// Runs the real IFCC pipeline on one file and prints it as JSON for the site:
// the IR after the optimisation passes (with operators, which the -d dump leaves out),
// the C line each IR instruction came from, the stack slot of every variable,
// and the x86-64 and RISC-V output with the IR item behind each assembly line.
// It links against the compiler's own object files and changes none of them.

#include "antlr4-runtime.h"
#include <algorithm>
#include <cstdint>
#include <exception>
#include <fstream>
#include <iostream>
#include <map>
#include <memory>
#include <optional>
#include <ostream>
#include <set>
#include <sstream>
#include <string>
#include <unordered_map>
#include <vector>

// The compiler keeps the state I need (current block, variable counter, a
// block's terminator, a visitor's stream) private, and I don't want to edit it.
#define private public
#define protected public
#include "ConstantPropagationVisitor.h"
#include "IRGenVisitor.h"
#include "IRx86Visitor.h"
#include "JumpBlocksVisitor.h"
#include "RV64Visitor.h"
#include "RemoveBlocksVisitor.h"
#include "UnusedAffectsRemoverVisitor.h"
#include "UserErrorReporter.h"
#include "ValidationVisitor.h"
#include "ifccLexer.h"
#include "ifccParser.h"
#undef private
#undef protected

struct VarInfo {
    std::string ir, name;
    int line;
    uint32_t slot;
};

struct BlockLines {
    std::vector<int> instrs;
    int next = 0;
};

// Records which C statement was being compiled when each IR instruction and
// each block terminator was created. Inner statements finish first, so they win.
class TracingGen : public IRGenVisitor {
public:
    using IRGenVisitor::IRGenVisitor;

    std::map<ir::BasicBlock *, BlockLines> lines;
    std::map<std::string, std::vector<VarInfo>> vars;

    antlrcpp::Any visitFunction(ifccParser::FunctionContext *ctx) override {
        functionLine = ctx->getStart()->getLine();
        std::string name = ctx->VARIABLE(0)->getText();
        int firstParam = counterVariables;
        nextLines.clear();
        claimedFunctionStart = false;

        antlrcpp::Any result = IRGenVisitor::visitFunction(ctx);

        ir::CFG &cfg = *ir.back();
        Scope &top = cfg.getBlocks()[0]->getScope();
        for (size_t i = 1; i < ctx->VARIABLE().size(); ++i) {
            std::string id = "$" + std::to_string(firstParam + i - 1);
            vars[name].push_back({id, ctx->VARIABLE(i)->getText(), functionLine,
                                  top.getVariable(id).value().second});
        }
        for (auto &b : cfg.getBlocks()) {
            BlockLines &l = lines[b.get()];
            l.instrs.resize(b->instrs.size(), 0);
            auto it = nextLines.find(b->next.get());
            l.next = it != nextLines.end() ? it->second : functionLine;
        }
        return result;
    }

    antlrcpp::Any visitDeclaAffect(ifccParser::DeclaAffectContext *ctx) override {
        std::string id = "$" + std::to_string(counterVariables);
        antlrcpp::Any result = IRGenVisitor::visitDeclaAffect(ctx);
        vars[currentFunction->getName()].push_back(
            {id, ctx->VARIABLE()->getText(), (int)ctx->getStart()->getLine(),
             currentBlock->getScope().getVariable(id).value().second});
        return result;
    }

    antlrcpp::Any visitStatement(ifccParser::StatementContext *ctx) override {
        if (!claimedFunctionStart) {
            claimedFunctionStart = true;
            claim({}, functionLine);
        }
        int line = ctx->getStart()->getLine();
        Snapshot before = snapshot();
        try {
            antlrcpp::Any result = IRGenVisitor::visitStatement(ctx);
            claimPendingJumps();
            claim(before, line);
            return result;
        } catch (...) {
            // break and continue only get their jump once the enclosing loop
            // or switch catches the exception, so remember where they were.
            if (ctx->break_stmt() || ctx->continue_stmt()) {
                pending.push_back({currentBlock, line});
            }
            claim(before, line);
            throw;
        }
    }

private:
    using Snapshot = std::map<ir::BasicBlock *, std::pair<size_t, const void *>>;

    int functionLine = 0;
    bool claimedFunctionStart = false;
    std::map<const void *, int> nextLines;
    std::vector<std::pair<ir::BasicBlock *, int>> pending;

    std::vector<ir::BasicBlock *> liveBlocks() {
        std::vector<ir::BasicBlock *> out;
        for (auto &b : currentFunction->getBlocks()) out.push_back(b.get());
        out.push_back(&currentFunction->getEpilogue());
        return out;
    }

    Snapshot snapshot() {
        Snapshot s;
        for (auto *b : liveBlocks()) s[b] = {b->instrs.size(), b->next.get()};
        return s;
    }

    void claim(const Snapshot &before, int line) {
        std::map<const void *, int> live;
        for (auto *b : liveBlocks()) {
            auto old = before.find(b);
            size_t from = old == before.end() ? 0 : old->second.first;
            BlockLines &l = lines[b];
            l.instrs.resize(b->instrs.size(), 0);
            for (size_t i = from; i < b->instrs.size(); ++i) {
                if (!l.instrs[i]) l.instrs[i] = line;
            }
            const void *n = b->next.get();
            if (!n) continue;
            auto known = nextLines.find(n);
            if (known != nextLines.end()) {
                live[n] = known->second;
            } else if (old == before.end() || old->second.second != n) {
                live[n] = line;
            }
        }
        nextLines = live;
    }

    void claimPendingJumps() {
        for (auto &[block, line] : pending) {
            const void *n = block->next.get();
            if (n) nextLines[n] = line;
        }
        pending.clear();
    }
};

std::string target(ir::IRInstr *i) {
    if (auto a = dynamic_cast<ir::Affect *>(i)) return a->getTo();
    if (auto a = dynamic_cast<ir::AffectConst *>(i)) return a->getTo();
    if (auto a = dynamic_cast<ir::BinOp *>(i)) return a->getTo();
    if (auto a = dynamic_cast<ir::UnaryOp *>(i)) return a->getTo();
    if (auto a = dynamic_cast<ir::Call *>(i)) return a->getRet();
    return "";
}

// The passes replace instructions in place, insert one after a post-increment
// or drop dead ones, and every IR instruction writes one variable. So a pass
// is an edit of the list of written variables, and a longest common
// subsequence tells which old instruction each new one stands for.
void runPass(ir::Prog &prog, IRBaseVisitor &pass,
             std::map<ir::BasicBlock *, BlockLines> &lines) {
    std::map<ir::BasicBlock *, std::vector<std::string>> before;
    for (auto &cfg : prog)
        for (auto &b : cfg->getBlocks())
            for (auto &i : b->instrs) before[b.get()].push_back(target(i.get()));

    for (auto &cfg : prog) cfg->visitBlocks(pass);

    for (auto &cfg : prog) {
        for (auto &b : cfg->getBlocks()) {
            const auto &a = before[b.get()];
            std::vector<std::string> c;
            for (auto &i : b->instrs) c.push_back(target(i.get()));
            const auto &oldLines = lines[b.get()].instrs;
            size_t n = a.size(), m = c.size();
            std::vector<std::vector<int>> dp(n + 1, std::vector<int>(m + 1, 0));
            for (size_t x = n; x-- > 0;)
                for (size_t y = m; y-- > 0;)
                    dp[x][y] = a[x] == c[y] ? dp[x + 1][y + 1] + 1
                                            : std::max(dp[x + 1][y], dp[x][y + 1]);
            std::vector<int> newLines(m, 0);
            size_t x = 0, y = 0;
            while (x < n && y < m) {
                if (a[x] == c[y]) {
                    newLines[y++] = oldLines[x++];
                } else if (dp[x + 1][y] >= dp[x][y + 1]) {
                    ++x;
                } else {
                    ++y;
                }
            }
            for (size_t k = 0; k < m; ++k)
                if (!newLines[k]) newLines[k] = k ? newLines[k - 1] : 0;
            for (size_t k = m; k-- > 0;)
                if (!newLines[k] && k + 1 < m) newLines[k] = newLines[k + 1];
            lines[b.get()].instrs = newLines;
        }
    }
}

struct Span {
    std::string func, block, kind;
    int index;
    size_t from, to;
};

// Wraps a real backend and notes where each IR item's assembly starts and ends.
template <class Backend> class Traced : public Backend {
public:
    explicit Traced(std::ostringstream &out) : Backend(out), out(out) {}

    std::ostringstream &out;
    std::vector<Span> spans;

    void visitCFG(ir::CFG &cfg) override {
        func = cfg.getName();
        block.clear();
        cfgStart = pos();
        Backend::visitCFG(cfg);
    }
    void visitBasicBlock(ir::BasicBlock &bb) override {
        if (block.empty()) spans.push_back({func, "", "prologue", -1, cfgStart, pos()});
        block = bb.getName();
        index = 0;
        size_t start = pos();
        Backend::visitBasicBlock(bb);
        spans.push_back({func, block, "block", -1, start, pos()});
    }
    void visitAffect(ir::Affect &i) override { instr([&] { Backend::visitAffect(i); }); }
    void visitAffectConst(ir::AffectConst &i) override {
        instr([&] { Backend::visitAffectConst(i); });
    }
    void visitBinOp(ir::BinOp &i) override { instr([&] { Backend::visitBinOp(i); }); }
    void visitUnaryOp(ir::UnaryOp &i) override { instr([&] { Backend::visitUnaryOp(i); }); }
    void visitCall(ir::Call &i) override { instr([&] { Backend::visitCall(i); }); }
    void visitUnconditionalJump(ir::UnconditionalJump &j) override {
        next([&] { Backend::visitUnconditionalJump(j); });
    }
    void visitConditionalJump(ir::ConditionalJump &j) override {
        next([&] { Backend::visitConditionalJump(j); });
    }
    void visitSwitchJump(ir::SwitchJump &j) override {
        next([&] { Backend::visitSwitchJump(j); });
    }
    void visitReturn(ir::Return &r) override { next([&] { Backend::visitReturn(r); }); }

private:
    std::string func, block;
    int index = 0;
    size_t cfgStart = 0;

    size_t pos() { return (size_t)out.tellp(); }
    template <class F> void instr(F emit) {
        size_t start = pos();
        emit();
        spans.push_back({func, block, "instr", index++, start, pos()});
    }
    template <class F> void next(F emit) {
        size_t start = pos();
        emit();
        spans.push_back({func, block, "next", -1, start, pos()});
    }
};

std::string json(const std::string &s) {
    std::string out = "\"";
    for (char c : s) {
        switch (c) {
        case '"': out += "\\\""; break;
        case '\\': out += "\\\\"; break;
        case '\n': out += "\\n"; break;
        case '\t': out += "\\t"; break;
        default:
            if ((unsigned char)c < 0x20) {
                char buf[8];
                snprintf(buf, sizeof buf, "\\u%04x", c);
                out += buf;
            } else {
                out += c;
            }
        }
    }
    return out + "\"";
}

const char *binOpName(ir::BinOp::BinOpType t) {
    static const char *names[] = {"ADD", "SUB", "DIV", "MUL", "MOD", "SHIFT_R",
                                  "SHIFT_L", "GT", "LT", "GTE", "LTE", "EQ",
                                  "NEQ", "AND_BIN", "OR_BIN", "XOR_BIN"};
    return names[t];
}

const char *unaryOpName(ir::UnaryOp::UnaryOpType t) {
    static const char *names[] = {"NEG", "NOT", "PRE_INC", "PRE_DEC", "POST_INC", "POST_DEC"};
    return names[t];
}

class Json {
public:
    std::ostringstream os;

    void slots(ir::BasicBlock &b, const std::vector<std::string> &names) {
        os << ",\"slots\":{";
        std::set<std::string> seen;
        bool first = true;
        for (auto &n : names) {
            if (!seen.insert(n).second) continue;
            auto v = b.getScope().getVariable(n);
            if (!v) continue;
            os << (first ? "" : ",") << json(n) << ":" << v->second;
            first = false;
        }
        os << "}";
    }

    void line(int l) {
        os << ",\"line\":";
        if (l) os << l; else os << "null";
    }

    void instr(ir::BasicBlock &b, ir::IRInstr *i, int l) {
        if (auto a = dynamic_cast<ir::Affect *>(i)) {
            os << "{\"op\":\"copy\",\"to\":" << json(a->getTo()) << ",\"from\":" << json(a->getFrom());
            slots(b, {a->getTo(), a->getFrom()});
        } else if (auto a = dynamic_cast<ir::AffectConst *>(i)) {
            os << "{\"op\":\"const\",\"to\":" << json(a->getTo()) << ",\"value\":" << a->getValue();
            slots(b, {a->getTo()});
        } else if (auto a = dynamic_cast<ir::BinOp *>(i)) {
            os << "{\"op\":\"bin\",\"kind\":\"" << binOpName(a->getType()) << "\",\"to\":" << json(a->getTo())
               << ",\"left\":" << json(a->getLeft()) << ",\"right\":" << json(a->getRight());
            slots(b, {a->getTo(), a->getLeft(), a->getRight()});
        } else if (auto a = dynamic_cast<ir::UnaryOp *>(i)) {
            os << "{\"op\":\"unary\",\"kind\":\"" << unaryOpName(a->getType()) << "\",\"to\":" << json(a->getTo())
               << ",\"from\":" << json(a->getFrom());
            slots(b, {a->getTo(), a->getFrom()});
        } else if (auto a = dynamic_cast<ir::Call *>(i)) {
            os << "{\"op\":\"call\",\"func\":" << json(a->getFunc_name()) << ",\"ret\":" << json(a->getRet())
               << ",\"args\":[";
            for (size_t k = 0; k < a->getNames().size(); ++k)
                os << (k ? "," : "") << json(a->getNames()[k]);
            os << "]";
            std::vector<std::string> names = a->getNames();
            names.push_back(a->getRet());
            slots(b, names);
        }
        line(l);
        os << "}";
    }

    void next(ir::BasicBlock &b, int l) {
        ir::Next *n = b.next.get();
        if (auto j = dynamic_cast<ir::UnconditionalJump *>(n)) {
            os << "{\"op\":\"jump\",\"to\":" << json(j->getTo().getName());
            slots(b, {});
        } else if (auto j = dynamic_cast<ir::ConditionalJump *>(n)) {
            os << "{\"op\":\"branch\",\"cond\":" << json(j->getCondition()) << ",\"then\":"
               << json(j->getThen()->getName()) << ",\"else\":" << json(j->getElse()->getName());
            slots(b, {j->getCondition()});
        } else if (auto j = dynamic_cast<ir::SwitchJump *>(n)) {
            os << "{\"op\":\"switch\",\"test\":" << json(j->getExpressionTest()) << ",\"cases\":[";
            bool first = true;
            for (auto &[value, block] : j->getCaseTests()) {
                os << (first ? "" : ",") << "{\"value\":" << json(value) << ",\"to\":" << json(block->getName()) << "}";
                first = false;
            }
            os << "],\"default\":" << json(j->getDefaultBlock()->getName());
            slots(b, {j->getExpressionTest()});
        } else {
            os << "{\"op\":\"ret\"";
            slots(b, {"#return"});
        }
        line(l);
        os << "}";
    }
};

template <class Backend> void emitAsm(Json &j, ir::Prog &prog) {
    std::ostringstream out;
    Traced<Backend> backend(out);
    for (auto &cfg : prog) cfg->visitBlocks(backend);
    std::string text = out.str();
    auto lineAt = [&](size_t offset) { return std::count(text.begin(), text.begin() + offset, '\n'); };
    j.os << "{\"text\":" << json(text) << ",\"spans\":[";
    bool first = true;
    for (auto &s : backend.spans) {
        j.os << (first ? "" : ",") << "{\"func\":" << json(s.func) << ",\"block\":" << json(s.block)
             << ",\"kind\":\"" << s.kind << "\",\"index\":" << s.index << ",\"from\":" << lineAt(s.from)
             << ",\"to\":" << lineAt(s.to) << "}";
        first = false;
    }
    j.os << "]}";
}

int main(int argc, char **argv) {
    if (argc != 2) {
        std::cerr << "usage: ifcc-export file.c\n";
        return 1;
    }
    std::ifstream file(argv[1]);
    std::stringstream in;
    in << file.rdbuf();

    antlr4::ANTLRInputStream input(in.str());
    ifccLexer lexer(&input);
    antlr4::CommonTokenStream tokens(&lexer);
    tokens.fill();
    ifccParser parser(&tokens);
    antlr4::tree::ParseTree *tree = parser.axiom();
    if (parser.getNumberOfSyntaxErrors() != 0) {
        std::cerr << "syntax error\n";
        return 1;
    }

    ir::Prog prog;
    UserErrorReporter reporter(in.str());
    ValidationVisitor validation(reporter);
    validation.visit(tree);
    TracingGen gen(prog);
    gen.visit(tree);

    // Same passes, same order and same visitor instances as the compiler's main().
    ConstantPropagationVisitor constants;
    UnusedAffectsRemoverVisitor unused;
    JumpBlocksVisitor jumps;
    RemoveBlocksVisitor unreachable;
    runPass(prog, constants, gen.lines);
    runPass(prog, unused, gen.lines);
    runPass(prog, jumps, gen.lines);
    runPass(prog, unreachable, gen.lines);

    Json j;
    j.os << "{\"functions\":[";
    for (size_t f = 0; f < prog.size(); ++f) {
        ir::CFG &cfg = *prog[f];
        j.os << (f ? "," : "") << "{\"name\":" << json(cfg.getName()) << ",\"args\":[";
        for (size_t k = 0; k < cfg.getArgs().size(); ++k)
            j.os << (k ? "," : "") << json(cfg.getArgs()[k].first);
        j.os << "],\"frameSize\":" << cfg.getSize()
             << ",\"returnSlot\":" << cfg.getEpilogue().getScope().getVariable("#return").value().second
             << ",\"vars\":[";
        auto &vars = gen.vars[cfg.getName()];
        for (size_t k = 0; k < vars.size(); ++k)
            j.os << (k ? "," : "") << "{\"ir\":" << json(vars[k].ir) << ",\"name\":" << json(vars[k].name)
                 << ",\"line\":" << vars[k].line << ",\"slot\":" << vars[k].slot << "}";
        j.os << "],\"blocks\":[";
        for (size_t k = 0; k < cfg.getBlocks().size(); ++k) {
            ir::BasicBlock &b = *cfg.getBlocks()[k];
            BlockLines &l = gen.lines[&b];
            j.os << (k ? "," : "") << "{\"name\":" << json(b.getName()) << ",\"instrs\":[";
            for (size_t i = 0; i < b.instrs.size(); ++i) {
                if (i) j.os << ",";
                j.instr(b, b.instrs[i].get(), l.instrs[i]);
            }
            j.os << "],\"next\":";
            j.next(b, l.next);
            j.os << "}";
        }
        j.os << "]}";
    }
    j.os << "],\"asm\":{\"x86\":";

    // The x86 backend prints a trace line on stderr for every copy.
    std::ostringstream discard;
    std::streambuf *stderrBuf = std::cerr.rdbuf(discard.rdbuf());
    emitAsm<IRx86Visitor>(j, prog);
    std::cerr.rdbuf(stderrBuf);

    j.os << ",\"rv64\":";
    emitAsm<RV64Visitor>(j, prog);
    j.os << "}}\n";
    std::cout << j.os.str();
    return 0;
}

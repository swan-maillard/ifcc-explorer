import type { BinKind, Block, Func, Instr, Next, Program, UnaryKind } from "./types";

export const binSymbol: Record<BinKind, string> = {
  ADD: "+", SUB: "-", MUL: "*", DIV: "/", MOD: "%",
  SHIFT_L: "<<", SHIFT_R: ">>",
  GT: ">", LT: "<", GTE: ">=", LTE: "<=", EQ: "==", NEQ: "!=",
  AND_BIN: "&", OR_BIN: "|", XOR_BIN: "^",
};

const unarySymbol: Record<UnaryKind, (v: string) => string> = {
  NEG: (v) => `-${v}`,
  NOT: (v) => `!${v}`,
  PRE_INC: (v) => `++${v}`,
  PRE_DEC: (v) => `--${v}`,
  POST_INC: (v) => `${v}++`,
  POST_DEC: (v) => `${v}--`,
};

export function formatInstr(i: Instr): string {
  switch (i.op) {
    case "const": return `${i.to} = ${i.value}`;
    case "copy": return `${i.to} = ${i.from}`;
    case "bin": return `${i.to} = ${i.left} ${binSymbol[i.kind]} ${i.right}`;
    case "unary": return `${i.to} = ${unarySymbol[i.kind](i.from)}`;
    case "call": return `${i.ret} = ${i.func}(${i.args.join(", ")})`;
  }
}

export function formatNext(n: Next): string {
  switch (n.op) {
    case "jump": return `j ${n.to}`;
    case "branch": return `j ${n.then} if ${n.cond} else ${n.else}`;
    case "switch": return `switch (${n.test})`;
    case "ret": return "ret";
  }
}

export function successors(n: Next): { to: string; label: string }[] {
  switch (n.op) {
    case "jump": return [{ to: n.to, label: "" }];
    case "branch": return [
      { to: n.then, label: "true" },
      { to: n.else, label: "false" },
    ];
    case "switch": return [
      ...n.cases.map((c) => ({ to: c.to, label: `case ${c.value}` })),
      { to: n.default, label: "default" },
    ];
    case "ret": return [];
  }
}

// Prints the IR exactly like the compiler's DebugVisitor (ifcc -d), which
// drops the operators. Used by the tests to check the JSON against the real dump.
export function debugDump(program: Program): string {
  return program.functions.map(dumpFunc).join("");
}

function dumpFunc(f: Func): string {
  const args = f.args.map((a) => `${a}, `).join("");
  return `${f.name}(${args}) {\n${f.blocks.map(dumpBlock).join("")}}\n`;
}

function dumpBlock(b: Block): string {
  const lines = [`${b.name}:`, ...b.instrs.map(dumpInstr), ...dumpNext(b.next)];
  return lines.map((l) => `    ${l}\n`).join("") + "\n";
}

function dumpInstr(i: Instr): string {
  switch (i.op) {
    case "const": return `${i.to} = ${i.value}`;
    case "copy": return `${i.to} = ${i.from}`;
    case "bin": return `${i.to} = (${i.left}, ${i.right})`;
    case "unary": return `${i.to} = (${i.from})`;
    case "call": return `${i.ret} = ${i.func}(${i.args.map((a) => `${a}, `).join("")})`;
  }
}

function dumpNext(n: Next): string[] {
  switch (n.op) {
    case "jump": return [`j ${n.to}`];
    case "branch": return [`j ${n.then} if ${n.cond} else ${n.else}`];
    case "switch": return [
      `switch (${n.test}) {`,
      ...n.cases.map((c) => `    ${c.value} : ${c.to}`),
      `    default : ${n.default}`,
      "}",
    ];
    case "ret": return ["ret"];
  }
}

/** The C name behind an IR variable, if it has one ($ names are declared variables, # are temporaries). */
export function cName(f: Func, irName: string): string | undefined {
  return f.vars.find((v) => v.ir === irName)?.name;
}

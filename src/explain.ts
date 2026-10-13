// The sentences in the side panel. They only restate what the data says.

import { binSymbol, cName, formatInstr } from "./ir";
import type { Event, Step, Trace } from "./interp";
import { asmForBlock, asmForItem, findBlock, linksFor, itemsOnLine, lineOf, spanAt, type Focus } from "./links";
import type { Backend, Func, ItemRef, Next, Program } from "./types";

export const backendName: Record<Backend, string> = { x86: "x86-64", rv64: "RISC-V" };

export const slotText = (backend: Backend, slot: number) => (backend === "x86" ? `-${slot}[rbp]` : `-${slot}(s0)`);

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function list(words: string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

function funcOf(program: Program, name: string): Func {
  return program.functions.find((f) => f.name === name)!;
}

/** "$0 (a)" for declared variables, the bare name for temporaries. */
export function named(f: Func, irName: string): string {
  const c = cName(f, irName);
  return c ? `${irName} (${c})` : irName;
}

function sourceLine(program: Program, line: number): string {
  return program.source.split("\n")[line - 1]?.trim() ?? "";
}

function describeNext(f: Func, n: Next): string {
  switch (n.op) {
    case "jump": return `a jump to ${n.to}`;
    case "branch": return `a test of ${named(f, n.cond)}: ${n.then} if it isn't zero, ${n.else} if it is`;
    case "switch": return `a switch on ${named(f, n.test)} with ${plural(n.cases.length, "case")} and a default`;
    case "ret": return "ret, which hands the value in #return back to the caller";
  }
}

function itemText(program: Program, item: ItemRef): string {
  const b = findBlock(program, item.func, item.block)!;
  if (item.index >= 0) return `\`${formatInstr(b.instrs[item.index])}\``;
  return describeNext(funcOf(program, item.func), b.next);
}

export function describeFocus(program: Program, backend: Backend, focus: Focus): string {
  const be = backendName[backend];
  switch (focus.kind) {
    case "line": {
      const code = sourceLine(program, focus.line);
      const items = itemsOnLine(program, focus.line);
      if (items.length === 0) {
        if (/^(case|default)\b/.test(code)) {
          return `Line ${focus.line}, \`${code}\`, has no IR instruction of its own. Its value lives in the switch that jumps here.`;
        }
        return `Line ${focus.line}${code ? `, \`${code}\`,` : ""} has no IR instruction of its own.`;
      }
      const instrs = items.filter((i) => i.index >= 0).length;
      const jumps = items.length - instrs;
      const blocks = [...new Set(items.map((i) => i.block))];
      const asm = new Set(items.flatMap((i) => asmForItem(program, backend, i))).size;
      const parts = [instrs && plural(instrs, "IR instruction"), jumps && plural(jumps, "block ending")].filter(Boolean);
      return `Line ${focus.line}, \`${code}\`, became ${list(parts as string[])} in ${list(blocks)}. That's ${plural(asm, "line")} of ${be}.`;
    }
    case "block": {
      const f = funcOf(program, focus.func);
      const b = f.blocks.find((x) => x.name === focus.block)!;
      const lines = [...new Set(b.instrs.map((i) => i.line).filter((l): l is number => l !== null))];
      const from = lines.length ? `, from ${lines.length === 1 ? "line" : "lines"} ${list(lines.map(String))},` : "";
      const asm = asmForBlock(program, backend, f.name, b.name).length;
      return `${b.name} has ${plural(b.instrs.length, "instruction")}${from} and ends with ${describeNext(f, b.next)}. In ${be} it starts at the ${b.name} label and takes ${plural(asm, "line")}.`;
    }
    case "item": {
      const line = lineOf(program, focus.item);
      const asm = asmForItem(program, backend, focus.item).length;
      const from = line ? ` comes from line ${line}, \`${sourceLine(program, line)}\`,` : "";
      return `${capitalise(itemText(program, focus.item))}${from} and takes ${plural(asm, "line")} of ${be}.${slotsSentence(program, backend, focus.item)}`;
    }
    case "asm": {
      const asmLine = program.asm[backend].text.split("\n")[focus.line]?.trim() ?? "";
      const text = `\`${asmLine}\``;
      const span = spanAt(program, backend, focus.line);
      if (!span) return `${text} is part of the file header, not of any function.`;
      if (span.kind === "prologue") {
        return `${text} is part of the prologue of ${span.func}. It sets up the stack frame that holds the variables before the first block runs. The backend adds it, so nothing in the IR maps to it.`;
      }
      if (span.kind === "block") {
        return `${text} is the label of block ${span.block}. The IR and the assembly use the same name, which is how jumps line up between them.`;
      }
      const item = { func: span.func, block: span.block, index: span.kind === "instr" ? span.index : -1 };
      const h = linksFor(program, backend, { kind: "item", item });
      const line = [...h.lines][0];
      const from = line ? `, from line ${line} of the C` : "";
      return `${text} is part of ${itemText(program, item)} in ${span.block}${from}.${slotsSentence(program, backend, item, asmLine)}`;
    }
  }
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Says where named variables live on the stack, or only the slot the assembly line mentions.
function slotsSentence(program: Program, backend: Backend, item: ItemRef, asmLine?: string): string {
  const b = findBlock(program, item.func, item.block)!;
  const f = funcOf(program, item.func);
  const slots = item.index >= 0 ? b.instrs[item.index].slots : b.next.slots;
  let entries = Object.entries(slots);
  if (asmLine) {
    const m = asmLine.match(/-(\d+)(\[rbp\]|\(s0\))/);
    if (!m) return "";
    entries = entries.filter(([, s]) => s === Number(m[1]));
  } else {
    entries = entries.filter(([n]) => cName(f, n));
  }
  if (entries.length === 0) return "";
  const parts = entries.map(([n, s]) => `${named(f, n)} lives at ${slotText(backend, s)}`);
  return ` ${capitalise(list(parts))}.`;
}

export function describeStep(program: Program, trace: Trace, index: number): string {
  const step = trace.steps[index];
  const event = step.event;
  if (!event) return "";
  const before = index > 0 ? trace.steps[index - 1] : step;
  const what = describeEvent(program, event, before, trace, step);
  if (!step.at || event.kind === "start") return what;
  return `${what} Next, in ${step.at.block}: ${itemText(program, step.at)}.`;
}

function describeEvent(program: Program, event: Event, before: Step, trace: Trace, step: Step): string {
  switch (event.kind) {
    case "start":
      return `main starts at ${step.at!.block}. Nothing has run yet. Press Step to watch the values change.`;
    case "write": {
      const f = funcOf(program, event.item.func);
      const to = named(f, event.to);
      const i = event.instr;
      if (i.op === "const") return `${to} gets ${event.value}.`;
      if (i.op === "copy") return `${to} gets a copy of ${named(f, i.from)}, which is ${event.value}.`;
      if (i.op === "bin") {
        return `${to} = ${event.inputs[0][1]} ${binSymbol[i.kind]} ${event.inputs[1][1]}, which is ${event.value}.`;
      }
      if (i.op === "unary") {
        const from = named(f, i.from);
        const old = event.inputs[0][1];
        switch (i.kind) {
          case "PRE_INC": return `${from} goes up by one, from ${old} to ${event.value}.`;
          case "PRE_DEC": return `${from} goes down by one, from ${old} to ${event.value}.`;
          case "POST_INC": return `${to} keeps the old value ${old}, then ${from} goes up to ${old + 1}.`;
          case "POST_DEC": return `${to} keeps the old value ${old}, then ${from} goes down to ${old - 1}.`;
          case "NEG": return `${to} = -${old}, which is ${event.value}.`;
          case "NOT": return `${to} = !${old}, which is ${event.value}.`;
        }
      }
      return "";
    }
    case "call": {
      const callee = funcOf(program, event.callee);
      const params = callee.args.map((a, k) => `${cName(callee, a) ?? a} = ${event.args[k]}`);
      return `${event.item.func} calls ${event.callee}(${event.args.join(", ")}). ${event.callee} gets a new stack frame of its own${params.length ? `, with ${list(params)}` : ""}.`;
    }
    case "jump": {
      const f = funcOf(program, event.item.func);
      const n = event.next;
      if (n.op === "branch" && event.tested) {
        const { name, value } = event.tested;
        return value !== 0
          ? `${named(f, name)} is ${value}, not zero, so ${event.item.block} goes on to ${event.to}.`
          : `${named(f, name)} is 0, so ${event.item.block} goes on to ${event.to}.`;
      }
      if (n.op === "switch" && event.tested) {
        const { name, value, matched } = event.tested;
        return matched !== undefined
          ? `${named(f, name)} is ${value}, which matches case ${matched}, so the switch jumps to ${event.to}.`
          : `${named(f, name)} is ${value} and no case matches, so the switch jumps to the default, ${event.to}.`;
      }
      return `${event.item.block} jumps to ${event.to}.`;
    }
    case "return": {
      if (event.to) {
        const caller = before.frames[before.frames.length - 2];
        const callBlock = findBlock(program, caller.func, caller.block)!;
        const call = callBlock.instrs[caller.index];
        const into = call && call.op === "call" ? `, which stores it in ${call.ret}` : "";
        return `${event.func} returns ${event.value} to ${event.to}${into}. Its stack frame is gone.`;
      }
      const gcc = program.runs.gcc.exit;
      const code = event.value !== trace.exitCode
        ? `Exit codes only keep the low 8 bits, so the process exits with ${trace.exitCode}`
        : `The exit code is ${trace.exitCode}`;
      const check = trace.exitCode === gcc ? `the same as with GCC` : `but with GCC it exits with ${gcc}`;
      return `main returns ${event.value}. ${code}, ${check}.`;
    }
  }
}

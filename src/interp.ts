import type { BinKind, Func, Instr, ItemRef, Next, Program } from "./types";

// Memory is keyed by stack slot, like the generated code: two IR names that the
// compiler put in the same slot really do share a value.
export type Memory = Map<number, number>;

export interface Frame {
  func: Func;
  block: string;
  index: number; // next instruction to run, -1 for the terminator
  memory: Memory;
}

export interface Step {
  /** The IR item about to run, or null once main has returned. */
  at: ItemRef | null;
  /** Call stack, innermost last, copied so each step keeps its own values. */
  frames: { func: string; block: string; index: number; memory: Record<number, number> }[];
  /** What the previous item did, for the explanation panel. */
  event: Event | null;
}

export type Event =
  | { kind: "start" }
  | { kind: "write"; item: ItemRef; instr: Instr; to: string; value: number; inputs: [string, number][] }
  | { kind: "call"; item: ItemRef; callee: string; args: number[] }
  | { kind: "jump"; item: ItemRef; next: Next; to: string; tested?: { name: string; value: number; matched?: string } }
  | { kind: "return"; item: ItemRef; func: string; value: number; to: string | null };

export interface Trace {
  steps: Step[];
  returned: number;
  exitCode: number;
}

const MAX_STEPS = 20000;

export function run(program: Program): Trace {
  const funcs = new Map(program.functions.map((f) => [f.name, f]));
  const main = funcs.get("main");
  if (!main) throw new Error("no main function");

  const mainFrame = enter(main, []);
  // The x86 prologue of main stores 0 in #return before anything else.
  mainFrame.memory.set(main.returnSlot, 0);
  const stack: Frame[] = [mainFrame];
  const steps: Step[] = [snapshot(stack, { kind: "start" })];
  let returned: number | null = null;

  while (returned === null) {
    if (steps.length > MAX_STEPS) throw new Error("too many steps");
    const frame = stack[stack.length - 1];
    const block = findBlock(frame.func, frame.block);
    const item: ItemRef = { func: frame.func.name, block: frame.block, index: frame.index };
    let event: Event;

    if (frame.index >= 0 && frame.index < block.instrs.length) {
      const instr = block.instrs[frame.index];
      if (instr.op === "call") {
        const callee = funcs.get(instr.func);
        if (!callee) throw new Error(`call to unknown function ${instr.func}`);
        const args = instr.args.map((a) => read(frame, instr.slots, a));
        stack.push(enter(callee, args));
        event = { kind: "call", item, callee: callee.name, args };
      } else {
        event = execute(frame, instr, item);
        advance(frame, block.instrs.length);
      }
    } else {
      const next = block.next;
      if (next.op === "ret") {
        const value = read(frame, next.slots, "#return");
        stack.pop();
        const caller = stack[stack.length - 1];
        if (caller) {
          const callBlock = findBlock(caller.func, caller.block);
          const call = callBlock.instrs[caller.index];
          if (call.op !== "call") throw new Error("return to a non-call");
          write(caller, call.slots, call.ret, value);
          advance(caller, callBlock.instrs.length);
        } else {
          returned = value;
        }
        event = { kind: "return", item, func: frame.func.name, value, to: caller ? caller.func.name : null };
      } else {
        event = jump(frame, next, item);
      }
    }
    steps.push(snapshot(returned === null ? stack : [frame], event, returned !== null));
  }

  return { steps, returned, exitCode: returned & 0xff };
}

function enter(func: Func, args: number[]): Frame {
  const frame: Frame = { func, block: func.blocks[0].name, index: 0, memory: new Map() };
  func.args.forEach((name, i) => {
    const param = func.vars.find((v) => v.ir === name);
    if (!param) throw new Error(`no slot for parameter ${name}`);
    frame.memory.set(param.slot, args[i]);
  });
  if (func.blocks[0].instrs.length === 0) frame.index = -1;
  return frame;
}

function findBlock(func: Func, name: string) {
  const block = func.blocks.find((b) => b.name === name);
  if (!block) throw new Error(`no block ${name} in ${func.name}`);
  return block;
}

function advance(frame: Frame, count: number) {
  frame.index = frame.index + 1 < count ? frame.index + 1 : -1;
}

function slotOf(slots: Record<string, number>, name: string): number {
  const slot = slots[name];
  if (slot === undefined) throw new Error(`no slot for ${name}`);
  return slot;
}

function read(frame: Frame, slots: Record<string, number>, name: string): number {
  const value = frame.memory.get(slotOf(slots, name));
  if (value === undefined) throw new Error(`${name} is read before it is written`);
  return value;
}

function write(frame: Frame, slots: Record<string, number>, name: string, value: number) {
  frame.memory.set(slotOf(slots, name), value | 0);
}

function execute(frame: Frame, instr: Exclude<Instr, { op: "call" }>, item: ItemRef): Event {
  const get = (name: string): [string, number] => [name, read(frame, instr.slots, name)];
  let inputs: [string, number][] = [];
  let value: number;

  switch (instr.op) {
    case "const":
      value = instr.value;
      break;
    case "copy":
      inputs = [get(instr.from)];
      value = inputs[0][1];
      break;
    case "bin":
      inputs = [get(instr.left), get(instr.right)];
      value = binary(instr.kind, inputs[0][1], inputs[1][1]);
      break;
    case "unary": {
      inputs = [get(instr.from)];
      const v = inputs[0][1];
      switch (instr.kind) {
        case "NEG": value = -v; break;
        case "NOT": value = v === 0 ? 1 : 0; break;
        case "PRE_INC": value = v + 1; break;
        case "PRE_DEC": value = v - 1; break;
        case "POST_INC":
        case "POST_DEC":
          // to gets the old value, then from is incremented or decremented
          write(frame, instr.slots, instr.to, v);
          write(frame, instr.slots, instr.from, instr.kind === "POST_INC" ? v + 1 : v - 1);
          return { kind: "write", item, instr, to: instr.to, value: v, inputs };
      }
      break;
    }
  }
  write(frame, instr.slots, instr.to, value);
  return { kind: "write", item, instr, to: instr.to, value: value | 0, inputs };
}

export function binary(kind: BinKind, a: number, b: number): number {
  switch (kind) {
    case "ADD": return (a + b) | 0;
    case "SUB": return (a - b) | 0;
    case "MUL": return Math.imul(a, b);
    case "DIV":
      if (b === 0) throw new Error("division by zero");
      return Math.trunc(a / b) | 0;
    case "MOD":
      if (b === 0) throw new Error("division by zero");
      return a % b | 0;
    case "SHIFT_L": return a << b;
    case "SHIFT_R": return a >> b;
    case "GT": return a > b ? 1 : 0;
    case "LT": return a < b ? 1 : 0;
    case "GTE": return a >= b ? 1 : 0;
    case "LTE": return a <= b ? 1 : 0;
    case "EQ": return a === b ? 1 : 0;
    case "NEQ": return a !== b ? 1 : 0;
    case "AND_BIN": return a & b;
    case "OR_BIN": return a | b;
    case "XOR_BIN": return a ^ b;
  }
}

// Case values are the source text of the constant: a number or a 'c' character.
function caseValue(text: string): number {
  return text.startsWith("'") ? text.charCodeAt(1) : parseInt(text, 10);
}

function jump(frame: Frame, next: Exclude<Next, { op: "ret" }>, item: ItemRef): Event {
  let to: string;
  let tested: { name: string; value: number; matched?: string } | undefined;
  if (next.op === "jump") {
    to = next.to;
  } else if (next.op === "branch") {
    const value = read(frame, next.slots, next.cond);
    to = value !== 0 ? next.then : next.else;
    tested = { name: next.cond, value };
  } else {
    const value = read(frame, next.slots, next.test);
    const hit = next.cases.find((c) => caseValue(c.value) === value);
    to = hit ? hit.to : next.default;
    tested = { name: next.test, value, matched: hit?.value };
  }
  frame.block = to;
  frame.index = findBlock(frame.func, to).instrs.length > 0 ? 0 : -1;
  return { kind: "jump", item, next, to, tested };
}

function snapshot(stack: Frame[], event: Event, done = false): Step {
  const top = stack[stack.length - 1];
  return {
    at: done ? null : { func: top.func.name, block: top.block, index: top.index },
    frames: stack.map((f) => ({ func: f.func.name, block: f.block, index: f.index, memory: Object.fromEntries(f.memory) })),
    event,
  };
}

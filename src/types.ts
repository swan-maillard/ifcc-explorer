export type BinKind =
  | "ADD" | "SUB" | "DIV" | "MUL" | "MOD" | "SHIFT_R" | "SHIFT_L"
  | "GT" | "LT" | "GTE" | "LTE" | "EQ" | "NEQ"
  | "AND_BIN" | "OR_BIN" | "XOR_BIN";

export type UnaryKind = "NEG" | "NOT" | "PRE_INC" | "PRE_DEC" | "POST_INC" | "POST_DEC";

type Slots = { slots: Record<string, number>; line: number | null };

export type Instr = Slots &
  (
    | { op: "const"; to: string; value: number }
    | { op: "copy"; to: string; from: string }
    | { op: "bin"; kind: BinKind; to: string; left: string; right: string }
    | { op: "unary"; kind: UnaryKind; to: string; from: string }
    | { op: "call"; func: string; ret: string; args: string[] }
  );

export type Next = Slots &
  (
    | { op: "jump"; to: string }
    | { op: "branch"; cond: string; then: string; else: string }
    | { op: "switch"; test: string; cases: { value: string; to: string }[]; default: string }
    | { op: "ret" }
  );

export interface Block {
  name: string;
  instrs: Instr[];
  next: Next;
}

export interface Var {
  ir: string;
  name: string;
  line: number;
  slot: number;
}

export interface Func {
  name: string;
  args: string[];
  frameSize: number;
  returnSlot: number;
  vars: Var[];
  blocks: Block[];
}

export type Backend = "x86" | "rv64";

export interface AsmSpan {
  func: string;
  block: string;
  kind: "prologue" | "block" | "instr" | "next";
  index: number;
  from: number;
  to: number;
}

export interface Run {
  exit: number;
  stdout: string;
}

export interface Program {
  id: string;
  path: string;
  source: string;
  dump: string;
  functions: Func[];
  asm: Record<Backend, { text: string; spans: AsmSpan[] }>;
  runs: { gcc: Run; x86: Run; rv64: Run };
}

/** One IR item: an instruction (index >= 0) or the block's terminator (index -1). */
export interface ItemRef {
  func: string;
  block: string;
  index: number;
}

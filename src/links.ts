// Everything the three views share: which C line, IR items and assembly lines
// belong together. All of it comes from the exporter's data, nothing is guessed.

import type { AsmSpan, Backend, Block, Func, ItemRef, Program } from "./types";

export type Focus =
  | { kind: "line"; line: number }
  | { kind: "block"; func: string; block: string }
  | { kind: "item"; item: ItemRef }
  | { kind: "asm"; line: number };

export interface Highlight {
  lines: Set<number>;
  items: Set<string>;
  blocks: Set<string>;
  asm: Set<number>;
  func: string | null;
}

export const itemKey = (i: ItemRef) => `${i.func}/${i.block}/${i.index}`;
export const blockKey = (func: string, block: string) => `${func}/${block}`;

export function findBlock(program: Program, func: string, block: string): Block | undefined {
  return program.functions.find((f) => f.name === func)?.blocks.find((b) => b.name === block);
}

export function itemsOf(f: Func, b: Block): ItemRef[] {
  return [...b.instrs.map((_, index) => ({ func: f.name, block: b.name, index })), { func: f.name, block: b.name, index: -1 }];
}

export function lineOf(program: Program, item: ItemRef): number | null {
  const b = findBlock(program, item.func, item.block);
  if (!b) return null;
  return item.index >= 0 ? b.instrs[item.index].line : b.next.line;
}

export function itemsOnLine(program: Program, line: number): ItemRef[] {
  return program.functions.flatMap((f) =>
    f.blocks.flatMap((b) => itemsOf(f, b).filter((i) => lineOf(program, i) === line)),
  );
}

function spanLines(span: AsmSpan): number[] {
  return Array.from({ length: span.to - span.from }, (_, k) => span.from + k);
}

export function asmForItem(program: Program, backend: Backend, item: ItemRef): number[] {
  const kind = item.index >= 0 ? "instr" : "next";
  return program.asm[backend].spans
    .filter((s) => s.kind === kind && s.func === item.func && s.block === item.block && (kind === "next" || s.index === item.index))
    .flatMap(spanLines);
}

export function asmForBlock(program: Program, backend: Backend, func: string, block: string): number[] {
  return program.asm[backend].spans
    .filter((s) => s.kind === "block" && s.func === func && s.block === block)
    .flatMap(spanLines);
}

/** The smallest span around an assembly line: an instruction, a terminator, a block label or a prologue. */
export function spanAt(program: Program, backend: Backend, line: number): AsmSpan | undefined {
  return program.asm[backend].spans
    .filter((s) => s.from <= line && line < s.to)
    .sort((a, b) => a.to - a.from - (b.to - b.from))[0];
}

/** The C line of a function's signature: the exporter gives it to the epilogue's ret. */
export function functionLine(program: Program, func: string): number | null {
  const f = program.functions.find((x) => x.name === func);
  return f ? f.blocks[f.blocks.length - 1].next.line : null;
}

export function highlight(program: Program, backend: Backend, focus: Focus | null): Highlight {
  const h: Highlight = { lines: new Set(), items: new Set(), blocks: new Set(), asm: new Set(), func: null };
  if (!focus) return h;

  const addItem = (item: ItemRef) => {
    h.items.add(itemKey(item));
    h.blocks.add(blockKey(item.func, item.block));
    const line = lineOf(program, item);
    if (line) h.lines.add(line);
    asmForItem(program, backend, item).forEach((l) => h.asm.add(l));
    h.func ??= item.func;
  };

  switch (focus.kind) {
    case "line":
      h.lines.add(focus.line);
      itemsOnLine(program, focus.line).forEach(addItem);
      break;
    case "item":
      addItem(focus.item);
      break;
    case "block": {
      const f = program.functions.find((x) => x.name === focus.func);
      const b = f?.blocks.find((x) => x.name === focus.block);
      if (!f || !b) break;
      itemsOf(f, b).forEach((i) => {
        const line = lineOf(program, i);
        if (line) h.lines.add(line);
      });
      h.blocks.add(blockKey(f.name, b.name));
      asmForBlock(program, backend, f.name, b.name).forEach((l) => h.asm.add(l));
      h.func = f.name;
      break;
    }
    case "asm": {
      const span = spanAt(program, backend, focus.line);
      h.asm.add(focus.line);
      if (!span) break;
      if (span.kind === "instr" || span.kind === "next") {
        addItem({ func: span.func, block: span.block, index: span.kind === "instr" ? span.index : -1 });
      } else if (span.kind === "block") {
        const whole = highlight(program, backend, { kind: "block", func: span.func, block: span.block });
        whole.asm.add(focus.line);
        return whole;
      } else {
        const line = functionLine(program, span.func);
        if (line) h.lines.add(line);
        spanLines(span).forEach((l) => h.asm.add(l));
        h.func = span.func;
      }
      break;
    }
  }
  return h;
}

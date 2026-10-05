import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import programs from "../src/data/programs.json";
import { debugDump } from "../src/ir";
import type { Program } from "../src/types";

const raw = (id: string, ext: string) => readFileSync(new URL(`../data/raw/${id}${ext}`, import.meta.url), "utf8");

describe("programs.json matches what the compiler emitted", () => {
  for (const program of programs as Program[]) {
    describe(program.path, () => {
      it("has the test file's source", () => {
        expect(program.source).toBe(raw(program.id, ".c"));
      });

      it("has the assembly that ifcc wrote, byte for byte", () => {
        expect(program.asm.x86.text).toBe(raw(program.id, ".x86.s"));
        expect(program.asm.rv64.text).toBe(raw(program.id, ".rv64.s"));
      });

      it("has the IR that ifcc -d printed", () => {
        expect(debugDump(program)).toBe(raw(program.id, ".ir.txt"));
        expect(program.dump).toBe(raw(program.id, ".ir.txt"));
      });

      it("has the exit codes of the real runs", () => {
        expect(program.runs).toEqual(JSON.parse(raw(program.id, ".runs.json")));
      });

      it("maps every block to its label in both backends", () => {
        for (const backend of ["x86", "rv64"] as const) {
          const lines = program.asm[backend].text.split("\n");
          const blockSpans = program.asm[backend].spans.filter((s) => s.kind === "block");
          const blocks = program.functions.flatMap((f) => f.blocks.map((b) => b.name));
          expect(blockSpans.map((s) => s.block)).toEqual(blocks);
          for (const span of blockSpans) expect(lines[span.from]).toBe(`${span.block}:`);
        }
      });

      it("traces every IR instruction back to a line of C", () => {
        const lineCount = program.source.split("\n").length;
        for (const f of program.functions) {
          for (const b of f.blocks) {
            for (const item of [...b.instrs, b.next]) {
              expect(item.line).toBeGreaterThanOrEqual(1);
              expect(item.line).toBeLessThanOrEqual(lineCount);
            }
          }
        }
      });
    });
  }
});

import { describe, expect, it } from "vitest";
import { describeFocus, describeStep } from "../src/explain";
import { run } from "../src/interp";
import { itemsOf, type Focus } from "../src/links";
import { programs } from "../src/programs";

const clean = (text: string) => {
  expect(text).not.toMatch(/undefined|NaN|null|—/);
  expect(text.trim().length).toBeGreaterThan(0);
};

describe("explanations", () => {
  for (const program of programs) {
    it(`describe every step of ${program.id}`, () => {
      const trace = run(program);
      trace.steps.forEach((_, i) => clean(describeStep(program, trace, i)));
      expect(describeStep(program, trace, trace.steps.length - 1)).toContain(`exit`);
    });

    it(`describe every line, block, item and assembly line of ${program.id}`, () => {
      const focuses: Focus[] = [
        ...program.source.split("\n").map((_, i) => ({ kind: "line", line: i + 1 }) as Focus),
        ...program.functions.flatMap((f) =>
          f.blocks.flatMap((b) => [
            { kind: "block", func: f.name, block: b.name } as Focus,
            ...itemsOf(f, b).map((item) => ({ kind: "item", item }) as Focus),
          ]),
        ),
      ];
      for (const backend of ["x86", "rv64"] as const) {
        focuses.forEach((f) => clean(describeFocus(program, backend, f)));
        program.asm[backend].text.split("\n").forEach((_, line) => clean(describeFocus(program, backend, { kind: "asm", line })));
      }
    });
  }
});

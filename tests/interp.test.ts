import { describe, expect, it } from "vitest";
import { programs } from "../src/programs";
import { run } from "../src/interp";

describe("IR interpreter", () => {
  for (const program of programs) {
    it(`${program.path} exits like the GCC build`, () => {
      const trace = run(program);
      expect(trace.exitCode).toBe(program.runs.gcc.exit);
      expect(program.runs.gcc.stdout).toBe("");
    });

    it(`${program.path} exits like IFCC's own x86-64 and RISC-V builds`, () => {
      const { exitCode } = run(program);
      expect(exitCode).toBe(program.runs.x86.exit);
      expect(exitCode).toBe(program.runs.rv64.exit);
    });
  }
});

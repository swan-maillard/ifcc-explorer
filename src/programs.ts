import data from "./data/programs.json";
import type { Program } from "./types";

// Written by compiler/generate.sh, checked against the raw compiler output in tests/data.test.ts.
export const programs = data as unknown as Program[];

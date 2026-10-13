# IFCC explorer

A one-page site that follows a C program through IFCC, the compiler we wrote at INSA Lyon. Pick one of nine programs from its test suite and you see the C source, the control-flow graph of the compiler's IR and the x86-64 or RISC-V assembly it writes, side by side. Hover a line of C, a block or a line of assembly and the matching parts light up in the other two views. Run mode steps through the IR and shows each variable's value in its stack slot, down to the exit code.

Live page: https://swan-maillard.github.io/ifcc-explorer/

## The project

IFCC compiles a subset of C (int and void functions, recursion, if, while, do while, switch) to x86-64 or RISC-V. It's written in C++17 with ANTLR4: it builds its own IR made of basic blocks, runs four optimisation passes on it and hands it to one of the two backends. We were six, in the compiler project of our 4th year at INSA Lyon, in March and April 2024. When I rebuilt it in 2026, all 112 test programs still gave the same result as GCC on both backends.

Code: https://github.com/swan-maillard/INSA-4A-CompilerC

## What this demo shows

Everything on the page is real compiler output. `compiler/generate.sh` builds the compiler in Docker (ANTLR 4.9.2, the version we used), then for each program it keeps:

- the assembly written by `ifcc` and `ifcc -trv64`, byte for byte,
- the IR printed by `ifcc -d`,
- the exit codes of the program built by GCC, and of IFCC's own builds run natively and under qemu for RISC-V.

The `-d` dump leaves out the operators (`#5 = ($0, #4)`), so I wrote a small exporter, `compiler/export.cpp`, that links against the compiler's own object files and prints its IR as JSON. It runs the same pipeline as `main.cpp` and also records three things the page needs: which C statement was being compiled when each IR instruction was created, the stack slot of every variable, and which IR item each line of assembly comes from. The tests check that its JSON prints back to exactly what `ifcc -d` printed and that its assembly is identical to what `ifcc` wrote.

The run mode is a small interpreter for the IR in TypeScript. Memory is keyed by stack slot like in the generated code, and `main` starts with 0 in `#return` like its prologue does. For all nine programs its exit code matches GCC's build and both IFCC builds.

## Differences with the school version

The compiler itself doesn't run in the browser: its outputs are computed once by `npm run generate` and committed in `src/data/programs.json` (raw files in `data/raw`). Only the IR interpreter is new code. The link from an IR instruction to a C line goes through the optimisation passes by matching the variable each instruction writes, since the passes replace instructions without keeping track of where they came from.

## Run it

```sh
npm install
npm run dev
npm test
```

`npm run generate` rebuilds the data. It needs Docker and clones the compiler repo into `.cache` (or set `IFCC_SRC` to a local copy).

import "@fontsource/josefin-sans/latin-500";
import "@fontsource/barlow/latin-400";
import "@fontsource/barlow/latin-500";
import "@fontsource/barlow-condensed/latin-500";
import "./style.css";

import { programs } from "./programs";
import { describeFocus, describeStep, named, slotText } from "./explain";
import { run, type Trace } from "./interp";
import { asmForItem, linksFor, lineOf, type Focus } from "./links";
import { meta } from "./meta";
import type { Backend, Func } from "./types";
import { CodeView, escapeHtml, colourAsm, colourC } from "./views/code";
import { GraphView } from "./views/graph";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let program = programs[0];
let backend: Backend = "x86";
let trace: Trace = run(program);
let step = 0;
let pinned: Focus | null = null;
let hovered: Focus | null = null;
let shownFunc: string | null = null;
let timer: number | null = null;

const source = new CodeView($("source-scroll"), "c", {
  hover: (line) => setHover(line === null ? null : { kind: "line", line: line + 1 }),
  pick: (line) => setPin(line === null ? null : { kind: "line", line: line + 1 }),
});
const asm = new CodeView($("asm-scroll"), "asm", {
  hover: (line) => setHover(line === null ? null : { kind: "asm", line }),
  pick: (line) => setPin(line === null ? null : { kind: "asm", line }),
});
const graph = new GraphView($("graph-scroll"), {
  hover: (focus) => setHover(focus),
  pick: (focus) => setPin(focus),
});

function setHover(focus: Focus | null) {
  hovered = focus;
  render();
}

function setPin(focus: Focus | null) {
  pinned = focus;
  if (focus?.kind !== "line") source.clearActive();
  if (focus?.kind !== "asm") asm.clearActive();
  render();
  // Bring the linked parts into view, except in the view that was used to pick.
  const h = linksFor(program, backend, focus);
  const firstAsm = Math.min(...h.asm);
  if (focus && focus.kind !== "asm" && Number.isFinite(firstAsm)) asm.reveal(firstAsm);
  const block = [...h.blocks][0]?.split("/")[1];
  if (focus && focus.kind !== "block" && focus.kind !== "item" && block) graph.reveal(block);
}

function loadProgram(id: string) {
  program = programs.find((p) => p.id === id) ?? programs[0];
  trace = run(program);
  step = 0;
  pinned = hovered = null;
  shownFunc = null;
  stop();
  $("path").textContent = program.path;
  $("note").textContent = meta[program.id]?.note ?? "";
  source.setLines(program.source.replace(/\n$/, "").split("\n").map(colourC), 1);
  renderTabs();
  loadAsm();
  render();
  revealStep();
}

function loadAsm() {
  asm.setLines(program.asm[backend].text.replace(/\n$/, "").split("\n").map(colourAsm), 1);
  document.querySelectorAll<HTMLButtonElement>("[data-backend]").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.backend === backend));
  });
}

function renderTabs() {
  const tabs = $("func-tabs");
  tabs.replaceChildren();
  if (program.functions.length < 2) return;
  for (const f of program.functions) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "toggle";
    b.textContent = f.name;
    b.dataset.func = f.name;
    b.addEventListener("click", () => {
      showFunc(f.name);
      setPin({ kind: "block", func: f.name, block: f.blocks[0].name });
    });
    tabs.append(b);
  }
}

function showFunc(name: string) {
  if (shownFunc === name) return;
  const f = program.functions.find((x) => x.name === name)!;
  graph.show(f);
  shownFunc = name;
  $("legend").innerHTML = legend(f);
  document.querySelectorAll<HTMLButtonElement>("[data-func]").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.func === name));
  });
}

function legend(f: Func): string {
  const vars = f.vars.map((v) => `<code>${escapeHtml(v.ir)}</code> is ${escapeHtml(v.name)}`);
  const text = vars.length ? `In ${f.name}, ${vars.join(", ")}. ` : "";
  return `${text}Names starting with # are temporaries.`;
}

function current() {
  return trace.steps[step].at;
}

function render() {
  const focus = hovered ?? pinned;
  const h = linksFor(program, backend, focus);
  const at = current();

  const func = h.func ?? at?.func ?? shownFunc ?? "main";
  showFunc(func);

  const currentLine = at ? lineOf(program, at) : null;
  source.mark(new Set([...h.lines].map((l) => l - 1)), new Set(currentLine ? [currentLine - 1] : []));
  asm.mark(h.asm, new Set(at ? asmForItem(program, backend, at) : []));

  const event = trace.steps[step].event;
  const taken = event?.kind === "jump" && step > 0 ? { from: event.item.block, to: event.to } : null;
  graph.mark(h, at, taken);

  $("explain").innerHTML = withCode(focus ? describeFocus(program, backend, focus) : idleText());
  renderRun();
}

// The explanations mark code with backticks.
function withCode(text: string): string {
  return escapeHtml(text).replace(/`([^`]+)`/g, "<code>$1</code>");
}

function idleText(): string {
  if (step === 0) {
    return "Press Step to run the IR one instruction at a time. You can also hover or click a line of C, a block or a line of assembly to see what it turned into.";
  }
  return describeStep(program, trace, step);
}

function renderRun() {
  const last = trace.steps.length - 1;
  $("counter").textContent = `Step ${step} of ${last}`;
  ($("back") as HTMLButtonElement).disabled = step === 0;
  ($("reset") as HTMLButtonElement).disabled = step === 0;
  ($("step") as HTMLButtonElement).disabled = step === last;
  ($("play") as HTMLButtonElement).disabled = step === last && timer === null;
  $("play").textContent = timer === null ? "Run" : "Pause";

  const s = trace.steps[step];
  const event = s.event;
  const written = event?.kind === "write" ? event.instr.slots[event.to] : undefined;
  $("frames").innerHTML = s.frames
    .map((frame, k) => {
      const f = program.functions.find((x) => x.name === frame.func)!;
      const top = k === s.frames.length - 1;
      const rows = [...f.vars.map((v) => ({ ir: v.ir, slot: v.slot })), { ir: "#return", slot: f.returnSlot }]
        .map(({ ir, slot }) => {
          const value = frame.memory[slot];
          const changed = top && written === slot;
          return `<tr class="${changed ? "is-changed" : ""}"><th scope="row">${escapeHtml(named(f, ir))}</th>` +
            `<td class="slot">${slotText(backend, slot)}</td>` +
            `<td class="value">${value === undefined ? '<span class="unset">not set</span>' : value}</td></tr>`;
        })
        .join("");
      const caption = k === 0 ? f.name : `${f.name}, called from ${s.frames[k - 1].func}`;
      return `<table class="frame${top ? " is-top" : ""}"><caption>${escapeHtml(caption)}</caption>` +
        `<thead><tr><th scope="col">Variable</th><th scope="col">Stack slot</th><th scope="col">Value</th></tr></thead>` +
        `<tbody>${rows}</tbody></table>`;
    })
    .reverse()
    .join("");

  const runs = program.runs;
  const real = `GCC exits with ${runs.gcc.exit}. IFCC exits with ${runs.x86.exit} on x86-64 and ${runs.rv64.exit} on RISC-V.`;
  const done = step === last ? ` Here the IR ends with ${trace.exitCode}.` : "";
  $("result").textContent = real + done;
}

function goTo(n: number) {
  step = Math.max(0, Math.min(trace.steps.length - 1, n));
  pinned = null;
  source.clearActive();
  asm.clearActive();
  render();
  revealStep();
}

function revealStep() {
  const at = current();
  if (!at) return;
  graph.reveal(at.block);
  const lines = asmForItem(program, backend, at);
  if (lines.length) asm.reveal(lines[0]);
}

function play() {
  if (timer !== null) return stop();
  if (step === trace.steps.length - 1) goTo(0);
  timer = window.setInterval(() => {
    if (step >= trace.steps.length - 1) return stop();
    goTo(step + 1);
  }, 650);
  renderRun();
}

function stop() {
  if (timer !== null) window.clearInterval(timer);
  timer = null;
  renderRun();
}

const select = $("program") as HTMLSelectElement;
select.innerHTML = programs
  .map((p) => `<option value="${p.id}">${escapeHtml(meta[p.id]?.title ?? p.id)}</option>`)
  .join("");
select.addEventListener("change", () => loadProgram(select.value));

document.querySelectorAll<HTMLButtonElement>("[data-backend]").forEach((b) =>
  b.addEventListener("click", () => {
    backend = b.dataset.backend as Backend;
    loadAsm();
    render();
    revealStep();
  }),
);

$("step").addEventListener("click", () => goTo(step + 1));
$("back").addEventListener("click", () => goTo(step - 1));
$("reset").addEventListener("click", () => {
  stop();
  goTo(0);
});
$("play").addEventListener("click", play);

// Nothing runs while it can't be seen.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
});
new IntersectionObserver(([entry]) => {
  if (!entry.isIntersecting) stop();
}).observe($("workspace"));

loadProgram(programs[0].id);

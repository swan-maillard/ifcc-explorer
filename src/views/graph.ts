import { formatInstr, formatNext, successors } from "../ir";
import { layout, type Layout } from "../layout";
import { blockKey, itemKey, type Focus, type Linked } from "../links";
import type { Func, ItemRef } from "../types";
import { escapeHtml } from "./code";

const SVG = "http://www.w3.org/2000/svg";
const FONT_SIZE = 13;
const ROW = 20;
const HEADER = 26;
const PAD_X = 12;
const PAD_Y = 8;

export interface GraphCallbacks {
  hover(focus: Focus | null): void;
  pick(focus: Focus | null): void;
}

let measurer: CanvasRenderingContext2D | null = null;
function textWidth(text: string): number {
  measurer ??= document.createElement("canvas").getContext("2d");
  if (!measurer) return text.length * FONT_SIZE * 0.62;
  measurer.font = `${FONT_SIZE}px ui-monospace, "Cascadia Mono", Consolas, monospace`;
  return measurer.measureText(text).width;
}

function el<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number> = {}) {
  const node = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

export class GraphView {
  private svg: SVGSVGElement;
  private func: Func | null = null;
  private placed: Layout | null = null;
  private nodes = new Map<string, SVGGElement>();
  private rows = new Map<string, SVGGElement>();
  private edges: { from: string; to: string; path: SVGPathElement; label: SVGTextElement | null }[] = [];

  constructor(private scroller: HTMLElement, private callbacks: GraphCallbacks) {
    this.svg = scroller.querySelector("svg")!;
    this.svg.addEventListener("mouseleave", () => callbacks.hover(null));
  }

  get shown(): string | null {
    return this.func?.name ?? null;
  }

  show(func: Func) {
    this.func = func;
    const lines = (b: Func["blocks"][number]) => [
      ...b.instrs.map(formatInstr),
      formatNext(b.next),
    ];
    const sizes = func.blocks.map((b) => {
      const texts = [b.name, ...lines(b)];
      const width = Math.max(96, ...texts.map(textWidth)) + PAD_X * 2;
      return { name: b.name, width: Math.ceil(width), height: HEADER + lines(b).length * ROW + PAD_Y };
    });
    const edges = func.blocks.flatMap((b) => successors(b.next).map((s) => ({ from: b.name, to: s.to, label: s.label })));
    const placed = layout(sizes, edges);
    this.placed = placed;

    this.svg.replaceChildren();
    this.svg.setAttribute("viewBox", `0 0 ${placed.width} ${placed.height}`);
    this.svg.setAttribute("width", String(placed.width));
    this.svg.setAttribute("height", String(placed.height));
    this.svg.append(this.markers());

    const edgeLayer = el("g", { class: "edges" });
    this.edges = placed.edges.map((e) => {
      const path = el("path", { d: e.path, class: `edge${e.back ? " back" : ""}`, "marker-end": "url(#arrow)" });
      edgeLayer.append(path);
      let label: SVGTextElement | null = null;
      if (e.label) {
        label = el("text", { x: e.labelX, y: e.labelY, class: "edge-label" });
        label.textContent = e.label;
        edgeLayer.append(label);
      }
      return { from: e.from, to: e.to, path, label };
    });
    this.svg.append(edgeLayer);

    this.nodes.clear();
    this.rows.clear();
    const nodeLayer = el("g", { class: "nodes" });
    placed.nodes.forEach((n) => {
      const block = func.blocks.find((b) => b.name === n.name)!;
      const g = el("g", {
        class: "node",
        transform: `translate(${n.x},${n.y})`,
        tabindex: 0,
        role: "button",
        "aria-label": `Block ${n.name}: ${lines(block).join(", ")}`,
      });
      g.append(el("rect", { class: "box", width: n.width, height: n.height, rx: 6 }));
      const title = el("text", { x: PAD_X, y: 18, class: "block-name" });
      title.textContent = n.name;
      g.append(title);

      lines(block).forEach((text, k) => {
        const index = k < block.instrs.length ? k : -1;
        const row = el("g", { class: `row${index < 0 ? " terminator" : ""}` });
        row.append(el("rect", { class: "row-bg", x: 2, y: HEADER + k * ROW - 2, width: n.width - 4, height: ROW }));
        const t = el("text", { x: PAD_X, y: HEADER + k * ROW + 12 });
        t.innerHTML = escapeHtml(text);
        row.append(t);
        const item: ItemRef = { func: func.name, block: n.name, index };
        row.addEventListener("mouseenter", () => this.callbacks.hover({ kind: "item", item }));
        row.addEventListener("click", (e) => {
          e.stopPropagation();
          this.callbacks.pick({ kind: "item", item });
        });
        this.rows.set(itemKey(item), row);
        g.append(row);
      });

      const focus: Focus = { kind: "block", func: func.name, block: n.name };
      title.addEventListener("mouseenter", () => this.callbacks.hover(focus));
      g.addEventListener("click", () => this.callbacks.pick(focus));
      g.addEventListener("focus", () => this.callbacks.pick(focus));
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.callbacks.pick(focus);
        } else if (e.key === "Escape") {
          this.callbacks.pick(null);
        }
      });
      this.nodes.set(blockKey(func.name, n.name), g);
      nodeLayer.append(g);
    });
    this.svg.append(nodeLayer);
    this.svg.setAttribute("aria-label", `Control-flow graph of ${func.name}: ${func.blocks.length} blocks, ${edges.length} edges.`);
  }

  mark(h: Linked, current: ItemRef | null, taken: { from: string; to: string } | null) {
    for (const [key, g] of this.nodes) {
      g.classList.toggle("is-linked", h.blocks.has(key));
      g.classList.toggle("is-current", !!current && key === blockKey(current.func, current.block));
    }
    for (const [key, row] of this.rows) {
      row.classList.toggle("is-linked", h.items.has(key));
      row.classList.toggle("is-current", !!current && key === itemKey(current));
    }
    for (const e of this.edges) {
      const linked = h.blocks.has(blockKey(this.func!.name, e.from)) && h.blocks.size === 1 && h.items.size === 0;
      const isTaken = !!taken && taken.from === e.from && taken.to === e.to;
      const cls = isTaken ? "is-current" : linked ? "is-linked" : "";
      e.path.setAttribute("class", `edge${e.path.classList.contains("back") ? " back" : ""}${cls ? ` ${cls}` : ""}`);
      e.path.setAttribute("marker-end", `url(#arrow${isTaken ? "-current" : linked ? "-linked" : ""})`);
      e.label?.classList.toggle("is-linked", linked || isTaken);
    }
  }

  /** Scrolls the graph panel (not the page) so a block is in view. */
  reveal(block: string) {
    const n = this.placed?.nodes.find((x) => x.name === block);
    if (!n) return;
    const view = this.scroller;
    const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fitsX = n.x >= view.scrollLeft && n.x + n.width <= view.scrollLeft + view.clientWidth;
    const fitsY = n.y >= view.scrollTop && n.y + n.height <= view.scrollTop + view.clientHeight;
    if (fitsX && fitsY) return;
    view.scrollTo({
      left: fitsX ? view.scrollLeft : Math.max(0, n.x + n.width / 2 - view.clientWidth / 2),
      top: fitsY ? view.scrollTop : Math.max(0, n.y - 24),
      behavior: smooth ? "smooth" : "auto",
    });
  }

  private markers() {
    const defs = el("defs");
    for (const [id, cls] of [["arrow", ""], ["arrow-linked", "is-linked"], ["arrow-current", "is-current"]]) {
      const m = el("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" });
      m.append(el("path", { d: "M0,0 L10,5 L0,10 z", class: `arrowhead ${cls}` }));
      defs.append(m);
    }
    return defs;
  }
}

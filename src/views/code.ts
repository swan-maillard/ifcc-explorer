// A block of code shown as a listbox: the mouse or the arrow keys pick a line.

export interface CodeCallbacks {
  hover(line: number | null): void;
  pick(line: number | null): void;
}

export class CodeView {
  readonly list: HTMLOListElement;
  private items: HTMLLIElement[] = [];
  private active = -1;

  constructor(
    private scroller: HTMLElement,
    private prefix: string,
    private callbacks: CodeCallbacks,
  ) {
    this.list = scroller.querySelector("ol")!;
    this.list.addEventListener("mouseover", (e) => {
      const line = this.lineFrom(e.target);
      if (line !== null) callbacks.hover(line);
    });
    this.list.addEventListener("mouseleave", () => callbacks.hover(null));
    this.list.addEventListener("click", (e) => {
      const line = this.lineFrom(e.target);
      if (line !== null) this.setActive(line, true);
    });
    this.list.addEventListener("keydown", (e) => this.onKey(e));
  }

  /** Lines are HTML (already escaped), numbered from `first`. */
  setLines(lines: string[], first: number) {
    this.list.replaceChildren(
      ...lines.map((html, i) => {
        const li = document.createElement("li");
        li.id = `${this.prefix}-${i}`;
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", "false");
        li.dataset.line = String(i);
        li.innerHTML = `<span class="ln" aria-hidden="true">${i + first}</span><span class="code">${html || " "}</span>`;
        return li;
      }),
    );
    this.items = [...this.list.querySelectorAll("li")];
    this.active = -1;
    this.list.removeAttribute("aria-activedescendant");
  }

  mark(linked: Set<number>, current: Set<number>) {
    this.items.forEach((li, i) => {
      li.classList.toggle("is-linked", linked.has(i));
      li.classList.toggle("is-current", current.has(i));
    });
  }

  clearActive() {
    if (this.active >= 0) this.items[this.active]?.setAttribute("aria-selected", "false");
    this.active = -1;
    this.list.removeAttribute("aria-activedescendant");
  }

  /** Scrolls this panel, never the page, so the line is visible. */
  reveal(line: number) {
    const li = this.items[line];
    if (!li) return;
    const top = li.offsetTop;
    const bottom = top + li.offsetHeight;
    const view = this.scroller;
    if (top < view.scrollTop || bottom > view.scrollTop + view.clientHeight) {
      const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
      view.scrollTo({ top: Math.max(0, top - view.clientHeight / 3), behavior: smooth ? "smooth" : "auto" });
    }
  }

  private lineFrom(target: EventTarget | null): number | null {
    const li = (target as HTMLElement | null)?.closest?.("li");
    return li && this.list.contains(li) ? Number(li.dataset.line) : null;
  }

  private setActive(line: number, pick: boolean) {
    if (this.active >= 0) this.items[this.active]?.setAttribute("aria-selected", "false");
    this.active = line;
    const li = this.items[line];
    li.setAttribute("aria-selected", "true");
    this.list.setAttribute("aria-activedescendant", li.id);
    this.reveal(line);
    if (pick) this.callbacks.pick(line);
  }

  private onKey(e: KeyboardEvent) {
    const last = this.items.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(last, this.active + 1),
      ArrowUp: Math.max(0, this.active < 0 ? 0 : this.active - 1),
      Home: 0,
      End: last,
    };
    if (e.key in moves) {
      e.preventDefault();
      this.setActive(moves[e.key], true);
    } else if (e.key === "Escape") {
      this.clearActive();
      this.callbacks.pick(null);
    }
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const C_KEYWORDS = /\b(int|void|if|else|while|do|switch|case|default|break|continue|return)\b/g;

export function highlightC(line: string): string {
  return escapeHtml(line).replace(C_KEYWORDS, '<span class="kw">$1</span>');
}

export function highlightAsm(line: string): string {
  const html = escapeHtml(line);
  if (/^\S.*:$/.test(line)) return `<span class="label">${html}</span>`;
  if (/^\s*\./.test(line)) return `<span class="dir">${html}</span>`;
  return html.replace(/^(\s*)(\S+)/, '$1<span class="op">$2</span>');
}

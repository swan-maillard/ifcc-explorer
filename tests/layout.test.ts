import { describe, expect, it } from "vitest";
import { successors } from "../src/ir";
import { layout } from "../src/layout";
import { programs } from "../src/programs";

describe("graph layout", () => {
  for (const program of programs) {
    for (const f of program.functions) {
      it(`places every block of ${program.id}/${f.name} without overlaps`, () => {
        const sizes = f.blocks.map((b) => ({ name: b.name, width: 120, height: 30 + 20 * b.instrs.length }));
        const edges = f.blocks.flatMap((b) => successors(b.next).map((s) => ({ from: b.name, to: s.to, label: s.label })));
        const { nodes, edges: placed, width, height } = layout(sizes, edges);
        expect(placed).toHaveLength(edges.length);
        for (const a of nodes) {
          expect(a.x).toBeGreaterThanOrEqual(0);
          expect(a.x + a.width).toBeLessThanOrEqual(width);
          expect(a.y + a.height).toBeLessThanOrEqual(height);
          for (const b of nodes) {
            if (a === b) continue;
            const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
            expect(apart).toBe(true);
          }
        }
        expect(nodes[0].y).toBe(Math.min(...nodes.map((n) => n.y)));
      });
    }
  }
});

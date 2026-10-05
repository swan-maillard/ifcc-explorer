// A small layered layout for control-flow graphs: blocks go down in layers,
// loops come back up on the right so they never cross the forward edges.
// An edge that skips layers gets an invisible waypoint in each layer it crosses,
// so it's routed around the blocks instead of through them.

export interface NodeSize {
  name: string;
  width: number;
  height: number;
}

export interface EdgeSpec {
  from: string;
  to: string;
  label: string;
}

export interface PlacedNode extends NodeSize {
  x: number; // left
  y: number; // top
  layer: number;
}

export interface PlacedEdge extends EdgeSpec {
  back: boolean;
  path: string;
  labelX: number;
  labelY: number;
}

export interface Layout {
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  width: number;
  height: number;
}

const GAP_X = 28;
const GAP_Y = 54;
const MARGIN = 16;
const LANE = 14;
const WAYPOINT = 12;

interface Vertex {
  width: number;
  height: number;
  layer: number;
  centre: number;
}

export function layout(nodes: NodeSize[], edges: EdgeSpec[]): Layout {
  const index = new Map(nodes.map((n, i) => [n.name, i]));
  const ends = edges.map((e) => [index.get(e.from)!, index.get(e.to)!] as const);
  const back = findBackEdges(nodes.length, ends);
  const layerOf = assignLayers(nodes.length, ends, back);

  // Vertices are the blocks followed by the waypoints. Each forward edge
  // becomes a chain of vertices, one per layer.
  const vertices: Vertex[] = nodes.map((n, v) => ({ width: n.width, height: n.height, layer: layerOf[v], centre: 0 }));
  const chains: number[][] = ends.map(([a, b], i) => {
    if (back.has(i)) return [a, b];
    const chain = [a];
    for (let layer = layerOf[a] + 1; layer < layerOf[b]; layer++) {
      vertices.push({ width: WAYPOINT, height: 0, layer, centre: 0 });
      chain.push(vertices.length - 1);
    }
    chain.push(b);
    return chain;
  });
  const links = chains.filter((_, i) => !back.has(i)).flatMap((c) => c.slice(1).map((v, k) => [c[k], v] as const));

  const layers = orderLayers(vertices, links);
  const bands = place(vertices, links, layers);

  const left = Math.min(...vertices.map((v) => v.centre - v.width / 2));
  vertices.forEach((v) => (v.centre += MARGIN - left));

  const placed: PlacedNode[] = nodes.map((n, i) => ({
    ...n,
    x: vertices[i].centre - n.width / 2,
    y: bands[layerOf[i]].top,
    layer: layerOf[i],
  }));
  return route(placed, vertices, bands, edges, chains, back);
}

function findBackEdges(n: number, ends: (readonly [number, number])[]): Set<number> {
  const back = new Set<number>();
  const state = new Array(n).fill(0); // 0 new, 1 on stack, 2 done
  const visit = (v: number) => {
    state[v] = 1;
    ends.forEach(([a, b], e) => {
      if (a !== v) return;
      if (state[b] === 1) back.add(e);
      else if (state[b] === 0) visit(b);
    });
    state[v] = 2;
  };
  for (let v = 0; v < n; v++) if (state[v] === 0) visit(v);
  return back;
}

function assignLayers(n: number, ends: (readonly [number, number])[], back: Set<number>): number[] {
  const layer = new Array(n).fill(0);
  // Longest path: relax forward edges until nothing moves (graphs here are tiny).
  for (let changed = true; changed; ) {
    changed = false;
    ends.forEach(([a, b], i) => {
      if (!back.has(i) && layer[b] < layer[a] + 1) {
        layer[b] = layer[a] + 1;
        changed = true;
      }
    });
  }
  return layer;
}

function orderLayers(vertices: Vertex[], links: (readonly [number, number])[]): number[][] {
  const depth = Math.max(...vertices.map((v) => v.layer)) + 1;
  const layers: number[][] = Array.from({ length: depth }, () => []);
  vertices.forEach((v, i) => layers[v.layer].push(i));

  const position = new Array(vertices.length).fill(0);
  const refresh = () => layers.forEach((l) => l.forEach((v, i) => (position[v] = (i + 0.5) / l.length)));
  refresh();

  const sortBy = (l: number[], neighbours: (v: number) => number[]) => {
    const key = new Map(l.map((v, i) => {
      const ns = neighbours(v);
      return [v, ns.length ? ns.reduce((s, w) => s + position[w], 0) / ns.length : (i + 0.5) / l.length];
    }));
    l.sort((a, b) => key.get(a)! - key.get(b)!);
  };
  const parents = (v: number) => links.filter(([, b]) => b === v).map(([a]) => a);
  const children = (v: number) => links.filter(([a]) => a === v).map(([, b]) => b);

  for (let sweep = 0; sweep < 4; sweep++) {
    for (let d = 1; d < depth; d++) {
      sortBy(layers[d], parents);
      refresh();
    }
    for (let d = depth - 2; d >= 0; d--) {
      sortBy(layers[d], children);
      refresh();
    }
  }
  return layers;
}

interface Band {
  top: number;
  height: number;
}

function place(vertices: Vertex[], links: (readonly [number, number])[], layers: number[][]): Band[] {
  let y = MARGIN;
  return layers.map((layer) => {
    const desired = layer.map((v) => {
      const parents = links.filter(([, b]) => b === v).map(([a]) => vertices[a].centre);
      return parents.length ? parents.reduce((s, x) => s + x, 0) / parents.length : 0;
    });
    // Push right to remove overlaps, then slide the whole layer back so it sits
    // as close as it can to where its parents want it.
    const actual: number[] = [];
    layer.forEach((v, i) => {
      const prev = vertices[layer[i - 1]];
      const min = i === 0 ? -Infinity : actual[i - 1] + prev.width / 2 + GAP_X + vertices[v].width / 2;
      actual.push(Math.max(desired[i], min));
    });
    const shift = desired.reduce((s, x, i) => s + x - actual[i], 0) / layer.length;
    layer.forEach((v, i) => (vertices[v].centre = actual[i] + shift));
    const band = { top: y, height: Math.max(...layer.map((v) => vertices[v].height)) };
    y += band.height + GAP_Y;
    return band;
  });
}

function route(
  nodes: PlacedNode[], vertices: Vertex[], bands: Band[], edges: EdgeSpec[], chains: number[][], back: Set<number>,
): Layout {
  const forward = edges.map((_, i) => i).filter((i) => !back.has(i));

  // Spread the edges leaving or entering a block along its bottom or top side,
  // in the order of where they go next.
  const ports = (end: (c: number[]) => number, towards: (c: number[]) => number) => {
    const at = new Map<number, number>();
    const byNode = new Map<number, number[]>();
    for (const e of forward) byNode.set(end(chains[e]), [...(byNode.get(end(chains[e])) ?? []), e]);
    for (const [v, es] of byNode) {
      es.sort((a, b) => vertices[towards(chains[a])].centre - vertices[towards(chains[b])].centre);
      const n = nodes[v];
      es.forEach((e, k) => at.set(e, n.x + (n.width * (k + 1)) / (es.length + 1)));
    }
    return at;
  };
  const out = ports((c) => c[0], (c) => c[1]);
  const into = ports((c) => c[c.length - 1], (c) => c[c.length - 2]);

  const curve = (x1: number, y1: number, x2: number, y2: number) => {
    const bend = Math.max(20, (y2 - y1) / 2);
    return `C${x1},${y1 + bend} ${x2},${y2 - bend} ${x2},${y2}`;
  };

  const placed: PlacedEdge[] = [];
  let lanes = 0;
  edges.forEach((e, i) => {
    const chain = chains[i];
    const a = nodes[chain[0]];
    const b = nodes[chain[chain.length - 1]];
    if (!back.has(i)) {
      let x = out.get(i)!;
      let y = a.y + a.height;
      let path = `M${x},${y}`;
      const start = { x, y };
      for (const w of chain.slice(1, -1)) {
        const wx = vertices[w].centre;
        const band = bands[vertices[w].layer];
        path += ` ${curve(x, y, wx, band.top)} V${band.top + band.height}`;
        x = wx;
        y = band.top + band.height;
      }
      path += ` ${curve(x, y, into.get(i)!, b.y)}`;
      // The label sits halfway down the first hop, where diverging edges are apart.
      const next = chain.length > 2 ? { x: vertices[chain[1]].centre, y: bands[vertices[chain[1]].layer].top } : { x: into.get(i)!, y: b.y };
      placed.push({
        ...e, back: false, path,
        labelX: (start.x + next.x) / 2 + 5,
        labelY: (start.y + next.y) / 2 + 4,
      });
      return;
    }
    const between = nodes.filter((n) => n.layer >= b.layer && n.layer <= a.layer);
    const lane = Math.max(...between.map((n) => n.x + n.width)) + 18 + lanes++ * LANE;
    const sy = a.y + a.height / 2;
    const ty = b.y + Math.min(b.height / 2, 20);
    const r = 8;
    placed.push({
      ...e, back: true,
      path:
        `M${a.x + a.width},${sy} H${lane - r} Q${lane},${sy} ${lane},${sy - r} ` +
        `V${ty + r} Q${lane},${ty} ${lane - r},${ty} H${b.x + b.width}`,
      labelX: a.x + a.width + 4, labelY: sy - 6,
    });
  });

  const right = Math.max(...vertices.map((v) => v.centre + v.width / 2));
  const width = right + (lanes ? 18 + lanes * LANE : 0) + MARGIN + 40;
  const height = Math.max(...nodes.map((n) => n.y + n.height)) + MARGIN;
  return { nodes, edges: placed, width, height };
}

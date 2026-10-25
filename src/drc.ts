// Minimal DRC + connectivity for the 2-layer designs this studio makes.
import { Design, Pt, RULES, allPads, boardOutline, distToPoly, pointInPoly } from './core';

type Shape = { k: 'cap'; a: Pt; b: Pt; r: number } | { k: 'rect'; x1: number; y1: number; x2: number; y2: number };
interface Item { id: string; net?: string; top: boolean; bot: boolean; s: Shape; hole?: boolean; npth?: boolean; chip?: string; label: string }

const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const cross = (a: Pt, b: Pt) => a[0] * b[1] - a[1] * b[0];
function ptSeg(p: Pt, a: Pt, b: Pt) {
  const d = sub(b, a), L = d[0] * d[0] + d[1] * d[1];
  const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / L)) : 0;
  return Math.hypot(p[0] - a[0] - t * d[0], p[1] - a[1] - t * d[1]);
}
function segsCross(a: Pt, b: Pt, c: Pt, d: Pt) {
  const d1 = cross(sub(b, a), sub(c, a)), d2 = cross(sub(b, a), sub(d, a)), d3 = cross(sub(d, c), sub(a, c)), d4 = cross(sub(d, c), sub(b, c));
  return d1 * d2 < 0 && d3 * d4 < 0;
}
const segSeg = (a: Pt, b: Pt, c: Pt, d: Pt) => segsCross(a, b, c, d) ? 0 : Math.min(ptSeg(a, c, d), ptSeg(b, c, d), ptSeg(c, a, b), ptSeg(d, a, b));
function segRect(a: Pt, b: Pt, r: { x1: number; y1: number; x2: number; y2: number }) {
  const inside = (p: Pt) => p[0] >= r.x1 && p[0] <= r.x2 && p[1] >= r.y1 && p[1] <= r.y2;
  if (inside(a) || inside(b)) return 0;
  const C: Pt[] = [[r.x1, r.y1], [r.x2, r.y1], [r.x2, r.y2], [r.x1, r.y2]];
  return Math.min(...C.map((p, i) => segSeg(a, b, p, C[(i + 1) % 4])));
}
function dist(s: Shape, t: Shape): number {
  if (s.k === 'cap' && t.k === 'cap') return segSeg(s.a, s.b, t.a, t.b) - s.r - t.r;
  if (s.k === 'cap' && t.k === 'rect') return segRect(s.a, s.b, t) - s.r;
  if (s.k === 'rect' && t.k === 'cap') return dist(t, s);
  const r = s as Extract<Shape, { k: 'rect' }>, q = t as Extract<Shape, { k: 'rect' }>;
  const dx = Math.max(0, q.x1 - r.x2, r.x1 - q.x2), dy = Math.max(0, q.y1 - r.y2, r.y1 - q.y2);
  return Math.hypot(dx, dy);
}

function items(d: Design): Item[] {
  const out: Item[] = [];
  allPads(d).forEach((p, i) => out.push({
    id: p.npth ? 'npth' + i : 'pad' + i, net: p.npth ? `NPTH#${i}` : p.net, top: p.npth || p.side !== 'B' || !!p.drill, bot: p.npth || p.side === 'B' || !!p.drill,
    hole: !!p.drill || !!p.npth, npth: p.npth, chip: p.chip, label: `${p.ref ?? 'pad'}.${p.num || (p.npth ? 'hole' : i)}`,
    s: p.shape === 'circle' ? { k: 'cap', a: [p.x, p.y], b: [p.x, p.y], r: p.w / 2 } : { k: 'rect', x1: p.x - p.w / 2, y1: p.y - p.h / 2, x2: p.x + p.w / 2, y2: p.y + p.h / 2 },
  }));
  d.vias.forEach(v => out.push({ id: v.id, net: v.net, top: true, bot: true, hole: true, label: 'via ' + v.id, s: { k: 'cap', a: [v.x, v.y], b: [v.x, v.y], r: v.d / 2 } }));
  d.traces.filter(t => t.layer === 'TopCopper' || t.layer === 'BottomCopper').forEach(t => t.pts.forEach((p, i) => {
    if (i === 0 && t.pts.length > 1) return;
    const top = t.layer === 'TopCopper';
    out.push({ id: `${t.id}#${i}`, net: t.net, top, bot: !top, label: 'trace ' + t.id, s: { k: 'cap', a: t.pts[Math.max(0, i - 1)], b: p, r: t.width / 2 } });
  }));
  return out;
}

/** Smallest gap between a shape and the board outline (negative/0 if it pokes outside). */
function edgeGap(s: Shape, poly: Pt[]): number {
  if (s.k === 'cap') {
    if (!pointInPoly(s.a, poly) || !pointInPoly(s.b, poly)) return -1;
    let m = Infinity; for (let i = 0; i < poly.length; i++) m = Math.min(m, segSeg(s.a, s.b, poly[i], poly[(i + 1) % poly.length]));
    return m - s.r;
  }
  const C: Pt[] = [[s.x1, s.y1], [s.x2, s.y1], [s.x2, s.y2], [s.x1, s.y2]];
  if (C.some(c => !pointInPoly(c, poly))) return -1;
  return Math.min(...C.map(c => distToPoly(c, poly)));
}

export interface DrcReport { violations: string[]; unrouted: string[]; shorts: string[]; nets: Record<string, number> }

export function runDrc(d: Design): DrcReport {
  const it = items(d), violations: string[] = [], shorts: string[] = [];
  const outline = boardOutline(d);
  const bbs = it.map(a => a.s.k === 'rect' ? [a.s.x1, a.s.y1, a.s.x2, a.s.y2] : [Math.min(a.s.a[0], a.s.b[0]) - a.s.r, Math.min(a.s.a[1], a.s.b[1]) - a.s.r, Math.max(a.s.a[0], a.s.b[0]) + a.s.r, Math.max(a.s.a[1], a.s.b[1]) + a.s.r]);
  // union-find over touching copper on top, plus pour on bottom
  const par = it.map((_, i) => i); const find = (i: number): number => par[i] === i ? i : (par[i] = find(par[i])); const join = (a: number, b: number) => { par[find(a)] = find(b); };
  for (let i = 0; i < it.length; i++) {
    const a = it[i];
    // board-edge clearance
    const bb = a.s.k === 'rect' ? [a.s.x1, a.s.y1, a.s.x2, a.s.y2] : [Math.min(a.s.a[0], a.s.b[0]) - a.s.r, Math.min(a.s.a[1], a.s.b[1]) - a.s.r, Math.max(a.s.a[0], a.s.b[0]) + a.s.r, Math.max(a.s.a[1], a.s.b[1]) + a.s.r];
    for (const k of d.keepouts ?? []) if (bb[0] < k.x2 && bb[2] > k.x1 && bb[1] < k.y2 && bb[3] > k.y1) violations.push(`copper in ${k.label ?? 'keepout'}: ${a.label}`);
    if (!a.npth) {
      if (!d.outline) { if (bb[0] < RULES.edgeClear || bb[1] < RULES.edgeClear || bb[2] > d.board.w - RULES.edgeClear || bb[3] > d.board.h - RULES.edgeClear) violations.push(`edge clearance: ${a.label}`); }
      else if (edgeGap(a.s, outline) < RULES.edgeClear) violations.push(`edge clearance: ${a.label}`);
    } else if (d.outline && edgeGap(a.s, outline) < 0.5) violations.push(`hole too close to edge: ${a.label}`);
    for (let j = i + 1; j < it.length; j++) {
      const b = it[j];
      if (Math.max(bb[0] - 6, 0) > (bbs[j][2]) || bb[2] + 6 < bbs[j][0] || bb[1] - 6 > bbs[j][3] || bb[3] + 6 < bbs[j][1]) continue; // far apart
      if ((a.npth || b.npth) && a.chip && a.chip === b.chip) continue; // footprint-intrinsic (vendor land pattern)
      if (!((a.top && b.top) || (a.bot && b.bot))) continue;
      const g = dist(a.s, b.s);
      if (g <= 1e-6) { join(i, j); if (a.net && b.net && a.net !== b.net) shorts.push(`${a.label} (${a.net}) touches ${b.label} (${b.net})`); }
      else if (g < RULES.minClear - 1e-6 && a.net && b.net && a.net !== b.net) violations.push(`clearance ${g.toFixed(3)} mm: ${a.label} (${a.net}) ↔ ${b.label} (${b.net})`);
      else if (a.hole && b.hole && g < 0.25) violations.push(`hole-to-hole copper ${g.toFixed(3)}: ${a.label} ↔ ${b.label}`);
    }
  }
  for (const pr of d.pours) { const g = it.map((x, i) => [x, i] as const).filter(([x]) => x.bot && x.net === pr.net); g.forEach(([, i]) => join(i, g[0][1])); }
  const nets: Record<string, Set<number>> = {};
  it.forEach((x, i) => { if (x.net && x.id.startsWith('pad')) (nets[x.net] ??= new Set()).add(find(i)); });
  const unrouted = Object.entries(nets).filter(([, s]) => s.size > 1).map(([n, s]) => `${n}: ${s.size} islands`);
  return { violations, unrouted, shorts, nets: Object.fromEntries(Object.entries(nets).map(([k, v]) => [k, v.size])) };
}

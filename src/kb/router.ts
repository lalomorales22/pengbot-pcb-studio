// Small 2-layer grid maze router (A*, 0.5 mm grid) used to wire the keyboard matrix + controller.
// Every cell keeps "who may use it": free, one net only, or nobody. Items are inflated by
// clearance + half trace width + a grid margin, so straight 0.5 mm steps can never violate RULES.minClear.
import { Design, Pt, RULES, Trace, Via, allPads, boardOutline, distToPoly, pointInPoly } from '../core';

type Shape = { k: 'cap'; a: Pt; b: Pt; r: number } | { k: 'rect'; x1: number; y1: number; x2: number; y2: number };
interface Obj { net: string; top: boolean; bot: boolean; s: Shape; hole?: boolean }

const G = 0.5, TW = 0.25, VIA_D = 0.6, VIA_DRILL = 0.3;
const R_TRACE = RULES.minClear + TW / 2 + 0.095;     // 0.42: keeps 0.5 mm grid steps clear at their midpoints
const R_VIA = RULES.minClear + VIA_D / 2 + 0.03;      // 0.53
const R_HOLE_VIA = VIA_D / 2 + 0.3;                    // via vs other holes (drill-to-drill + annular)

function dShape(p: Pt, s: Shape): number {
  if (s.k === 'rect') { const dx = Math.max(s.x1 - p[0], 0, p[0] - s.x2), dy = Math.max(s.y1 - p[1], 0, p[1] - s.y2); return Math.hypot(dx, dy); }
  const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((p[0] - s.a[0]) * dx + (p[1] - s.a[1]) * dy) / L)) : 0;
  return Math.hypot(p[0] - s.a[0] - t * dx, p[1] - s.a[1] - t * dy) - s.r;
}
const bbox = (s: Shape) => s.k === 'rect' ? [s.x1, s.y1, s.x2, s.y2] : [Math.min(s.a[0], s.b[0]) - s.r, Math.min(s.a[1], s.b[1]) - s.r, Math.max(s.a[0], s.b[0]) + s.r, Math.max(s.a[1], s.b[1]) + s.r];

export interface RouteResult { traces: Trace[]; vias: Via[]; failed: string[] }
export interface RouteOpts { prefer?: (net: string) => 'top' | 'bot' | undefined; order?: string[]; skip?: (net: string) => boolean }

export function autoroute(d: Design, opts: RouteOpts = {}): RouteResult {
  const W = d.board.w, H = d.board.h, nx = Math.floor(W / G) + 1, ny = Math.floor(H / G) + 1, N = nx * ny;
  const nets: string[] = []; const nid = new Map<string, number>();
  const id = (n: string) => { let i = nid.get(n); if (i === undefined) { i = nets.length; nets.push(n); nid.set(n, i); } return i; };
  // owner maps: -1 free, >=0 single net, -2 blocked. Index = layer*N + cell.
  const own = new Int32Array(2 * N).fill(-1), ownV = new Int32Array(2 * N).fill(-1);
  const outline = boardOutline(d);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const p: Pt = [i * G, j * G], c = j * nx + i;
    const inside = pointInPoly(p, outline), e = inside ? distToPoly(p, outline) : -1;
    if (!inside || e < RULES.edgeClear + TW / 2 + 0.1) own[c] = own[N + c] = -2;
    if (!inside || e < RULES.edgeClear + VIA_D / 2 + 0.1) ownV[c] = ownV[N + c] = -2;
  }
  for (const k of d.keepouts ?? []) stampRect(k.x1, k.y1, k.x2, k.y2);
  function stampRect(x1: number, y1: number, x2: number, y2: number) {
    for (let j = Math.max(0, Math.floor(y1 / G) - 1); j <= Math.min(ny - 1, Math.ceil(y2 / G) + 1); j++)
      for (let i = Math.max(0, Math.floor(x1 / G) - 1); i <= Math.min(nx - 1, Math.ceil(x2 / G) + 1); i++) { const c = j * nx + i; own[c] = own[N + c] = ownV[c] = ownV[N + c] = -2; }
  }
  const mark = (arr: Int32Array, idx: number, n: number) => { const v = arr[idx]; arr[idx] = v === -1 || v === n ? n : -2; };
  function stamp(o: Obj) {
    const n = id(o.net), [x1, y1, x2, y2] = bbox(o.s), R = Math.max(R_TRACE, R_VIA, o.hole ? R_HOLE_VIA + 0.0 : 0) + 0.01;
    for (let j = Math.max(0, Math.floor((y1 - R) / G)); j <= Math.min(ny - 1, Math.ceil((y2 + R) / G)); j++)
      for (let i = Math.max(0, Math.floor((x1 - R) / G)); i <= Math.min(nx - 1, Math.ceil((x2 + R) / G)); i++) {
        const c = j * nx + i, dd = dShape([i * G, j * G], o.s);
        if (dd < R_TRACE) { if (o.top) mark(own, c, n); if (o.bot) mark(own, N + c, n); }
        if (dd < R_VIA || (o.hole && dd < R_HOLE_VIA)) { mark(ownV, c, n); mark(ownV, N + c, n); }
      }
  }
  // collect copper
  const objs: Obj[] = [];
  allPads(d).forEach((p, i) => {
    const s: Shape = p.shape === 'circle' ? { k: 'cap', a: [p.x, p.y], b: [p.x, p.y], r: p.w / 2 } : { k: 'rect', x1: p.x - p.w / 2, y1: p.y - p.h / 2, x2: p.x + p.w / 2, y2: p.y + p.h / 2 };
    if (p.npth) objs.push({ net: `#npth${i}`, top: true, bot: true, s, hole: true });
    else objs.push({ net: p.net ?? `#nc${i}`, top: p.side !== 'B' || !!p.drill, bot: p.side === 'B' || !!p.drill, s, hole: !!p.drill });
  });
  d.vias.forEach(v => objs.push({ net: v.net ?? `#v${v.id}`, top: true, bot: true, hole: true, s: { k: 'cap', a: [v.x, v.y], b: [v.x, v.y], r: v.d / 2 } }));
  d.traces.filter(t => t.layer !== 'TopSilk').forEach(t => t.pts.forEach((p, i) => {
    if (i === 0 && t.pts.length > 1) return; const top = t.layer === 'TopCopper';
    objs.push({ net: t.net ?? `#t${t.id}`, top, bot: !top, s: { k: 'cap', a: t.pts[Math.max(0, i - 1)], b: p, r: t.width / 2 } });
  }));
  objs.forEach(stamp);

  const out: RouteResult = { traces: [], vias: [], failed: [] };
  const routable = [...new Set(objs.map(o => o.net).filter(n => !n.startsWith('#')))].filter(n => !opts.skip?.(n));
  const order = opts.order ?? routable;
  const netObjs = (n: string) => objs.filter(o => o.net === n);
  let tid = 0;

  // A* state: (layer*N + cell)*4 + dir
  const S = 2 * N * 4, cost = new Float32Array(S), from = new Int32Array(S), seen = new Uint32Array(S); let gen = 0;
  const grp = new Int32Array(2 * N);

  for (const net of order) {
    if (!routable.includes(net)) continue;
    const n = id(net), pref = opts.prefer?.(net);
    for (;;) {
      // connected groups of this net's copper
      const os = netObjs(net); if (os.length < 2) break;
      const par = os.map((_, i) => i), f = (i: number): number => par[i] === i ? i : (par[i] = f(par[i]));
      for (let i = 0; i < os.length; i++) for (let j = i + 1; j < os.length; j++) {
        const a = os[i], b = os[j]; if (!((a.top && b.top) || (a.bot && b.bot))) continue;
        if (touch(a.s, b.s)) par[f(i)] = f(j);
      }
      const roots = [...new Set(os.map((_, i) => f(i)))]; if (roots.length < 2) break;
      // pick the group with most members as the tree; others are targets
      const size = new Map<number, number>(); os.forEach((_, i) => size.set(f(i), (size.get(f(i)) ?? 0) + 1));
      const tree = roots.sort((a, b) => (size.get(b)! - size.get(a)!))[0];
      grp.fill(-1);
      const tb: number[][] = [];
      os.forEach((o, i) => {
        const g = f(i) === tree ? 0 : 1 + roots.indexOf(f(i)); const [x1, y1, x2, y2] = bbox(o.s);
        if (g) { const b = (tb[g] ??= [Infinity, Infinity, -Infinity, -Infinity]); b[0] = Math.min(b[0], x1); b[1] = Math.min(b[1], y1); b[2] = Math.max(b[2], x2); b[3] = Math.max(b[3], y2); }
        for (let j = Math.max(0, Math.floor(y1 / G) - 1); j <= Math.min(ny - 1, Math.ceil(y2 / G) + 1); j++)
          for (let ii = Math.max(0, Math.floor(x1 / G) - 1); ii <= Math.min(nx - 1, Math.ceil(x2 / G) + 1); ii++) {
            const c = j * nx + ii; if (dShape([ii * G, j * G], o.s) > TW / 2 - 0.02) continue;
            if (o.top && (own[c] === n)) grp[c] = g === 0 ? 0 : (grp[c] > 0 ? grp[c] : g);
            if (o.bot && (own[N + c] === n)) grp[N + c] = g === 0 ? 0 : (grp[N + c] > 0 ? grp[N + c] : g);
          }
      });
      const targets = tb.map((b, g) => b ? g : -1).filter(g => g > 0);
      const h = (c: number) => { const x = (c % nx) * G, y = Math.floor(c / nx) * G; let m = Infinity; for (const g of targets) { const b = tb[g]; m = Math.min(m, Math.max(0, b[0] - x, x - b[2]) + Math.max(0, b[1] - y, y - b[3])); } return m / G; };
      // search
      gen++; const heap = new Heap();
      for (let L = 0; L < 2; L++) for (let c = 0; c < N; c++) if (grp[L * N + c] === 0) for (let dir = 0; dir < 4; dir++) {
        const s = ((L * N + c) << 2) | dir; seen[s] = gen; cost[s] = 0; from[s] = -1; heap.push(s, h(c));
      }
      let goal = -1; const dx = [1, -1, 0, 0], dy = [0, 0, 1, -1];
      let pops = 0;
      while (heap.size && pops < 4e6) {
        const s = heap.pop(); pops++; const lc = s >> 2, dir = s & 3, L = lc >= N ? 1 : 0, c = lc - L * N;
        const g0 = cost[s];
        if (grp[lc] > 0) { goal = s; break; }
        const x = c % nx, y = (c / nx) | 0;
        const lw = (LL: number) => (pref ? ((pref === 'top') === (LL === 0) ? 1 : 2.2) : 1);
        for (let k = 0; k < 4; k++) {
          const X = x + dx[k], Y = y + dy[k]; if (X < 0 || Y < 0 || X >= nx || Y >= ny) continue;
          const cc = Y * nx + X, ix = L * N + cc, o = own[ix]; if (o !== -1 && o !== n) continue;
          const ns = (ix << 2) | k, nc = g0 + lw(L) + (k !== dir ? 0.6 : 0);
          if (seen[ns] !== gen || nc < cost[ns]) { seen[ns] = gen; cost[ns] = nc; from[ns] = s; heap.push(ns, nc + h(cc)); }
        }
        // via
        const okV = (ownV[c] === -1 || ownV[c] === n) && (ownV[N + c] === -1 || ownV[N + c] === n);
        const o2 = own[(1 - L) * N + c];
        if (okV && (o2 === -1 || o2 === n)) {
          const ns = ((((1 - L) * N + c)) << 2) | dir, nc = g0 + 9;
          if (seen[ns] !== gen || nc < cost[ns]) { seen[ns] = gen; cost[ns] = nc; from[ns] = s; heap.push(ns, nc + h(c)); }
        }
      }
      if (goal < 0) { out.failed.push(net); break; }
      // backtrack -> cells
      const path: number[] = []; for (let s = goal; s >= 0; s = from[s]) path.push(s >> 2); path.reverse();
      const pt = (lc: number): Pt => { const c = lc % N; return [+((c % nx) * G).toFixed(3), +(Math.floor(c / nx) * G).toFixed(3)]; };
      let run: Pt[] = [pt(path[0])], layer = path[0] >= N ? 1 : 0;
      const flush = () => {
        if (run.length >= 2) {
          const pts: Pt[] = [run[0]]; for (let i = 1; i < run.length - 1; i++) { const a = pts[pts.length - 1], b = run[i], c = run[i + 1]; if ((b[0] - a[0]) * (c[1] - b[1]) !== (b[1] - a[1]) * (c[0] - b[0])) pts.push(b); } pts.push(run[run.length - 1]);
          const t: Trace = { id: `R${++tid}`, layer: layer ? 'BottomCopper' : 'TopCopper', width: TW, pts, net };
          out.traces.push(t); d.traces.push(t);
          pts.forEach((p, i) => { if (i) { const o: Obj = { net, top: !layer, bot: !!layer, s: { k: 'cap', a: pts[i - 1], b: p, r: TW / 2 } }; objs.push(o); stamp(o); } });
        }
      };
      for (let i = 1; i < path.length; i++) {
        const L = path[i] >= N ? 1 : 0;
        if (L !== layer) {
          flush(); const p = pt(path[i]);
          const v: Via = { id: `RV${out.vias.length + 1}`, x: p[0], y: p[1], d: VIA_D, drill: VIA_DRILL, net };
          out.vias.push(v); d.vias.push(v);
          const o: Obj = { net, top: true, bot: true, hole: true, s: { k: 'cap', a: p, b: p, r: VIA_D / 2 } }; objs.push(o); stamp(o);
          layer = L; run = [p];
        } else run.push(pt(path[i]));
      }
      flush();
      if (path.length === 1) { // tree and target touch the same cell: add a dot trace
        const p = pt(path[0]); const t: Trace = { id: `R${++tid}`, layer: layer ? 'BottomCopper' : 'TopCopper', width: TW, pts: [p, p], net }; out.traces.push(t); d.traces.push(t);
        const o: Obj = { net, top: !layer, bot: !!layer, s: { k: 'cap', a: p, b: p, r: TW / 2 } }; objs.push(o); stamp(o);
      }
    }
  }
  return out;
}

function touch(a: Shape, b: Shape): boolean {
  if (a.k === 'rect' && b.k === 'rect') return a.x1 <= b.x2 && b.x1 <= a.x2 && a.y1 <= b.y2 && b.y1 <= a.y2;
  if (a.k === 'rect') return touch(b, a);
  if (b.k === 'rect') { // capsule vs rect: sample along capsule
    const n = 1 + Math.ceil(Math.hypot(a.b[0] - a.a[0], a.b[1] - a.a[1]) / 0.05);
    for (let i = 0; i <= n; i++) { const t = i / n; if (dShape([a.a[0] + t * (a.b[0] - a.a[0]), a.a[1] + t * (a.b[1] - a.a[1])], b) <= a.r + 1e-6) return true; }
    return false;
  }
  const n = 1 + Math.ceil(Math.hypot(a.b[0] - a.a[0], a.b[1] - a.a[1]) / 0.05);
  for (let i = 0; i <= n; i++) { const t = i / n; if (dShape([a.a[0] + t * (a.b[0] - a.a[0]), a.a[1] + t * (a.b[1] - a.a[1])], b) <= a.r + 1e-6) return true; }
  return false;
}

class Heap {
  k: number[] = []; v: number[] = [];
  get size() { return this.k.length; }
  push(val: number, key: number) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop(): number {
    const k = this.k, v = this.v, top = v[0], lk = k.pop()!, lv = v.pop()!;
    if (k.length) {
      let i = 0; const n = k.length;
      for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && k[c + 1] < k[c]) c++; if (k[c] >= lk) break; k[i] = k[c]; v[i] = v[c]; i = c; }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
}

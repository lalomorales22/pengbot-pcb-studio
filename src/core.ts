// Core geometry + Gerber/Excellon export. Pure TS (browser + node).
// Units: integer nanometres internally. Gerber uses FSLAX46Y46 in mm => 1 unit = 1 nm.
import JSZip from 'jszip';
import { FP, xf } from './footprints';
import { textRects } from './font';

export const NM = 1_000_000; // nm per mm
export const BOARD = { w: 50 * NM, h: 50 * NM };

export type LayerId = 'TopCopper' | 'TopMask' | 'TopSilk' | 'TopPaste' | 'BottomCopper' | 'BottomMask' | 'BottomSilk' | 'Outline';
export const LAYERS: LayerId[] = ['TopCopper', 'TopMask', 'TopSilk', 'TopPaste', 'BottomCopper', 'BottomMask', 'BottomSilk', 'Outline'];
export const ART_LAYERS: LayerId[] = ['TopSilk', 'TopCopper', 'TopMask'];

/** Axis-aligned rect in nm (y up, origin = board bottom-left). */
export interface Rect { x: number; y: number; w: number; h: number }
export interface Art { layer: LayerId; rects: Rect[] }

export interface Gray { width: number; height: number; lum: Uint8Array; alpha: Uint8Array }
export interface VecOpts { threshold: number; invert: boolean; dither: boolean; sizeMm: number; cxMm: number; cyMm: number }

/** Threshold (optionally Floyd–Steinberg dither) to a boolean mask. Transparent pixels = off. */
export function toMask(g: Gray, o: VecOpts): Uint8Array {
  const { width: W, height: H } = g;
  const v = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) v[i] = g.lum[i];
  const m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const on = v[i] < o.threshold; // dark = ink
    m[i] = (o.invert ? !on : on) && g.alpha[i] > 127 ? 1 : 0;
    if (o.dither) {
      const err = v[i] - (v[i] < o.threshold ? 0 : 255);
      if (x + 1 < W) v[i + 1] += err * 7 / 16;
      if (y + 1 < H) {
        if (x > 0) v[i + W - 1] += err * 3 / 16;
        v[i + W] += err * 5 / 16;
        if (x + 1 < W) v[i + W + 1] += err / 16;
      }
    }
  }
  return m;
}

/** Vectorize mask -> merged rectangles (row runs merged vertically). Exact, gap-free, Gerber-safe. */
export function vectorize(g: Gray, o: VecOpts, bw = BOARD.w, bh = BOARD.h): Rect[] {
  const m = toMask(g, o);
  const { width: W, height: H } = g;
  const px = Math.round((o.sizeMm * NM) / Math.max(W, H));
  const x0 = Math.round(o.cxMm * NM - (W * px) / 2), yTop = Math.round(o.cyMm * NM + (H * px) / 2);
  const open = new Map<string, Rect>(); const out: Rect[] = [];
  for (let y = 0; y < H; y++) {
    const runs: [number, number][] = [];
    for (let x = 0; x < W;) {
      if (!m[y * W + x]) { x++; continue; }
      const s = x; while (x < W && m[y * W + x]) x++; runs.push([s, x]);
    }
    const next = new Map<string, Rect>();
    for (const [s, e] of runs) {
      const k = s + ':' + e; const r = open.get(k);
      const ry = yTop - (y + 1) * px;
      if (r) { r.y = ry; r.h += px; open.delete(k); next.set(k, r); }
      else next.set(k, { x: x0 + s * px, y: ry, w: (e - s) * px, h: px });
    }
    open.forEach(r => out.push(r)); open.clear(); next.forEach((r, k) => open.set(k, r));
  }
  open.forEach(r => out.push(r));
  // clip to board
  return out.map(r => {
    const x1 = Math.max(0, r.x), y1 = Math.max(0, r.y), x2 = Math.min(bw, r.x + r.w), y2 = Math.min(bh, r.y + r.h);
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }).filter(r => r.w > 0 && r.h > 0);
}

// ---------- Design model (mm, y up, origin = board bottom-left) ----------
export type Pt = [number, number];
export type DrawLayer = 'TopCopper' | 'TopSilk';
export interface Trace { id: string; layer: DrawLayer; width: number; pts: Pt[]; net?: string; brush?: boolean }
export interface Via { id: string; x: number; y: number; d: number; drill: number; net?: string }
export interface UserPad { id: string; x: number; y: number; w: number; h: number; shape: 'rect' | 'circle'; net?: string }
export interface Chip { id: string; fp: string; x: number; y: number; rot: number; ref: string; value?: string; nets?: Record<string, string> }
export interface SilkText { id: string; text: string; x: number; y: number; px: number; rot: 0 | 90 }
export interface Pour { layer: 'BottomCopper'; net: string; clearance: number; margin: number }
export interface Design {
  name?: string; board: { w: number; h: number };
  art: Art[]; traces: Trace[]; vias: Via[]; pads: UserPad[]; chips: Chip[]; texts: SilkText[]; pours: Pour[];
  /** Copper keepouts (mm), e.g. the ESP32 antenna: cleared from pours on every layer, no traces/pads allowed. */
  penguinCount?: { top: number; bottom: number };
  keepouts?: { x1: number; y1: number; x2: number; y2: number; label?: string }[];
}
export const emptyDesign = (w = 50, h = 50): Design => ({ board: { w, h }, art: [], traces: [], vias: [], pads: [], chips: [], texts: [], pours: [] });

// JLCPCB-friendly defaults (2-layer, 1 oz): see README
export const RULES = { minTrace: 0.15, minClear: 0.2, viaD: 0.6, viaDrill: 0.3, maskExp: 0.05, silkClear: 0.15, minSilk: 0.15, edgeClear: 0.3 };

export interface AbsPad { x: number; y: number; w: number; h: number; shape: 'rect' | 'circle'; drill?: number; chip?: string; ref?: string; num?: string; net?: string }
export function chipPads(c: Chip): AbsPad[] {
  const f = FP[c.fp]; if (!f) return [];
  const swap = c.rot % 180 !== 0;
  return f.pads.map(p => {
    const [x, y] = xf(p.x, p.y, c.rot, c.x, c.y);
    return { x, y, w: swap ? p.h : p.w, h: swap ? p.w : p.h, shape: p.shape, drill: p.drill, chip: c.id, ref: c.ref, num: p.num, net: c.nets?.[p.num] };
  });
}
export function allPads(d: Design): AbsPad[] { return [...d.chips.flatMap(chipPads), ...d.pads.map(p => ({ ...p }))]; }
export function chipSilk(c: Chip): { lines: [Pt, Pt][]; dots: [number, number, number][] } {
  const f = FP[c.fp]; if (!f) return { lines: [], dots: [] };
  return {
    lines: f.silk.lines.map(([a, b, e, g]) => [xf(a, b, c.rot, c.x, c.y), xf(e, g, c.rot, c.x, c.y)] as [Pt, Pt]),
    dots: f.silk.dots.map(([a, b, dd]) => { const [x, y] = xf(a, b, c.rot, c.x, c.y); return [x, y, dd] as [number, number, number]; }),
  };
}
export function textRectsNm(d: Design): Rect[] {
  return d.texts.flatMap(t => textRects(t.text, t.x, t.y, t.px, t.rot)).map(([x1, y1, x2, y2]) => ({ x: Math.round(x1 * NM), y: Math.round(y1 * NM), w: Math.round((x2 - x1) * NM), h: Math.round((y2 - y1) * NM) }));
}

// Primitives per layer (mm). Art rects stay in nm. pol 'C' = clear (Gerber %LPC%).
export type Prim = ({ t: 'rect'; x1: number; y1: number; x2: number; y2: number } | { t: 'circ'; x: number; y: number; d: number } | { t: 'line'; pts: Pt[]; w: number }) & { pol?: 'C' };
const padPrim = (p: AbsPad, exp = 0): Prim => p.shape === 'circle'
  ? { t: 'circ', x: p.x, y: p.y, d: p.w + 2 * exp }
  : { t: 'rect', x1: p.x - p.w / 2 - exp, y1: p.y - p.h / 2 - exp, x2: p.x + p.w / 2 + exp, y2: p.y + p.h / 2 + exp };
const clear = (p: Prim): Prim => ({ ...p, pol: 'C' });

/** Copper pour on bottom: full fill minus clearances, then same-net pads/vias reconnected with 4-spoke thermals. */
export function pourPrims(d: Design, pr: Pour): Prim[] {
  const { w, h } = d.board, m = pr.margin, cl = pr.clearance;
  const out: Prim[] = [{ t: 'rect', x1: m, y1: m, x2: w - m, y2: h - m }];
  const holes = [...allPads(d).filter(p => p.drill), ...d.vias.map(v => ({ x: v.x, y: v.y, w: v.d, h: v.d, shape: 'circle' as const, net: v.net, drill: v.drill }))];
  for (const p of holes) out.push(clear(padPrim(p, cl)));
  for (const k of d.keepouts ?? []) out.push(clear({ t: 'rect', x1: k.x1, y1: k.y1, x2: k.x2, y2: k.y2 }));
  for (const t of d.traces.filter(t => (t.layer as string) === pr.layer)) out.push(clear({ t: 'line', pts: t.pts, w: t.width + 2 * cl }));
  for (const p of holes.filter(p => p.net === pr.net)) {
    const r = Math.max(p.w, p.h) / 2 + cl + 0.1, sw = 0.5;
    out.push({ t: 'line', pts: [[p.x - r, p.y], [p.x + r, p.y]], w: sw }, { t: 'line', pts: [[p.x, p.y - r], [p.x, p.y + r]], w: sw }, padPrim(p));
  }
  return out;
}

export function layerPrims(d: Design, layer: LayerId): { rects: Rect[]; prims: Prim[] } {
  const rects = d.art.filter(a => a.layer === layer).flatMap(a => a.rects);
  const pads = allPads(d), tht = pads.filter(p => p.drill), smd = pads.filter(p => !p.drill);
  const prims: Prim[] = [];
  const traces = (l: DrawLayer) => d.traces.filter(t => t.layer === l).forEach(t => prims.push({ t: 'line', pts: t.pts, w: t.width }));
  const viaPrims = () => d.vias.forEach(v => prims.push({ t: 'circ', x: v.x, y: v.y, d: v.d }));
  switch (layer) {
    case 'TopCopper': traces('TopCopper'); pads.forEach(p => prims.push(padPrim(p))); viaPrims(); break;
    case 'BottomCopper':
      d.pours.filter(p => p.layer === 'BottomCopper').forEach(p => prims.push(...pourPrims(d, p)));
      tht.forEach(p => prims.push(padPrim(p))); viaPrims(); break;
    case 'TopMask': pads.forEach(p => prims.push(padPrim(p, RULES.maskExp))); break;
    case 'BottomMask': tht.forEach(p => prims.push(padPrim(p, RULES.maskExp))); break;
    case 'TopPaste': smd.forEach(p => prims.push(padPrim(p))); break;
    case 'TopSilk':
      rects.push(...textRectsNm(d));
      traces('TopSilk');
      for (const c of d.chips) { const s = chipSilk(c); s.lines.forEach(l => prims.push({ t: 'line', pts: l, w: 0.15 })); s.dots.forEach(([x, y, dd]) => prims.push({ t: 'circ', x, y, d: dd })); }
      pads.forEach(p => prims.push(clear(padPrim(p, RULES.maskExp + RULES.silkClear)))); // keep silk off pads
      break;
    case 'BottomSilk':
      tht.forEach(p => prims.push(clear(padPrim(p, RULES.maskExp + RULES.silkClear))));
      d.vias.forEach(v => prims.push(clear({ t: 'circ', x: v.x, y: v.y, d: v.d + 2 * RULES.silkClear })));
      break;
  }
  return { rects, prims };
}

// ---------- Gerber ----------
const PFX = 'penguin-pcb';
const FILES: Record<LayerId, { ext: string; fn: string; pol: string; desc: string }> = {
  TopCopper: { ext: 'GTL', fn: 'Copper,L1,Top', pol: 'Positive', desc: 'Top copper' },
  TopMask: { ext: 'GTS', fn: 'Soldermask,Top', pol: 'Negative', desc: 'Top solder mask (shapes = mask OPENINGS)' },
  TopSilk: { ext: 'GTO', fn: 'Legend,Top', pol: 'Positive', desc: 'Top silkscreen' },
  TopPaste: { ext: 'GTP', fn: 'Paste,Top', pol: 'Positive', desc: 'Top paste (stencil, SMD pads)' },
  BottomCopper: { ext: 'GBL', fn: 'Copper,L2,Bot', pol: 'Positive', desc: 'Bottom copper (GND pour)' },
  BottomMask: { ext: 'GBS', fn: 'Soldermask,Bot', pol: 'Negative', desc: 'Bottom solder mask' },
  BottomSilk: { ext: 'GBO', fn: 'Legend,Bot', pol: 'Positive', desc: 'Bottom silkscreen' },
  Outline: { ext: 'GKO', fn: 'Profile,NP', pol: 'Positive', desc: 'Board outline' },
};
export const fileName = (l: LayerId) => `${PFX}.${FILES[l].ext}`;
const c = (n: number) => String(Math.round(n));
const n = (mm: number) => c(mm * NM);

export function gerber(layer: LayerId, rects: Rect[], prims: Prim[] = [], board = { w: 50, h: 50 }): string {
  const f = FILES[layer];
  const L = ['G04 Penguin PCB Studio*', '%TF.GenerationSoftware,LaloMorales,PenguinPCBStudio,0.3*%', `%TF.FileFunction,${f.fn}*%`,
    `%TF.FilePolarity,${f.pol}*%`, '%FSLAX46Y46*%', '%MOMM*%', '%LPD*%'];
  if (layer === 'Outline') {
    L.push('%TA.AperFunction,Profile*%', '%ADD10C,0.100000*%', '%TD*%', 'D10*', 'G01*',
      `X0Y0D02*`, `X${n(board.w)}Y0D01*`, `X${n(board.w)}Y${n(board.h)}D01*`, `X0Y${n(board.h)}D01*`, 'X0Y0D01*');
    L.push('M02*'); return L.join('\n') + '\n';
  }
  const ap = new Map<string, number>();
  const apFor = (dmm: number) => { const k = dmm.toFixed(4); if (!ap.has(k)) ap.set(k, 10 + ap.size); return ap.get(k)!; };
  prims.forEach(p => { if (p.t === 'circ') apFor(p.d); if (p.t === 'line') apFor(p.w); });
  ap.forEach((d, k) => L.push(`%ADD${d}C,${Number(k).toFixed(6)}*%`));
  L.push('G01*');
  const region = (x1: string, y1: string, x2: string, y2: string) =>
    L.push('G36*', `X${x1}Y${y1}D02*`, `X${x2}Y${y1}D01*`, `X${x2}Y${y2}D01*`, `X${x1}Y${y2}D01*`, `X${x1}Y${y1}D01*`, 'G37*');
  for (const r of rects) region(c(r.x), c(r.y), c(r.x + r.w), c(r.y + r.h));
  let pol = 'D';
  for (const p of prims) {
    const want = p.pol === 'C' ? 'C' : 'D';
    if (want !== pol) { L.push(`%LP${want}*%`); pol = want; }
    if (p.t === 'rect') region(n(p.x1), n(p.y1), n(p.x2), n(p.y2));
    else if (p.t === 'circ') L.push(`D${apFor(p.d)}*`, `X${n(p.x)}Y${n(p.y)}D03*`);
    else if (p.pts.length) {
      L.push(`D${apFor(p.w)}*`);
      if (p.pts.length === 1) L.push(`X${n(p.pts[0][0])}Y${n(p.pts[0][1])}D03*`);
      else p.pts.forEach(([x, y], i) => L.push(`X${n(x)}Y${n(y)}${i ? 'D01' : 'D02'}*`));
    }
  }
  if (pol !== 'D') L.push('%LPD*%');
  L.push('M02*');
  return L.join('\n') + '\n';
}

export function drills(d: Design): { x: number; y: number; dia: number; plated: boolean }[] {
  return [...allPads(d).filter(p => p.drill).map(p => ({ x: p.x, y: p.y, dia: p.drill!, plated: true })),
    ...d.vias.map(v => ({ x: v.x, y: v.y, dia: v.drill, plated: true }))];
}

export function excellon(d: Design = emptyDesign()): string {
  const hs = drills(d);
  const tools = [...new Set(hs.map(h => h.dia.toFixed(3)))].sort();
  const L = ['M48', '; Penguin PCB Studio - plated holes', 'FMAT,2', 'METRIC,TZ'];
  tools.forEach((t, i) => L.push(`T${i + 1}C${t}`));
  if (!tools.length) L.push('T1C0.300');
  L.push('%', 'G90', 'G05');
  tools.forEach((t, i) => { L.push(`T${i + 1}`); hs.filter(h => h.dia.toFixed(3) === t).forEach(h => L.push(`X${h.x.toFixed(3)}Y${h.y.toFixed(3)}`)); });
  L.push('M30', '');
  return L.join('\n');
}

// ---------- BOM / CPL (JLCPCB column names; LCSC part # left for you to fill) ----------
export function bomCsv(d: Design): string {
  const groups = new Map<string, Chip[]>();
  for (const c of d.chips) { const k = `${c.value ?? FP[c.fp]?.name}|${c.fp}`; groups.set(k, [...(groups.get(k) ?? []), c]); }
  const rows = [...groups.values()].map(cs => `"${cs[0].value ?? FP[cs[0].fp]?.name}","${cs.map(c => c.ref).join(',')}","${cs[0].fp}",""`);
  return ['Comment,Designator,Footprint,LCSC Part #', ...rows].join('\n') + '\n';
}
export function cplCsv(d: Design): string {
  return ['Designator,Mid X,Mid Y,Layer,Rotation', ...d.chips.map(c => `${c.ref},${c.x.toFixed(3)}mm,${c.y.toFixed(3)}mm,Top,${c.rot}`)].join('\n') + '\n';
}

function readme(d: Design) {
  return `Penguin PCB Studio export - ${d.name ?? 'board'}
${d.board.w} x ${d.board.h} mm, 2 layers, FR-4 1.6 mm, 1 oz, HASL or ENIG. Upload this zip as-is to JLCPCB (or OSH Park).

${LAYERS.map(l => `${fileName(l).padEnd(18)} ${FILES[l].desc}`).join('\n')}
${(PFX + '.DRL').padEnd(18)} Excellon drills (${drills(d).length} plated holes)
bom.csv / cpl.csv  BOM + placement (JLCPCB column names; fill LCSC part numbers before ordering assembly)

Parts: ${d.chips.map(c => `${c.ref}=${c.value ?? c.fp}`).join(', ') || 'none'}
Keepouts: ${(d.keepouts ?? []).map(k => `${k.label ?? 'keepout'} ${k.x1},${k.y1}-${k.x2},${k.y2} mm`).join('; ') || 'none'}
Traces: ${d.traces.length}  Vias: ${d.vias.length}  Pads: ${d.pads.length}  Pours: ${d.pours.map(p => p.layer + ':' + p.net).join(', ') || 'none'}

Rules used: min trace ${RULES.minTrace} mm (signals 0.25, power 0.4), clearance >= ${RULES.minClear} mm, via ${RULES.viaD}/${RULES.viaDrill} mm
(annular ring 0.15), solder-mask expansion ${RULES.maskExp} mm, silk clipped ${RULES.silkClear} mm off pads, silk stroke >= ${RULES.minSilk} mm.
Format: Gerber RS-274X with X2 file attributes, mm, 4.6 format; clear polarity (%LPC%) used for pour clearances.
`;
}

/** Accepts a full Design, or (legacy) a bare Art[] list on a 50 x 50 board. */
export async function buildZip(input: Design | Art[]): Promise<JSZip> {
  const d: Design = Array.isArray(input) ? { ...emptyDesign(), art: input } : input;
  const zip = new JSZip();
  for (const l of LAYERS) { const { rects, prims } = layerPrims(d, l); zip.file(fileName(l), gerber(l, rects, prims, d.board)); }
  zip.file(PFX + '.DRL', excellon(d));
  if (d.chips.length) { zip.file('bom.csv', bomCsv(d)); zip.file('cpl.csv', cplCsv(d)); }
  zip.file('README.txt', readme(d));
  return zip;
}

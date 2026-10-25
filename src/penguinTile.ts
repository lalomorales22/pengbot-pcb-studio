// Tiles Lalo's hand-drawn penguin all over a board as silkscreen, dodging parts, pads, labels and the antenna keepout.
import { Art, LayerId, NM, Rect } from './core';
import { LALO_PENGUIN } from './laloPenguinMask';

/** mm rect, origin bottom-left, y up. */
export interface MmRect { x1: number; y1: number; x2: number; y2: number }
export interface TileOpts {
  board: { w: number; h: number };
  scaleMm: number;          // penguin width in mm
  marginMm?: number;        // keep this far from avoidRects + board edge
  avoidRects?: MmRect[];
  cols?: number; rows?: number; // grid; default = fill the board at ~pitch
  pitch?: number;           // centre spacing as a fraction of size (<1 = penguins overlap a bit)
  layer?: LayerId;
  mirror?: boolean;         // mirror the whole set (for BottomSilk, so they read right side up from below)
  alternate?: boolean;      // flip every other penguin for a hand-stamped look
  occupied?: MmRect[];      // tiles already placed (second pass fills gaps around these)
  maxOverlap?: number;      // allowed overlap with occupied, fraction of tile area
  pxMm?: number;            // silk pixel size; >= 0.15 keeps every line JLC-printable
  inside?: (box: MmRect) => boolean; // e.g. custom board outline test
}
export interface TileResult { art: Art; placed: (MmRect & { flip: boolean })[] }

const SRC = LALO_PENGUIN;
const srcInk = (x: number, y: number) => SRC.rows[y]?.[x] === '1';

/** Downsample the line-art to a cols x rows bitmap; a cell is ink if >= 22% of it is ink (keeps thin strokes). */
function bitmap(cols: number, flip: boolean): { w: number; h: number; m: Uint8Array } {
  const s = SRC.width / cols, rows = Math.max(1, Math.round(SRC.height / s)), m = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    let n = 0, t = 0;
    for (let y = Math.floor(r * s); y < Math.min(SRC.height, Math.ceil((r + 1) * s)); y++)
      for (let x = Math.floor(c * s); x < Math.min(SRC.width, Math.ceil((c + 1) * s)); x++) { t++; if (srcInk(x, y)) n++; }
    if (t && n / t >= 0.22) m[r * cols + (flip ? cols - 1 - c : c)] = 1;
  }
  return { w: cols, h: rows, m };
}

/** Merged rects (nm) for one penguin with its bottom-left at the origin. Cached per size/flip. */
const cache = new Map<string, { rects: Rect[]; wMm: number; hMm: number }>();
export function penguinRects(scaleMm: number, flip = false, pxMm = 0.16) {
  const cols = Math.max(12, Math.round(scaleMm / pxMm)), key = `${cols}|${flip}|${scaleMm}`;
  const hit = cache.get(key); if (hit) return hit;
  const { w, h, m } = bitmap(cols, flip), px = Math.round((scaleMm * NM) / w);
  const out: Rect[] = []; let open = new Map<string, Rect>();
  for (let r = 0; r < h; r++) {
    const next = new Map<string, Rect>(), y = (h - 1 - r) * px;
    for (let c = 0; c < w;) {
      if (!m[r * w + c]) { c++; continue; }
      const s = c; while (c < w && m[r * w + c]) c++;
      const k = s + ':' + c, o = open.get(k);
      if (o) { o.y = y; o.h += px; open.delete(k); next.set(k, o); } else next.set(k, { x: s * px, y, w: (c - s) * px, h: px });
    }
    open.forEach(v => out.push(v)); open = next;
  }
  open.forEach(v => out.push(v));
  const res = { rects: out, wMm: (w * px) / NM, hMm: (h * px) / NM }; cache.set(key, res); return res;
}

const hit = (a: MmRect, b: MmRect) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
const overlapArea = (a: MmRect, b: MmRect) => Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)) * Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));

/** Stamp many copies of Lalo's penguin on a silk layer. Tiles whose (slightly shrunk) box touches any avoid rect are skipped. */
export function tilePenguinArt(o: TileOpts): TileResult {
  const { board, scaleMm } = o, margin = o.marginMm ?? 0.4, pitch = o.pitch ?? 0.92, px = o.pxMm ?? 0.16;
  const base = penguinRects(scaleMm, false, px), tw = base.wMm, th = base.hMm;
  const sx = tw * pitch, sy = th * pitch;
  const cols = o.cols ?? Math.floor((board.w - 2 * margin - tw) / sx) + 1, rows = o.rows ?? Math.floor((board.h - 2 * margin - th) / sy) + 1;
  const ox = (board.w - ((cols - 1) * sx + tw)) / 2, oy = (board.h - ((rows - 1) * sy + th)) / 2;
  const avoid = (o.avoidRects ?? []).map(r => ({ x1: r.x1 - margin, y1: r.y1 - margin, x2: r.x2 + margin, y2: r.y2 + margin }));
  const occ = o.occupied ?? [], maxOv = o.maxOverlap ?? 0.12;
  const placed: TileResult['placed'] = [], rects: Rect[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x1 = ox + c * sx + (r % 2 ? sx / 2 : 0), y1 = oy + r * sy; // brick offset on odd rows
    const box = { x1, y1, x2: x1 + tw, y2: y1 + th };
    if (box.x1 < margin || box.y1 < margin || box.x2 > board.w - margin || box.y2 > board.h - margin) continue;
    const ink = { x1: x1 + tw * 0.06, y1: y1 + th * 0.04, x2: box.x2 - tw * 0.06, y2: box.y2 - th * 0.04 };
    if (avoid.some(a => hit(ink, a))) continue;
    if (o.inside && !o.inside({ x1: box.x1 - margin, y1: box.y1 - margin, x2: box.x2 + margin, y2: box.y2 + margin })) continue;
    if (occ.some(q => overlapArea(box, q) > maxOv * tw * th)) continue;
    const flip = (o.alternate ? (r + c) % 2 === 1 : false) !== !!o.mirror;
    const g = penguinRects(scaleMm, flip, px), X = Math.round(x1 * NM), Y = Math.round(y1 * NM);
    for (const q of g.rects) rects.push({ x: q.x + X, y: q.y + Y, w: q.w, h: q.h });
    placed.push({ ...box, flip });
  }
  return { art: { layer: o.layer ?? 'TopSilk', rects }, placed };
}

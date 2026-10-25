// Paints one board side (top/bottom) into a 2D canvas used as a Three.js texture. Units inside = mm.
import { Art, Design, LayerId, NM, Rect, allPads, chipSilk, onBot, onTop, textRectsNm } from './core';
import { FP } from './footprints';

export interface Look { mask: string; maskCopper: string; silk: string; fr4: string; gold: string; copper: string }
export const MASKS: Record<string, Look> = {
  'Glacier navy': { mask: '#0d2a4d', maskCopper: '#1d4a7c', silk: '#f4f8fb', fr4: '#b8a77a', gold: '#d9b45a', copper: '#c98a4b' },
  'Penguin black': { mask: '#101114', maskCopper: '#24262c', silk: '#f4f8fb', fr4: '#b8a77a', gold: '#d9b45a', copper: '#c98a4b' },
  'Snow white': { mask: '#e9eef2', maskCopper: '#d3dbe2', silk: '#15171c', fr4: '#b8a77a', gold: '#d9b45a', copper: '#c98a4b' },
  'Classic green': { mask: '#1e5a2e', maskCopper: '#2f7a42', silk: '#f4f8fb', fr4: '#b8a77a', gold: '#d9b45a', copper: '#c98a4b' },
};

export type Sel = { kind: 'chip' | 'trace' | 'via' | 'pad'; id: string } | null;
export interface PaintOpts { look: Look; vis: Record<LayerId, boolean>; grid: number; showGrid: boolean; preview?: Art | null; sel: Sel }

export function paintSide(cv: HTMLCanvasElement, side: 'top' | 'bottom', d: Design, o: PaintOpts) {
  const { w: BW, h: BH } = d.board, k = cv.width / BW, ctx = cv.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const top = side === 'top', L = o.look;
  const maskOn = o.vis[top ? 'TopMask' : 'BottomMask'], cuOn = o.vis[top ? 'TopCopper' : 'BottomCopper'];
  ctx.fillStyle = maskOn ? L.mask : L.fr4; ctx.fillRect(0, 0, cv.width, cv.height);
  if (top) ctx.setTransform(k, 0, 0, -k, 0, cv.height); else ctx.setTransform(k, 0, 0, k, 0, 0);

  const rects = (rs: Rect[]) => { ctx.beginPath(); for (const r of rs) ctx.rect(r.x / NM, r.y / NM, r.w / NM, r.h / NM); ctx.fill(); };
  const circle = (x: number, y: number, dd: number) => { ctx.beginPath(); ctx.arc(x, y, dd / 2, 0, Math.PI * 2); ctx.fill(); };
  const polyline = (pts: [number, number][], w: number) => { ctx.lineWidth = w; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); if (pts.length === 1) circle(pts[0][0], pts[0][1], w); else ctx.stroke(); };
  const pads = allPads(d);
  const sidePads = top ? pads.filter(onTop) : pads.filter(onBot), npth = pads.filter(p => p.npth);
  const holes = [...pads.filter(p => p.drill && !p.npth), ...d.vias.map(v => ({ x: v.x, y: v.y, w: v.d, h: v.d, shape: 'circle' as const, net: v.net }))];
  const padPath = (list: typeof sidePads, exp = 0) => {
    for (const p of list) {
      if (p.shape === 'circle') { ctx.moveTo(p.x + p.w / 2 + exp, p.y); ctx.arc(p.x, p.y, p.w / 2 + exp, 0, Math.PI * 2); }
      else ctx.rect(p.x - p.w / 2 - exp, p.y - p.h / 2 - exp, p.w + 2 * exp, p.h + 2 * exp);
    }
  };
  const copper = (color: string) => {
    ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (top) {
      rects(d.art.filter(a => a.layer === 'TopCopper').flatMap(a => a.rects));
      d.traces.filter(t => t.layer === 'TopCopper').forEach(t => polyline(t.pts, t.width));
    } else {
      rects(d.art.filter(a => a.layer === 'BottomCopper').flatMap(a => a.rects));
      d.traces.filter(t => t.layer === 'BottomCopper').forEach(t => polyline(t.pts, t.width));
      for (const pr of d.pours) { // GND pour with clearances + thermal spokes
        const c = pr.clearance; ctx.fillRect(pr.margin, pr.margin, BW - 2 * pr.margin, BH - 2 * pr.margin);
        ctx.fillStyle = maskOn ? L.mask : L.fr4; ctx.beginPath(); padPath(holes, c); ctx.fill();
        for (const k of d.keepouts ?? []) ctx.fillRect(k.x1, k.y1, k.x2 - k.x1, k.y2 - k.y1);
        ctx.fillStyle = color; ctx.strokeStyle = color;
        for (const p of holes.filter(p => p.net === pr.net)) { const r = Math.max(p.w, p.h) / 2 + c + 0.1; polyline([[p.x - r, p.y], [p.x + r, p.y]], 0.5); polyline([[p.x, p.y - r], [p.x, p.y + r]], 0.5); }
      }
    }
    ctx.beginPath(); padPath(sidePads); ctx.fill();
    d.vias.forEach(v => circle(v.x, v.y, v.d));
  };
  if (cuOn) copper(maskOn ? L.maskCopper : L.copper);

  // silk (drawn before mask openings so pads clip it, like the Gerber %LPC% clip)
  if (o.vis[top ? 'TopSilk' : 'BottomSilk']) {
    ctx.fillStyle = L.silk; ctx.strokeStyle = L.silk; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    rects(d.art.filter(a => a.layer === (top ? 'TopSilk' : 'BottomSilk')).flatMap(a => a.rects));
    (d.silkPolys ?? []).filter(p => p.layer === (top ? 'TopSilk' : 'BottomSilk')).forEach(p => polyline(p.pts, p.w));
    for (const c of d.chips) {
      if ((FP[c.fp]?.silkSide ?? 'T') !== (top ? 'T' : 'B')) continue;
      const s = chipSilk(c); ctx.lineWidth = 0.15;
      ctx.beginPath(); s.lines.forEach(([a, b]) => { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }); ctx.stroke();
      s.dots.forEach(([x, y, dd]) => circle(x, y, dd));
    }
    if (top) {
      rects(textRectsNm(d));
      d.traces.filter(t => t.layer === 'TopSilk').forEach(t => polyline(t.pts, t.width));
      for (const c of [] as typeof d.chips) {
        const s = chipSilk(c); ctx.lineWidth = 0.15;
        ctx.beginPath(); s.lines.forEach(([a, b]) => { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }); ctx.stroke();
        s.dots.forEach(([x, y, dd]) => circle(x, y, dd));
      }
    }
  }
  // mask openings: bare FR4 + gold-plated copper inside
  if (maskOn) {
    ctx.save(); ctx.beginPath();
    for (const r of d.art.filter(a => a.layer === (top ? 'TopMask' : 'BottomMask')).flatMap(a => a.rects)) ctx.rect(r.x / NM, r.y / NM, r.w / NM, r.h / NM);
    padPath(sidePads, 0.05 + (o.vis[top ? 'TopSilk' : 'BottomSilk'] ? 0.15 : 0));
    ctx.clip(); ctx.fillStyle = L.mask; ctx.fillRect(-1, -1, BW + 2, BH + 2);
    if (cuOn) copper(L.maskCopper);
    ctx.beginPath(); padPath(sidePads, 0.05);
    for (const r of d.art.filter(a => a.layer === (top ? 'TopMask' : 'BottomMask')).flatMap(a => a.rects)) ctx.rect(r.x / NM, r.y / NM, r.w / NM, r.h / NM);
    ctx.clip(); ctx.fillStyle = L.fr4; ctx.fillRect(-1, -1, BW + 2, BH + 2);
    if (cuOn) copper(L.gold);
    ctx.restore();
  }
  // holes
  ctx.fillStyle = '#07090d';
  pads.filter(p => p.drill || p.npth).forEach(p => circle(p.x, p.y, p.drill ?? p.w));
  void npth;
  d.vias.forEach(v => circle(v.x, v.y, v.drill));

  if (top && o.showGrid) {
    const step = o.grid >= 0.5 ? o.grid : 1;
    ctx.strokeStyle = 'rgba(159,216,255,0.12)'; ctx.lineWidth = 0.03; ctx.beginPath();
    for (let v = 0; v <= BW + 1e-6; v += step) { ctx.moveTo(v, 0); ctx.lineTo(v, BH); }
    for (let v = 0; v <= BH + 1e-6; v += step) { ctx.moveTo(0, v); ctx.lineTo(BW, v); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(159,216,255,0.25)'; ctx.lineWidth = 0.05; ctx.beginPath();
    for (let v = 0; v <= BW; v += 10) { ctx.moveTo(v, 0); ctx.lineTo(v, BH); }
    for (let v = 0; v <= BH; v += 10) { ctx.moveTo(0, v); ctx.lineTo(BW, v); }
    ctx.stroke();
  }
  if (top && o.preview) { ctx.globalAlpha = 0.6; ctx.fillStyle = '#9fd8ff'; rects(o.preview.rects); ctx.globalAlpha = 1; }
  if (o.sel && o.sel.kind !== 'chip') {
    ctx.strokeStyle = '#7fe3ff'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; const s = o.sel;
    if (s.kind === 'trace' && top) { const t = d.traces.find(t => t.id === s.id); if (t) { ctx.globalAlpha = 0.6; polyline(t.pts, t.width + 0.3); ctx.globalAlpha = 1; } }
    ctx.lineWidth = 0.12;
    if (s.kind === 'via') { const v = d.vias.find(v => v.id === s.id); if (v) { ctx.beginPath(); ctx.arc(v.x, v.y, v.d / 2 + 0.25, 0, Math.PI * 2); ctx.stroke(); } }
    if (s.kind === 'pad' && top) { const p = d.pads.find(p => p.id === s.id); if (p) ctx.strokeRect(p.x - p.w / 2 - 0.2, p.y - p.h / 2 - 0.2, p.w + 0.4, p.h + 0.4); }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

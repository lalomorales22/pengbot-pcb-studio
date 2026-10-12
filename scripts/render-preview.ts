// Quick headless top/bottom preview PNG of the ESP32 board (navy mask, copper, white silk). Usage: npx tsx scripts/render-preview.ts
import { PNG } from 'pngjs'; import fs from 'node:fs';
import { esp32Board } from '../src/esp32';
import { NM, allPads, layerPrims, textRectsNm } from '../src/core';
const d = esp32Board(), S = 12, W = d.board.w * S, H = d.board.h * S;
for (const side of ['top', 'bottom'] as const) {
  const png = new PNG({ width: W, height: H });
  const put = (x: number, y: number, c: number[]) => { const px = Math.round(side === 'top' ? x * S : (d.board.w - x) * S), py = Math.round(H - y * S); if (px < 0 || py < 0 || px >= W || py >= H) return; const i = (py * W + px) * 4; png.data.set([...c, 255], i); };
  const fillR = (x1: number, y1: number, x2: number, y2: number, c: number[]) => { for (let y = y1; y < y2; y += 1 / S) for (let x = x1; x < x2; x += 1 / S) put(x, y, c); };
  fillR(0, 0, d.board.w, d.board.h, [13, 42, 77]);
  const cu = [40, 80, 130];
  if (side === 'top') for (const t of d.traces.filter(t => t.layer === 'TopCopper')) for (let i = 1; i < t.pts.length; i++) { const [a, b] = [t.pts[i - 1], t.pts[i]]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let s = 0; s <= L; s += 0.05) { const x = a[0] + (b[0] - a[0]) * s / (L || 1), y = a[1] + (b[1] - a[1]) * s / (L || 1); fillR(x - t.width / 2, y - t.width / 2, x + t.width / 2, y + t.width / 2, cu); } }
  for (const k of d.keepouts ?? []) { fillR(k.x1, k.y1, k.x2, k.y1 + 0.1, [255, 80, 80]); }
  const layer = side === 'top' ? 'TopSilk' : 'BottomSilk';
  const { rects } = layerPrims(d, layer);
  for (const r of rects) fillR(r.x / NM, r.y / NM, (r.x + r.w) / NM, (r.y + r.h) / NM, [240, 245, 250]);
  for (const p of allPads(d).filter(p => side === 'top' || p.drill)) fillR(p.x - p.w / 2, p.y - p.h / 2, p.x + p.w / 2, p.y + p.h / 2, [217, 180, 90]);
  for (const v of d.vias) fillR(v.x - 0.3, v.y - 0.3, v.x + 0.3, v.y + 0.3, [217, 180, 90]);
  fs.writeFileSync(`out/pengbot-esp32-${side}.png`, PNG.sync.write(png));
}
void textRectsNm; console.log('wrote out/pengbot-esp32-{top,bottom}.png', d.penguinCount);

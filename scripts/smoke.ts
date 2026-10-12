// Headless smoke: default PengBot Nano-328 board (ATmega328P) + penguin silk + a hand-drawn brush stroke + an extra
// placed chip -> Gerber zip, then assert copper/silk/outline/drills are real and DRC/connectivity is clean.
import { PNG } from 'pngjs';
import fs from 'node:fs';
import JSZip from 'jszip';
import { buildZip } from '../src/core';
import { penguinBadge } from '../src/penguinArt';
import { mcuBoard, smoothStroke } from '../src/demo';
import { runDrc } from '../src/drc';

const g = penguinBadge(400), png = new PNG({ width: g.width, height: g.height });
for (let i = 0; i < g.width * g.height; i++) { png.data[i * 4] = png.data[i * 4 + 1] = png.data[i * 4 + 2] = g.lum[i]; png.data[i * 4 + 3] = 255; }
fs.mkdirSync('public/samples', { recursive: true });
fs.writeFileSync('public/samples/penguin-badge.png', PNG.sync.write(png));

const d = mcuBoard();
// hand-drawn brush stroke (jittery "ice wave" under the badge), smoothed like the Brush tool does
const raw: [number, number][] = [];
for (let i = 0; i <= 80; i++) { const x = 54 + i * 0.2; raw.push([x, 14 + 1.2 * Math.sin(i / 6) + (Math.sin(i * 7.3) * 0.08)]); }
d.traces.push({ id: 'brush1', layer: 'TopSilk', width: 0.25, pts: smoothStroke(raw), brush: true });
// user-placed extra chip: a PengBot P1 is too big here, so drop an 0805 test resistor in the free corner (unconnected)
d.chips.push({ id: 'R9', fp: 'R0805', x: 62, y: 8, rot: 90, ref: 'R9', value: '0R (spare)' });

const drc = runDrc(d);
const buf = await (await buildZip(d)).generateAsync({ type: 'nodebuffer' });
fs.mkdirSync('out', { recursive: true });
fs.writeFileSync('out/pengbot-nano-328-gerbers.zip', buf);

const z = await JSZip.loadAsync(buf);
const read = (n: string) => z.file(n)!.async('string');
const count = (s: string, re: RegExp) => (s.match(re) || []).length;
const [gtl, gbl, gto, gko, gts, drl, bom] = await Promise.all(['GTL', 'GBL', 'GTO', 'GKO', 'GTS'].map(e => read('penguin-pcb.' + e)).concat([read('penguin-pcb.DRL'), read('bom.csv')]));
const stats = {
  board: `${d.board.w}x${d.board.h} mm`, chips: d.chips.length, traces: d.traces.length,
  topCopperDraws: count(gtl, /D01\*/g), topCopperFlashes: count(gtl, /D03\*/g), topCopperRegions: count(gtl, /G36\*/g),
  bottomPour: gbl.includes('%LPC*%'), bottomFlashes: count(gbl, /D03\*/g),
  silkRegions: count(gto, /G36\*/g), silkClipsPads: gto.includes('%LPC*%'), outlineSegs: count(gko, /D01\*/g),
  maskOpenings: count(gts, /G36\*|D03\*/g), drillHits: count(drl, /^X/gm), bomLines: bom.trim().split('\n').length - 1,
  drc: { violations: drc.violations.length, shorts: drc.shorts.length, unrouted: drc.unrouted.length, nets: Object.keys(drc.nets).length },
};
console.log(stats);
const fail: string[] = [];
if (stats.topCopperDraws < 60 || stats.topCopperFlashes < 60) fail.push('top copper');
if (!stats.bottomPour || stats.bottomFlashes < 60) fail.push('bottom pour');
if (stats.silkRegions < 500) fail.push('silk');
if (!gto.includes('X54000000')) fail.push('brush stroke missing from silk');
if (stats.outlineSegs !== 4 || !gko.includes('X72000000Y56000000')) fail.push('outline');
if (stats.drillHits !== 28 + 14 + 14 + 6 + 2 + 4) fail.push(`drills (${stats.drillHits})`);
if (drc.violations.length || drc.shorts.length || drc.unrouted.length) fail.push('DRC: ' + [...drc.shorts, ...drc.unrouted, ...drc.violations].slice(0, 5).join('; '));
for (const f of [gtl, gbl, gto, gko, gts]) if (!f.trim().endsWith('M02*')) fail.push('M02');
console.log(Object.keys(z.files).join(' '));
if (fail.length) { console.error('SMOKE FAIL:', fail.join(' | ')); process.exit(1); }
console.log(`OK -> out/pengbot-nano-328-gerbers.zip (${buf.length} bytes)`);

// ---------------- PengBot ESP32 (default board) ----------------
{
  const { esp32Board, ESP_W, ESP_H } = await import('../src/esp32');
  const fs2 = await import('node:fs');
  if (!fs2.existsSync('public/samples/lalo-penguin.png')) console.warn('note: public/samples/lalo-penguin.png missing (mask is embedded in src/laloPenguinMask.ts, so the board still builds)');
  const e = esp32Board();
  const drc = runDrc(e);
  const buf = await (await buildZip(e)).generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync('out/pengbot-esp32-gerbers.zip', buf);
  const z = await JSZip.loadAsync(buf);
  const rd = (n: string) => z.file('penguin-pcb.' + n)!.async('string');
  const [gtl, gbl, gto, gbo, gko, drl] = await Promise.all(['GTL', 'GBL', 'GTO', 'GBO', 'GKO', 'DRL'].map(rd));
  const sizes = Object.fromEntries(await Promise.all(Object.keys(z.files).map(async n => [n, (await z.file(n)!.async('string')).length] as const)));
  const s = {
    board: `${e.board.w}x${e.board.h} mm`, chips: e.chips.length, traces: e.traces.length, vias: e.vias.length, penguins: e.penguinCount,
    topCopperDraws: count(gtl, /D01\*/g), topCopperRegions: count(gtl, /G36\*/g), bottomPour: gbl.includes('%LPC*%'),
    topSilkRegions: count(gto, /G36\*/g), bottomSilkRegions: count(gbo, /G36\*/g), drillHits: count(drl, /^X/gm),
    drc: { violations: drc.violations.length, shorts: drc.shorts.length, unrouted: drc.unrouted.length, nets: Object.keys(drc.nets).length },
    zipBytes: buf.length, rawBytes: sizes,
  };
  console.log(s);
  const f: string[] = [];
  if (s.topCopperDraws < 100) f.push('top copper');
  if (!s.bottomPour) f.push('bottom pour');
  if (!e.penguinCount || e.penguinCount.top < 40 || e.penguinCount.bottom < 40) f.push(`not enough penguins ${JSON.stringify(e.penguinCount)}`);
  if (s.topSilkRegions < 3000 || s.bottomSilkRegions < 3000) f.push('silk');
  if (count(gko, /D01\*/g) !== 4 || !gko.includes(`X${ESP_W * 1e6}Y${ESP_H * 1e6}`)) f.push('outline');
  const expHoles = 14 + 13 + 4 + 2 + e.vias.length;
  if (s.drillHits !== expHoles) f.push(`drills ${s.drillHits} != ${expHoles}`);
  if (drc.violations.length || drc.shorts.length || drc.unrouted.length) f.push('DRC: ' + [...drc.shorts, ...drc.unrouted, ...drc.violations].slice(0, 8).join('; '));
  for (const t of [gtl, gbl, gto, gbo, gko]) if (!t.trim().endsWith('M02*')) f.push('M02');
  if (buf.length > 8e6) f.push('zip too big');
  if (f.length) { console.error('ESP32 SMOKE FAIL:', f.join(' | ')); process.exit(1); }
  console.log(`OK -> out/pengbot-esp32-gerbers.zip (${buf.length} bytes)`);
}

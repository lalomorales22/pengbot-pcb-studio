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

// ---------------- Cyberdeck keyboards ----------------
{
  const { newKeyboard, buildKeyboard, autoArrange, fromUnits, parseKle } = await import('../src/kb/keyboard');
  const { kitFiles, kitZip } = await import('../src/kb/exports');
  const { stabHalf } = await import('../src/footprints');
  type KB = ReturnType<typeof newKeyboard>;
  async function check(kb: KB, file: string, expect: { touch: boolean; minOutline: number }) {
    const b = buildKeyboard(kb), d = b.design, drc = runDrc(d);
    const buf = await (await buildZip(d)).generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    fs.writeFileSync(`out/${file}-gerbers.zip`, buf);
    const kbuf = await (await kitZip(kb, b)).generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    fs.writeFileSync(`out/${file}-kit.zip`, kbuf);
    const z = await JSZip.loadAsync(buf), rd = (n: string) => z.file(n)?.async('string') ?? Promise.resolve('');
    const [gtl, gbl, gbo, gko, gbp, drl, npth, cpl] = await Promise.all(['penguin-pcb.GTL', 'penguin-pcb.GBL', 'penguin-pcb.GBO', 'penguin-pcb.GKO', 'penguin-pcb.GBP', 'penguin-pcb.DRL', 'penguin-pcb-NPTH.DRL', 'cpl.csv'].map(rd));
    const kit = kitFiles(kb, b);
    const stabs = kb.switch === 'mx' ? kb.keys.filter(k => stabHalf(k.w)).length * 4 : 0;
    const s = {
      board: `${d.board.w.toFixed(1)}x${d.board.h.toFixed(1)} mm`, keys: kb.keys.length, matrix: `${b.matrix.rows}x${b.matrix.cols}`, rows: b.matrix.rowPins.join(','), cols: b.matrix.colPins.join(','), special: b.matrix.special,
      traces: d.traces.length, vias: d.vias.length, penguinsBack: d.penguinCount?.bottom, routeMs: b.ms,
      outlineSegs: count(gko, /D01\*/g), npthHits: count(npth, /^X/gm), plated: count(drl, /^X/gm), bottomCuDraws: count(gbl, /D01\*/g), topCuDraws: count(gtl, /D01\*/g),
      bottomSilkRegions: count(gbo, /G36\*/g), bottomPastePads: count(gbp, /G36\*/g), cplBottom: count(cpl, /,Bottom,/g),
      drc: { violations: drc.violations.length, shorts: drc.shorts.length, unrouted: drc.unrouted.length, nets: Object.keys(drc.nets).length },
      kit: Object.keys(kit).length, zip: buf.length, kitZip: kbuf.length,
    };
    console.log(file, s);
    const f: string[] = [];
    if (b.failed.length || b.warnings.length) f.push('build: ' + [...b.failed, ...b.warnings].join('; '));
    if (drc.violations.length || drc.shorts.length || drc.unrouted.length) f.push('DRC: ' + [...drc.shorts, ...drc.unrouted, ...drc.violations].slice(0, 8).join('; '));
    if (s.outlineSegs < expect.minOutline) f.push('outline ' + s.outlineSegs);
    if (s.npthHits !== kb.keys.length * 5 + stabs + kb.holes.length) f.push(`npth ${s.npthHits} != ${kb.keys.length * 5 + stabs + kb.holes.length}`);
    if (s.cplBottom !== kb.keys.length) f.push('diodes on bottom in CPL');
    if (s.bottomPastePads < kb.keys.length * 4) f.push('bottom paste');
    if (!d.penguinCount || d.penguinCount.bottom < 100) f.push('penguins');
    if (expect.touch !== d.chips.some(c => c.id === 'J2')) f.push('touchpad header');
    const qmk = Object.entries(kit).find(([k]) => k.endsWith('keyboard.json'))!;
    const info = JSON.parse(qmk[1]); if (info.layouts.LAYOUT.layout.length !== kb.keys.length || info.matrix_pins.cols.length !== b.matrix.cols) f.push('qmk json');
    if (!kit['firmware/kmk/code.py'].includes('keyboard.col_pins = (board.')) f.push('kmk');
    if (count(kit['plate/plate.svg'], /<path/g) !== kb.keys.length + 2) f.push('plate cutouts');
    if (!kit['plate/plate.dxf'].includes('LWPOLYLINE')) f.push('dxf');
    for (const t of [gtl, gbl, gbo, gko]) if (!t.trim().endsWith('M02*')) f.push('M02');
    if (f.length) { console.error(`KEYBOARD ${file} SMOKE FAIL:`, f.join(' | ')); process.exit(1); }
    console.log(`OK -> out/${file}-gerbers.zip (${buf.length} bytes) + out/${file}-kit.zip`);
  }

  // 1) Deck 40: compact staggered cyberdeck, MX hotswap, Cirque 40 mm touchpad, QWIIC header
  const deck = newKeyboard('deck40', 'mx'); deck.name = 'PengDeck 40';
  await check(deck, 'pengdeck40-touchpad', { touch: true, minOutline: 4 });

  // 2) Custom shape (hand-drawn chamfered outline), Choc v1, no touchpad, layout from KLE JSON
  const kle = `[{"name":"PengSplit 36"},["Q","W","E","R","T",{"x":1},"Y","U","I","O","P"],["A","S","D","F","G",{"x":1},"H","J","K","L",";"],["Z","X","C","V","B",{"x":1},"N","M",",",".","/"],[{"x":2},"Gui",{"w":1.5},"Lower",{"w":1.5},"Space",{"w":1.5},"Enter",{"w":1.5},"Raise","Alt"]]`;
  const parsed = parseKle(kle);
  let cus = autoArrange({ ...fromUnits(parsed.keys, 'PengSplit 36 custom', 'choc'), i2c: false });
  const xs = cus.outline.map(p => p[0]), ys = cus.outline.map(p => p[1]);
  const [x1, y1, x2, y2] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], mx = (x1 + x2) / 2;
  cus = { ...cus, shape: 'custom', radius: 3, ctrl: { x: mx, y: y2 - 11, rot: 90 },
    outline: [[x1 + 8, y1], [mx - 12, y1], [mx, y1 + 4.5], [mx + 12, y1], [x2 - 8, y1], [x2, y1 + 8], [x2, y2 - 22], [mx + 30, y2 - 22], [mx + 22, y2], [mx - 22, y2], [mx - 30, y2 - 22], [x1, y2 - 22], [x1, y1 + 8]] };
  cus.holes = [{ id: 'h1', x: x1 + 9.5, y: y1 + 4.5, size: 'M2.5' }, { id: 'h2', x: x2 - 9.5, y: y1 + 4.5, size: 'M2.5' }, { id: 'h3', x: mx, y: y1 + 12.5, size: 'M2' }];
  await check(cus, 'pengsplit36-custom-shape', { touch: false, minOutline: 20 });
}

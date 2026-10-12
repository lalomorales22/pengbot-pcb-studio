// Default project: "PengBot Nano-328" — ATmega328P (DIP-28) barebones Arduino-compatible board, 72 × 56 mm, 2 layers.
import { Design, Pt, SilkText, Trace, Via, emptyDesign, vectorize, NM } from './core';
import { penguinBadge } from './penguinArt';

export const BADGE_OPTS = { threshold: 128, invert: false, dither: false, sizeMm: 17, cxMm: 62.5, cyMm: 26 };
export const BOARD_W = 72, BOARD_H = 56;

// MCU pin -> net (ATmega328P-PU DIP-28). AVCC tied to VCC.
export const MCU_NETS: Record<number, string> = {
  1: 'RESET', 2: 'RXD', 3: 'TXD', 4: 'D2', 5: 'D3', 6: 'D4', 7: 'VCC', 8: 'GND', 9: 'XTAL1', 10: 'XTAL2', 11: 'D5', 12: 'D6', 13: 'D7', 14: 'D8',
  15: 'D9', 16: 'D10', 17: 'D11', 18: 'D12', 19: 'D13', 20: 'VCC', 21: 'AREF', 22: 'GND', 23: 'A0', 24: 'A1', 25: 'A2', 26: 'A3', 27: 'A4', 28: 'A5',
};
export const MCU_LABELS: Record<number, string> = {
  1: 'RST', 2: 'D0', 3: 'D1', 4: 'D2', 5: 'D3', 6: 'D4', 7: 'VCC', 8: 'GND', 9: 'X1', 10: 'X2', 11: 'D5', 12: 'D6', 13: 'D7', 14: 'D8',
  15: 'D9', 16: 'D10', 17: 'D11', 18: 'D12', 19: 'D13', 20: 'AVCC', 21: 'AREF', 22: 'GND', 23: 'A0', 24: 'A1', 25: 'A2', 26: 'A3', 27: 'A4', 28: 'A5',
};

const MX = 34, MY = 30, J1Y = 18.57, J2Y = 41.43;
const pinX = (k: number) => +(MX - 16.51 + ((k <= 14 ? k : 29 - k) - 1) * 2.54).toFixed(3); // MCU pin x (rot 90 DIP)
let tid = 0, vid = 0, xid = 0;
const tr = (net: string, pts: Pt[], width = 0.3): Trace => ({ id: 'T' + ++tid, layer: 'TopCopper', width, pts, net });
const via = (x: number, y: number, net = 'GND'): Via => ({ id: 'V' + ++vid, x, y, d: 0.6, drill: 0.3, net });
const txt = (text: string, x: number, y: number, px = 0.2, rot: 0 | 90 = 0): SilkText => ({ id: 'X' + ++xid, text, x, y, px, rot });

export function mcuBoard(): Design {
  tid = vid = xid = 0;
  const d = emptyDesign(BOARD_W, BOARD_H);
  d.name = 'PengBot Nano-328 (ATmega328P, 16 MHz, 5 V)';
  const j1: Record<string, string> = {}, j2: Record<string, string> = {}, u1: Record<string, string> = {};
  for (let k = 1; k <= 28; k++) u1[k] = MCU_NETS[k];
  for (let i = 1; i <= 14; i++) { j1[i] = MCU_NETS[i]; j2[i] = MCU_NETS[29 - i]; }
  d.chips = [
    { id: 'U1', fp: 'DIP28', x: MX, y: MY, rot: 90, ref: 'U1', value: 'ATmega328P-PU', nets: u1 },
    { id: 'J1', fp: 'HDR1x14', x: MX, y: J1Y, rot: 0, ref: 'J1', value: 'GPIO 1x14 2.54mm', nets: j1 },
    { id: 'J2', fp: 'HDR1x14', x: MX, y: J2Y, rot: 0, ref: 'J2', value: 'GPIO 1x14 2.54mm', nets: j2 },
    { id: 'J3', fp: 'HDR1x6', x: 6, y: 9.68, rot: 270, ref: 'J3', value: 'FTDI 1x6 2.54mm', nets: { 1: 'DTR', 2: 'RXD', 3: 'TXD', 4: 'VCC', 5: 'NC_CTS', 6: 'GND' } },
    { id: 'Y1', fp: 'HC49', x: 40.5, y: 14, rot: 0, ref: 'Y1', value: '16MHz HC-49/S', nets: { 1: 'XTAL1', 2: 'XTAL2' } },
    { id: 'C1', fp: 'C0805', x: 11, y: 16.03, rot: 0, ref: 'C1', value: '100nF (auto-reset)', nets: { 1: 'DTR', 2: 'RESET' } },
    { id: 'C2', fp: 'C0805', x: 34, y: 15.5, rot: 90, ref: 'C2', value: '100nF', nets: { 1: 'VCC', 2: 'GND' } },
    { id: 'C3', fp: 'C0805', x: 35.9, y: 44.5, rot: 0, ref: 'C3', value: '100nF', nets: { 1: 'GND', 2: 'VCC' } },
    { id: 'C4', fp: 'C0805', x: 38.06, y: 10, rot: 90, ref: 'C4', value: '22pF', nets: { 1: 'GND', 2: 'XTAL1' } },
    { id: 'C5', fp: 'C0805', x: 42.94, y: 10, rot: 90, ref: 'C5', value: '22pF', nets: { 1: 'GND', 2: 'XTAL2' } },
    { id: 'R1', fp: 'R0805', x: 12, y: 22.4, rot: 0, ref: 'R1', value: '10k (reset pull-up)', nets: { 1: 'VCC', 2: 'RESET' } },
    { id: 'R2', fp: 'R0805', x: 40.35, y: 45, rot: 90, ref: 'R2', value: '330R', nets: { 1: 'D13', 2: 'LED_A' } },
    { id: 'D1', fp: 'LED0805', x: 40.35, y: 49, rot: 270, ref: 'D1', value: 'LED blue (D13)', nets: { 1: 'GND', 2: 'LED_A' } },
  ];
  // MCU <-> GPIO headers: straight drops, no crossings
  for (let k = 1; k <= 14; k++) d.traces.push(tr(MCU_NETS[k], [[pinX(k), J1Y], [pinX(k), MY - 3.81]], ['VCC', 'GND'].includes(MCU_NETS[k]) ? 0.4 : 0.3));
  for (let k = 15; k <= 28; k++) d.traces.push(tr(MCU_NETS[k], [[pinX(k), MY + 3.81], [pinX(k), J2Y]], ['VCC', 'GND'].includes(MCU_NETS[k]) ? 0.4 : 0.3));
  d.traces.push(
    // FTDI header J3 -> MCU (staggered so nothing crosses)
    tr('DTR', [[6, 16.03], [10.05, 16.03]]),
    tr('RESET', [[11.95, 16.03], [pinX(1), 16.03], [pinX(1), J1Y]]),
    tr('RXD', [[6, 13.49], [pinX(2), 13.49], [pinX(2), J1Y]]),
    tr('TXD', [[6, 10.95], [pinX(3), 10.95], [pinX(3), J1Y]]),
    tr('VCC', [[6, 8.41], [pinX(7), 8.41], [pinX(7), J1Y]], 0.4),
    // VCC bus up the left edge and over to AVCC (J2 / pin 20)
    tr('VCC', [[6, 8.41], [5.27, 7.14], [1.5, 7.14], [1.5, 47], [pinX(20), 47], [pinX(20), J2Y]], 0.4),
    // reset pull-up R1
    tr('VCC', [[1.5, 22.4], [11.05, 22.4]], 0.4),
    tr('RESET', [[12.95, 22.4], [pinX(1), 22.4]]),
    // decoupling C2 (VCC/GND at pins 7/8) and C3 (AVCC)
    tr('GND', [[34, 16.45], [pinX(8), 17.72], [pinX(8), J1Y]], 0.4),
    tr('VCC', [[34, 14.55], [pinX(7), 14.55]], 0.4),
    tr('VCC', [[36.85, 44.5], [pinX(20), 44.5]], 0.4),
    tr('GND', [[34.95, 44.5], [33.4, 44.5]], 0.4),
    // 16 MHz crystal + 22 pF load caps
    tr('XTAL1', [[pinX(9), J1Y], [pinX(9), 15.5], [38.06, 14]]),
    tr('XTAL2', [[pinX(10), J1Y], [pinX(10), 15.5], [42.94, 14]]),
    tr('XTAL1', [[38.06, 14], [38.06, 10.95]]), tr('XTAL2', [[42.94, 14], [42.94, 10.95]]),
    tr('GND', [[38.06, 9.05], [38.06, 7.3]], 0.4), tr('GND', [[42.94, 9.05], [42.94, 7.3]], 0.4),
    // status LED on D13 (PB5)
    tr('D13', [[40.35, J2Y], [40.35, 44.05]]), tr('LED_A', [[40.35, 45.95], [40.35, 48.05]]), tr('GND', [[40.35, 49.95], [40.35, 51.7]], 0.4),
  );
  d.vias.push(via(38.06, 7.3), via(42.94, 7.3), via(33.4, 44.5), via(40.35, 51.7));
  d.pours.push({ layer: 'BottomCopper', net: 'GND', clearance: 0.3, margin: 0.5 });
  // silkscreen: pin labels, connector legend, branding
  for (let k = 1; k <= 14; k++) d.texts.push(txt(MCU_LABELS[k], pinX(k), (J1Y + MY - 3.81) / 2, 0.2, 90));
  for (let k = 15; k <= 28; k++) d.texts.push(txt(MCU_LABELS[k], pinX(k), (J2Y + MY + 3.81) / 2, 0.2, 90));
  ['DTR', 'TXO', 'RXI', 'VCC', 'CTS', 'GND'].forEach((l, i) => d.texts.push(txt(l, 3.35, 16.03 - i * 2.54, 0.17)));
  d.texts.push(txt('FTDI', 4.5, 18.6), txt('GPIO', 54.6, J1Y), txt('GPIO', 54.6, J2Y),
    txt('PENGBOT NANO-328', 60.5, 51), txt('PENGUINSTHEGAME.COM', 60.5, 48.4, 0.17), txt('ATMEGA328P 16MHZ 5V', 60.5, 46.2, 0.17), txt('V1.0', 60.5, 3, 0.2));
  d.art.push({ layer: 'TopSilk', rects: vectorize(penguinBadge(400), BADGE_OPTS, BOARD_W * NM, BOARD_H * NM) });
  return d;
}

/** Old free-form art board: 50 × 50, penguin badge only. */
export function badgeOnly(): Design {
  const d = emptyDesign(50, 50); d.name = 'Penguin badge (art board)';
  d.art = [{ layer: 'TopSilk', rects: vectorize(penguinBadge(400), { ...BADGE_OPTS, sizeMm: 32, cxMm: 25, cyMm: 25 }, 50 * NM, 50 * NM) }];
  return d;
}

/** Chaikin smoothing + light decimation for hand-drawn brush strokes. */
export function smoothStroke(pts: Pt[], iters = 2, minSeg = 0.12): Pt[] {
  let p = pts;
  for (let it = 0; it < iters && p.length > 2; it++) {
    const q: Pt[] = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const [a, b] = [p[i], p[i + 1]];
      q.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    q.push(p[p.length - 1]); p = q;
  }
  const out: Pt[] = [p[0]];
  for (const pt of p.slice(1)) { const l = out[out.length - 1]; if (Math.hypot(pt[0] - l[0], pt[1] - l[1]) >= minSeg) out.push(pt); }
  if (out.length > 1 || p.length === 1) { const last = p[p.length - 1]; const l = out[out.length - 1]; if (l !== last) out[out.length - 1] = last; }
  return out.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)] as Pt);
}

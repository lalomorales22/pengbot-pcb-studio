// "PengBot ESP32" — ESP32-WROOM-32E dev board, 80 × 60 mm, 2 layers, USB-C 5 V -> AMS1117-3.3, EN/BOOT buttons,
// 0.1" GPIO headers on both sides + bottom, antenna at the top edge over a copper keepout,
// and Lalo's hand-drawn penguin tiled all over both silkscreens.
import { Chip, Design, Pt, SilkText, Trace, Via, emptyDesign } from './core';
import { FP } from './footprints';
import { MmRect, tilePenguinArt } from './penguinTile';

export const ESP_W = 80, ESP_H = 60;
const MX = 40, MY = 47.25;                 // module centre (top edge flush with board edge at y = 60)
export const ANTENNA_KEEPOUT = { x1: 20, y1: 53.6, x2: 60, y2: 60, label: 'antenna keepout' };
const J1X = 8, J2X = 72, TOP = 52.51, P = 2.54;

/** WROOM-32E pin -> net. Flash pins 17-22 (SD2/SD3/CMD/CLK/SD0/SD1) and NC 32 intentionally unconnected. */
export const ESP_NETS: Record<string, string> = {
  1: 'GND', 2: '3V3', 3: 'EN', 4: 'IO36', 5: 'IO39', 6: 'IO34', 7: 'IO35', 8: 'IO32', 9: 'IO33', 10: 'IO25', 11: 'IO26', 12: 'IO27', 13: 'IO14', 14: 'IO12',
  15: 'GND', 16: 'IO13', 23: 'IO15', 24: 'IO2',
  25: 'IO0', 26: 'IO4', 27: 'IO16', 28: 'IO17', 29: 'IO5', 30: 'IO18', 31: 'IO19', 33: 'IO21', 34: 'RXD0', 35: 'TXD0', 36: 'IO22', 37: 'IO23', 38: 'GND', EP: 'GND',
};
const LABEL: Record<string, string> = { IO36: 'VP36', IO39: 'VN39', RXD0: 'RX0', TXD0: 'TX0' };
export const lbl = (n: string) => LABEL[n] ?? n;
/** J1 (left, top->bottom) = module pins 1..14; J2 (right, top->bottom) = pins 38..25 minus NC 32; J4 (bottom, left->right). */
export const J1_PINS = Array.from({ length: 14 }, (_, i) => i + 1);
export const J2_PINS = [38, 37, 36, 35, 34, 33, 31, 30, 29, 28, 27, 26, 25];
export const J4_NETS = ['IO13', 'IO15', 'IO2', 'GND'];
const leftY = (k: number) => +(MY + 5.26 - (k - 1) * 1.27).toFixed(3);
const rightY = (k: number) => +(MY - 11.25 + (k - 25) * 1.27).toFixed(3);

let tid = 0, vid = 0, xid = 0;
const tr = (net: string, pts: Pt[], width = 0.25): Trace => ({ id: 'T' + ++tid, layer: 'TopCopper', width, pts, net });
const via = (x: number, y: number, net = 'GND'): Via => ({ id: 'V' + ++vid, x, y, d: 0.6, drill: 0.3, net });
const txt = (text: string, x: number, y: number, px = 0.17, rot: 0 | 90 = 0): SilkText => ({ id: 'X' + ++xid, text, x, y, px, rot });
const pw = (net: string) => (net === '3V3' ? 0.5 : net === 'GND' ? 0.4 : 0.25);

export function esp32Board(opts: { penguins?: boolean } = {}): Design {
  tid = vid = xid = 0;
  const d = emptyDesign(ESP_W, ESP_H);
  d.name = 'PengBot ESP32 (ESP32-WROOM-32E, USB-C 5 V, 3.3 V)';
  d.keepouts = [ANTENNA_KEEPOUT];
  const u1: Record<string, string> = { ...ESP_NETS };
  const j1: Record<string, string> = {}, j2: Record<string, string> = {}, j4: Record<string, string> = {};
  J1_PINS.forEach((k, i) => { j1[i + 1] = ESP_NETS[k]; });
  J2_PINS.forEach((k, i) => { j2[i + 1] = ESP_NETS[k]; });
  J4_NETS.forEach((n, i) => { j4[i + 1] = n; });
  const c = (id: string, fp: string, x: number, y: number, rot: number, value: string, nets: Record<string, string>): Chip => ({ id, fp, x, y, rot, ref: id, value, nets });
  d.chips = [
    c('U1', 'WROOM32', MX, MY, 0, 'ESP32-WROOM-32E (4MB)', u1),
    c('J1', 'HDR1x14', J1X, TOP - 6.5 * P, 270, 'GPIO L 1x14 2.54mm', j1),
    c('J2', 'HDR1x13', J2X, TOP - 6 * P, 270, 'GPIO R 1x13 2.54mm', j2),
    c('J4', 'HDR1x4', 40, 29, 0, 'GPIO B 1x4 2.54mm', j4),
    c('J3', 'USBC6P', 40, 2.2, 0, 'USB-C 6P power (HRO TYPE-C-31-M-17)', { A12: 'GND', A9: 'VBUS', A5: 'CC1', B5: 'CC2', B9: 'VBUS', B12: 'GND', S1: 'GND', S2: 'GND' }),
    c('U2', 'SOT223', 24, 10, 180, 'AMS1117-3.3', { 1: 'GND', 2: '3V3', 3: 'VBUS', 4: '3V3' }),
    c('R1', 'R0805', 38, 9.5, 90, '5.1k (CC1)', { 1: 'CC1', 2: 'GND' }),
    c('R2', 'R0805', 42, 9.5, 90, '5.1k (CC2)', { 1: 'CC2', 2: 'GND' }),
    c('C1', 'C0805', 40, 14.95, 90, '10uF (VBUS)', { 1: 'VBUS', 2: 'GND' }),
    c('C2', 'C0805', 28, 16.05, 270, '10uF (LDO in)', { 1: 'VBUS', 2: 'GND' }),
    c('C3', 'C0805', 18, 2.95, 90, '22uF (LDO out)', { 1: '3V3', 2: 'GND' }),
    c('C4', 'C0805', 15, 2.95, 90, '100nF', { 1: '3V3', 2: 'GND' }),
    c('C5', 'C0805', 3.5, 50.92, 90, '22uF (ESP 3V3)', { 1: '3V3', 2: 'GND' }),
    c('C6', 'C0805', 5.6, 50.92, 90, '100nF (ESP 3V3)', { 1: '3V3', 2: 'GND' }),
    c('R3', 'R0805', 2.75, 30, 0, '10k (EN pull-up)', { 1: '3V3', 2: 'EN' }),
    c('C7', 'C0805', 4.95, 16, 0, '1uF (EN delay)', { 1: 'EN', 2: 'GND' }),
    c('SW1', 'SW_TACT', 8, 11, 0, 'EN / RESET', { 1: 'EN', 3: 'GND' }),
    c('SW2', 'SW_TACT', 72, 11, 0, 'BOOT (IO0)', { 1: 'GND', 3: 'IO0' }),
    c('R4', 'R0805', 10, 2.95, 90, '1k (PWR LED)', { 1: '3V3', 2: 'LED_A' }),
    c('D1', 'LED0805', 10, 6.3, 270, 'LED blue (power)', { 1: 'GND', 2: 'LED_A' }),
  ];

  // ---- module -> J1 fanout (left). Pin k: out to x_k, down to the header row, over to the header.
  d.traces.push(tr('GND', [[MX - 9, TOP], [J1X, TOP]], 0.4));
  for (let k = 2; k <= 14; k++) {
    const n = ESP_NETS[k], y = leftY(k), Y = +(TOP - (k - 1) * P).toFixed(3), x = +(29.5 - (14 - k) * 0.6).toFixed(3);
    d.traces.push(tr(n, [[MX - 9, y], [x, y], [x, Y], [J1X, Y]], pw(n)));
  }
  // ---- module -> J2 fanout (right)
  J2_PINS.forEach((k, s) => {
    const n = ESP_NETS[k], y = rightY(k), Y = +(TOP - s * P).toFixed(3);
    if (s === 0) { d.traces.push(tr(n, [[MX + 9, y], [J2X, Y]], pw(n))); return; }
    const x = +(50.5 + (12 - s) * 0.6).toFixed(3);
    d.traces.push(tr(n, [[MX + 9, y], [x, y], [x, Y], [J2X, Y]], pw(n)));
  });
  // ---- module bottom pads -> J4 (IO13, IO15, IO2) + pin 15 GND via
  const bx = (k: number) => +(MX - 5.715 + (k - 15) * 1.27).toFixed(3), BY = MY - 12.5, jx = (i: number) => +(40 + (i - 1.5) * P).toFixed(3);
  d.traces.push(
    tr('IO13', [[bx(16), BY], [bx(16), 31], [jx(0), 31], [jx(0), 29]]),
    tr('IO15', [[bx(23), BY], [bx(23), 32], [jx(1), 32], [jx(1), 29]]),
    tr('IO2', [[bx(24), BY], [bx(24), 31], [jx(2), 31], [jx(2), 29]]),
    tr('GND', [[bx(15), BY], [bx(15), 32.6]], 0.4),
  );
  d.vias.push(via(bx(15), 32.6));
  // exposed GND pad: 4 stitching vias into the bottom pour
  for (const [x, y] of [[37.5, 46.75], [40.5, 46.75], [37.5, 49.75], [40.5, 49.75]]) d.vias.push(via(x, y));

  // ---- power: USB-C VBUS loop (around the CC resistors) -> C1 -> C2 -> AMS1117 VIN
  d.traces.push(
    tr('VBUS', [[38.5, 5.2], [38.5, 7], [35, 7], [35, 14], [45, 14], [45, 7], [41.5, 7], [41.5, 5.2]], 0.4),
    tr('VBUS', [[35, 14], [35, 17], [21.7, 17], [21.7, 13.15]], 0.5),
    tr('CC1', [[39.5, 5.2], [39.5, 8.55], [38, 8.55]]), tr('CC2', [[40.5, 5.2], [40.5, 8.55], [42, 8.55]]),
    tr('GND', [[37.5, 5.2], [37.5, 3.4]], 0.4), tr('GND', [[42.5, 5.2], [42.5, 3.4]], 0.4),
    tr('GND', [[38, 10.45], [38, 12]], 0.4), tr('GND', [[42, 10.45], [42, 12]], 0.4),
    tr('GND', [[40, 15.9], [40, 17.3]], 0.4), tr('GND', [[28, 15.1], [29.6, 15.1]], 0.4),
    tr('GND', [[26.3, 13.15], [26.3, 15.6]], 0.4),
    // 3V3: LDO VOUT + tab -> bus along the bottom + up the left edge -> J1.2 (module 3V3 via the fanout trace)
    tr('3V3', [[24, 13.15], [24, 6.85]], 0.5),
    tr('3V3', [[24, 6.85], [24, 2], [1.5, 2], [1.5, TOP - P], [J1X, TOP - P]], 0.5),
    tr('GND', [[18, 3.9], [18, 5.3]], 0.4), tr('GND', [[15, 3.9], [15, 5.3]], 0.4),
    // ESP bulk decoupling at J1.2
    tr('GND', [[3.5, 51.87], [3.5, TOP], [J1X, TOP]], 0.4), tr('GND', [[5.6, 51.87], [5.6, TOP]], 0.4),
    // EN: J1.3 -> RC (R3 pull-up, C7) -> SW1
    tr('EN', [[J1X, TOP - 2 * P], [4, TOP - 2 * P], [4, 12.85], [4.9, 12.85]]),
    tr('GND', [[5.9, 16], [7.3, 16]], 0.4), tr('GND', [[11.1, 12.85], [11.1, 15]], 0.4),
    // power LED
    tr('LED_A', [[10, 3.9], [10, 5.35]]), tr('GND', [[10, 7.25], [11.9, 7.25]], 0.4),
    // BOOT: J2 IO0 -> SW2
    tr('IO0', [[J2X, TOP - 12 * P], [76, TOP - 12 * P], [76, 12.85], [75.1, 12.85]]),
    tr('GND', [[68.9, 12.85], [67.2, 12.85]], 0.4),
  );
  d.vias.push(via(37.5, 3.4), via(42.5, 3.4), via(38, 12), via(42, 12), via(40, 17.3), via(29.6, 15.1), via(26.3, 15.6),
    via(18, 5.3), via(15, 5.3), via(7.3, 16), via(11.1, 15), via(11.9, 7.25), via(67.2, 12.85));
  d.pours.push({ layer: 'BottomCopper', net: 'GND', clearance: 0.3, margin: 0.5 });

  // ---- silk labels
  J1_PINS.forEach((k, i) => d.texts.push(txt(lbl(ESP_NETS[k]), 13.2, TOP - i * P + 0.85)));
  J2_PINS.forEach((k, i) => d.texts.push(txt(lbl(ESP_NETS[k]), 66.8, TOP - i * P + 0.85)));
  J4_NETS.forEach((n, i) => d.texts.push(txt(n === 'GND' ? 'G' : n.replace('IO', ''), jx(i), 26.7)));
  d.texts.push(
    txt('EN', 8, 7.6), txt('BOOT', 72, 7.6), txt('PWR', 13.2, 6.3), txt('5V USB-C', 52, 2.4),
    txt('PENGBOT ESP32', 56, 21.5, 0.26), txt('PENGUINSTHEGAME.COM', 56, 18.8), txt('ESP32-WROOM-32E 3V3', 56, 16.6), txt('V1.0', 56, 14.4),
    txt('ANTENNA - KEEP CLEAR', 40, 56.8, 0.15),
  );
  if (opts.penguins !== false) addPenguins(d);
  return d;
}

/** Everything penguins must dodge on the top side (mm): part courtyards, labels, vias, antenna keepout. */
export function topAvoidRects(d: Design): MmRect[] {
  const out: MmRect[] = [...(d.keepouts ?? [])];
  for (const ch of d.chips) {
    const f = FP[ch.fp]; if (!f) continue; const [w, h] = ch.rot % 180 ? [f.size[1], f.size[0]] : f.size;
    out.push({ x1: ch.x - w / 2, y1: ch.y - h / 2, x2: ch.x + w / 2, y2: ch.y + h / 2 });
  }
  for (const t of d.texts) { const W = (t.text.length * 6 - 1) * t.px, H = 7 * t.px; const [w, h] = t.rot ? [H, W] : [W, H]; out.push({ x1: t.x - w / 2, y1: t.y - h / 2, x2: t.x + w / 2, y2: t.y + h / 2 }); }
  for (const v of d.vias) out.push({ x1: v.x - 0.5, y1: v.y - 0.5, x2: v.x + 0.5, y2: v.y + 0.5 });
  return out;
}

export const PENGUIN_TOP = { big: 6.4, small: 3.6 }, PENGUIN_BOTTOM = 5.2;
/** Lalo's penguin, a ton of them: big + small fill on TopSilk, dense mirrored grid on BottomSilk (only THT pads/vias/keepout to dodge). */
export function addPenguins(d: Design) {
  const avoid = topAvoidRects(d), board = d.board;
  const big = tilePenguinArt({ board, scaleMm: PENGUIN_TOP.big, marginMm: 0.35, avoidRects: avoid, pitch: 0.9, alternate: true });
  const small = tilePenguinArt({ board, scaleMm: PENGUIN_TOP.small, marginMm: 0.3, avoidRects: avoid, pitch: 0.95, alternate: true, occupied: big.placed, maxOverlap: 0.04 });
  const botAvoid: MmRect[] = [...(d.keepouts ?? [])];
  for (const ch of d.chips) for (const p of FP[ch.fp].pads.filter(p => p.drill)) {
    const r = p.w / 2 + 0.2;
    const rot = ((ch.rot % 360) + 360) % 360, [a, b] = rot === 90 ? [-p.y, p.x] : rot === 180 ? [-p.x, -p.y] : rot === 270 ? [p.y, -p.x] : [p.x, p.y];
    botAvoid.push({ x1: ch.x + a - r, y1: ch.y + b - r, x2: ch.x + a + r, y2: ch.y + b + r });
  }
  // bottom: dodge THT pads, vias and keepout, but let tiles sit over vias' small footprint only if needed -> just avoid them
  for (const v of d.vias) botAvoid.push({ x1: v.x - 0.5, y1: v.y - 0.5, x2: v.x + 0.5, y2: v.y + 0.5 });
  const bot = tilePenguinArt({ board, scaleMm: PENGUIN_BOTTOM, marginMm: 0.3, avoidRects: botAvoid, pitch: 0.9, mirror: true, layer: 'BottomSilk' });
  const botSmall = tilePenguinArt({ board, scaleMm: PENGUIN_TOP.small, marginMm: 0.3, avoidRects: botAvoid, pitch: 0.95, mirror: true, layer: 'BottomSilk', occupied: bot.placed, maxOverlap: 0.04 });
  d.art.push(big.art, small.art, bot.art, botSmall.art);
  d.penguinCount = { top: big.placed.length + small.placed.length, bottom: bot.placed.length + botSmall.placed.length };
  return d;
}

// Cyberdeck keyboard builder: layout model, presets, KLE import, outline shapes, and the
// layout -> real PCB generator (switch + Kailh socket + diode per key, auto matrix, controller, autorouted copper).
import { Chip, Design, Pt, SilkText, Trace, Via, emptyDesign, pointInPoly } from '../core';
import { CAP_COLORS, FP, PM_LEFT, PM_RIGHT, SwitchKind, U, keyFp, xf } from '../footprints';
import { autoroute } from './router';
import { MmRect, tilePenguinArt } from '../penguinTile';

export const WIDTHS = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.75, 6.25];
export interface Key { id: string; x: number; y: number; w: number; rot: number; label?: string }
export interface KbHole { id: string; x: number; y: number; size: 'M2' | 'M2.5' }
export type ShapeKind = 'rect' | 'rounded' | 'wedge' | 'split' | 'custom';
export type Touchpad = 'cirque40' | 'cirque35' | 'pmw3360';
export interface Keyboard {
  name: string; switch: SwitchKind; controller: 'kb2040' | 'nicenano';
  keys: Key[]; shape: ShapeKind; outline: Pt[]; radius: number; holes: KbHole[];
  ctrl: { x: number; y: number; rot: number }; i2c: boolean; i2cPos: { x: number; y: number };
  touchpad: { on: boolean; kind: Touchpad; x: number; y: number; hx: number; hy: number }; penguins: boolean;
}
export const TOUCHPADS: Record<Touchpad, { name: string; dia: number; pins: string[]; note: string }> = {
  cirque40: { name: 'Cirque TM040040 (40 mm, I2C)', dia: 40, pins: ['3V3', 'GND', 'SDA', 'SCL', 'DR'],
    note: 'Cirque Pinnacle 1CA027 — QMK driver cirque_pinnacle_i2c, address 0x2A. The module ships with a 12-pin 0.5 mm FFC; wire it to this 0.1" header with an FFC breakout (FFC pinout not verified here — check the Cirque TM0xx0xx datasheet).' },
  cirque35: { name: 'Cirque TM035035 (35 mm, I2C)', dia: 35, pins: ['3V3', 'GND', 'SDA', 'SCL', 'DR'],
    note: 'Same Pinnacle 1CA027 controller and header as TM040040 (QMK cirque_pinnacle_i2c, 0x2A).' },
  pmw3360: { name: 'PMW3360 trackball (34 mm ball, SPI)', dia: 36, pins: ['3V3', 'GND', 'SCK', 'MOSI', 'MISO', 'CS', 'MOT'],
    note: 'PMW3360 breakout over SPI (QMK driver pmw3360). Pin order on breakouts varies — match the silk labels, not position.' },
};
/** Controllers that drop into the Pro Micro footprint. */
export const CONTROLLERS = {
  kb2040: { name: 'Adafruit KB2040 (RP2040, USB-C)', fw: 'KMK (CircuitPython) / QMK' },
  nicenano: { name: 'nice!nano v2 (nRF52840, BLE, USB-C)', fw: 'ZMK' },
};

let kid = 0; export const keyId = () => 'k' + (++kid).toString(36) + Math.random().toString(36).slice(2, 5);

// ---------------- presets (KLE-ish rows: [label, width]) ----------------
type Row = [string, number][];
const r1 = (s: string) => s.split(' ').map(l => [l, 1] as [string, number]);
const PRESETS: Record<string, { name: string; rows: Row[]; i2c: boolean; touch: boolean }> = {
  deck40: { name: 'Deck 40 — compact staggered cyberdeck (40 keys)', i2c: true, touch: true, rows: [
    [['Esc', 1], ...r1('Q W E R T Y U I O P'), ['Bksp', 1.5]],
    [['Fn', 1.25], ...r1('A S D F G H J K L'), ['Enter', 2.25]],
    [['Shift', 1.75], ...r1('Z X C V B N M , .'), ['Up', 1.75]],
    [['Ctrl', 1.25], ['Gui', 1.25], ['Alt', 1.25], ['Space', 6.25], ['Left', 1.25], ['Right', 1.25]],
  ] },
  ortho40: { name: '40% ortho 4×12 (48 keys)', i2c: true, touch: false, rows: [
    r1('Tab Q W E R T Y U I O P Bksp'), r1('Esc A S D F G H J K L ; \''), r1('Shift Z X C V B N M , . / Enter'), r1('Ctrl Gui Alt Fn Lower Space Space Raise Left Down Up Right'),
  ] },
  mini60: { name: '60-key mini 5×12 ortho (60 keys)', i2c: false, touch: false, rows: [
    r1('` 1 2 3 4 5 6 7 8 9 0 Bksp'), r1('Tab Q W E R T Y U I O P \\'), r1('Esc A S D F G H J K L ; \''), r1('Shift Z X C V B N M , . / Enter'), r1('Ctrl Gui Alt Fn Lower Space Space Raise Left Down Up Right'),
  ] },
  split36: { name: 'Split-ish 36 (two 3×5 halves + thumbs, one PCB)', i2c: true, touch: false, rows: [
    [...r1('Q W E R T'), ['', -1.5] as [string, number], ...r1('Y U I O P')],
    [...r1('A S D F G'), ['', -1.5] as [string, number], ...r1('H J K L ;')],
    [...r1('Z X C V B'), ['', -1.5] as [string, number], ...r1('N M , . /')],
    [['', -2] as [string, number], ...r1('Gui Lower Space'), ['', -1.5] as [string, number], ...r1('Enter Raise Alt')],
  ] },
};
export const PRESET_NAMES = Object.fromEntries(Object.entries(PRESETS).map(([k, v]) => [k, v.name]));

/** Rows of [label, width] (negative width = gap) -> keys in layout units (x right, y down, top-left). */
function rowsToUnits(rows: Row[]) {
  const out: { x: number; y: number; w: number; label: string }[] = [];
  rows.forEach((row, y) => { let x = 0; for (const [l, w] of row) { if (w < 0) { x += -w; continue; } out.push({ x, y, w, label: l }); x += w; } });
  return out;
}

/** KLE (keyboard-layout-editor.com) raw JSON -> layout units. Supports x/y/w offsets and labels; rotation is reported, not applied. */
export function parseKle(json: string): { keys: { x: number; y: number; w: number; label: string }[]; warnings: string[] } {
  let data: unknown; const warnings: string[] = [];
  try { data = JSON.parse(json); } catch { data = Function('"use strict";return [' + json + ']')(); }
  if (!Array.isArray(data)) throw new Error('KLE JSON must be an array of rows');
  const keys: { x: number; y: number; w: number; label: string }[] = [];
  let y = 0, rot = false;
  for (const row of data) {
    if (!Array.isArray(row)) continue; // metadata object
    let x = 0, w = 1;
    for (const it of row) {
      if (typeof it === 'object' && it) { const o = it as Record<string, number>; if (o.x) x += o.x; if (o.y) y += o.y; if (o.w) w = o.w; if (o.r) rot = true; continue; }
      if (typeof it === 'string') {
        const lab = it.split('\n').filter(Boolean); const label = (lab[lab.length - 1] ?? lab[0] ?? '').trim();
        const ww = Math.max(1, Math.round(w * 4) / 4); if (ww !== w) warnings.push(`width ${w}u rounded to ${ww}u`);
        keys.push({ x, y, w: ww, label }); x += w; w = 1;
      }
    }
    y += 1;
  }
  if (rot) warnings.push('KLE rotation (r/rx/ry) ignored — rotate keys in 90° steps in the editor');
  if (!keys.length) throw new Error('no keys found');
  return { keys, warnings: [...new Set(warnings)] };
}

// ---------------- layout -> Keyboard ----------------
const MARGIN = 6, STRIP = 26;
export function newKeyboard(preset = 'deck40', sw: SwitchKind = 'mx'): Keyboard {
  const p = PRESETS[preset] ?? PRESETS.deck40;
  const kb = fromUnits(rowsToUnits(p.rows), p.name.split(' — ')[0].split(' (')[0], sw);
  kb.i2c = p.i2c; kb.touchpad.on = p.touch; kb.shape = preset === 'split36' ? 'split' : 'rounded';
  return autoArrange(kb);
}
export function fromUnits(units: { x: number; y: number; w: number; label: string }[], name: string, sw: SwitchKind = 'mx'): Keyboard {
  const rowsH = Math.max(...units.map(k => k.y)) + 1;
  const keys: Key[] = units.map(k => ({ id: keyId(), x: +((k.x + k.w / 2) * U).toFixed(3), y: +((rowsH - k.y - 0.5) * U).toFixed(3), w: k.w, rot: 0, label: k.label }));
  return { name, switch: sw, controller: 'kb2040', keys, shape: 'rounded', outline: [], radius: 4, holes: [], ctrl: { x: 0, y: 0, rot: 90 }, i2c: true, i2cPos: { x: 0, y: 0 },
    touchpad: { on: false, kind: 'cirque40', x: 0, y: 0, hx: 0, hy: 0 }, penguins: true };
}
export const keyBox = (k: Key) => { const [w, h] = k.rot % 180 ? [U, k.w * U] : [k.w * U, U]; return { x1: k.x - w / 2, y1: k.y - h / 2, x2: k.x + w / 2, y2: k.y + h / 2 }; };
export function keysBox(keys: Key[]) {
  const bs = keys.map(keyBox); return { x1: Math.min(...bs.map(b => b.x1)), y1: Math.min(...bs.map(b => b.y1)), x2: Math.max(...bs.map(b => b.x2)), y2: Math.max(...bs.map(b => b.y2)) };
}

/** Place controller / headers / touchpad / holes around the keys and regenerate the outline from the shape preset. */
export function autoArrange(kb: Keyboard): Keyboard {
  const b = keysBox(kb.keys), tpd = TOUCHPADS[kb.touchpad.kind].dia;
  const x1 = b.x1 - MARGIN, y1 = b.y1 - MARGIN, tpW = kb.touchpad.on ? tpd + 10 : 0;
  const x2 = b.x2 + MARGIN + tpW, y2 = b.y2 + STRIP;
  const ctrl = { x: x1 + 17.3, y: b.y2 + 12.5, rot: 90 };       // USB-C flush with the left edge
  const i2cPos = { x: ctrl.x + 29, y: b.y2 + 6.5 };
  const touchpad = { ...kb.touchpad, x: b.x2 + MARGIN / 2 + tpW / 2, y: (b.y1 + b.y2) / 2, hx: ctrl.x + 29, hy: b.y2 + 18 };
  const k2 = { ...kb, ctrl, i2cPos, touchpad };
  const outline = shapeOutline(kb.shape === 'custom' ? 'rounded' : kb.shape, [x1, y1, x2, y2], k2);
  const ins = 3.6, hs: KbHole[] = [];
  for (const [x, y] of [[x1 + ins, y1 + ins], [x2 - ins, y1 + ins], [x1 + ins, y2 - ins], [x2 - ins, y2 - ins]] as Pt[])
    if (pointInPoly([x, y], outline)) hs.push({ id: keyId(), x, y, size: 'M2' });
  return { ...k2, outline, radius: kb.shape === 'rect' ? 0.5 : kb.radius || 4, holes: hs, shape: kb.shape === 'custom' ? 'rounded' : kb.shape };
}

export function shapeOutline(kind: ShapeKind, [x1, y1, x2, y2]: number[], kb: Keyboard): Pt[] {
  if (kind === 'wedge') { const s = 10; return [[x1 - s, y1], [x2 + s, y1], [x2, y2], [x1, y2]]; }
  if (kind === 'split') {
    // V notch at the bottom between the halves (widest x-gap between keys near the middle)
    const bs = kb.keys.map(keyBox).sort((a, b) => a.x1 - b.x1); let best = { gap: 0, x: (x1 + x2) / 2 }; let reach = -Infinity;
    for (const k of bs) { if (reach > -Infinity && k.x1 - reach > best.gap && Math.abs((k.x1 + reach) / 2 - (x1 + x2) / 2) < (x2 - x1) / 4) best = { gap: k.x1 - reach, x: (k.x1 + reach) / 2 }; reach = Math.max(reach, k.x2); }
    const kb1 = keysBox(kb.keys);
    const g = Math.max(0, best.gap - 5), depth = g > 6 ? (kb1.y2 - kb1.y1) * 0.55 + MARGIN : MARGIN - 1.5, hw = g > 6 ? g / 2 : 6;
    return [[x1, y1], [best.x - hw, y1], [best.x - hw / 3, y1 + depth], [best.x + hw / 3, y1 + depth], [best.x + hw, y1], [x2, y1], [x2, y2], [x1, y2]];
  }
  return [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
}

/** Round every corner of a polygon (convex or concave) with radius r. */
export function fillet(poly: Pt[], r: number, seg = 6): Pt[] {
  if (r <= 0.01) return poly;
  const out: Pt[] = [], n = poly.length;
  for (let i = 0; i < n; i++) {
    const p = poly[i], a = poly[(i + n - 1) % n], b = poly[(i + 1) % n];
    const u = norm([a[0] - p[0], a[1] - p[1]]), v = norm([b[0] - p[0], b[1] - p[1]]);
    const ang = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1])));
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const t = Math.min(r / Math.tan(ang / 2), la * 0.45, lb * 0.45); if (!isFinite(t) || t < 0.01 || ang > Math.PI - 0.01) { out.push(p); continue; }
    const rr = t * Math.tan(ang / 2), s: Pt = [p[0] + u[0] * t, p[1] + u[1] * t], e: Pt = [p[0] + v[0] * t, p[1] + v[1] * t];
    const bis = norm([u[0] + v[0], u[1] + v[1]]), dc = rr / Math.sin(ang / 2), c: Pt = [p[0] + bis[0] * dc, p[1] + bis[1] * dc];
    let a0 = Math.atan2(s[1] - c[1], s[0] - c[0]), a1 = Math.atan2(e[1] - c[1], e[0] - c[0]);
    let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    for (let k = 0; k <= seg; k++) { const q = a0 + (da * k) / seg; out.push([+(c[0] + rr * Math.cos(q)).toFixed(4), +(c[1] + rr * Math.sin(q)).toFixed(4)]); }
    void a1;
  }
  return out;
}
const norm = (v: Pt): Pt => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
export function polyArea(p: Pt[]) { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; }

// ---------------- matrix + pins ----------------
export interface Matrix { rows: number; cols: number; pos: Map<string, [number, number]>; rowPins: string[]; colPins: string[]; special: Record<string, string>; errors: string[] }
/** Rows = clusters of key centre Y (top row = 0); cols = order within the row by X. */
export function assignMatrix(kb: Keyboard): Matrix {
  const ks = [...kb.keys].sort((a, b) => b.y - a.y || a.x - b.x), rowsArr: Key[][] = [];
  for (const k of ks) { const r = rowsArr[rowsArr.length - 1]; if (r && Math.abs(r[0].y - k.y) < U * 0.5) r.push(k); else rowsArr.push([k]); }
  rowsArr.forEach(r => r.sort((a, b) => a.x - b.x));
  const pos = new Map<string, [number, number]>(); rowsArr.forEach((r, i) => r.forEach((k, j) => pos.set(k.id, [i, j])));
  const rows = rowsArr.length, cols = Math.max(0, ...rowsArr.map(r => r.length));
  // Pro Micro pin names. I2C = D2/D3 (KB2040 I2C1 SDA/SCL); SPI = 15/14/16 (+10 as CS).
  const special: Record<string, string> = {}; const used = new Set<string>();
  const tp = kb.touchpad.on ? kb.touchpad.kind : null;
  if (kb.i2c || tp === 'cirque40' || tp === 'cirque35') { special.SDA = '2'; special.SCL = '3'; used.add('2').add('3'); }
  if (tp === 'pmw3360') { Object.assign(special, { SCK: '15', MISO: '14', MOSI: '16', CS: '10' }); ['15', '14', '16', '10'].forEach(p => used.add(p)); }
  const pool = ['4', '5', '6', '7', '8', '9', '10', '16', '14', '15', '18', '19', '20', '21', 'TX', 'RX', '2', '3'].filter(p => !used.has(p));
  const errors: string[] = [];
  if (rows + cols > pool.length) errors.push(`matrix ${rows}×${cols} needs ${rows + cols} GPIO but only ${pool.length} are free on the Pro Micro footprint${kb.i2c ? ' (turn off the QWIIC header to free D2/D3)' : ''}`);
  const rowPins = pool.slice(0, rows), colPins = pool.slice(rows, rows + cols);
  const spare = pool[rows + cols]; if ((tp === 'cirque40' || tp === 'cirque35') && spare) special.DR = spare;
  return { rows, cols, pos, rowPins, colPins, special, errors };
}

// ---------------- Keyboard -> Design ----------------
export interface KbBuild { design: Design; matrix: Matrix; failed: string[]; warnings: string[]; ms: number }
export function buildKeyboard(kb0: Keyboard): KbBuild {
  const t0 = Date.now();
  // normalise so the outline bbox starts at 0,0
  const ox = Math.min(...kb0.outline.map(p => p[0])), oy = Math.min(...kb0.outline.map(p => p[1]));
  const kb = translate(kb0, -ox, -oy);
  const outline = fillet(kb.outline, kb.radius); if (polyArea(outline) < 0) outline.reverse();
  const W = +Math.max(...outline.map(p => p[0])).toFixed(3), H = +Math.max(...outline.map(p => p[1])).toFixed(3);
  const d = emptyDesign(W, H); d.outline = outline.map(([x, y]) => [Math.min(W, Math.max(0, x)), Math.min(H, Math.max(0, y))] as Pt);
  d.name = `${kb.name} (${kb.keys.length} keys, ${kb.switch === 'mx' ? 'MX' : 'Choc v1'} hotswap, ${kb.controller === 'kb2040' ? 'KB2040 RP2040' : 'nice!nano'})`;
  const m = assignMatrix(kb), warnings = [...m.errors];
  const net = (pin: string) => { const ri = m.rowPins.indexOf(pin); if (ri >= 0) return `ROW${ri}`; const ci = m.colPins.indexOf(pin); if (ci >= 0) return `COL${ci}`; const s = Object.entries(m.special).find(([, p]) => p === pin); return s ? (s[0] === 'DR' ? 'TP_DR' : s[0]) : undefined; };
  const chips: Chip[] = [], traces: Trace[] = [], vias: Via[] = [], texts: SilkText[] = [];
  const sw = kb.switch;
  // keys
  kb.keys.forEach((k, i) => {
    const [r, c] = m.pos.get(k.id)!, n = i + 1, kn = `K${n}`, rot = ((k.rot % 360) + 360) % 360;
    const fp = keyFp(sw, k.w); const P = (x: number, y: number) => xf(x, y, rot, k.x, k.y);
    chips.push({ id: 'SW' + n, fp: fp.id, x: k.x, y: k.y, rot, ref: 'SW' + n, value: `${k.label || 'key'} ${k.w}u`, nets: { 1: `COL${c}`, 2: kn }, color: capColor(k) });
    const dp = P(3, -5.5);
    chips.push({ id: 'D' + n, fp: 'D_SOD123_B', x: dp[0], y: dp[1], rot, ref: 'D' + n, value: '1N4148W', nets: { 1: `ROW${r}`, 2: kn } });
    const local: Pt[] = sw === 'mx' ? [[5.842, 5.08], [6.6, 5.08], [6.6, -5.5], [4.65, -5.5]] : [[8.5, 3.8], [8.0, 3.8], [8.0, -5.5], [4.65, -5.5]];
    traces.push({ id: 'KT' + n, layer: 'BottomCopper', width: 0.25, net: kn, pts: local.map(([x, y]) => P(x, y)) });
    const vp = sw === 'mx' ? P(-8.0, 2.54) : P(-4.3, 6);
    vias.push({ id: 'KV' + n, x: +vp[0].toFixed(3), y: +vp[1].toFixed(3), d: 0.6, drill: 0.3, net: `COL${c}` });
  });
  // controller
  const pm: Record<string, string> = {};
  [...PM_LEFT, ...PM_RIGHT].forEach((name, i) => { const nn = name === 'GND' ? 'GND' : name === 'VCC' ? '3V3' : net(name); if (nn) pm[String(i + 1)] = nn; });
  chips.push({ id: 'U1', fp: 'PROMICRO', x: kb.ctrl.x, y: kb.ctrl.y, rot: kb.ctrl.rot, ref: 'U1', value: kb.controller === 'kb2040' ? 'Adafruit KB2040 (Pro Micro RP2040)' : 'nice!nano v2 (Pro Micro nRF52840)', nets: pm });
  if (kb.i2c) {
    chips.push({ id: 'J1', fp: 'HDR1x4', x: kb.i2cPos.x, y: kb.i2cPos.y, rot: 0, ref: 'J1', value: 'QWIIC/I2C to host 1x4 (GND 3V3 SDA SCL)', nets: { 1: 'GND', 2: '3V3', 3: 'SDA', 4: 'SCL' } });
    ['G', '3V', 'DA', 'CL'].forEach((l, i) => texts.push(txt(l, kb.i2cPos.x + (i - 1.5) * 2.54, kb.i2cPos.y + 2.3)));
    texts.push(txt('QWIIC', kb.i2cPos.x, kb.i2cPos.y - 2.3));
  }
  if (kb.touchpad.on) {
    const tp = TOUCHPADS[kb.touchpad.kind], fpId = tp.pins.length === 5 ? 'HDR1x5' : 'HDR1x7', nets: Record<string, string> = {};
    tp.pins.forEach((p, i) => { const nn = p === 'DR' ? (m.special.DR ? 'TP_DR' : '') : p === 'MOT' ? '' : p; if (nn) nets[i + 1] = nn; });
    chips.push({ id: 'J2', fp: fpId, x: kb.touchpad.hx, y: kb.touchpad.hy, rot: 0, ref: 'J2', value: `${tp.name} header 1x${tp.pins.length}`, nets });
    tp.pins.forEach((p, i) => texts.push(txt(p === '3V3' ? '3V' : p.slice(0, 3), kb.touchpad.hx + (i - (tp.pins.length - 1) / 2) * 2.54, kb.touchpad.hy + 2.3, 0.13)));
    texts.push(txt(kb.touchpad.kind === 'pmw3360' ? 'TRACKBALL' : 'TOUCHPAD', kb.touchpad.hx, kb.touchpad.hy - 2.3));
    const R = tp.dia / 2; d.silkPolys = [{ layer: 'TopSilk', w: 0.2, pts: Array.from({ length: 65 }, (_, i) => [kb.touchpad.x + R * Math.cos(i * Math.PI / 32), kb.touchpad.y + R * Math.sin(i * Math.PI / 32)] as Pt) }];
    texts.push(txt(tp.name.split(' (')[0].toUpperCase(), kb.touchpad.x, kb.touchpad.y, 0.2));
  }
  kb.holes.forEach((h, i) => chips.push({ id: 'H' + (i + 1), fp: h.size === 'M2' ? 'MH_M2' : 'MH_M25', x: h.x, y: h.y, rot: 0, ref: 'H' + (i + 1), value: `${h.size} mounting hole` }));
  const kb1 = keysBox(kb.keys);
  texts.push(txt(kb.name.toUpperCase().slice(0, 22), Math.min(W - 30, kb1.x1 + (kb1.x2 - kb1.x1) * 0.62), kb1.y2 + 18.5, 0.24), txt('PENGUIN PCB STUDIO', Math.min(W - 30, kb1.x1 + (kb1.x2 - kb1.x1) * 0.62), kb1.y2 + 15.6, 0.16));
  d.chips = chips; d.traces = traces; d.vias = vias; d.texts = texts;
  // autoroute
  const order = [...Array(m.rows).keys()].map(i => `ROW${i}`).concat([...Array(m.cols).keys()].map(i => `COL${i}`), ['SDA', 'SCL', 'TP_DR', 'SCK', 'MOSI', 'MISO', 'CS', 'GND', '3V3']);
  const rr = autoroute(d, { order, prefer: n => (n.startsWith('COL') ? 'top' : n.startsWith('ROW') ? 'bot' : undefined) });
  if (rr.failed.length) warnings.push('autorouter could not finish: ' + rr.failed.join(', '));
  if (kb.penguins) addBackPenguins(d);
  return { design: d, matrix: m, failed: rr.failed, warnings, ms: Date.now() - t0 };
}
export function capColor(k: Key) {
  const l = (k.label ?? '').trim();
  if (l === 'Space' || l === 'Esc') return CAP_COLORS.accent;
  if (l === 'Enter' || ['Up', 'Down', 'Left', 'Right'].includes(l)) return CAP_COLORS.ice;
  if (k.w > 1 || l.length > 1) return CAP_COLORS.mod;
  return CAP_COLORS.alpha;
}
const txt = (text: string, x: number, y: number, px = 0.15): SilkText => ({ id: 'X' + Math.random().toString(36).slice(2, 8), text, x, y, px, rot: 0 });

export function translate(kb: Keyboard, dx: number, dy: number): Keyboard {
  if (!dx && !dy) return kb;
  return { ...kb, keys: kb.keys.map(k => ({ ...k, x: k.x + dx, y: k.y + dy })), outline: kb.outline.map(([x, y]) => [x + dx, y + dy] as Pt),
    holes: kb.holes.map(h => ({ ...h, x: h.x + dx, y: h.y + dy })), ctrl: { ...kb.ctrl, x: kb.ctrl.x + dx, y: kb.ctrl.y + dy }, i2cPos: { x: kb.i2cPos.x + dx, y: kb.i2cPos.y + dy },
    touchpad: { ...kb.touchpad, x: kb.touchpad.x + dx, y: kb.touchpad.y + dy, hx: kb.touchpad.hx + dx, hy: kb.touchpad.hy + dy } };
}

/** Lalo's penguin tiled over the back silk, dodging bottom pads, holes, vias and the outline. */
export function addBackPenguins(d: Design) {
  const avoid: MmRect[] = [];
  for (const c of d.chips) for (const p of FP[c.fp].pads) {
    if (!p.npth && !p.drill && p.side !== 'B') continue;
    const [x, y] = xf(p.x, p.y, c.rot, c.x, c.y), sw = c.rot % 180 ? [p.h, p.w] : [p.w, p.h];
    avoid.push({ x1: x - sw[0] / 2 - 0.2, y1: y - sw[1] / 2 - 0.2, x2: x + sw[0] / 2 + 0.2, y2: y + sw[1] / 2 + 0.2 });
  }
  for (const v of d.vias) avoid.push({ x1: v.x - 0.5, y1: v.y - 0.5, x2: v.x + 0.5, y2: v.y + 0.5 });
  const o = d.outline!, inside = (b: MmRect) => [[b.x1, b.y1], [b.x2, b.y1], [b.x2, b.y2], [b.x1, b.y2]].every(p => pointInPoly(p as Pt, o));
  const big = tilePenguinArt({ board: d.board, scaleMm: 5.2, marginMm: 0.3, avoidRects: avoid, pitch: 0.9, mirror: true, layer: 'BottomSilk', inside });
  const small = tilePenguinArt({ board: d.board, scaleMm: 3.6, marginMm: 0.3, avoidRects: avoid, pitch: 0.95, mirror: true, layer: 'BottomSilk', occupied: big.placed, maxOverlap: 0.04, inside });
  d.art = d.art.filter(a => a.layer !== 'BottomSilk').concat([big.art, small.art]);
  d.penguinCount = { top: 0, bottom: big.placed.length + small.placed.length };
}

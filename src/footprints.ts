// Footprint library. Units: mm, origin = footprint centre, +y = up (board coords).
export type PadShape = 'rect' | 'circle';
export interface PadDef { x: number; y: number; w: number; h: number; shape: PadShape; drill?: number; num: string; side?: 'B'; npth?: boolean }
export type BodyPart =
  | { kind: 'box'; x: number; y: number; z: number; w: number; d: number; h: number; color: string; metal?: boolean; label?: string; cap?: boolean; under?: boolean }
  | { kind: 'cyl'; x: number; y: number; z: number; r: number; h: number; color: string; metal?: boolean; under?: boolean };
export interface Footprint {
  id: string; name: string; desc: string; prefix: string;
  pads: PadDef[];
  silk: { lines: [number, number, number, number][]; dots: [number, number, number][] }; // dots: x,y,diameter
  body: BodyPart[];
  size: [number, number]; // courtyard w,h for hit/ghost
  /** 'B' = SMD part assembled on the bottom (CPL layer Bottom). */
  side?: 'B';
  /** Which silkscreen the footprint outline goes on (default top). */
  silkSide?: 'T' | 'B';
}

const BLACK = '#17181b', LEAD = '#c9ced6';

const r0805: Footprint = {
  id: 'R0805', name: '0805 resistor', desc: '2.0 × 1.25 mm SMD', prefix: 'R',
  pads: [{ x: -0.95, y: 0, w: 1.0, h: 1.3, shape: 'rect', num: '1' }, { x: 0.95, y: 0, w: 1.0, h: 1.3, shape: 'rect', num: '2' }],
  silk: { lines: [[-0.25, 0.85, 0.25, 0.85], [-0.25, -0.85, 0.25, -0.85]], dots: [] },
  body: [
    { kind: 'box', x: 0, y: 0, z: 0, w: 1.3, d: 1.25, h: 0.5, color: BLACK },
    { kind: 'box', x: -0.82, y: 0, z: 0, w: 0.36, d: 1.25, h: 0.52, color: LEAD, metal: true },
    { kind: 'box', x: 0.82, y: 0, z: 0, w: 0.36, d: 1.25, h: 0.52, color: LEAD, metal: true },
  ],
  size: [3, 1.8],
};

const soicY = [1.905, 0.635, -0.635, -1.905];
const soic8: Footprint = {
  id: 'SOIC8', name: 'SOIC-8', desc: '1.27 mm pitch, 3.9 mm body', prefix: 'U',
  pads: [
    ...soicY.map((y, i) => ({ x: -2.7, y, w: 1.55, h: 0.6, shape: 'rect' as const, num: String(i + 1) })),
    ...soicY.slice().reverse().map((y, i) => ({ x: 2.7, y, w: 1.55, h: 0.6, shape: 'rect' as const, num: String(i + 5) })),
  ],
  silk: { lines: [[-1.95, 2.6, 1.95, 2.6], [-1.95, -2.6, 1.95, -2.6]], dots: [[-3.4, 2.75, 0.4]] },
  body: [
    { kind: 'box', x: 0, y: 0, z: 0.1, w: 3.9, d: 4.9, h: 1.45, color: BLACK },
    { kind: 'cyl', x: -1.2, y: 1.7, z: 1.55, r: 0.3, h: 0.02, color: '#3a3d44' },
    ...soicY.flatMap(y => [
      { kind: 'box' as const, x: -2.55, y, z: 0, w: 1.2, d: 0.42, h: 0.22, color: LEAD, metal: true },
      { kind: 'box' as const, x: 2.55, y, z: 0, w: 1.2, d: 0.42, h: 0.22, color: LEAD, metal: true },
    ]),
  ],
  size: [6.4, 5.4],
};

const q = [0.75, 0.25, -0.25, -0.75];
const qfn16: Footprint = {
  id: 'QFN16', name: 'QFN-16 3×3', desc: '0.5 mm pitch + exposed pad', prefix: 'U',
  pads: [
    ...q.map((y, i) => ({ x: -1.45, y, w: 0.8, h: 0.3, shape: 'rect' as const, num: String(i + 1) })),
    ...q.map((x, i) => ({ x: -x, y: -1.45, w: 0.3, h: 0.8, shape: 'rect' as const, num: String(i + 5) })),
    ...q.map((y, i) => ({ x: 1.45, y: -y, w: 0.8, h: 0.3, shape: 'rect' as const, num: String(i + 9) })),
    ...q.map((x, i) => ({ x, y: 1.45, w: 0.3, h: 0.8, shape: 'rect' as const, num: String(i + 13) })),
    { x: 0, y: 0, w: 1.7, h: 1.7, shape: 'rect', num: 'EP' },
  ],
  silk: {
    lines: [[-1.75, 1.75, -1.2, 1.75], [1.2, 1.75, 1.75, 1.75], [1.75, 1.75, 1.75, 1.2], [1.75, -1.2, 1.75, -1.75],
      [1.75, -1.75, 1.2, -1.75], [-1.2, -1.75, -1.75, -1.75], [-1.75, -1.75, -1.75, -1.2]],
    dots: [[-2.15, 1.6, 0.35]],
  },
  body: [
    { kind: 'box', x: 0, y: 0, z: 0, w: 3, d: 3, h: 0.9, color: '#26282d' },
    { kind: 'cyl', x: -1.0, y: 1.0, z: 0.9, r: 0.18, h: 0.02, color: '#4a4e57' },
  ],
  size: [3.8, 3.8],
};

const dipY = [3.81, 1.27, -1.27, -3.81];
const dip8: Footprint = {
  id: 'DIP8', name: 'DIP-8', desc: 'Through-hole, 2.54 mm, 0.3"', prefix: 'U',
  pads: [
    ...dipY.map((y, i) => ({ x: -3.81, y, w: 1.6, h: 1.6, shape: (i === 0 ? 'rect' : 'circle') as PadShape, drill: 0.8, num: String(i + 1) })),
    ...dipY.slice().reverse().map((y, i) => ({ x: 3.81, y, w: 1.6, h: 1.6, shape: 'circle' as const, drill: 0.8, num: String(i + 5) })),
  ],
  silk: {
    lines: [[-2.6, 5.0, -0.7, 5.0], [0.7, 5.0, 2.6, 5.0], [2.6, 5.0, 2.6, -5.0], [2.6, -5.0, -2.6, -5.0], [-2.6, -5.0, -2.6, 5.0],
      [-0.7, 5.0, 0, 4.4], [0, 4.4, 0.7, 5.0]],
    dots: [],
  },
  body: [
    { kind: 'box', x: 0, y: 0, z: 0.5, w: 6.35, d: 9.8, h: 3.3, color: BLACK },
    { kind: 'cyl', x: 0, y: 4.9, z: 3.8, r: 0.7, h: 0.02, color: '#050506' },
    ...dipY.flatMap(y => [
      { kind: 'box' as const, x: -3.4, y, z: 0, w: 0.9, d: 0.5, h: 1.6, color: LEAD, metal: true },
      { kind: 'box' as const, x: 3.4, y, z: 0, w: 0.9, d: 0.5, h: 1.6, color: LEAD, metal: true },
    ]),
  ],
  size: [9.4, 10.4],
};

// PengBot P1 — invented penguin-branded MCU module (16 × 22 mm, castellated, 23 pads + GND).
const pbSide = Array.from({ length: 9 }, (_, i) => 6 - i * 2); // 6 .. -10
const pengbot: Footprint = {
  id: 'PENGBOT', name: 'PengBot P1 module', desc: 'Penguin MCU module · 16×22 mm · 23 castellated pads', prefix: 'M',
  pads: [
    ...pbSide.map((y, i) => ({ x: -8, y, w: 1.6, h: 0.9, shape: 'rect' as const, num: String(i + 1) })),
    ...[-4, -2, 0, 2, 4].map((x, i) => ({ x, y: -11, w: 0.9, h: 1.6, shape: 'rect' as const, num: String(i + 10) })),
    ...pbSide.slice().reverse().map((y, i) => ({ x: 8, y, w: 1.6, h: 0.9, shape: 'rect' as const, num: String(i + 15) })),
    { x: 0, y: -3, w: 3.6, h: 3.6, shape: 'rect', num: 'GND' },
  ],
  silk: {
    lines: [[-8.4, 11.4, 8.4, 11.4], [8.4, 11.4, 8.4, 7.0], [-8.4, 11.4, -8.4, 7.0], [-8.4, -11.9, -5.0, -11.9], [5.0, -11.9, 8.4, -11.9],
      [-8.4, 7.4, 8.4, 7.4]],
    dots: [[-9.6, 6.6, 0.5]],
  },
  body: [
    { kind: 'box', x: 0, y: 0, z: 0, w: 16, d: 22, h: 0.8, color: '#0a0f18' },              // module PCB (penguin black)
    { kind: 'box', x: 0, y: -2.8, z: 0.8, w: 13, d: 13.5, h: 2.1, color: '#e9eef3', metal: true, label: 'PengBot' }, // white belly shield
    { kind: 'box', x: 0, y: 9.0, z: 0.8, w: 12, d: 2.6, h: 0.04, color: '#c9a24a', metal: true },   // PCB antenna meander
    { kind: 'box', x: 5.8, y: -10.0, z: 0.8, w: 1.0, d: 0.6, h: 0.35, color: '#f4a340' },          // beak-orange status LED
  ],
  size: [17.6, 24],
};


const c0805: Footprint = { ...r0805, id: 'C0805', name: '0805 capacitor', desc: '2.0 × 1.25 mm MLCC', prefix: 'C',
  body: [{ kind: 'box', x: 0, y: 0, z: 0, w: 1.3, d: 1.25, h: 0.8, color: '#b08a5a' },
    { kind: 'box', x: -0.82, y: 0, z: 0, w: 0.36, d: 1.25, h: 0.82, color: LEAD, metal: true },
    { kind: 'box', x: 0.82, y: 0, z: 0, w: 0.36, d: 1.25, h: 0.82, color: LEAD, metal: true }] };
// LED: pad 1 = cathode (marked with silk bar)
const led0805: Footprint = { ...r0805, id: 'LED0805', name: '0805 LED', desc: 'pad 1 = cathode', prefix: 'D',
  silk: { lines: [[-0.25, 0.85, 0.6, 0.85], [-0.25, -0.85, 0.6, -0.85], [-2.0, 0.85, -2.0, -0.85]], dots: [] },
  body: [{ kind: 'box', x: 0, y: 0, z: 0, w: 2.0, d: 1.25, h: 0.35, color: '#f2f2ee' },
    { kind: 'box', x: 0.1, y: 0, z: 0.35, w: 1.4, d: 1.0, h: 0.4, color: '#7fe3ff' },
    { kind: 'box', x: -0.85, y: 0, z: 0.35, w: 0.12, d: 1.0, h: 0.02, color: '#2a7a3a' }] };

/** Dual in-line, n pins, 0.3" rows. Local: pin 1 top-left, counter-clockwise. */
export function dip(n: number, label?: string): Footprint {
  const h = n / 2, top = ((h - 1) * 2.54) / 2, ys = Array.from({ length: h }, (_, i) => top - i * 2.54), L = h * 2.54;
  return {
    id: 'DIP' + n, name: `DIP-${n}`, desc: `Through-hole, 2.54 mm, 0.3"`, prefix: 'U',
    pads: [...ys.map((y, i) => ({ x: -3.81, y, w: 1.6, h: 1.6, shape: (i ? 'circle' : 'rect') as PadShape, drill: 0.8, num: String(i + 1) })),
      ...ys.slice().reverse().map((y, i) => ({ x: 3.81, y, w: 1.6, h: 1.6, shape: 'circle' as const, drill: 0.8, num: String(i + h + 1) }))],
    silk: { lines: [[-2.6, L / 2, -0.7, L / 2], [0.7, L / 2, 2.6, L / 2], [2.6, L / 2, 2.6, -L / 2], [2.6, -L / 2, -2.6, -L / 2], [-2.6, -L / 2, -2.6, L / 2],
      [-0.7, L / 2, 0, L / 2 - 0.6], [0, L / 2 - 0.6, 0.7, L / 2]], dots: [] },
    body: [{ kind: 'box', x: 0, y: 0, z: 0.5, w: 6.35, d: L - 0.4, h: 3.3, color: BLACK, label },
      { kind: 'cyl', x: 0, y: L / 2 - 0.3, z: 3.8, r: 0.7, h: 0.02, color: '#050506' },
      ...ys.flatMap(y => [
        { kind: 'box' as const, x: -3.4, y, z: 0, w: 0.9, d: 0.5, h: 1.6, color: LEAD, metal: true },
        { kind: 'box' as const, x: 3.4, y, z: 0, w: 0.9, d: 0.5, h: 1.6, color: LEAD, metal: true }])],
    size: [9.4, L + 0.8],
  };
}

/** 1×n 2.54 mm pin header (male), pins along local x, pin 1 at left (square). */
export function header(n: number): Footprint {
  const xs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * 2.54), L = n * 2.54;
  return {
    id: 'HDR1x' + n, name: `Header 1×${n}`, desc: '2.54 mm pin header, 1.0 mm drill', prefix: 'J',
    pads: xs.map((x, i) => ({ x, y: 0, w: 1.7, h: 1.7, shape: (i ? 'circle' : 'rect') as PadShape, drill: 1.0, num: String(i + 1) })),
    silk: { lines: [], dots: [] },
    body: [{ kind: 'box', x: 0, y: 0, z: 0, w: L, d: 2.5, h: 2.5, color: '#141518' },
      ...xs.map(x => ({ kind: 'box' as const, x, y: 0, z: 2.5, w: 0.64, d: 0.64, h: 5.8, color: '#d9b45a', metal: true }))],
    size: [L, 2.6],
  };
}

const hc49: Footprint = {
  id: 'HC49', name: 'Crystal HC-49/S', desc: '16 MHz, 4.88 mm lead pitch', prefix: 'Y',
  pads: [{ x: -2.44, y: 0, w: 1.6, h: 1.6, shape: 'circle', drill: 0.8, num: '1' }, { x: 2.44, y: 0, w: 1.6, h: 1.6, shape: 'circle', drill: 0.8, num: '2' }],
  silk: { lines: [[-3.6, 2.4, 3.6, 2.4], [-3.6, -2.4, 3.6, -2.4]], dots: [] },
  body: [{ kind: 'box', x: 0, y: 0, z: 0.4, w: 10.5, d: 4.4, h: 3.4, color: '#d5dbe2', metal: true },
    { kind: 'box', x: 0, y: 0, z: 0, w: 11.2, d: 4.8, h: 0.4, color: '#c0c7cf', metal: true }],
  size: [11.4, 5],
};


// ---------- PengBot ESP32 parts ----------
// ESP32-WROOM-32E (Espressif datasheet land pattern: 18 x 25.5 mm, 1.27 mm pitch, 38 pads + exposed GND).
// Local origin = module centre, antenna at +y (top 6 mm = keepout, no copper under it on any layer).
const wroomSide = Array.from({ length: 14 }, (_, i) => +(5.26 - i * 1.27).toFixed(3));
const wroom: Footprint = {
  id: 'WROOM32', name: 'ESP32-WROOM-32E', desc: 'Wi-Fi/BT module · 18×25.5 mm · 4 MB flash onboard', prefix: 'U',
  pads: [
    ...wroomSide.map((y, i) => ({ x: -9, y, w: 1.5, h: 0.9, shape: 'rect' as const, num: String(i + 1) })),
    ...Array.from({ length: 10 }, (_, i) => ({ x: +(-5.715 + i * 1.27).toFixed(3), y: -12.5, w: 0.9, h: 1.5, shape: 'rect' as const, num: String(i + 15) })),
    ...wroomSide.slice().reverse().map((y, i) => ({ x: 9, y, w: 1.5, h: 0.9, shape: 'rect' as const, num: String(i + 25) })),
    { x: -1, y: 1, w: 5, h: 5, shape: 'rect', num: 'EP' },
  ],
  silk: { lines: [[-9.4, 12.4, 9.4, 12.4], [-9.4, 12.4, -9.4, 6.4], [9.4, 12.4, 9.4, 6.4], [-9.4, 6.75, 9.4, 6.75], [-9.4, -13.4, -6.6, -13.4], [6.6, -13.4, 9.4, -13.4]], dots: [[-10.4, 6.3, 0.5]] },
  body: [
    { kind: 'box', x: 0, y: 0, z: 0, w: 18, d: 25.5, h: 0.8, color: '#10151f' },
    { kind: 'box', x: 0, y: -2.8, z: 0.8, w: 16.6, d: 17.6, h: 2.3, color: '#dfe5ec', metal: true, label: 'ESP32' },
    { kind: 'box', x: 0, y: 9.6, z: 0.8, w: 15, d: 4.2, h: 0.04, color: '#c9a24a', metal: true },
  ],
  size: [19.6, 26.4],
};

// AMS1117-3.3 (SOT-223): 1 GND/ADJ, 2 VOUT, 3 VIN, 4 = tab (VOUT).
const sot223: Footprint = {
  id: 'SOT223', name: 'AMS1117-3.3 (SOT-223)', desc: '3.3 V 1 A LDO regulator', prefix: 'U',
  pads: [
    { x: -2.3, y: -3.15, w: 1.2, h: 2.0, shape: 'rect', num: '1' }, { x: 0, y: -3.15, w: 1.2, h: 2.0, shape: 'rect', num: '2' },
    { x: 2.3, y: -3.15, w: 1.2, h: 2.0, shape: 'rect', num: '3' }, { x: 0, y: 3.15, w: 3.6, h: 2.0, shape: 'rect', num: '4' },
  ],
  silk: { lines: [[-3.4, 1.9, -3.4, -1.9], [3.4, 1.9, 3.4, -1.9]], dots: [[-3.7, -3.4, 0.4]] },
  body: [{ kind: 'box', x: 0, y: 0, z: 0, w: 6.5, d: 3.5, h: 1.6, color: BLACK, label: '1117' },
    { kind: 'box', x: 0, y: 3.15, z: 0, w: 3.0, d: 1.6, h: 0.1, color: LEAD, metal: true },
    ...[-2.3, 0, 2.3].map(x => ({ kind: 'box' as const, x, y: -2.9, z: 0, w: 0.7, d: 1.6, h: 0.1, color: LEAD, metal: true }))],
  size: [7.4, 8.4],
};

// USB-C receptacle, 6-pin power-only (HRO TYPE-C-31-M-17 / GCT USB4125 class). Pads: GND VBUS CC1 CC2 VBUS GND + 2 shell posts.
// Approximate land pattern — verify against the exact part's datasheet before ordering.
const usbc: Footprint = {
  id: 'USBC6P', name: 'USB-C 6P (power)', desc: '5 V in · CC 5.1k pulldowns · board-edge', prefix: 'J',
  pads: [
    ...[['A12', -2.5], ['A9', -1.5], ['A5', -0.5], ['B5', 0.5], ['B9', 1.5], ['B12', 2.5]].map(([num, x]) => ({ x: x as number, y: 3.0, w: 0.7, h: 1.6, shape: 'rect' as const, num: num as string })),
    { x: -4.3, y: 0, w: 1.6, h: 1.6, shape: 'circle', drill: 1.0, num: 'S1' }, { x: 4.3, y: 0, w: 1.6, h: 1.6, shape: 'circle', drill: 1.0, num: 'S2' },
  ],
  silk: { lines: [[-4.6, 4.4, -3.2, 4.4], [3.2, 4.4, 4.6, 4.4]], dots: [] },
  body: [{ kind: 'box', x: 0, y: 0.2, z: 0, w: 8.9, d: 7.0, h: 3.2, color: '#c9ced6', metal: true },
    { kind: 'box', x: 0, y: -3.2, z: 0.6, w: 7.0, d: 0.8, h: 2.0, color: '#17181b' }],
  size: [9.6, 7.6],
};

// 5.1 x 5.1 SMD tactile switch (TS-1187A class). 1-2 and 3-4 are internally connected.
const sw: Footprint = {
  id: 'SW_TACT', name: 'Tact switch 5.1 mm SMD', desc: 'EN / BOOT button', prefix: 'SW',
  pads: [{ x: -3.1, y: 1.85, w: 1.2, h: 1.0, shape: 'rect', num: '1' }, { x: -3.1, y: -1.85, w: 1.2, h: 1.0, shape: 'rect', num: '2' },
    { x: 3.1, y: 1.85, w: 1.2, h: 1.0, shape: 'rect', num: '3' }, { x: 3.1, y: -1.85, w: 1.2, h: 1.0, shape: 'rect', num: '4' }],
  silk: { lines: [[-2.6, 2.6, 2.6, 2.6], [-2.6, -2.6, 2.6, -2.6], [-2.6, 1.0, -2.6, -1.0], [2.6, 1.0, 2.6, -1.0]], dots: [] },
  body: [{ kind: 'box', x: 0, y: 0, z: 0, w: 5.1, d: 5.1, h: 1.4, color: '#c9ced6', metal: true },
    { kind: 'cyl', x: 0, y: 0, z: 1.4, r: 1.5, h: 0.8, color: '#1c2633' }],
  size: [7.6, 5.6],
};

export const DIP28 = dip(28, 'ATMEGA328P');
export const HDR14 = header(14), HDR6 = header(6), HDR13 = header(13), HDR4 = header(4);
export const FOOTPRINTS: Footprint[] = [r0805, c0805, led0805, soic8, qfn16, dip8, DIP28, hc49, HDR6, HDR14, pengbot, wroom, sot223, usbc, sw, HDR13, HDR4];
export const FP: Record<string, Footprint> = Object.fromEntries(FOOTPRINTS.map(f => [f.id, f]));

/** Rotate a local point by rot (multiples of 90°, CCW) and translate. */
export function xf(x: number, y: number, rot: number, cx: number, cy: number): [number, number] {
  const r = ((rot % 360) + 360) % 360;
  const [a, b] = r === 90 ? [-y, x] : r === 180 ? [-x, -y] : r === 270 ? [y, -x] : [x, y];
  return [cx + a, cy + b];
}

// ---------- Keyboard parts ----------
// Switch land patterns are copied 1:1 from kiswitch (MIT/CC-BY-SA, github.com/kiswitch/kiswitch):
//   Switch_Keyboard_Hotswap_Kailh.pretty/SW_Hotswap_Kailh_MX_1.00u.kicad_mod
//   Switch_Keyboard_Hotswap_Kailh.pretty/SW_Hotswap_Kailh_Choc_V1_1.00u.kicad_mod
//   Mounting_Keyboard_Stabilizer.pretty/Stabilizer_Cherry_MX_{2.00u,6.25u,7.00u}.kicad_mod
// KiCad is y-down; we are y-up, so every y below is negated vs the .kicad_mod file.
// Pad 1 / pad 2 are the Kailh socket's SMD tabs on the BOTTOM copper (B.Cu); all round holes are NPTH.
export type SwitchKind = 'mx' | 'choc';
export const U = 19.05;
const npth = (x: number, y: number, d: number): PadDef => ({ x, y, w: d, h: d, shape: 'circle', drill: d, npth: true, num: '' });
const SW_DEF: Record<SwitchKind, { holes: PadDef[]; pads: PadDef[]; cut: number; name: string }> = {
  mx: {
    name: 'MX hotswap (Kailh CPG151101S11)', cut: 14,
    holes: [npth(-3.81, 2.54, 3.05), npth(2.54, 5.08, 3.05), npth(0, 0, 4), npth(-5.08, 0, 1.75), npth(5.08, 0, 1.75)],
    pads: [{ x: -7.085, y: 2.54, w: 2.55, h: 2.5, shape: 'rect', num: '1', side: 'B' }, { x: 5.842, y: 5.08, w: 2.55, h: 2.5, shape: 'rect', num: '2', side: 'B' }],
  },
  choc: {
    name: 'Choc v1 hotswap (Kailh CPG135001S30)', cut: 13.8,
    holes: [npth(0, 5.9, 3.05), npth(5, 3.8, 3.05), npth(0, 0, 3.45), npth(-5.5, 0, 1.9), npth(5.5, 0, 1.9)],
    pads: [{ x: -3.5, y: 6, w: 2.55, h: 2.5, shape: 'rect', num: '1', side: 'B' }, { x: 8.5, y: 3.8, w: 2.55, h: 2.5, shape: 'rect', num: '2', side: 'B' }],
  },
};
/** Plate cutout: Cherry MX spec 14.0 mm square; Kailh Choc v1 spec 13.8 mm square. */
export const plateCut = (k: SwitchKind) => SW_DEF[k].cut;
/** Cherry PCB-mount stabilizer half-spacing for a key width (kiswitch Stabilizer_Cherry_MX_*). */
export const stabHalf = (w: number) => (w >= 7 ? 57.15 : w >= 6 ? 50 : w >= 2 ? 11.938 : 0);
export const CAP_COLORS = { alpha: '#eef3f7', mod: '#16181d', accent: '#f4a340', ice: '#9fd8ff' };

/** Key switch + Kailh socket (+ MX stabilizer holes for >= 2u) + keycap body, for width w (in u). */
export function keyFp(kind: SwitchKind, w: number): Footprint {
  const id = `KEY_${kind.toUpperCase()}_${w}U`;
  if (FP[id]) return FP[id];
  const def = SW_DEF[kind], sh = kind === 'mx' ? stabHalf(w) : 0;
  const stab = sh ? [npth(-sh, 6.985, 3.048), npth(sh, 6.985, 3.048), npth(-sh, -8.225, 3.9878), npth(sh, -8.225, 3.9878)] : [];
  const c = def.cut / 2 + 0.3, cw = w * U - 1.1, choc = kind === 'choc';
  const f: Footprint = {
    id, name: `${kind === 'mx' ? 'MX' : 'Choc'} ${w}u`, desc: def.name + (sh ? ' + Cherry stab' : ''), prefix: 'SW',
    pads: [...def.pads, ...def.holes, ...stab],
    silk: { lines: [[-c, c, c, c], [c, c, c, -c], [c, -c, -c, -c], [-c, -c, -c, c]], dots: [] },
    body: [
      { kind: 'box', x: 0, y: 0, z: 0, w: 14, d: 14, h: choc ? 2.2 : 5, color: '#20232a' },
      { kind: 'box', x: 0, y: 0, z: choc ? 2.2 : 5, w: 15, d: 15, h: choc ? 0.8 : 3.5, color: choc ? '#3b3f48' : '#2a2d35' },
      { kind: 'box', x: 0, y: 0, z: choc ? 3 : 8.5, w: cw, d: U - 1.1 - (choc ? 1 : 0), h: choc ? 3 : 7.5, color: CAP_COLORS.alpha, cap: true },
      // Kailh socket body on the back
      { kind: 'box', x: choc ? 2.5 : -0.6, y: choc ? 4.9 : 3.8, z: 0, w: choc ? 9.5 : 10.9, d: choc ? 4.6 : 4.6, h: 1.8, color: '#e8e4da', under: true },
    ],
    size: [w * U, U], silkSide: 'T',
  };
  FP[id] = f; return f;
}

// 1N4148W, SOD-123 — pads from KiCad Diode_SMD.pretty/D_SOD-123.kicad_mod (±1.65, 0.9 × 1.2). Pad 1 = cathode. Bottom side.
export const dSod123B: Footprint = {
  id: 'D_SOD123_B', name: '1N4148W SOD-123 (back)', desc: 'Per-key matrix diode, bottom side, pad 1 = cathode', prefix: 'D', side: 'B', silkSide: 'B',
  pads: [{ x: -1.65, y: 0, w: 0.9, h: 1.2, shape: 'rect', num: '1', side: 'B' }, { x: 1.65, y: 0, w: 0.9, h: 1.2, shape: 'rect', num: '2', side: 'B' }],
  silk: { lines: [[-0.9, 1.0, 0.9, 1.0], [-0.9, -1.0, 0.9, -1.0], [-0.55, 0.8, -0.55, -0.8]], dots: [] },
  body: [{ kind: 'box', x: 0, y: 0, z: 0, w: 2.7, d: 1.6, h: 1.1, color: BLACK, under: true }, { kind: 'box', x: -0.9, y: 0, z: 1.1, w: 0.3, d: 1.6, h: 0.02, color: '#c9ced6', under: true }],
  size: [4.4, 2.2],
};

/** Pro Micro footprint (2 × 12, 0.6" rows, 2.54 mm pitch). Fits Adafruit KB2040 (RP2040), SparkFun Pro Micro RP2040,
 *  nice!nano v2 (nRF52840). Local: USB-C at +y; left column = pins 1-12, right column = 13-24, both top -> bottom. */
export const PM_LEFT = ['TX', 'RX', 'GND', 'GND', '2', '3', '4', '5', '6', '7', '8', '9'];
export const PM_RIGHT = ['RAW', 'GND', 'RST', 'VCC', '21', '20', '19', '18', '15', '14', '16', '10'];
const pmY = (i: number) => +(13.97 - i * 2.54).toFixed(3);
export const proMicro: Footprint = {
  id: 'PROMICRO', name: 'Pro Micro RP2040 (KB2040)', desc: 'USB-C controller module, socketed · 18×33 mm', prefix: 'U',
  pads: [...PM_LEFT.map((_, i) => ({ x: -7.62, y: pmY(i), w: 1.7, h: 1.7, shape: (i ? 'circle' : 'rect') as PadShape, drill: 1.0, num: String(i + 1) })),
    ...PM_RIGHT.map((_, i) => ({ x: 7.62, y: pmY(i), w: 1.7, h: 1.7, shape: 'circle' as const, drill: 1.0, num: String(i + 13) }))],
  silk: { lines: [[-9, 16.5, 9, 16.5], [9, 16.5, 9, -16.5], [9, -16.5, -9, -16.5], [-9, -16.5, -9, 16.5], [-4.5, 16.5, -4.5, 13.5], [4.5, 16.5, 4.5, 13.5], [-4.5, 13.5, 4.5, 13.5]], dots: [[-9.8, 14.6, 0.5]] },
  body: [
    { kind: 'box', x: -7.62, y: 0, z: 0, w: 2.5, d: 30.5, h: 5, color: '#141518' }, { kind: 'box', x: 7.62, y: 0, z: 0, w: 2.5, d: 30.5, h: 5, color: '#141518' },
    { kind: 'box', x: 0, y: 0, z: 5, w: 18, d: 33, h: 1.2, color: '#0d1b3d' },
    { kind: 'box', x: 0, y: 2, z: 6.2, w: 7, d: 7, h: 0.9, color: BLACK, label: 'RP2040' },
    { kind: 'box', x: 0, y: 15.2, z: 6.2, w: 9, d: 7.4, h: 3.2, color: '#c9ced6', metal: true },
  ],
  size: [19, 34],
};
export const mountHole = (m: 'M2' | 'M2.5'): Footprint => {
  const d = m === 'M2' ? 2.2 : 2.7, r = d / 2 + 0.9, oct = Array.from({ length: 8 }, (_, i) => [Math.cos(i * Math.PI / 4) * r, Math.sin(i * Math.PI / 4) * r]);
  return { id: m === 'M2' ? 'MH_M2' : 'MH_M25', name: `Mounting hole ${m}`, desc: `${d} mm NPTH (${m} screw/standoff)`, prefix: 'H',
    pads: [npth(0, 0, d)], silk: { lines: oct.map((p, i) => [p[0], p[1], oct[(i + 1) % 8][0], oct[(i + 1) % 8][1]] as [number, number, number, number]), dots: [] },
    body: [{ kind: 'cyl', x: 0, y: 0, z: -0.01, r: d / 2 + 0.6, h: 0.02, color: '#c9a24a', metal: true }], size: [r * 2 + 0.4, r * 2 + 0.4] };
};
export const HDR5 = header(5), HDR7 = header(7);
for (const f of [dSod123B, proMicro, mountHole('M2'), mountHole('M2.5'), HDR5, HDR7]) { FOOTPRINTS.push(f); FP[f.id] = f; }

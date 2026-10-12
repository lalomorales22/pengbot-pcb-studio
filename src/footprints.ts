// Footprint library. Units: mm, origin = footprint centre, +y = up (board coords).
export type PadShape = 'rect' | 'circle';
export interface PadDef { x: number; y: number; w: number; h: number; shape: PadShape; drill?: number; num: string }
export type BodyPart =
  | { kind: 'box'; x: number; y: number; z: number; w: number; d: number; h: number; color: string; metal?: boolean; label?: string }
  | { kind: 'cyl'; x: number; y: number; z: number; r: number; h: number; color: string; metal?: boolean };
export interface Footprint {
  id: string; name: string; desc: string; prefix: string;
  pads: PadDef[];
  silk: { lines: [number, number, number, number][]; dots: [number, number, number][] }; // dots: x,y,diameter
  body: BodyPart[];
  size: [number, number]; // courtyard w,h for hit/ghost
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

export const DIP28 = dip(28, 'ATMEGA328P');
export const HDR14 = header(14), HDR6 = header(6);
export const FOOTPRINTS: Footprint[] = [r0805, c0805, led0805, soic8, qfn16, dip8, DIP28, hc49, HDR6, HDR14, pengbot];
export const FP: Record<string, Footprint> = Object.fromEntries(FOOTPRINTS.map(f => [f.id, f]));

/** Rotate a local point by rot (multiples of 90°, CCW) and translate. */
export function xf(x: number, y: number, rot: number, cx: number, cy: number): [number, number] {
  const r = ((rot % 360) + 360) % 360;
  const [a, b] = r === 90 ? [-y, x] : r === 180 ? [-x, -y] : r === 270 ? [y, -x] : [x, y];
  return [cx + a, cy + b];
}

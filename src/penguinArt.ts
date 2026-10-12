// Procedural penguin badge (ink = dark pixels -> becomes silkscreen white on the board).
// Shared by the browser (default sample) and the node smoke test, so no image decoding needed.
import type { Gray } from './core';
import { FONT } from './font';

export function penguinBadge(W = 400, text = 'PENGUINS'): Gray {
  const ink = new Uint8Array(W * W);
  const s = W / 400;
  const ell = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  for (let py = 0; py < W; py++) for (let px = 0; px < W; px++) {
    const x = px / s, y = py / s;
    const r = Math.hypot(x - 200, y - 200);
    let on = (r >= 184 && r <= 194) || (r >= 172 && r <= 176);          // double ring
    const body = ell(x, y, 200, 178, 74, 100), bodyIn = ell(x, y, 200, 178, 66, 92);
    if (body && !bodyIn) on = true;                                      // body outline
    if (ell(x, y, 200, 202, 46, 66)) on = true;                          // white belly
    // flippers (outlined)
    for (const sx of [-1, 1]) {
      const fx = 200 + sx * 70, fy = 190;
      const dx = (x - fx) * Math.cos(sx * 0.35) + (y - fy) * Math.sin(sx * 0.35), dy = -(x - fx) * Math.sin(sx * 0.35) + (y - fy) * Math.cos(sx * 0.35);
      const o = (dx / 16) ** 2 + (dy / 50) ** 2, i = (dx / 9) ** 2 + (dy / 43) ** 2;
      if (o <= 1 && i > 1 && !bodyIn) on = true;
    }
    // eyes: white disc with dark pupil
    for (const ex of [176, 224]) {
      const d = Math.hypot(x - ex, y - 128);
      if (d <= 12 && Math.hypot(x - (ex + (ex < 200 ? 3 : -3)), y - 130) > 5) on = true;
    }
    // beak: downward triangle
    if (y >= 142 && y <= 160 && Math.abs(x - 200) <= 14 * (1 - (y - 142) / 18)) on = true;
    // feet
    if (ell(x, y, 176, 280, 20, 8) || ell(x, y, 224, 280, 20, 8)) on = true;
    if (on) ink[py * W + px] = 1;
  }
  // text
  const scale = 4 * s, adv = 6 * scale, tw = text.length * adv - scale, tx0 = Math.round(W / 2 - tw / 2), ty0 = Math.round(300 * s);
  [...text].forEach((ch, k) => {
    const g = FONT[ch] ?? FONT[' '];
    for (let gy = 0; gy < 7; gy++) for (let gx = 0; gx < 5; gx++) if (g[gy][gx] === '1')
      for (let yy = 0; yy < scale; yy++) for (let xx = 0; xx < scale; xx++) {
        const X = Math.round(tx0 + k * adv + gx * scale + xx), Y = Math.round(ty0 + gy * scale + yy);
        if (X >= 0 && Y >= 0 && X < W && Y < W) ink[Y * W + X] = 1;
      }
  });
  const lum = new Uint8Array(W * W), alpha = new Uint8Array(W * W).fill(255);
  for (let i = 0; i < W * W; i++) lum[i] = ink[i] ? 0 : 255;
  return { width: W, height: W, lum, alpha };
}

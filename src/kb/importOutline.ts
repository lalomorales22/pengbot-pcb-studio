// Import a board outline from SVG (polygon / polyline / rect / path) or DXF (LWPOLYLINE / POLYLINE / LINE chain). Units: mm.
import { Pt } from '../core';

export function outlineFromDxf(text: string): Pt[] {
  const lines = text.split(/\r?\n/).map(s => s.trim()), polys: Pt[][] = [], segs: [Pt, Pt][] = [];
  for (let i = 0; i < lines.length - 1; i += 2) {
    if (lines[i] !== '0') continue;
    const type = lines[i + 1];
    if (type === 'LWPOLYLINE' || type === 'POLYLINE' || type === 'LINE') {
      const pts: Pt[] = []; let x: number | null = null; const ln: number[] = [];
      let j = i + 2;
      for (; j < lines.length - 1; j += 2) {
        const c = lines[j], v = lines[j + 1];
        if (c === '0' && type !== 'POLYLINE') break;
        if (c === '0' && type === 'POLYLINE' && v === 'SEQEND') break;
        if (c === '10') x = +v; else if (c === '20' && x !== null) { pts.push([x, +v]); x = null; }
        if (type === 'LINE' && ['10', '20', '11', '21'].includes(c)) ln.push(+v);
      }
      if (type === 'LINE' && ln.length >= 4) segs.push([[ln[0], ln[1]], [ln[2], ln[3]]]);
      else if (pts.length >= 3) polys.push(pts);
      i = j - 2;
    }
  }
  if (!polys.length && segs.length) { // chain LINE segments
    const chain: Pt[] = [segs[0][0], segs[0][1]]; const rest = segs.slice(1); const eq = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-3;
    while (rest.length) { const end = chain[chain.length - 1]; const k = rest.findIndex(s => eq(s[0], end) || eq(s[1], end)); if (k < 0) break; const s = rest.splice(k, 1)[0]; chain.push(eq(s[0], end) ? s[1] : s[0]); }
    if (eq(chain[0], chain[chain.length - 1])) chain.pop(); polys.push(chain);
  }
  if (!polys.length) throw new Error('no closed polyline found in DXF');
  return largest(polys);
}

/** Browser-only (uses SVG geometry APIs to flatten curves). SVG y-down is flipped to board y-up. */
export function outlineFromSvg(text: string): Pt[] {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml'), svg = doc.querySelector('svg'); if (!svg) throw new Error('not an SVG');
  // mm per user unit: width="100mm" + viewBox -> scale; otherwise 1 unit = 1 mm (96 dpi px -> mm when width is in px)
  const vb = svg.getAttribute('viewBox')?.split(/[ ,]+/).map(Number), wAttr = svg.getAttribute('width') ?? '';
  let k = 1; const m = /([\d.]+)\s*(mm|cm|in|px)?/.exec(wAttr);
  if (m) { const v = +m[1], unit = m[2] ?? 'px', mm = unit === 'mm' ? v : unit === 'cm' ? v * 10 : unit === 'in' ? v * 25.4 : v * 25.4 / 96; k = vb ? mm / vb[2] : mm / v; }
  const host = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); host.style.position = 'absolute'; host.style.visibility = 'hidden'; document.body.appendChild(host);
  const polys: Pt[][] = [];
  try {
    for (const el of Array.from(doc.querySelectorAll('path, polygon, polyline, rect, circle, ellipse'))) {
      const c = host.appendChild(document.importNode(el, true)) as unknown as SVGGeometryElement;
      if (el.tagName === 'polygon' || el.tagName === 'polyline') { const pts = (el.getAttribute('points') ?? '').trim().split(/[\s,]+/).map(Number); const out: Pt[] = []; for (let i = 0; i + 1 < pts.length; i += 2) out.push([pts[i], pts[i + 1]]); polys.push(out); continue; }
      const L = c.getTotalLength(), n = Math.min(600, Math.max(24, Math.round(L / 0.5))), out: Pt[] = [];
      for (let i = 0; i < n; i++) { const p = c.getPointAtLength((L * i) / n); out.push([p.x, p.y]); }
      polys.push(out);
    }
  } finally { host.remove(); }
  if (!polys.length) throw new Error('no shapes in SVG');
  return simplify(largest(polys).map(([x, y]) => [x * k, -y * k] as Pt));
}
function area(p: Pt[]) { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; }
const largest = (ps: Pt[][]) => ps.sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)))[0];
/** Drop nearly collinear points (keeps outlines light for the editor). */
function simplify(p: Pt[], tol = 0.05): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = out[out.length - 1] ?? p[p.length - 1], b = p[i], c = p[(i + 1) % p.length];
    const cr = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / (Math.hypot(c[0] - a[0], c[1] - a[1]) || 1);
    if (cr > tol) out.push(b);
  }
  return out.length >= 3 ? out : p;
}

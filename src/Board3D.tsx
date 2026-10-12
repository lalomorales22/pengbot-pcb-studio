import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, ThreeEvent, useThree } from '@react-three/fiber';
import { ContactShadows, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Art, Chip, Design, DrawLayer, LayerId, Pt } from './core';
import { smoothStroke } from './demo';
import { FP, Footprint, xf } from './footprints';
import { Look, Sel, paintSide } from './texture';

export type Tool = 'orbit' | 'select' | 'brush' | 'poly' | 'via' | 'pad' | 'chip';
export type ViewName = 'iso' | 'top' | 'bottom' | 'front';
const T = 1.6, H = T / 2, TEX = 2048;
type V3 = [number, number, number];

export interface BoardProps {
  design: Design; tool: Tool; fpId: string; ghostRot: number; grid: number; showGrid: boolean;
  look: Look; vis: Record<LayerId, boolean>; preview: Art | null; sel: Sel;
  traceLayer: DrawLayer; traceWidth: number;
  view: { name: ViewName; n: number };
  onAddTrace(pts: Pt[], brush?: boolean): void; onAddVia(x: number, y: number): void; onAddPad(x: number, y: number): void; onAddChip(x: number, y: number): void;
  onSelect(s: Sel): void; onMoveStart(): void; onMoveChip(id: string, x: number, y: number): void; onCursor(p: Pt | null): void;
}

// ---------- hit testing (mm) ----------
function segDist(p: Pt, a: Pt, b: Pt) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
export function chipAt(d: Design, x: number, y: number): Chip | undefined {
  return [...d.chips].reverse().find(c => {
    const f = FP[c.fp]; const sw = c.rot % 180 !== 0; const [w, h] = sw ? [f.size[1], f.size[0]] : f.size;
    return Math.abs(x - c.x) <= w / 2 && Math.abs(y - c.y) <= h / 2;
  });
}
function hitTest(d: Design, x: number, y: number): Sel {
  const v = d.vias.find(v => Math.hypot(v.x - x, v.y - y) <= v.d / 2 + 0.3); if (v) return { kind: 'via', id: v.id };
  const p = d.pads.find(p => Math.abs(p.x - x) <= p.w / 2 + 0.2 && Math.abs(p.y - y) <= p.h / 2 + 0.2); if (p) return { kind: 'pad', id: p.id };
  const t = [...d.traces].reverse().find(t => t.pts.some((a, i) => i && segDist([x, y], t.pts[i - 1], a) <= t.width / 2 + 0.3) || (t.pts.length === 1 && Math.hypot(t.pts[0][0] - x, t.pts[0][1] - y) < 0.5));
  if (t) return { kind: 'trace', id: t.id };
  const c = chipAt(d, x, y); if (c) return { kind: 'chip', id: c.id };
  return null;
}

// ---------- chip bodies ----------
function labelTexture(text: string) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 512; const g = cv.getContext('2d')!;
  g.fillStyle = '#e9eef3'; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#b9c3cc'; g.lineWidth = 6; g.strokeRect(14, 14, 484, 484);
  // penguin mark
  g.save(); g.translate(256, 200);
  g.fillStyle = '#0a0a0c'; g.beginPath(); g.ellipse(0, 0, 70, 95, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(0, 22, 46, 66, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(-24, -42, 12, 0, Math.PI * 2); g.arc(24, -42, 12, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#0a0a0c'; g.beginPath(); g.arc(-21, -40, 6, 0, Math.PI * 2); g.arc(21, -40, 6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f4a340'; g.beginPath(); g.moveTo(-14, -22); g.lineTo(14, -22); g.lineTo(0, -6); g.fill();
  g.restore();
  g.fillStyle = '#0d2a4d'; g.textAlign = 'center'; g.font = 'bold 72px system-ui, sans-serif'; g.fillText(text, 256, 380);
  g.font = '500 34px ui-monospace, monospace'; g.fillStyle = '#5a6773'; g.fillText('P1 · RV32 · BLE', 256, 432);
  g.fillText('penguinsthegame.com', 256, 474);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function markingTexture(text: string, w: number, d: number) {
  const along = d > w, L = 1024, S = Math.round(L * Math.min(w, d) / Math.max(w, d));
  const cv = document.createElement('canvas'); cv.width = along ? S : L; cv.height = along ? L : S; const g = cv.getContext('2d')!;
  g.fillStyle = '#17181b'; g.fillRect(0, 0, cv.width, cv.height);
  g.translate(cv.width / 2, cv.height / 2); if (along) g.rotate(Math.PI / 2);
  g.fillStyle = '#9aa3ad'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `600 ${Math.round(S * 0.3)}px ui-monospace, monospace`; g.fillText(text, 0, -S * 0.12);
  g.font = `500 ${Math.round(S * 0.16)}px ui-monospace, monospace`; g.fillText('PENGUIN · 2026', 0, S * 0.24);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

const ChipBody = memo(function ChipBody({ fp, ghost }: { fp: Footprint; ghost?: boolean }) {
  const labelTex = useMemo(() => {
    const b = fp.body.find(b => b.kind === 'box' && b.label) as Extract<Footprint['body'][number], { kind: 'box' }> | undefined;
    return !b ? null : b.label === 'PengBot' ? labelTexture('PengBot') : markingTexture(b.label!, b.w, b.d);
  }, [fp]);
  return <>{fp.body.map((b, i) => {
    const mat = <meshStandardMaterial color={b.color} metalness={b.metal ? 0.75 : 0.05} roughness={b.metal ? 0.3 : 0.55}
      transparent={ghost} opacity={ghost ? 0.45 : 1} depthWrite={!ghost} />;
    if (b.kind === 'cyl') return <mesh key={i} position={[b.x, b.z + b.h / 2, -b.y]} castShadow><cylinderGeometry args={[b.r, b.r, b.h, 24]} />{mat}</mesh>;
    return <group key={i}>
      <mesh position={[b.x, b.z + b.h / 2, -b.y]} castShadow><boxGeometry args={[b.w, b.h, b.d]} />{mat}</mesh>
      {b.label && labelTex && !ghost && <mesh position={[b.x, b.z + b.h + 0.003, -b.y]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[b.w * 0.94, b.d * 0.94]} /><meshStandardMaterial map={labelTex} metalness={0.3} roughness={0.45} /></mesh>}
    </group>;
  })}</>;
});

function Courtyard({ fp, color = '#7fe3ff' }: { fp: Footprint; color?: string }) {
  const [w, h] = fp.size;
  return <Line points={[[-w / 2, 0.03, -h / 2], [w / 2, 0.03, -h / 2], [w / 2, 0.03, h / 2], [-w / 2, 0.03, h / 2], [-w / 2, 0.03, -h / 2]]} color={color} lineWidth={2} />;
}

function ChipMesh({ c, pos, selected, onDown, onClick }: { c: Chip; pos: V3; selected: boolean; onDown(e: ThreeEvent<PointerEvent>): void; onClick(e: ThreeEvent<MouseEvent>): void }) {
  const fp = FP[c.fp]; if (!fp) return null;
  return <group position={pos} rotation={[0, (c.rot * Math.PI) / 180, 0]} onPointerDown={onDown} onClick={onClick}>
    <ChipBody fp={fp} />{selected && <Courtyard fp={fp} />}
  </group>;
}

// ---------- camera presets ----------
function CameraRig({ view, size }: { view: { name: ViewName; n: number }; size: number }) {
  const { camera, controls } = useThree() as any;
  useEffect(() => {
    const s = size / 50, P: Record<ViewName, V3> = { iso: [0, 46, 50], top: [0, 80, 0.01], bottom: [0, -80, 0.01], front: [0, 14, 74] };
    const q = P[view.name]; camera.position.set(q[0] * s, q[1] * s, q[2] * s); camera.lookAt(0, 0, 0);
    if (controls) { controls.target.set(0, 0, 0); controls.update(); }
  }, [view.n, controls, size]); // eslint-disable-line
  return null;
}

// ---------- scene ----------
function Scene(p: BoardProps) {
  const { w: BW, h: BH } = p.design.board, MAXD = Math.max(BW, BH);
  const W = (x: number, y: number, z = H): V3 => [x - BW / 2, z, BH / 2 - y];
  const cvSize = { width: Math.round(TEX * BW / MAXD), height: Math.round(TEX * BH / MAXD) };
  const topCv = useMemo(() => Object.assign(document.createElement('canvas'), cvSize), [BW, BH]); // eslint-disable-line
  const botCv = useMemo(() => Object.assign(document.createElement('canvas'), cvSize), [BW, BH]); // eslint-disable-line
  const topTex = useMemo(() => { const t = new THREE.CanvasTexture(topCv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }, [topCv]);
  const botTex = useMemo(() => { const t = new THREE.CanvasTexture(botCv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }, [botCv]);
  useEffect(() => {
    const o = { look: p.look, vis: p.vis, grid: p.grid, showGrid: p.showGrid, preview: p.preview, sel: p.sel };
    paintSide(topCv, 'top', p.design, o); paintSide(botCv, 'bottom', p.design, o);
    topTex.needsUpdate = true; botTex.needsUpdate = true;
  }, [p.design, p.look, p.vis, p.grid, p.showGrid, p.preview, p.sel, topTex, botTex]); // eslint-disable-line

  const [hover, setHover] = useState<Pt | null>(null);
  const [stroke, setStroke] = useState<Pt[]>([]);
  const drawing = useRef(false), moving = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const strokeRef = useRef<Pt[]>([]); strokeRef.current = stroke;

  const useSnap = p.grid > 0 && p.tool !== 'brush';
  const snap = (v: number, max: number) => Math.min(max, Math.max(0, useSnap ? Math.round(v / p.grid) * p.grid : v));
  const toBoard = (pt: THREE.Vector3): Pt => [pt.x + BW / 2, BH / 2 - pt.z];
  const snapPt = (pt: THREE.Vector3): Pt => { const [x, y] = toBoard(pt); return [+snap(x, BW).toFixed(4), +snap(y, BH).toFixed(4)]; };

  const addPoint = (s: Pt[], q: Pt): Pt[] => {
    const last = s[s.length - 1];
    if (last && Math.hypot(last[0] - q[0], last[1] - q[1]) < (useSnap ? 1e-6 : 0.08)) return s;
    if (s.length >= 2) { // merge collinear
      const a = s[s.length - 2], cr = (last[0] - a[0]) * (q[1] - a[1]) - (last[1] - a[1]) * (q[0] - a[0]);
      const dot = (last[0] - a[0]) * (q[0] - last[0]) + (last[1] - a[1]) * (q[1] - last[1]);
      if (Math.abs(cr) < 1e-6 && dot >= 0) return [...s.slice(0, -1), q];
    }
    return [...s, q];
  };
  const finish = () => {
    const s = strokeRef.current;
    if (p.tool === 'brush') { if (s.length >= 1) p.onAddTrace(s.length > 2 ? smoothStroke(s) : s, true); }
    else if (s.length >= 2) p.onAddTrace(s);
    setStroke([]); strokeRef.current = []; drawing.current = false;
  };

  useEffect(() => { // tool switch commits a pending polyline
    return () => { if (strokeRef.current.length >= 2) p.onAddTrace(strokeRef.current); setStroke([]); drawing.current = false; };
  }, [p.tool]); // eslint-disable-line
  useEffect(() => {
    const up = () => { if (drawing.current && p.tool === 'brush') finish(); moving.current = null; };
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'Enter') finish();
      if (e.key === 'Escape') { setStroke([]); drawing.current = false; }
    };
    window.addEventListener('pointerup', up); window.addEventListener('keydown', key);
    return () => { window.removeEventListener('pointerup', up); window.removeEventListener('keydown', key); };
  }); // re-bind each render for fresh closures

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    const q = snapPt(e.point);
    switch (p.tool) {
      case 'brush': drawing.current = true; strokeRef.current = [q]; setStroke([q]); break;
      case 'poly': setStroke(s => addPoint(s, q)); break;
      case 'via': p.onAddVia(...q); break;
      case 'pad': p.onAddPad(...q); break;
      case 'chip': p.onAddChip(...q); break;
      case 'select': {
        const [x, y] = toBoard(e.point); const h = hitTest(p.design, x, y); p.onSelect(h);
        if (h?.kind === 'chip') { const c = p.design.chips.find(c => c.id === h.id)!; p.onMoveStart(); moving.current = { id: c.id, dx: c.x - x, dy: c.y - y }; }
        break;
      }
    }
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const q = snapPt(e.point); setHover(q); p.onCursor(q);
    if (drawing.current && p.tool === 'brush') { const n = addPoint(strokeRef.current, q); strokeRef.current = n; setStroke(n); }
    if (moving.current) { const [x, y] = toBoard(e.point); const m = moving.current; p.onMoveChip(m.id, snap(x + m.dx, BW), snap(y + m.dy, BH)); }
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (p.tool !== 'orbit') return;
    const [x, y] = toBoard(e.point); p.onSelect(hitTest(p.design, x, y));
  };
  const chipDown = (c: Chip) => (e: ThreeEvent<PointerEvent>) => {
    if (p.tool !== 'select' || e.button !== 0) return;
    e.stopPropagation(); p.onSelect({ kind: 'chip', id: c.id }); p.onMoveStart();
    const [x, y] = toBoard(e.point); moving.current = { id: c.id, dx: c.x - x, dy: c.y - y };
  };
  const chipClick = (c: Chip) => (e: ThreeEvent<MouseEvent>) => { if (p.tool === 'orbit') { e.stopPropagation(); p.onSelect({ kind: 'chip', id: c.id }); } };

  const LEFT = p.tool === 'orbit' ? THREE.MOUSE.ROTATE : (-1 as any);
  const mouseButtons = { LEFT, MIDDLE: THREE.MOUSE.PAN, RIGHT: p.tool === 'orbit' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE };
  const fp = FP[p.fpId];
  const linePts = (s: Pt[]) => s.map(([x, y]) => W(x, y, H + 0.04));
  const strokeColor = p.traceLayer === 'TopCopper' ? '#f0b866' : '#ffffff';

  return <>
    <CameraRig view={p.view} size={MAXD} />
    <OrbitControls makeDefault mouseButtons={mouseButtons as any} enableDamping dampingFactor={0.12} minDistance={8} maxDistance={220} />
    <ambientLight intensity={0.35} />
    <hemisphereLight args={['#d8efff', '#0b1626', 0.7]} />
    <directionalLight position={[30, 60, 25]} intensity={1.7} castShadow />
    <directionalLight position={[-25, -50, -15]} intensity={0.7} color="#9fd8ff" />
    <directionalLight position={[-30, 20, -30]} intensity={0.35} color="#bfe6ff" />

    {/* board: FR4 core + painted top/bottom skins */}
    <mesh><boxGeometry args={[BW, T, BH]} /><meshStandardMaterial color={p.look.mask} roughness={0.6} /></mesh>
    <mesh scale={[1.0004, 0.55, 1.0004]}><boxGeometry args={[BW, T, BH]} /><meshStandardMaterial color={p.look.fr4} roughness={0.8} /></mesh>
    <mesh position={[0, H + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={onDown} onPointerMove={onMove} onClick={onClick}
      onPointerUp={() => { if (drawing.current && p.tool === 'brush') finish(); }} onPointerOut={() => { setHover(null); p.onCursor(null); }} onDoubleClick={() => p.tool === 'poly' && finish()}>
      <planeGeometry args={[BW, BH]} /><meshStandardMaterial map={topTex} roughness={0.42} metalness={0.08} />
    </mesh>
    <mesh position={[0, -H - 0.002, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <planeGeometry args={[BW, BH]} /><meshStandardMaterial map={botTex} roughness={0.42} metalness={0.08} />
    </mesh>

    {p.design.chips.map(c => <ChipMesh key={c.id} c={c} pos={W(c.x, c.y)} selected={p.sel?.kind === 'chip' && p.sel.id === c.id} onDown={chipDown(c)} onClick={chipClick(c)} />)}

    {/* in-progress stroke + ghosts */}
    {stroke.length > 0 && <Line points={linePts(p.tool === 'poly' && hover ? [...stroke, hover] : stroke.length === 1 ? [stroke[0], stroke[0]] : stroke)} color={strokeColor} lineWidth={3} />}
    {hover && p.tool === 'chip' && fp && <group position={W(hover[0], hover[1])} rotation={[0, (p.ghostRot * Math.PI) / 180, 0]}>
      <ChipBody fp={fp} ghost /><Courtyard fp={fp} color="#9fd8ff" />
      {fp.pads.map((pd, i) => { const [x, y] = xf(pd.x, pd.y, 0, 0, 0); return <mesh key={i} position={[x, 0.02, -y]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[pd.w, pd.h]} /><meshBasicMaterial color="#d9b45a" transparent opacity={0.7} /></mesh>; })}
    </group>}
    {hover && (p.tool === 'via' || p.tool === 'pad') && <mesh position={W(hover[0], hover[1], H + 0.03)} rotation={[-Math.PI / 2, 0, 0]}>
      {p.tool === 'via' ? <ringGeometry args={[0.15, 0.3, 24]} /> : <planeGeometry args={[1.5, 1.5]} />}
      <meshBasicMaterial color="#d9b45a" transparent opacity={0.75} /></mesh>}
    {hover && ['brush', 'poly', 'via', 'pad', 'chip'].includes(p.tool) && <mesh position={W(hover[0], hover[1], H + 0.05)} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.35, 0.45, 32]} /><meshBasicMaterial color="#9fd8ff" /></mesh>}

    <ContactShadows position={[0, -7, 0]} scale={MAXD * 1.8} blur={2.4} opacity={0.45} far={14} color="#000814" />
  </>;
}

export default function Board3D(p: BoardProps) {
  const cursor = p.tool === 'orbit' ? 'grab' : p.tool === 'select' ? 'default' : 'crosshair';
  return <Canvas className="board3d" style={{ cursor }} shadows dpr={[1, 2]} gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
    camera={{ position: [0, 64, 70], fov: 38, near: 0.1, far: 1000 }} onContextMenu={e => e.preventDefault()}>
    <Scene {...p} />
  </Canvas>;
}

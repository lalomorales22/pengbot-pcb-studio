// Cyberdeck Keyboard builder UI: 2D layout/outline editor (SVG) + 3D board preview + exports.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Design, LAYERS, LayerId, Pt, buildZip } from '../core';
import { U, keyFp } from '../footprints';
import { runDrc } from '../drc';
import { MASKS, Sel } from '../texture';
import Board3D, { ViewName } from '../Board3D';
import { CONTROLLERS, KbBuild, Key, Keyboard, PRESET_NAMES, ShapeKind, TOUCHPADS, Touchpad, WIDTHS, autoArrange, fillet, fromUnits, keyBox, keyId, newKeyboard, parseKle, shapeOutline, keysBox } from './keyboard';
import { kitZip } from './exports';
import { outlineFromDxf, outlineFromSvg } from './importOutline';
import { capColor } from './keyboard';

type ETool = 'select' | 'key' | 'outline' | 'hole';
type Drag = { kind: 'key' | 'vertex' | 'ctrl' | 'i2c' | 'tp' | 'tph' | 'hole' | 'pan'; id?: string; i?: number; dx: number; dy: number } | null;
const SNAPS: [number, string][] = [[U, '1u'], [U / 4, '¼u'], [U / 8, '⅛u'], [1, '1 mm'], [0, 'off']];

function download(blob: Blob, name: string) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); }
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'penguin-deck';

export default function KeyboardStudio({ onExit, onOpenInStudio }: { onExit(): void; onOpenInStudio(d: Design): void }) {
  const [kb, setKb] = useState<Keyboard>(() => newKeyboard('deck40', 'mx'));
  const [hist, setHist] = useState<Keyboard[]>([]);
  const set = (f: (k: Keyboard) => Keyboard, push = true) => setKb(k => { const n = f(k); if (push && n !== k) setHist(h => [...h.slice(-80), k]); return n; });
  const undo = () => setHist(h => { if (!h.length) return h; setKb(h[h.length - 1]); return h.slice(0, -1); });
  const [tool, setTool] = useState<ETool>('select');
  const [snap, setSnap] = useState(U / 4);
  const [newW, setNewW] = useState(1);
  const [sel, setSel] = useState<{ kind: 'key' | 'hole'; id: string } | null>(null);
  const [view, setView] = useState<'2d' | '3d'>('2d');
  const [build, setBuild] = useState<KbBuild | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [preset, setPreset] = useState('deck40');
  const [kle, setKle] = useState('');
  const [cam, setCam] = useState<{ name: ViewName; n: number }>({ name: 'iso', n: 0 });
  const stale = useRef(true);
  useEffect(() => { stale.current = true; }, [kb]);

  const worker = useMemo(() => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }), []);
  useEffect(() => () => worker.terminate(), [worker]);
  const runBuild = (then?: (b: KbBuild) => void) => {
    setBusy(true); setErr('');
    worker.onmessage = (e: MessageEvent) => {
      setBusy(false);
      if (!e.data.ok) { setErr(e.data.error); return; }
      const b = e.data.build as KbBuild; b.design.chips.forEach(c => { const m = /^KEY_(MX|CHOC)_([\d.]+)U$/.exec(c.fp); if (m) keyFp(m[1].toLowerCase() as 'mx' | 'choc', +m[2]); });
      stale.current = false; setBuild(b); then?.(b);
    };
    worker.postMessage(kb);
  };
  const drc = useMemo(() => (build ? runDrc(build.design) : null), [build]);
  const drcN = drc ? drc.violations.length + drc.shorts.length + drc.unrouted.length : 0;

  // ---------- geometry / view ----------
  const all = [...kb.outline, ...kb.keys.flatMap(k => { const b = keyBox(k); return [[b.x1, b.y1], [b.x2, b.y2]] as Pt[]; })];
  const vx1 = Math.min(...all.map(p => p[0])) - 15, vy1 = Math.min(...all.map(p => p[1])) - 15, vx2 = Math.max(...all.map(p => p[0])) + 15, vy2 = Math.max(...all.map(p => p[1])) + 15;
  const svgRef = useRef<SVGSVGElement>(null), drag = useRef<Drag>(null);
  const toMm = (e: { clientX: number; clientY: number }): Pt => {
    const s = svgRef.current!, pt = s.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const q = pt.matrixTransform(s.getScreenCTM()!.inverse()); return [q.x, -q.y];
  };
  const sn = (v: number, s = snap) => (s ? Math.round(v / s) * s : v);
  const fil = useMemo(() => fillet(kb.outline, kb.radius), [kb.outline, kb.radius]);
  const selKey = sel?.kind === 'key' ? kb.keys.find(k => k.id === sel.id) : undefined;

  const onDown = (e: React.PointerEvent, kind: NonNullable<Drag>['kind'], id?: string, i?: number) => {
    if (e.button !== 0) return; e.stopPropagation();
    const [x, y] = toMm(e);
    if (kind === 'key') { const k = kb.keys.find(k => k.id === id)!; setSel({ kind: 'key', id: id! }); drag.current = { kind, id, dx: k.x - x, dy: k.y - y }; }
    else if (kind === 'hole') { const h = kb.holes.find(h => h.id === id)!; setSel({ kind: 'hole', id: id! }); drag.current = { kind, id, dx: h.x - x, dy: h.y - y }; }
    else if (kind === 'vertex') { if (e.detail === 2 && kb.outline.length > 3) { set(k => ({ ...k, shape: 'custom', outline: k.outline.filter((_, j) => j !== i) })); return; } drag.current = { kind, i, dx: kb.outline[i!][0] - x, dy: kb.outline[i!][1] - y }; }
    else if (kind === 'ctrl') drag.current = { kind, dx: kb.ctrl.x - x, dy: kb.ctrl.y - y };
    else if (kind === 'i2c') drag.current = { kind, dx: kb.i2cPos.x - x, dy: kb.i2cPos.y - y };
    else if (kind === 'tp') drag.current = { kind, dx: kb.touchpad.x - x, dy: kb.touchpad.y - y };
    else if (kind === 'tph') drag.current = { kind, dx: kb.touchpad.hx - x, dy: kb.touchpad.hy - y };
    setHist(h => [...h.slice(-80), kb]);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const g = drag.current; if (!g) return; const [x, y] = toMm(e), X = x + g.dx, Y = y + g.dy, m1 = (v: number) => sn(v, Math.min(snap || 0.5, 1.27) || 0.5);
    set(k => {
      switch (g.kind) {
        case 'key': return { ...k, keys: k.keys.map(q => q.id === g.id ? { ...q, x: +sn(X).toFixed(3), y: +sn(Y).toFixed(3) } : q) };
        case 'vertex': return { ...k, shape: 'custom', outline: k.outline.map((p, j) => j === g.i ? [m1(X), m1(Y)] as Pt : p) };
        case 'hole': return { ...k, holes: k.holes.map(h => h.id === g.id ? { ...h, x: m1(X), y: m1(Y) } : h) };
        case 'ctrl': return { ...k, ctrl: { ...k.ctrl, x: m1(X), y: m1(Y) } };
        case 'i2c': return { ...k, i2cPos: { x: m1(X), y: m1(Y) } };
        case 'tp': return { ...k, touchpad: { ...k.touchpad, x: m1(X), y: m1(Y) } };
        case 'tph': return { ...k, touchpad: { ...k.touchpad, hx: m1(X), hy: m1(Y) } };
      }
      return k;
    }, false);
  };
  const onUp = () => { drag.current = null; };
  const onBg = (e: React.PointerEvent) => {
    if (e.button !== 0) return; const [x, y] = toMm(e);
    if (tool === 'key') { const id = keyId(); const w = newW * U; set(k => ({ ...k, keys: [...k.keys, { id, x: +(sn(x - w / 2) + w / 2).toFixed(3), y: +sn(y).toFixed(3), w: newW, rot: 0, label: '' }] })); setSel({ kind: 'key', id }); }
    else if (tool === 'hole') { const id = keyId(); set(k => ({ ...k, holes: [...k.holes, { id, x: +x.toFixed(2), y: +y.toFixed(2), size: 'M2' }] })); setSel({ kind: 'hole', id }); }
    else setSel(null);
  };
  const onEdge = (e: React.PointerEvent, i: number) => {
    if (tool !== 'outline' || e.button !== 0) return; e.stopPropagation(); const [x, y] = toMm(e);
    set(k => ({ ...k, shape: 'custom', outline: [...k.outline.slice(0, i + 1), [+x.toFixed(2), +y.toFixed(2)] as Pt, ...k.outline.slice(i + 1)] }));
  };
  const updKey = (f: (k: Key) => Key) => selKey && set(k => ({ ...k, keys: k.keys.map(q => q.id === selKey.id ? f(q) : q) }));
  const delSel = () => { if (!sel) return; set(k => sel.kind === 'key' ? { ...k, keys: k.keys.filter(q => q.id !== sel.id) } : { ...k, holes: k.holes.filter(h => h.id !== sel.id) }); setSel(null); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName; if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); delSel(); }
      else if (e.key === 'r' || e.key === 'R') updKey(q => ({ ...q, rot: (q.rot + 90) % 360 }));
      else if (e.key.startsWith('Arrow') && selKey) { e.preventDefault(); const s = snap || 0.25, d = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, s], ArrowDown: [0, -s] }[e.key]!; updKey(q => ({ ...q, x: +(q.x + d[0]).toFixed(3), y: +(q.y + d[1]).toFixed(3) })); }
      else if (e.key === 'v' || e.key === 'V') setView(v => (v === '2d' ? '3d' : '2d'));
      else if (e.key === 'k' || e.key === 'K') setTool('key');
      else if (e.key === 'o' || e.key === 'O') setTool('outline');
      else if (e.key === 's' || e.key === 'S') setTool('select');
      else if (e.key === 'Escape') setSel(null);
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });

  const reshape = (shape: ShapeKind) => set(k => { const a = autoArrange({ ...k, shape }); return { ...k, shape, outline: a.outline, radius: shape === 'rect' ? 0.5 : Math.max(2, k.radius) }; });
  const rearrange = () => set(k => autoArrange(k));
  const loadKle = (text: string) => {
    try { const r = parseKle(text); set(() => autoArrange({ ...fromUnits(r.keys, 'KLE import', kb.switch), touchpad: kb.touchpad, i2c: kb.i2c, controller: kb.controller, penguins: kb.penguins })); setMsg(`Imported ${r.keys.length} keys from KLE${r.warnings.length ? ' · ' + r.warnings.join('; ') : ''}`); setErr(''); }
    catch (e) { setErr('KLE: ' + (e as Error).message); }
  };
  const importOutline = async (f: File) => {
    try {
      const t = await f.text(), o = /\.dxf$/i.test(f.name) ? outlineFromDxf(t) : outlineFromSvg(t);
      const kbx = keysBox(kb.keys), ox = Math.min(...o.map(p => p[0])), oy = Math.min(...o.map(p => p[1]));
      const ow = Math.max(...o.map(p => p[0])) - ox, oh = Math.max(...o.map(p => p[1])) - oy;
      const dx = (kbx.x1 + kbx.x2) / 2 - ow / 2 - ox, dy = (kbx.y1 + kbx.y2) / 2 + 10 - oh / 2 - oy; // centre it on the keys (a bit up for the controller strip)
      set(k => ({ ...k, shape: 'custom', radius: 0, outline: o.map(([x, y]) => [+(x + dx).toFixed(3), +(y + dy).toFixed(3)] as Pt) }));
      setMsg(`Outline imported from ${f.name}: ${o.length} points, ${ow.toFixed(1)} × ${oh.toFixed(1)} mm`); setErr('');
    } catch (e) { setErr('Outline import: ' + (e as Error).message); }
  };
  const exportGerbers = () => runBuild(async b => download(await (await buildZip(b.design)).generateAsync({ type: 'blob' }), slug(kb.name) + '-gerbers.zip'));
  const exportKit = () => runBuild(async b => download(await (await kitZip(kb, b)).generateAsync({ type: 'blob' }), slug(kb.name) + '-kit.zip'));
  const exportJson = () => download(new Blob([JSON.stringify(kb, null, 1)], { type: 'application/json' }), slug(kb.name) + '.penguin-kb.json');
  const loadJson = async (f: File) => { try { const k = JSON.parse(await f.text()) as Keyboard; if (!k.keys || !k.outline) throw new Error('not a .penguin-kb.json'); set(() => k); } catch (e) { setErr((e as Error).message); } };

  const vis = useMemo(() => Object.fromEntries(LAYERS.map(l => [l, true])) as Record<LayerId, boolean>, []);
  const tpd = TOUCHPADS[kb.touchpad.kind];
  const pmW = kb.ctrl.rot % 180 ? 34 : 19, pmH = kb.ctrl.rot % 180 ? 19 : 34;
  const label = (x: number, y: number, t: string, size = 3.2, fill = '#cfe8ff') => <text x={x} y={-y} fontSize={size} fill={fill} textAnchor="middle" dominantBaseline="central" style={{ pointerEvents: 'none', userSelect: 'none' }}>{t}</text>;

  return (
    <div className="app kb">
      <header className="top">
        <img src="/penguin.svg" alt="" className="logo" />
        <div className="title"><h1>Cyberdeck Keyboard Builder</h1><span>{kb.name} · {kb.keys.length} keys · {kb.switch === 'mx' ? 'MX hotswap' : 'Choc v1 hotswap'} · {CONTROLLERS[kb.controller].name}{build && !stale.current ? ` · ${build.design.board.w.toFixed(0)} × ${build.design.board.h.toFixed(0)} mm` : ''}</span></div>
        <div className="spacer" />
        {build && <span className={'drc ' + (drcN ? 'bad' : 'ok')} title={drc ? [...drc.shorts, ...drc.unrouted, ...drc.violations].slice(0, 20).join('\n') || 'clean' : ''}>{drcN ? `⚠ DRC ${drcN}` : '✓ DRC clean'}{stale.current ? ' (stale)' : ''}</span>}
        <button onClick={undo} disabled={!hist.length}>↶ Undo</button>
        <button onClick={() => { setView('3d'); runBuild(); }} disabled={busy}>{busy ? '⏳ Routing…' : '⚙ Build PCB'}</button>
        <button className="primary" onClick={exportGerbers} disabled={busy}>⬇ Gerber zip</button>
        <button onClick={exportKit} disabled={busy} title="plate SVG/DXF, case SVG, KMK/QMK/ZMK firmware, KLE">⬇ Kit (plate · case · firmware)</button>
        <button onClick={onExit}>← PCB Studio</button>
      </header>

      <aside className="panel">
        <section>
          <h2>Start from</h2>
          <label className="row"><select value={preset} onChange={e => setPreset(e.target.value)}>{Object.entries(PRESET_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <div className="btnrow"><button className="primary" onClick={() => { set(() => newKeyboard(preset, kb.switch)); setSel(null); setBuild(null); }}>Load preset</button>
            <button onClick={() => set(k => ({ ...k, keys: [] }))}>Blank</button></div>
          <label className="row">Name <input value={kb.name} onChange={e => set(k => ({ ...k, name: e.target.value }), false)} /></label>
        </section>

        <section>
          <h2>Editor</h2>
          <div className="tools">{([['select', '➚', 'Select / drag', 'S'], ['key', '⌨', 'Place key', 'K'], ['outline', '⬠', 'Edit outline', 'O'], ['hole', '◎', 'Mounting hole', '']] as const).map(([id, ico, l, key]) =>
            <button key={id} className={tool === id ? 'on' : ''} onClick={() => setTool(id)}><span className="ico">{ico}</span>{l}{key && <kbd>{key}</kbd>}</button>)}</div>
          <label className="row">Snap <select value={snap} onChange={e => setSnap(Number(e.target.value))}>{SNAPS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}</select></label>
          {tool === 'key' && <label className="row">New key width <select value={newW} onChange={e => setNewW(Number(e.target.value))}>{WIDTHS.map(w => <option key={w} value={w}>{w}u</option>)}</select></label>}
          <div className="muted">{tool === 'outline' ? 'Drag vertices · click an edge to add a vertex · double-click a vertex to delete' : tool === 'key' ? 'Click to drop a key (1u = 19.05 mm)' : tool === 'hole' ? 'Click to add an M2 hole (change size when selected)' : 'Drag keys, controller, headers, touchpad · R rotate · Del delete · arrows nudge · V 2D/3D'}</div>
        </section>

        {selKey && <section className="selbox">
          <h2>Key {selKey.label || ''}</h2>
          <label className="row">Legend <input value={selKey.label ?? ''} onChange={e => updKey(q => ({ ...q, label: e.target.value }))} /></label>
          <div className="seg wrap">{WIDTHS.map(w => <button key={w} className={selKey.w === w ? 'on' : ''} onClick={() => updKey(q => ({ ...q, w }))}>{w}u</button>)}</div>
          <div className="muted">{(selKey.x / U).toFixed(2)}u, {(selKey.y / U).toFixed(2)}u · {selKey.rot}°</div>
          <div className="btnrow"><button onClick={() => updKey(q => ({ ...q, rot: (q.rot + 90) % 360 }))}>⟲ Rotate 90°</button>
            <button onClick={() => { const id = keyId(); set(k => ({ ...k, keys: [...k.keys, { ...selKey, id, x: selKey.x + selKey.w * U }] })); setSel({ kind: 'key', id }); }}>Duplicate →</button>
            <button className="danger" onClick={delSel}>Delete</button></div>
        </section>}
        {sel?.kind === 'hole' && <section className="selbox"><h2>Mounting hole</h2>
          <div className="seg">{(['M2', 'M2.5'] as const).map(s => <button key={s} className={kb.holes.find(h => h.id === sel.id)?.size === s ? 'on' : ''} onClick={() => set(k => ({ ...k, holes: k.holes.map(h => h.id === sel.id ? { ...h, size: s } : h) }))}>{s}</button>)}</div>
          <div className="btnrow"><button className="danger" onClick={delSel}>Delete</button></div></section>}

        <section>
          <h2>Board shape</h2>
          <div className="seg wrap">{(['rect', 'rounded', 'wedge', 'split'] as ShapeKind[]).map(s => <button key={s} className={kb.shape === s ? 'on' : ''} onClick={() => reshape(s)}>{s}</button>)}{kb.shape === 'custom' && <button className="on">custom</button>}</div>
          <label className="slider"><span>Corner radius<b>{kb.radius} mm</b></span><input type="range" min={0} max={20} step={0.5} value={kb.radius} onChange={e => set(k => ({ ...k, radius: Number(e.target.value) }), false)} /></label>
          <div className="btnrow"><button onClick={rearrange} title="Re-place controller, headers, touchpad, holes and refit the outline around the keys">↻ Auto-arrange</button>
            <label className="filebtn">Import outline (SVG/DXF)<input type="file" accept=".svg,.dxf,image/svg+xml" onChange={e => e.target.files?.[0] && importOutline(e.target.files[0])} /></label></div>
        </section>

        <section>
          <h2>Switches & controller</h2>
          <div className="seg">{(['mx', 'choc'] as const).map(s => <button key={s} className={kb.switch === s ? 'on' : ''} onClick={() => set(k => ({ ...k, switch: s }))}>{s === 'mx' ? 'MX hotswap' : 'Choc v1 hotswap'}</button>)}</div>
          <label className="row">MCU <select value={kb.controller} onChange={e => set(k => ({ ...k, controller: e.target.value as Keyboard['controller'] }))}>{Object.entries(CONTROLLERS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select></label>
          <div className="btnrow"><button onClick={() => set(k => ({ ...k, ctrl: { ...k.ctrl, rot: (k.ctrl.rot + 90) % 360 } }))}>⟲ Rotate controller</button></div>
          <label className="check"><input type="checkbox" checked={kb.i2c} onChange={e => set(k => ({ ...k, i2c: e.target.checked }))} /> QWIIC / I2C header to cyberdeck host</label>
        </section>

        <section>
          <h2>Touchpad / pointer</h2>
          <label className="check"><input type="checkbox" checked={kb.touchpad.on} onChange={e => set(k => autoArrange({ ...k, touchpad: { ...k.touchpad, on: e.target.checked } }))} /> Add pointing device</label>
          {kb.touchpad.on && <><label className="row"><select value={kb.touchpad.kind} onChange={e => set(k => ({ ...k, touchpad: { ...k.touchpad, kind: e.target.value as Touchpad } }))}>{Object.entries(TOUCHPADS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select></label>
            <div className="muted">{tpd.pins.join(' · ')} on a 0.1" header. {tpd.note}</div></>}
        </section>

        <section>
          <h2>Import KLE layout</h2>
          <textarea rows={3} placeholder='Paste keyboard-layout-editor.com "Raw data" or JSON' value={kle} onChange={e => setKle(e.target.value)} />
          <div className="btnrow"><button onClick={() => loadKle(kle)} disabled={!kle.trim()}>Import</button>
            <label className="filebtn">KLE .json<input type="file" accept=".json,.txt" onChange={async e => { const f = e.target.files?.[0]; if (f) loadKle(await f.text()); }} /></label></div>
        </section>

        <section>
          <h2>Penguins & files</h2>
          <label className="check"><input type="checkbox" checked={kb.penguins} onChange={e => set(k => ({ ...k, penguins: e.target.checked }))} /> 🐧 Tile Lalo's penguin on the back silk</label>
          <div className="btnrow"><button onClick={exportJson}>Save design</button><label className="filebtn">Open design<input type="file" accept=".json" onChange={e => e.target.files?.[0] && loadJson(e.target.files[0])} /></label>
            {build && <button onClick={() => onOpenInStudio(build.design)} title="Open the routed board in the full PCB studio (draw, add parts, art)">Open in PCB Studio</button>}</div>
        </section>

        <section>
          <h2>Build</h2>
          {err && <div className="drcbox">{err}</div>}
          {msg && <div className="muted">{msg}</div>}
          {build ? <div className="muted">
            Matrix {build.matrix.rows}×{build.matrix.cols} · rows → {build.matrix.rowPins.join(', ')} · cols → {build.matrix.colPins.join(', ')}
            {Object.keys(build.matrix.special).length ? ` · ${Object.entries(build.matrix.special).map(([k, v]) => `${k}=${v}`).join(' ')}` : ''}<br />
            {build.design.traces.length} traces · {build.design.vias.length} vias · {build.design.chips.length} parts · 🐧 {build.design.penguinCount?.bottom ?? 0} on the back · routed in {(build.ms / 1000).toFixed(1)} s
            {build.warnings.map((w, i) => <div key={i} className="warn">⚠ {w}</div>)}
            {drc && drcN > 0 && <div className="drcbox">{[...drc.shorts, ...drc.unrouted, ...drc.violations].slice(0, 6).map((l, i) => <div key={i}>{l}</div>)}</div>}
          </div> : <div className="muted">Press ⚙ Build PCB to place switches, diodes and the controller and autoroute the matrix.</div>}
        </section>
      </aside>

      <main className="stage">
        {view === '2d' ? (
          <svg ref={svgRef} className="kbedit" viewBox={`${vx1} ${-vy2} ${vx2 - vx1} ${vy2 - vy1}`} onPointerMove={onMove} onPointerUp={onUp} onPointerDown={onBg}>
            <defs><pattern id="ugrid" width={U / 4} height={U / 4} patternUnits="userSpaceOnUse"><path d={`M ${U / 4} 0 L 0 0 0 ${U / 4}`} fill="none" stroke="rgba(159,216,255,0.07)" strokeWidth={0.15} /></pattern></defs>
            <rect x={vx1} y={-vy2} width={vx2 - vx1} height={vy2 - vy1} fill="url(#ugrid)" />
            <path d={'M' + fil.map(([x, y]) => `${x} ${-y}`).join(' L') + ' Z'} fill={MASKS['Glacier navy'].mask} stroke="#9fd8ff" strokeWidth={0.4} />
            {tool === 'outline' && kb.outline.map((p, i) => { const q = kb.outline[(i + 1) % kb.outline.length]; return <line key={'e' + i} x1={p[0]} y1={-p[1]} x2={q[0]} y2={-q[1]} stroke="rgba(244,163,64,0.5)" strokeWidth={2.2} style={{ cursor: 'copy' }} onPointerDown={e => onEdge(e, i)} />; })}
            {kb.touchpad.on && <g>
              <circle cx={kb.touchpad.x} cy={-kb.touchpad.y} r={tpd.dia / 2} fill="rgba(159,216,255,0.12)" stroke="#9fd8ff" strokeWidth={0.4} strokeDasharray="2 1" style={{ cursor: 'move' }} onPointerDown={e => onDown(e, 'tp')} />
              {label(kb.touchpad.x, kb.touchpad.y, kb.touchpad.kind === 'pmw3360' ? 'TRACKBALL' : 'TOUCHPAD', 4)}
              <rect x={kb.touchpad.hx - tpd.pins.length * 1.27} y={-kb.touchpad.hy - 1.3} width={tpd.pins.length * 2.54} height={2.6} fill="#2a2d35" stroke="#d9b45a" strokeWidth={0.3} style={{ cursor: 'move' }} onPointerDown={e => onDown(e, 'tph')} />
              {label(kb.touchpad.hx, kb.touchpad.hy + 3, 'J2 pad hdr', 2)}
            </g>}
            {kb.i2c && <g><rect x={kb.i2cPos.x - 5.08} y={-kb.i2cPos.y - 1.3} width={10.16} height={2.6} fill="#2a2d35" stroke="#d9b45a" strokeWidth={0.3} style={{ cursor: 'move' }} onPointerDown={e => onDown(e, 'i2c')} />{label(kb.i2cPos.x, kb.i2cPos.y - 3, 'QWIIC', 2)}</g>}
            <g style={{ cursor: 'move' }} onPointerDown={e => onDown(e, 'ctrl')}>
              <rect x={kb.ctrl.x - pmW / 2} y={-kb.ctrl.y - pmH / 2} width={pmW} height={pmH} rx={1} fill="#0d1b3d" stroke="#7fe3ff" strokeWidth={0.4} />
              {label(kb.ctrl.x, kb.ctrl.y, kb.controller === 'kb2040' ? 'KB2040' : 'nice!nano', 3.2)}
              {(() => { const r = ((kb.ctrl.rot % 360) + 360) % 360, d = r === 0 ? [0, 1] : r === 90 ? [-1, 0] : r === 180 ? [0, -1] : [1, 0]; return label(kb.ctrl.x + d[0] * (Math.max(pmW, pmH) / 2 - 3), kb.ctrl.y + d[1] * (Math.max(pmW, pmH) / 2 - 3), 'USB', 2.2, '#f4a340'); })()}
            </g>
            {kb.holes.map(h => <circle key={h.id} cx={h.x} cy={-h.y} r={h.size === 'M2' ? 1.1 : 1.35} fill="#07090d" stroke={sel?.id === h.id ? '#f4a340' : '#d9b45a'} strokeWidth={0.8} style={{ cursor: 'move' }} onPointerDown={e => onDown(e, 'hole', h.id)} />)}
            {kb.keys.map(k => { const b = keyBox(k), on = sel?.id === k.id, col = capColor(k); return <g key={k.id} style={{ cursor: 'move' }} onPointerDown={e => onDown(e, 'key', k.id)}>
              <rect x={b.x1 + 0.5} y={-b.y2 + 0.5} width={b.x2 - b.x1 - 1} height={b.y2 - b.y1 - 1} rx={1.6} fill={col} stroke={on ? '#f4a340' : '#0a0f18'} strokeWidth={on ? 0.9 : 0.4} opacity={0.95} />
              <rect x={k.x - 7} y={-k.y - 7} width={14} height={14} fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth={0.3} />
              {label(k.x, k.y, k.label ?? '', 3.6, col === '#16181d' ? '#e9eef3' : '#0d2a4d')}
            </g>; })}
            {tool === 'outline' && kb.outline.map((p, i) => <circle key={'v' + i} cx={p[0]} cy={-p[1]} r={1.6} fill="#f4a340" stroke="#fff" strokeWidth={0.3} style={{ cursor: 'grab' }} onPointerDown={e => onDown(e, 'vertex', undefined, i)} />)}
          </svg>
        ) : build ? (
          <Board3D design={build.design} tool="orbit" fpId="R0805" ghostRot={0} grid={0.5} showGrid={false} look={MASKS['Glacier navy']} vis={vis} preview={null} sel={null as Sel}
            traceLayer="TopCopper" traceWidth={0.25} view={cam} onAddTrace={() => {}} onAddVia={() => {}} onAddPad={() => {}} onAddChip={() => {}} onSelect={() => {}} onMoveStart={() => {}} onMoveChip={() => {}} onCursor={() => {}} />
        ) : <div className="empty">{busy ? 'Placing switches and autorouting the matrix…' : 'Build the PCB to see it in 3D'}</div>}
        <div className="views">
          <button className={view === '2d' ? 'on' : ''} onClick={() => setView('2d')}>2D layout</button>
          <button className={view === '3d' ? 'on' : ''} onClick={() => { setView('3d'); if (!build || stale.current) runBuild(); }}>3D board</button>
          {view === '3d' && (['iso', 'top', 'bottom', 'front'] as ViewName[]).map(v => <button key={v} onClick={() => setCam(s => ({ name: v, n: s.n + 1 }))}>{v}</button>)}
        </div>
        <div className="status"><span className="hint">{view === '2d' ? 'Keys snap to ' + (SNAPS.find(s => s[0] === snap)?.[1] ?? 'off') + ' · board outline in navy · orange = touchpad / USB' : 'Left-drag rotate · right-drag pan · wheel zoom'}</span><span className="coords">{kb.keys.length} keys</span></div>
      </main>
    </div>
  );
}

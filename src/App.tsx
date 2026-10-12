import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ART_LAYERS, Art, NM, Design, DrawLayer, Gray, LAYERS, LayerId, Pt, VecOpts, buildZip, emptyDesign, vectorize } from './core';
import { FOOTPRINTS, FP } from './footprints';
import { MASKS, Sel } from './texture';
import { penguinBadge } from './penguinArt';
import { badgeOnly, mcuBoard } from './demo';
import { addPenguins, esp32Board } from './esp32';
import { runDrc } from './drc';
import Board3D, { Tool, ViewName } from './Board3D';

const MAXPX = 500;
async function loadGray(src: string): Promise<Gray> {
  const img = new Image(); img.src = src; await img.decode();
  const w0 = img.naturalWidth || 512, h0 = img.naturalHeight || 512;
  const s = Math.min(1, MAXPX / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * s)), h = Math.max(1, Math.round(h0 * s));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d')!; ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const lum = new Uint8Array(w * h), alpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) { lum[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]; alpha[i] = d[i * 4 + 3]; }
  return { width: w, height: h, lum, alpha };
}

const TOOLS: { id: Tool; label: string; key: string; icon: string; hint: string }[] = [
  { id: 'orbit', label: 'Orbit', key: '1', icon: '⟳', hint: 'Left-drag rotate · right-drag pan · wheel zoom · click to select' },
  { id: 'select', label: 'Select / move', key: '2', icon: '➚', hint: 'Click to select, drag chips to move · R rotate · Del delete · right-drag orbit' },
  { id: 'brush', label: 'Brush', key: '3', icon: '✎', hint: 'Hand-draw: drag for a smooth stroke on copper or silk (no snap) · Ctrl+Z undoes the last stroke · right-drag orbit' },
  { id: 'poly', label: 'Trace', key: '4', icon: '⌇', hint: 'Click-to-place trace (snaps to grid) · double-click or Enter to finish · Esc cancel · right-drag orbit' },
  { id: 'via', label: 'Via', key: '5', icon: '◎', hint: 'Click to drop a 0.6/0.3 mm via (plated hole, both sides)' },
  { id: 'pad', label: 'Pad', key: '6', icon: '▣', hint: 'Click to drop a 1.5 mm SMD pad / test point' },
  { id: 'chip', label: 'Place chip', key: '7', icon: '▦', hint: 'Click to place the selected footprint · R rotates ghost · right-drag orbit' },
];
const VIS_LAYERS: LayerId[] = ['TopCopper', 'TopMask', 'TopSilk', 'BottomCopper', 'BottomMask', 'BottomSilk'];
let uid = 0; const newId = (p: string) => `${p}${Date.now().toString(36)}${(uid++).toString(36)}`;

export default function App() {
  const [design, setDesign] = useState<Design>(() => esp32Board());
  const [past, setPast] = useState<Design[]>([]);
  const [future, setFuture] = useState<Design[]>([]);
  const dRef = useRef(design); dRef.current = design;
  useEffect(() => { (window as any).__pcb = design; }, [design]); // handy for scripted checks
  const commit = useCallback((f: (d: Design) => Design) => {
    const cur = dRef.current, next = f(cur); if (next === cur) return;
    setPast(p => [...p.slice(-99), cur]); setFuture([]); dRef.current = next; setDesign(next);
  }, []);
  const undo = () => { if (!past.length) return; setFuture(f => [design, ...f]); setDesign(past[past.length - 1]); setPast(p => p.slice(0, -1)); setSel(null); };
  const redo = () => { if (!future.length) return; setPast(p => [...p, design]); setDesign(future[0]); setFuture(f => f.slice(1)); };

  const [tool, setTool] = useState<Tool>('orbit');
  const [fpId, setFpId] = useState('PENGBOT');
  const [ghostRot, setGhostRot] = useState(0);
  const [grid, setGrid] = useState(0.5);
  const [showGrid, setShowGrid] = useState(true);
  const [maskName, setMaskName] = useState('Glacier navy');
  const [vis, setVis] = useState<Record<LayerId, boolean>>(Object.fromEntries(LAYERS.map(l => [l, true])) as any);
  const [traceLayer, setTraceLayer] = useState<DrawLayer>('TopCopper');
  const [traceWidth, setTraceWidth] = useState(0.3);
  const [sel, setSel] = useState<Sel>(null);
  const [view, setView] = useState<{ name: ViewName; n: number }>({ name: 'iso', n: 0 });
  const [cursor, setCursor] = useState<Pt | null>(null);

  // image import
  const [gray, setGray] = useState<Gray | null>(null);
  const [imgName, setImgName] = useState('');
  const [opts, setOpts] = useState<VecOpts>({ threshold: 128, invert: false, dither: false, sizeMm: 16, cxMm: 62.5, cyMm: 26 });
  const [target, setTarget] = useState<LayerId>('TopSilk');
  const previewRects = useMemo(() => (gray ? vectorize(gray, opts, design.board.w * NM, design.board.h * NM) : []), [gray, opts, design.board]);
  const preview: Art | null = gray ? { layer: target, rects: previewRects } : null;
  const loadFile = (f: File) => { setImgName(f.name); loadGray(URL.createObjectURL(f)).then(setGray); };
  const loadPenguin = () => { setImgName('penguin badge'); setGray(penguinBadge(400)); };
  const placeArt = () => { if (previewRects.length) { commit(d => ({ ...d, art: [...d.art, { layer: target, rects: previewRects }] })); setGray(null); } };

  const nextRef = (prefix: string) => {
    const nums = dRef.current.chips.filter(c => c.ref.startsWith(prefix)).map(c => parseInt(c.ref.slice(prefix.length)) || 0);
    return prefix + (Math.max(0, ...nums) + 1);
  };
  const rotateSel = () => {
    if (sel?.kind === 'chip') commit(d => ({ ...d, chips: d.chips.map(c => c.id === sel.id ? { ...c, rot: (c.rot + 90) % 360 } : c) }));
    else setGhostRot(r => (r + 90) % 360);
  };
  const deleteSel = () => {
    if (!sel) return;
    const k = ({ chip: 'chips', trace: 'traces', via: 'vias', pad: 'pads' } as const)[sel.kind];
    commit(d => ({ ...d, [k]: (d[k] as { id: string }[]).filter(x => x.id !== sel.id) }));
    setSel(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName; if (tag === 'INPUT' || tag === 'SELECT') return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (mod) return;
      const t = TOOLS.find(t => t.key === e.key); if (t) { setTool(t.id); return; }
      if (e.key === 'r' || e.key === 'R') rotateSel();
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSel(); }
      else if (e.key === 'g' || e.key === 'G') setShowGrid(s => !s);
      else if (e.key === 'Escape') setSel(null);
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });

  const exportZip = async () => {
    const blob = await (await buildZip(design)).generateAsync({ type: 'blob' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (design.name?.startsWith('PengBot ESP32') ? 'pengbot-esp32' : 'penguin-pcb') + '-gerbers.zip'; a.click();
  };

  const drc = useMemo(() => runDrc(design), [design]);
  const drcOk = !drc.violations.length && !drc.shorts.length && !drc.unrouted.length;
  const drcTitle = [...drc.shorts.map(s => 'SHORT ' + s), ...drc.unrouted.map(s => 'UNROUTED ' + s), ...drc.violations].slice(0, 20).join('\n') || `${Object.keys(drc.nets).length} nets, all connected, clearances ≥ 0.2 mm`;
  const selChip = sel?.kind === 'chip' ? design.chips.find(c => c.id === sel.id) : undefined;
  const num = (k: keyof VecOpts, label: string, min: number, max: number, step = 1) => (
    <label className="slider"><span>{label}<b>{String(opts[k])}</b></span>
      <input type="range" min={min} max={max} step={step} value={opts[k] as number} onChange={e => setOpts({ ...opts, [k]: Number(e.target.value) })} /></label>
  );
  const hint = TOOLS.find(t => t.id === tool)!.hint;

  return (
    <div className="app" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) loadFile(f); }}>
      <header className="top">
        <img src="/penguin.svg" alt="" className="logo" />
        <div className="title"><h1>Penguin PCB Studio</h1><span>{design.name ?? 'Untitled'} · {design.board.w} × {design.board.h} mm · 2 layers · 1.6 mm FR-4</span></div>
        <div className="spacer" />
        <span className={'drc ' + (drcOk ? 'ok' : 'bad')} title={drcTitle}>{drcOk ? '✓ DRC clean' : `⚠ DRC ${drc.violations.length + drc.shorts.length + drc.unrouted.length}`}</span>
        <button onClick={undo} disabled={!past.length} title="Ctrl+Z — undo last stroke / action">↶ Undo</button>
        <button onClick={redo} disabled={!future.length} title="Ctrl+Shift+Z">↷ Redo</button>
        <button className="primary" onClick={exportZip}>⬇ Export Gerber zip</button>
      </header>

      <aside className="panel">
        <section>
          <h2>Tools</h2>
          <div className="tools">{TOOLS.map(t => (
            <button key={t.id} className={tool === t.id ? 'on' : ''} onClick={() => setTool(t.id)} title={`${t.label} (${t.key})`}>
              <span className="ico">{t.icon}</span>{t.label}<kbd>{t.key}</kbd></button>))}</div>
        </section>

        {(tool === 'brush' || tool === 'poly') && <section>
          <h2>{tool === 'brush' ? 'Brush' : 'Trace'}</h2>
          <div className="seg">{(['TopCopper', 'TopSilk'] as DrawLayer[]).map(l =>
            <button key={l} className={traceLayer === l ? 'on' : ''} onClick={() => { setTraceLayer(l); setTraceWidth(l === 'TopSilk' ? 0.2 : 0.3); }}>{l === 'TopCopper' ? 'Copper' : 'Silk'}</button>)}</div>
          {tool === 'brush' && <div className="muted">Strokes are smoothed and exported as real {traceLayer === 'TopCopper' ? 'copper' : 'silkscreen'} lines. JLC min: 0.15 mm.</div>}
          <label className="row">Width <select value={traceWidth} onChange={e => setTraceWidth(Number(e.target.value))}>
            {[0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.8, 1.0, 1.5].map(w => <option key={w} value={w}>{w} mm</option>)}</select></label>
        </section>}

        <section>
          <h2>Chip library</h2>
          <div className="lib">{FOOTPRINTS.map(f => (
            <button key={f.id} className={fpId === f.id ? 'on' : ''} onClick={() => { setFpId(f.id); setTool('chip'); }}>
              <b>{f.id === 'PENGBOT' ? '🐧 ' : ''}{f.name}</b><small>{f.desc}</small></button>))}</div>
          {tool === 'chip' && <div className="muted">Ghost rotation {ghostRot}° · press R</div>}
        </section>

        {selChip && <section className="selbox">
          <h2>Selected · {selChip.ref}</h2>
          <div className="muted">{FP[selChip.fp].name} @ {selChip.x.toFixed(2)}, {selChip.y.toFixed(2)} mm · {selChip.rot}°</div>
          <div className="btnrow"><button onClick={rotateSel}>⟲ Rotate (R)</button><button className="danger" onClick={deleteSel}>Delete</button></div>
        </section>}
        {sel && !selChip && <section className="selbox">
          <h2>Selected · {sel.kind}</h2><div className="btnrow"><button className="danger" onClick={deleteSel}>Delete (Del)</button></div>
        </section>}

        <section>
          <h2>Grid & snap</h2>
          <label className="row">Snap <select value={grid} onChange={e => setGrid(Number(e.target.value))}>
            {[[0, 'off'], [0.1, '0.1 mm'], [0.25, '0.25 mm'], [0.5, '0.5 mm'], [1, '1 mm'], [1.27, '1.27 mm (50 mil)'], [2.54, '2.54 mm (100 mil)']].map(([v, l]) =>
              <option key={v} value={v}>{l}</option>)}</select></label>
          <label className="check"><input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} /> Show grid (G)</label>
        </section>

        <section>
          <h2>Board finish</h2>
          <div className="swatches">{Object.entries(MASKS).map(([n, l]) => (
            <button key={n} className={maskName === n ? 'on' : ''} onClick={() => setMaskName(n)} title={n}>
              <i style={{ background: l.mask, borderColor: l.silk }} />{n}</button>))}</div>
        </section>

        <section>
          <h2>Layers</h2>
          {VIS_LAYERS.map(l => <label key={l} className="check"><input type="checkbox" checked={vis[l]} onChange={e => setVis({ ...vis, [l]: e.target.checked })} /> {l}</label>)}
        </section>

        <section>
          <h2>Import art</h2>
          <input type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={e => e.target.files?.[0] && loadFile(e.target.files[0])} />
          <div className="btnrow"><button onClick={loadPenguin}>🐧 Penguin badge</button>
            <button onClick={() => { setImgName("Lalo's penguin"); loadGray('/samples/lalo-penguin.png').then(setGray); }}>🐧 Lalo's penguin</button>
            <button title="Re-stamp Lalo's penguin over all free silk (top + mirrored bottom)" onClick={() => commit(d => addPenguins({ ...d, art: d.art.filter(a => a.layer !== 'TopSilk' && a.layer !== 'BottomSilk') }))}>🐧🐧 Tile penguins</button></div>
          <div className="muted">{imgName || 'or drop a PNG / JPG / SVG anywhere'}</div>
          {gray && <div className="import">
            {num('threshold', 'Threshold', 1, 254)}
            <label className="check"><input type="checkbox" checked={opts.invert} onChange={e => setOpts({ ...opts, invert: e.target.checked })} /> invert</label>
            <label className="check"><input type="checkbox" checked={opts.dither} onChange={e => setOpts({ ...opts, dither: e.target.checked })} /> dither</label>
            {num('sizeMm', 'Size mm', 2, Math.max(design.board.w, design.board.h), 0.5)}{num('cxMm', 'Centre X', 0, design.board.w, 0.5)}{num('cyMm', 'Centre Y', 0, design.board.h, 0.5)}
            <label className="row">Layer <select value={target} onChange={e => setTarget(e.target.value as LayerId)}>{ART_LAYERS.map(l => <option key={l}>{l}</option>)}</select></label>
            <div className="muted">{previewRects.length} shapes (ice-blue preview on board)</div>
            <div className="btnrow"><button className="primary" onClick={placeArt}>Place on {target}</button><button onClick={() => setGray(null)}>Cancel</button></div>
          </div>}
        </section>

        <section>
          <h2>Board</h2>
          {!drcOk && <div className="drcbox">{drcTitle.split('\n').slice(0, 6).map((l, i) => <div key={i}>{l}</div>)}</div>}
          <div className="muted">{design.chips.length} parts · {design.traces.length} traces · {design.vias.length} vias · {design.pads.length} pads · {design.art.length} art{design.penguinCount ? ` · 🐧 ${design.penguinCount.top} top / ${design.penguinCount.bottom} bottom penguins` : ''}</div>
          {design.chips.length > 0 && <ul className="parts">{design.chips.map(c => (
            <li key={c.id} className={sel?.id === c.id ? 'on' : ''} onClick={() => setSel({ kind: 'chip', id: c.id })}><b>{c.ref}</b> {c.value ?? FP[c.fp]?.name}</li>))}</ul>}
          <div className="btnrow">
            <button onClick={() => { commit(() => esp32Board()); setSel(null); setView(v => ({ name: 'iso', n: v.n + 1 })); }}>🐧 PengBot ESP32</button>
            <button onClick={() => { commit(() => mcuBoard()); setSel(null); setView(v => ({ name: 'iso', n: v.n + 1 })); }}>🐧 PengBot Nano-328</button>
            <button onClick={() => { commit(() => badgeOnly()); setSel(null); setView(v => ({ name: 'iso', n: v.n + 1 })); }}>Badge art board</button>
            <button className="danger" onClick={() => { commit(d => ({ ...emptyDesign(d.board.w, d.board.h), name: 'Untitled' })); setSel(null); }}>Clear</button>
          </div>
        </section>
      </aside>

      <main className="stage">
        <Board3D design={design} tool={tool} fpId={fpId} ghostRot={ghostRot} grid={grid} showGrid={showGrid} look={MASKS[maskName]} vis={vis}
          preview={preview} sel={sel} traceLayer={traceLayer} traceWidth={traceWidth} view={view}
          onAddTrace={(pts, brush) => commit(d => ({ ...d, traces: [...d.traces, { id: newId(brush ? 'b' : 't'), layer: traceLayer, width: traceWidth, pts, brush }] }))}
          onAddVia={(x, y) => commit(d => ({ ...d, vias: [...d.vias, { id: newId('v'), x, y, d: 0.6, drill: 0.3 }] }))}
          onAddPad={(x, y) => commit(d => ({ ...d, pads: [...d.pads, { id: newId('p'), x, y, w: 1.5, h: 1.5, shape: 'rect' }] }))}
          onAddChip={(x, y) => { const id = newId('c'); commit(d => ({ ...d, chips: [...d.chips, { id, fp: fpId, x, y, rot: ghostRot, ref: nextRef(FP[fpId].prefix) }] })); setSel({ kind: 'chip', id }); }}
          onSelect={setSel}
          onMoveStart={() => { setPast(p => [...p.slice(-99), dRef.current]); setFuture([]); }}
          onMoveChip={(id, x, y) => setDesign(d => { const n = { ...d, chips: d.chips.map(c => c.id === id ? { ...c, x, y } : c) }; dRef.current = n; return n; })}
          onCursor={setCursor} />
        <div className="views">{(['iso', 'top', 'bottom', 'front'] as ViewName[]).map(v =>
          <button key={v} onClick={() => setView(s => ({ name: v, n: s.n + 1 }))}>{v[0].toUpperCase() + v.slice(1)}</button>)}</div>
        <div className="status"><span className="hint">{hint}</span><span className="coords">{cursor ? `X ${cursor[0].toFixed(2)}  Y ${cursor[1].toFixed(2)} mm` : '—'}</span></div>
      </main>
    </div>
  );
}

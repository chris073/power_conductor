// The SLD canvas: the only place that talks to React Flow. Everything it shows is projected from
// the project store; every edit goes back through store actions (one undo step each).

import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
  type Connection as RfConnection,
  type EdgeChangeset,
  type FinalConnectionState,
  type NodeChangeset,
} from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CATALOG } from '../domain/catalog';
import { energizedFromSources, trace as runTrace } from '../domain/topology';
import type { AnnotationKind, EquipmentType, Id } from '../domain/types';
import { placedSize, placedTerminals, snap } from '../layout/geometry';
import * as cmd from '../state/commands';
import { redo, undo, useProject } from '../state/projectStore';
import { useSettings } from '../state/settingsStore';
import { useUi } from '../state/uiStore';
import { buildEdges, buildNodes, Memo, type CableEdge, type CanvasNode, type Override } from './adapters';
import { OrthoEdge } from './edges/OrthoEdge';
import { buildStudyCase } from '../domain/study';
import { connectionDecoration, equipmentDecoration, type Decoration } from './lens';
import { CloudNode, LineupNode, NoteNode } from './nodes/BoxNodes';
import { BusNode } from './nodes/BusNode';
import { EquipmentNode } from './nodes/EquipmentNode';

const nodeTypes = { equipment: EquipmentNode, bus: BusNode, lineup: LineupNode, note: NoteNode, cloud: CloudNode };
const edgeTypes = { cable: OrthoEdge };
const proOptions = { hideAttribution: true };
const MULTI_KEYS = ['Shift', 'Control', 'Meta'];

export const DRAG_MIME = 'application/x-conductor-item';

export function CanvasProvider({ children }: { children: ReactNode }) {
  return <ReactFlowProvider>{children}</ReactFlowProvider>;
}

/** Bounds of everything on a sheet, from the layout model (React Flow only knows rendered nodes). */
export function sheetBounds(sheetId: Id) {
  const d = useProject.getState().doc;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [id, n] of Object.entries(d.layout.nodes)) {
    const e = d.equipment[id];
    const a = d.annotations[id];
    if ((e?.sheetId ?? a?.sheetId) !== sheetId) continue;
    const s = e ? placedSize(e, n) : { w: n.w ?? 200, h: n.h ?? 60 };
    x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y);
    x1 = Math.max(x1, n.x + s.w + (e ? 80 : 0)); y1 = Math.max(y1, n.y + s.h); // room for labels
  }
  if (!Number.isFinite(x0)) return null;
  return { x: x0, y: y0 - 24, width: x1 - x0, height: y1 - y0 + 24 };
}

function fitSheet(rf: ReturnType<typeof useReactFlow>, duration = 250) {
  const sheetId = useUi.getState().sheetId ?? useProject.getState().doc.sheets[0]?.id;
  const b = sheetId ? sheetBounds(sheetId) : null;
  if (b) void rf.fitBounds(b, { padding: 0.08, duration });
}

/** Canvas actions for toolbars and pages (they may not import the diagram library). */
export function useCanvasApi() {
  const rf = useReactFlow();
  return useMemo(
    () => ({
      fit: () => fitSheet(rf),
      zoomIn: () => void rf.zoomIn({ duration: 150 }),
      zoomOut: () => void rf.zoomOut({ duration: 150 }),
      /** Flow position of the viewport center. */
      center: () => {
        const el = document.querySelector('.sld-canvas') as HTMLElement | null;
        const r = el?.getBoundingClientRect();
        return r ? rf.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 }) : { x: 0, y: 0 };
      },
    }),
    [rf],
  );
}

export function placeItem(item: string, sheetId: Id, at: { x: number; y: number }, grid: number): Id {
  const st = useProject.getState();
  if (item === 'note' || item === 'cloud') {
    return st.addAnnotation(item as AnnotationKind, sheetId, { x: snap(at.x, grid), y: snap(at.y, grid) });
  }
  const type = item as EquipmentType;
  const def = CATALOG[type];
  const w = type === 'bus' ? 240 : def.w;
  const h = type === 'bus' ? 20 : def.h;
  return st.addEquipment(type, sheetId, { x: snap(at.x - w / 2, grid), y: snap(at.y - h / 2, grid) });
}

function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

function Canvas({ sheetId }: { sheetId: Id }) {
  const doc = useProject((s) => s.doc);
  const selection = useUi((s) => s.selection);
  const phase = useUi((s) => s.phase);
  const traceFrom = useUi((s) => s.trace?.from ?? null);
  const focusId = useUi((s) => s.focusId);
  const settings = useSettings();
  const rf = useReactFlow();
  const [overrides, setOverrides] = useState<Record<Id, Override>>({});
  const nodeMemo = useRef(new Memo<CanvasNode>()).current;
  const edgeMemo = useRef(new Memo<CableEdge>()).current;
  const nodeDeco = useRef(new Memo<Decoration>()).current;
  const edgeDeco = useRef(new Memo<Decoration>()).current;
  const cursor = useRef<{ x: number; y: number } | null>(null);

  // Any committed change replaces drag/resize previews.
  useEffect(() => setOverrides({}), [doc]);

  const traceResult = useMemo(() => (traceFrom && doc.equipment[traceFrom] ? runTrace(doc, [traceFrom]) : null), [doc, traceFrom]);
  const live = useMemo(() => (phase === 'operations' ? energizedFromSources(doc) : null), [doc, phase]);

  const overlay = useUi((s) => s.studyOverlay);
  // PSS/E bus numbers on drawn buses (Design lens). The study build runs only while the overlay is on.
  const busNum = useMemo(() => {
    if (overlay !== 'busNum' || phase !== 'design') return null;
    const sc = buildStudyCase(doc);
    const m = new Map<string, number>();
    for (const b of sc.buses) for (const id of b.busIds) m.set(id, b.number);
    return m;
  }, [doc, overlay, phase]);
  const decorations = useMemo(() => {
    const m = new Map<Id, Decoration>();
    const input = { doc, phase, trace: traceResult, live, voltageUnit: settings.voltageUnit, busNum, results: overlay === 'results' ? doc.studyResults : null };
    for (const e of Object.values(doc.equipment)) if (e.sheetId === sheetId) m.set(e.id, equipmentDecoration(e, input));
    for (const c of Object.values(doc.connections)) if (c.sheetId === sheetId) m.set(c.id, connectionDecoration(c, input));
    return m;
  }, [doc, phase, traceResult, live, settings.voltageUnit, sheetId, busNum, overlay]);

  const selSet = useMemo(() => new Set(selection), [selection]);
  const nodes = useMemo(
    () => buildNodes({ doc, sheetId, selection: selSet, decorations, overrides }, nodeMemo, nodeDeco),
    [doc, sheetId, selSet, decorations, overrides, nodeMemo, nodeDeco],
  );
  const edges = useMemo(
    () => buildEdges({ doc, sheetId, selection: selSet, decorations, overrides, straight: settings.routing === 'straight', grid: settings.gridSize, showTags: phase !== 'concept' }, edgeMemo, edgeDeco),
    [doc, sheetId, selSet, decorations, overrides, settings.routing, settings.gridSize, phase, edgeMemo, edgeDeco],
  );

  const onNodesChange = useCallback((changes: NodeChangeset<CanvasNode>) => {
    const next: Record<Id, Override> = {};
    const commit: Record<Id, { x: number; y: number }> = {};
    let selChanged = false;
    const sel = new Set(useUi.getState().selection);
    for (const c of changes) {
      if (c.type === 'position' && c.position) {
        if (c.dragging) next[c.id] = { ...next[c.id], x: c.position.x, y: c.position.y };
        else commit[c.id] = { x: c.position.x, y: c.position.y };
      } else if (c.type === 'dimensions' && c.resizing && c.dimensions) {
        next[c.id] = { ...next[c.id], w: c.dimensions.width, h: c.dimensions.height };
      } else if (c.type === 'select') {
        selChanged = true;
        if (c.selected) sel.add(c.id); else sel.delete(c.id);
      }
    }
    if (Object.keys(next).length) setOverrides((o) => {
      const merged = { ...o };
      for (const [id, v] of Object.entries(next)) merged[id] = { ...merged[id], ...v };
      return merged;
    });
    if (Object.keys(commit).length) useProject.getState().moveNodes(commit);
    if (selChanged) useUi.getState().select([...sel]);
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChangeset<CableEdge>) => {
    let selChanged = false;
    const sel = new Set(useUi.getState().selection);
    for (const c of changes) {
      if (c.type === 'select') {
        selChanged = true;
        if (c.selected) sel.add(c.id); else sel.delete(c.id);
      }
    }
    if (selChanged) useUi.getState().select([...sel]);
  }, []);

  const onNodeDragStop = useCallback((_: unknown, _n: CanvasNode, dragged: CanvasNode[]) => {
    const pos: Record<Id, { x: number; y: number }> = {};
    for (const n of dragged) pos[n.id] = { x: n.position.x, y: n.position.y };
    useProject.getState().moveNodes(pos);
  }, []);

  const onConnect = useCallback(
    (c: RfConnection) => {
      if (!c.sourceHandle || !c.targetHandle) return;
      const id = useProject.getState().connect({ equipmentId: c.source, terminalId: c.sourceHandle }, { equipmentId: c.target, terminalId: c.targetHandle }, sheetId);
      if (!id) useUi.getState().toast('Those terminals cannot be connected (already connected, or the same device).', 'error');
    },
    [sheetId],
  );

  /** Dropped a connection on a bus (new tap) or on a device body (nearest free terminal). */
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
      if (state.isValid || !state.fromNode || !state.fromHandle?.id) return;
      const pt = 'changedTouches' in event ? event.changedTouches[0]! : event;
      const el = document.elementFromPoint(pt.clientX, pt.clientY)?.closest('.react-flow__node') as HTMLElement | null;
      const targetId = el?.dataset.id;
      if (!targetId || targetId === state.fromNode.id) return;
      const d = useProject.getState().doc;
      const target = d.equipment[targetId];
      const layout = d.layout.nodes[targetId];
      if (!target || !layout) return;
      const from = { equipmentId: state.fromNode.id, terminalId: state.fromHandle.id };
      const p = rf.screenToFlowPosition({ x: pt.clientX, y: pt.clientY });
      const g = useSettings.getState().gridSize;
      if (target.type === 'bus') {
        const vertical = layout.rot === 90 || layout.rot === 270;
        const offset = vertical ? p.y - layout.y : p.x - layout.x;
        if (!useProject.getState().connectToBus(from, targetId, offset, sheetId, g)) useUi.getState().toast('Could not connect to that bus.', 'error');
        return;
      }
      // Nearest terminal of the same kind on the device body.
      const fromEq = d.equipment[from.equipmentId];
      const fromKind = fromEq?.type === 'bus' ? 'power' : CATALOG[fromEq?.type ?? 'load'].terminals.find((t) => t.id === from.terminalId)?.kind ?? 'power';
      const used = new Set(Object.values(d.connections).flatMap((c) => [c.from, c.to]).filter((r) => r.equipmentId === targetId).map((r) => r.terminalId));
      const candidates = placedTerminals(target, layout).filter((t) => t.kind === fromKind);
      const free = candidates.filter((t) => !used.has(t.id));
      const pool = free.length ? free : candidates;
      let best: (typeof pool)[number] | undefined;
      let bestD = Infinity;
      for (const t of pool) {
        const dd = Math.hypot(layout.x + t.x - p.x, layout.y + t.y - p.y);
        if (dd < bestD) { bestD = dd; best = t; }
      }
      if (best) useProject.getState().connect(from, { equipmentId: targetId, terminalId: best.id }, sheetId);
    },
    [rf, sheetId],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const item = e.dataTransfer.getData(DRAG_MIME);
      if (!item) return;
      e.preventDefault();
      const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const id = placeItem(item, sheetId, p, useSettings.getState().gridSize);
      useUi.getState().select([id]);
    },
    [rf, sheetId],
  );

  // Status bar: cursor and zoom (throttled to animation frames).
  const raf = useRef(0);
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      cursor.current = p;
      if (raf.current) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        if (cursor.current) useUi.getState().setCursor({ x: Math.round(cursor.current.x), y: Math.round(cursor.current.y) });
      });
    },
    [rf],
  );
  const onMove = useCallback((_: unknown, vp: { zoom: number }) => useUi.getState().setZoom(vp.zoom), []);

  // Inspector "go to" requests.
  useEffect(() => {
    if (!focusId) return;
    const d = useProject.getState().doc;
    const n = d.layout.nodes[focusId];
    const e = d.equipment[focusId];
    if (n) {
      const s = e ? placedSize(e, n) : { w: n.w ?? 0, h: n.h ?? 0 };
      void rf.setCenter(n.x + s.w / 2, n.y + s.h / 2, { zoom: Math.max(rf.getZoom(), 1), duration: 300 });
    }
    useUi.getState().focus(null);
  }, [focusId, rf]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      const ui = useUi.getState();
      if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
      if (mod && k === 'c') { if (cmd.copySelection()) e.preventDefault(); return; }
      if (mod && k === 'x') { e.preventDefault(); cmd.cutSelection(); return; }
      if (mod && k === 'v') { e.preventDefault(); cmd.paste(cursor.current ?? undefined); return; }
      if (mod && k === 'd') { e.preventDefault(); cmd.duplicateSelection(); return; }
      if (mod && k === 'a') { e.preventDefault(); cmd.selectAll(); return; }
      if (mod) return;
      if (k === 'delete' || k === 'backspace') { e.preventDefault(); cmd.deleteSelection(); return; }
      if (k === 'escape') { ui.select([]); cmd.clearTrace(); return; }
      if (k === 'r') { cmd.rotateSelection(); return; }
      if (k === 'm') { cmd.flipSelection(); return; }
      if (k === 'f') { fitSheet(rf); return; }
      if (k === 'o') { cmd.toggleSelection(); return; }
      if (k === 't') { const msg = cmd.traceSelection(); if (msg) ui.toast(msg); return; }
      const arrows: Record<string, [number, number]> = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] };
      if (arrows[k]) { e.preventDefault(); cmd.nudgeSelection(...arrows[k]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rf]);

  const g = settings.gridSize;
  return (
    <div className={`sld-canvas lens-${phase} ${traceResult ? 'has-trace' : ''}`} onPointerMove={onPointerMove}>
      <ReactFlow<CanvasNode, CableEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        onDrop={onDrop}
        onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG_MIME)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }}
        onMove={onMove}
        connectionMode={ConnectionMode.Loose}
        connectionLineType={settings.routing === 'straight' ? ConnectionLineType.Straight : ConnectionLineType.Step}
        connectionRadius={24}
        snapToGrid={settings.snap}
        snapGrid={[g, g]}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1]}
        panActivationKeyCode="Space"
        multiSelectionKeyCode={MULTI_KEYS}
        deleteKeyCode={null}
        zoomOnDoubleClick={false}
        disableKeyboardA11y
        minZoom={0.05}
        maxZoom={4}
        onlyRenderVisibleElements
        elevateEdgesOnSelect
        proOptions={proOptions}
        onInit={(inst) => requestAnimationFrame(() => fitSheet(inst as unknown as ReturnType<typeof useReactFlow>, 0))}
      >
        <Background id="minor" variant={BackgroundVariant.Dots} gap={g} size={1.2} color="var(--grid-minor)" />
        <Background id="major" variant={BackgroundVariant.Lines} gap={g * 5} lineWidth={0.6} color="var(--grid-major)" />
        {settings.showMinimap && <MiniMap pannable zoomable className="minimap" nodeClassName={(n) => `mm-${n.type}`} maskColor="var(--minimap-mask)" />}
      </ReactFlow>
    </div>
  );
}

export function SldCanvas({ sheetId }: { sheetId: Id }) {
  return <Canvas key={sheetId} sheetId={sheetId} />;
}


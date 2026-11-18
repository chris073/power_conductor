// A bus bar: one electrical node with any number of taps. Stretch it from either end; slide taps
// along it; drop a connection anywhere on it to create a new tap (handled in SldCanvas).

import { Handle, Position, useReactFlow, useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import { memo, useEffect, useRef, useState } from 'react';
import { BUS_THICKNESS, isBusVertical, snap } from '../../layout/geometry';
import { useProject } from '../../state/projectStore';
import { useSettings } from '../../state/settingsStore';
import type { EquipmentNode } from '../adapters';

type Drag =
  | { kind: 'end'; which: 'start' | 'end'; x: number; y: number; len: number }
  | { kind: 'tap'; tapId: string };

function BusNodeImpl({ id, data, selected }: NodeProps<EquipmentNode>) {
  const { eq, layout, deco } = data;
  const taps = data.taps ?? {};
  const vertical = isBusVertical(layout);
  const len = layout.w ?? 240;
  const grid = useSettings((s) => s.gridSize);
  const updateInternals = useUpdateNodeInternals();
  const { screenToFlowPosition } = useReactFlow();
  const drag = useRef<Drag | null>(null);
  const [preview, setPreview] = useState<{ start: number; len: number } | { tapId: string; off: number } | null>(null);

  const tapKey = Object.entries(taps).map(([k, v]) => `${k}:${v}`).join(',');
  useEffect(() => {
    updateInternals(id);
  }, [id, tapKey, len, vertical, updateInternals]);

  const axis = (p: { x: number; y: number }) => (vertical ? p.y : p.x);

  const onPointerDown = (e: React.PointerEvent, d: Drag) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = d;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const start = vertical ? layout.y : layout.x;
    if (d.kind === 'end') {
      const at = snap(axis(p), grid);
      if (d.which === 'start') {
        const end = start + len;
        const s = Math.min(at, end - grid * 2);
        setPreview({ start: s, len: end - s });
      } else {
        setPreview({ start, len: Math.max(grid * 2, at - start) });
      }
    } else {
      setPreview({ tapId: d.tapId, off: Math.max(0, Math.min(len, snap(axis(p) - start, grid))) });
    }
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !preview) { setPreview(null); return; }
    const st = useProject.getState();
    if ('len' in preview) {
      if (vertical) st.resizeBus(id, layout.x, preview.start, preview.len);
      else st.resizeBus(id, preview.start, layout.y, preview.len);
    } else {
      st.moveTap(id, preview.tapId, preview.off);
    }
    setPreview(null);
  };

  // Preview geometry (relative to the node box).
  const start = vertical ? layout.y : layout.x;
  const pv = preview && 'len' in preview ? preview : null;
  const offset0 = pv ? pv.start - start : 0;
  const shownLen = pv ? pv.len : len;
  const half = BUS_THICKNESS / 2;
  const tapPos = (tapId: string, off: number) => (preview && 'tapId' in preview && preview.tapId === tapId ? preview.off : off);

  return (
    <div className={`bus ${deco.cls} ${selected ? 'is-selected' : ''}`} style={{ width: vertical ? BUS_THICKNESS : len, height: vertical ? len : BUS_THICKNESS }} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
      <div
        className="bus-bar"
        style={vertical ? { left: half - 3, top: offset0, width: 6, height: shownLen } : { top: half - 3, left: offset0, height: 6, width: shownLen }}
      />
      {(eq.taps ?? []).map((t) => {
        const off = tapPos(t.id, taps[t.id] ?? 0);
        return (
          <Handle
            key={t.id}
            id={t.id}
            type="source"
            position={vertical ? Position.Right : Position.Bottom}
            className="term term-power term-tap"
            style={vertical ? { left: half, top: off, right: 'auto', bottom: 'auto' } : { left: off, top: half, right: 'auto', bottom: 'auto' }}
          />
        );
      })}
      {selected && (
        <>
          <div className="bus-grip nodrag nopan" style={vertical ? { left: half, top: offset0 } : { left: offset0, top: half }} onPointerDown={(e) => onPointerDown(e, { kind: 'end', which: 'start', x: layout.x, y: layout.y, len })} title="Drag to stretch" />
          <div className="bus-grip nodrag nopan" style={vertical ? { left: half, top: offset0 + shownLen } : { left: offset0 + shownLen, top: half }} onPointerDown={(e) => onPointerDown(e, { kind: 'end', which: 'end', x: layout.x, y: layout.y, len })} title="Drag to stretch" />
          {(eq.taps ?? []).map((t) => {
            const off = tapPos(t.id, taps[t.id] ?? 0);
            return (
              <div
                key={t.id}
                className="bus-tapgrip nodrag nopan"
                style={vertical ? { left: -10, top: off } : { left: off, top: -10 }}
                title="Slide tap"
                onPointerDown={(e) => onPointerDown(e, { kind: 'tap', tapId: t.id })}
              />
            );
          })}
        </>
      )}
      <div className="eq-label bus-label" style={vertical ? { left: BUS_THICKNESS + 6, top: 0 } : { left: 0, top: -22 }}>
        <span className="eq-tag">{eq.tag}</span>
        {deco.lines.map((l, i) => (
          <span key={i} className="eq-line">{l}</span>
        ))}
        {deco.badge > 0 && <span className="eq-badge static">{deco.badge}</span>}
        {deco.flag && <span className="eq-flag static">⚑</span>}
      </div>
    </div>
  );
}

export const BusNode = memo(BusNodeImpl);

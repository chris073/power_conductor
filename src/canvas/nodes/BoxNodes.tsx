// Resizable boxes: switchgear lineup (container), text notes and revision clouds.

import { NodeResizer, type NodeProps } from '@xyflow/react';
import { memo, useMemo, useState } from 'react';
import { useProject } from '../../state/projectStore';
import { useSettings } from '../../state/settingsStore';
import type { AnnotationNode, EquipmentNode } from '../adapters';

function useResize(id: string) {
  const grid = useSettings((s) => s.gridSize);
  return (_: unknown, p: { x: number; y: number; width: number; height: number }) => {
    const r = (v: number) => Math.max(grid, Math.round(v / grid) * grid);
    useProject.getState().resizeBox(id, Math.round(p.x / grid) * grid, Math.round(p.y / grid) * grid, r(p.width), r(p.height));
  };
}

function LineupNodeImpl({ id, data, selected, width, height }: NodeProps<EquipmentNode>) {
  const onResizeEnd = useResize(id);
  const { eq, deco } = data;
  return (
    <div className={`lineup ${deco.cls} ${selected ? 'is-selected' : ''}`} style={{ width, height }}>
      <NodeResizer isVisible={selected} minWidth={80} minHeight={80} onResizeEnd={onResizeEnd} lineClassName="resize-line" handleClassName="resize-handle" />
      <div className="lineup-label">
        <span className="eq-tag">{eq.tag}</span>
        {deco.lines.map((l, i) => (
          <span key={i} className="eq-line">{l}</span>
        ))}
      </div>
    </div>
  );
}

function NoteNodeImpl({ id, data, selected, width, height }: NodeProps<AnnotationNode>) {
  const onResizeEnd = useResize(id);
  const [editing, setEditing] = useState(false);
  return (
    <div className={`note ${selected ? 'is-selected' : ''}`} style={{ width, height }} onDoubleClick={() => setEditing(true)}>
      <NodeResizer isVisible={selected} minWidth={60} minHeight={20} onResizeEnd={onResizeEnd} lineClassName="resize-line" handleClassName="resize-handle" />
      {editing ? (
        <textarea
          className="note-edit nodrag"
          autoFocus
          defaultValue={data.ann.text}
          onBlur={(e) => {
            setEditing(false);
            if (e.target.value !== data.ann.text) useProject.getState().setNoteText(id, e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur();
          }}
        />
      ) : (
        <div className="note-text">{data.ann.text || 'Double-click to edit'}</div>
      )}
    </div>
  );
}

/** Scalloped revision-cloud outline around a rectangle. */
export function cloudPath(w: number, h: number, r = 12): string {
  const pts: string[] = [];
  const nx = Math.max(2, Math.round(w / (r * 2)));
  const ny = Math.max(2, Math.round(h / (r * 2)));
  const sx = w / nx;
  const sy = h / ny;
  pts.push(`M0 0`);
  for (let i = 1; i <= nx; i++) pts.push(`A${sx / 2} ${sx / 2} 0 0 1 ${i * sx} 0`);
  for (let i = 1; i <= ny; i++) pts.push(`A${sy / 2} ${sy / 2} 0 0 1 ${w} ${i * sy}`);
  for (let i = nx - 1; i >= 0; i--) pts.push(`A${sx / 2} ${sx / 2} 0 0 1 ${i * sx} ${h}`);
  for (let i = ny - 1; i >= 0; i--) pts.push(`A${sy / 2} ${sy / 2} 0 0 1 0 ${i * sy}`);
  return pts.join(' ');
}

function CloudNodeImpl({ id, data, selected, width = 240, height = 160 }: NodeProps<AnnotationNode>) {
  const onResizeEnd = useResize(id);
  const d = useMemo(() => cloudPath(width, height), [width, height]);
  return (
    <div className={`cloud ${selected ? 'is-selected' : ''}`} style={{ width, height }}>
      <NodeResizer isVisible={selected} minWidth={40} minHeight={40} onResizeEnd={onResizeEnd} lineClassName="resize-line" handleClassName="resize-handle" />
      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        <path d={d} className="cloud-path" />
      </svg>
      {data.ann.text && <div className="cloud-text">{data.ann.text}</div>}
    </div>
  );
}

export const LineupNode = memo(LineupNodeImpl);
export const NoteNode = memo(NoteNodeImpl);
export const CloudNode = memo(CloudNodeImpl);

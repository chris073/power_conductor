// A cable / control wire drawn as a right-angle polyline. When selected it shows one handle per
// segment; dragging a handle moves that segment (horizontal segments move vertically and vice
// versa) and turns the route into a manual route that survives later moves.

import { BaseEdge, EdgeLabelRenderer, Position, useReactFlow, type EdgeProps } from '@xyflow/react';
import { memo, useMemo, useRef, useState } from 'react';
import type { Dir } from '../../domain/catalog';
import type { Pt } from '../../domain/types';
import { autoRoute, bendsOf, fitManualRoute, moveSegment, pathD, segmentOrientation, simplify, straightRoute } from '../../layout/routing/orthogonal';
import { useProject } from '../../state/projectStore';
import type { CableEdge } from '../adapters';

const DIR: Record<Position, Dir> = { [Position.Top]: 'up', [Position.Bottom]: 'down', [Position.Left]: 'left', [Position.Right]: 'right' };

export const HANDLE_SIZE = 9;

function handleCenter(x: number, y: number, pos: Position): Pt {
  const h = HANDLE_SIZE / 2;
  if (pos === Position.Bottom) y -= h;
  else if (pos === Position.Top) y += h;
  else if (pos === Position.Left) x += h;
  else x -= h;
  return { x: Math.round(x), y: Math.round(y) };
}

function busDir(axis: 'h' | 'v' | undefined, from: Pt, to: Pt, fallback: Dir): Dir {
  if (axis === 'h') return to.y < from.y ? 'up' : 'down';
  if (axis === 'v') return to.x < from.x ? 'left' : 'right';
  return fallback;
}

function OrthoEdgeImpl({ id, data, selected, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }: EdgeProps<CableEdge>) {
  const { screenToFlowPosition } = useReactFlow();
  const [preview, setPreview] = useState<Pt[] | null>(null);
  const drag = useRef<{ index: number; base: Pt[]; orient: 'h' | 'v' } | null>(null);

  // React Flow reports the outer edge of the handle; terminals are at the handle center.
  const s = handleCenter(sourceX, sourceY, sourcePosition);
  const t = handleCenter(targetX, targetY, targetPosition);
  const conn = data!.conn;
  const route = data!.route;
  const straight = data!.straight && route?.mode !== 'manual';
  const control = conn.kind === 'control';

  const points = useMemo(() => {
    if (straight) return straightRoute(s, t);
    const sd = busDir(data!.sourceBus, s, t, DIR[sourcePosition]);
    const td = busDir(data!.targetBus, t, s, DIR[targetPosition]);
    const se = { ...s, dir: sd };
    const te = { ...t, dir: td };
    return route?.mode === 'manual' ? fitManualRoute(se, te, route.points) : autoRoute(se, te, data!.grid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.x, s.y, t.x, t.y, sourcePosition, targetPosition, route, straight, data!.grid, data!.sourceBus, data!.targetBus]);

  const shown = preview ?? points;
  const d = pathD(shown);

  const onDown = (e: React.PointerEvent, index: number) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { index, base: points, orient: segmentOrientation(points[index]!, points[index + 1]!) };
  };
  const onMove = (e: React.PointerEvent) => {
    const g = drag.current;
    if (!g) return;
    const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const grid = data!.grid;
    const v = Math.round((g.orient === 'h' ? p.y : p.x) / grid) * grid;
    setPreview(moveSegment(g.base, g.index, v));
  };
  const onUp = () => {
    const g = drag.current;
    drag.current = null;
    if (g && preview) {
      const full = simplify(preview);
      useProject.getState().setRoute(id, { mode: 'manual', points: bendsOf(full) });
    }
    setPreview(null);
  };

  const mid = shown.length > 1 ? midpointOfLongest(shown) : null;

  return (
    <>
      <BaseEdge path={d} interactionWidth={14} className={`cable ${control ? 'is-control' : ''} ${data!.deco.cls} ${selected ? 'is-selected' : ''}`} />
      {data!.showTag && !control && mid && (
        <text className="cable-tag" x={mid.x + (mid.vertical ? 5 : 0)} y={mid.y + (mid.vertical ? 0 : -5)} textAnchor={mid.vertical ? 'start' : 'middle'}>
          {conn.tag}
          {data!.deco.badge > 0 ? ` (${data!.deco.badge})` : ''}
        </text>
      )}
      {!control && mid && data!.deco.lines.length > 0 && (
        <text className="cable-tag cable-result" x={mid.x + (mid.vertical ? 5 : 0)} y={mid.y + (mid.vertical ? 12 : 9)} textAnchor={mid.vertical ? 'start' : 'middle'}>
          {data!.deco.lines.join('  ')}
        </text>
      )}
      {selected && !straight && (
        <EdgeLabelRenderer>
          {shown.slice(0, -1).map((a, i) => {
            const b = shown[i + 1]!;
            const len = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
            if (len < 16) return null;
            const orient = segmentOrientation(a, b);
            return (
              <div
                key={i}
                className={`seg-handle seg-${orient} nodrag nopan`}
                style={{ transform: `translate(-50%, -50%) translate(${(a.x + b.x) / 2}px, ${(a.y + b.y) / 2}px)` }}
                onPointerDown={(e) => onDown(e, i)}
                onPointerMove={onMove}
                onPointerUp={onUp}
                title="Drag to move this segment"
              />
            );
          })}
        </EdgeLabelRenderer>
      )}
    </>
  );
}

function midpointOfLongest(pts: Pt[]) {
  let best = 0;
  let at = { x: 0, y: 0, vertical: true };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!, b = pts[i + 1]!;
    const len = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    if (len > best) {
      best = len;
      at = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, vertical: a.x === b.x };
    }
  }
  return at;
}

export const OrthoEdge = memo(OrthoEdgeImpl);

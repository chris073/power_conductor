// Projects the domain + layout model into React Flow nodes and edges. Node and edge objects are
// cached per id and only rebuilt when their inputs change, so a 500-node sheet re-renders only
// what changed.

import type { Edge, Node } from '@xyflow/react';
import type { Annotation, Connection, Equipment, Id, NodeLayout, ProjectDoc, RouteLayout } from '../domain/types';
import { isBusVertical, placedSize } from '../layout/geometry';
import type { Decoration } from './lens';

export interface EquipmentData extends Record<string, unknown> {
  eq: Equipment;
  layout: NodeLayout;
  taps?: Record<string, number>;
  deco: Decoration;
}

export interface AnnotationData extends Record<string, unknown> {
  ann: Annotation;
  layout: NodeLayout;
}

export interface CableData extends Record<string, unknown> {
  conn: Connection;
  route?: RouteLayout;
  straight: boolean;
  grid: number;
  /** Bus axis at each end, used to point the route toward the other end. */
  sourceBus?: 'h' | 'v';
  targetBus?: 'h' | 'v';
  deco: Decoration;
  showTag: boolean;
}

export type EquipmentNode = Node<EquipmentData, 'equipment' | 'bus' | 'lineup'>;
export type AnnotationNode = Node<AnnotationData, 'note' | 'cloud'>;
export type CanvasNode = EquipmentNode | AnnotationNode;
export type CableEdge = Edge<CableData, 'cable'>;

interface CacheEntry<T> { deps: unknown[]; value: T }

function same(a: unknown[], b: unknown[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export class Memo<T> {
  private map = new Map<Id, CacheEntry<T>>();
  get(id: Id, deps: unknown[], make: () => T): T {
    const hit = this.map.get(id);
    if (hit && same(hit.deps, deps)) return hit.value;
    const value = make();
    this.map.set(id, { deps, value });
    return value;
  }
  prune(keep: Set<Id>) {
    for (const k of this.map.keys()) if (!keep.has(k)) this.map.delete(k);
  }
}

export interface Override { x?: number; y?: number; w?: number; h?: number }

export interface BuildInput {
  doc: ProjectDoc;
  sheetId: Id;
  selection: Set<Id>;
  decorations: Map<Id, Decoration>;
  overrides: Record<Id, Override>;
}

export function buildNodes(i: BuildInput, memo: Memo<CanvasNode>, decoMemo: Memo<Decoration>): CanvasNode[] {
  const out: CanvasNode[] = [];
  const keep = new Set<Id>();
  for (const e of Object.values(i.doc.equipment)) {
    if (e.sheetId !== i.sheetId) continue;
    const layout = i.doc.layout.nodes[e.id];
    if (!layout) continue;
    keep.add(e.id);
    const raw = i.decorations.get(e.id)!;
    const deco = decoMemo.get(e.id, [raw.key], () => raw);
    const taps = i.doc.layout.buses[e.id]?.taps;
    const selected = i.selection.has(e.id);
    const ov = i.overrides[e.id];
    out.push(
      memo.get(e.id, [e, layout, taps, deco, selected, ov], () => {
        const size = placedSize(e, layout);
        const type = e.type === 'bus' ? 'bus' : e.type === 'lineup' ? 'lineup' : 'equipment';
        return {
          id: e.id,
          type,
          position: { x: ov?.x ?? layout.x, y: ov?.y ?? layout.y },
          width: ov?.w ?? size.w,
          height: ov?.h ?? size.h,
          selected,
          zIndex: type === 'lineup' ? -1 : undefined,
          data: { eq: e, layout, taps, deco },
          ...(type === 'bus' ? { className: isBusVertical(layout) ? 'bus-v' : 'bus-h' } : {}),
        } as EquipmentNode;
      }),
    );
  }
  for (const a of Object.values(i.doc.annotations)) {
    if (a.sheetId !== i.sheetId) continue;
    const layout = i.doc.layout.nodes[a.id];
    if (!layout) continue;
    keep.add(a.id);
    const selected = i.selection.has(a.id);
    const ov = i.overrides[a.id];
    out.push(
      memo.get(a.id, [a, layout, selected, ov], () => ({
        id: a.id,
        type: a.kind,
        position: { x: ov?.x ?? layout.x, y: ov?.y ?? layout.y },
        width: ov?.w ?? layout.w ?? 200,
        height: ov?.h ?? layout.h ?? 60,
        selected,
        zIndex: a.kind === 'cloud' ? 5 : undefined,
        data: { ann: a, layout },
      }) as AnnotationNode),
    );
  }
  memo.prune(keep);
  decoMemo.prune(keep);
  return out;
}

export function buildEdges(
  i: BuildInput & { straight: boolean; grid: number; showTags: boolean },
  memo: Memo<CableEdge>,
  decoMemo: Memo<Decoration>,
): CableEdge[] {
  const out: CableEdge[] = [];
  const keep = new Set<Id>();
  const busAxis = (id: Id): 'h' | 'v' | undefined => {
    const e = i.doc.equipment[id];
    if (e?.type !== 'bus') return undefined;
    const n = i.doc.layout.nodes[id];
    return n && isBusVertical(n) ? 'v' : 'h';
  };
  for (const c of Object.values(i.doc.connections)) {
    if (c.sheetId !== i.sheetId) continue;
    const a = i.doc.equipment[c.from.equipmentId];
    const b = i.doc.equipment[c.to.equipmentId];
    if (!a || !b || a.sheetId !== i.sheetId || b.sheetId !== i.sheetId) continue;
    keep.add(c.id);
    const raw = i.decorations.get(c.id)!;
    const deco = decoMemo.get(c.id, [raw.key], () => raw);
    const route = i.doc.layout.routes[c.id];
    const selected = i.selection.has(c.id);
    const sb = busAxis(a.id);
    const tb = busAxis(b.id);
    out.push(
      memo.get(c.id, [c, route, deco, selected, i.straight, i.grid, sb, tb, i.showTags], () => ({
        id: c.id,
        type: 'cable',
        source: c.from.equipmentId,
        sourceHandle: c.from.terminalId,
        target: c.to.equipmentId,
        targetHandle: c.to.terminalId,
        selected,
        data: { conn: c, route, straight: i.straight, grid: i.grid, sourceBus: sb, targetBus: tb, deco, showTag: i.showTags },
      })),
    );
  }
  memo.prune(keep);
  decoMemo.prune(keep);
  return out;
}

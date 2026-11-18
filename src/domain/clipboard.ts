// Copy / paste / duplicate of a sub-graph with fresh ids and fresh tags.

import { CATALOG } from './catalog';
import { newId, nextTag } from './model';
import type { Annotation, BusLayout, Connection, Equipment, Id, NodeLayout, ProjectDoc, RouteLayout } from './types';

export interface Fragment {
  equipment: Equipment[];
  connections: Connection[];
  annotations: Annotation[];
  nodes: Record<Id, NodeLayout>;
  buses: Record<Id, BusLayout>;
  routes: Record<Id, RouteLayout>;
}

/** Selected objects plus connections whose both ends are selected. */
export function copyFragment(doc: ProjectDoc, ids: Iterable<Id>): Fragment {
  const set = new Set(ids);
  const equipment = Object.values(doc.equipment).filter((e) => set.has(e.id));
  const annotations = Object.values(doc.annotations).filter((a) => set.has(a.id));
  const eqIds = new Set(equipment.map((e) => e.id));
  const connections = Object.values(doc.connections).filter((c) => eqIds.has(c.from.equipmentId) && eqIds.has(c.to.equipmentId));
  const nodes: Fragment['nodes'] = {};
  const buses: Fragment['buses'] = {};
  const routes: Fragment['routes'] = {};
  for (const o of [...equipment, ...annotations]) { const n = doc.layout.nodes[o.id]; if (n) nodes[o.id] = n; }
  for (const e of equipment) { const b = doc.layout.buses[e.id]; if (b) buses[e.id] = b; }
  for (const c of connections) { const r = doc.layout.routes[c.id]; if (r) routes[c.id] = r; }
  return structuredClone({ equipment, connections, annotations, nodes, buses, routes });
}

export interface PasteResult {
  doc: ProjectDoc;
  newIds: Id[];
}

/** Paste a fragment into `sheetId`, shifted by (dx, dy), with new ids and tags. */
export function pasteFragment(doc: ProjectDoc, frag: Fragment, sheetId: Id, dx: number, dy: number): PasteResult {
  const map = new Map<Id, Id>();
  const taken = new Set<string>();
  const equipment = { ...doc.equipment };
  const connections = { ...doc.connections };
  const annotations = { ...doc.annotations };
  const nodes = { ...doc.layout.nodes };
  const buses = { ...doc.layout.buses };
  const routes = { ...doc.layout.routes };
  const newIds: Id[] = [];
  const shift = (n: NodeLayout): NodeLayout => ({ ...n, x: n.x + dx, y: n.y + dy });

  for (const e of frag.equipment) {
    const id = newId();
    map.set(e.id, id);
    const tag = nextTag({ equipment, connections }, CATALOG[e.type].tagPrefix, taken);
    taken.add(tag);
    equipment[id] = { ...structuredClone(e), id, sheetId, tag };
    const n = frag.nodes[e.id];
    if (n) nodes[id] = shift(n);
    const b = frag.buses[e.id];
    if (b) buses[id] = structuredClone(b);
    newIds.push(id);
  }
  for (const a of frag.annotations) {
    const id = newId();
    annotations[id] = { ...structuredClone(a), id, sheetId };
    const n = frag.nodes[a.id];
    if (n) nodes[id] = shift(n);
    newIds.push(id);
  }
  for (const c of frag.connections) {
    const from = map.get(c.from.equipmentId);
    const to = map.get(c.to.equipmentId);
    if (!from || !to) continue;
    const id = newId();
    const tag = nextTag({ equipment, connections }, c.kind === 'cable' ? 'C' : 'W', taken);
    taken.add(tag);
    connections[id] = { ...structuredClone(c), id, sheetId, tag, from: { ...c.from, equipmentId: from }, to: { ...c.to, equipmentId: to } };
    const r = frag.routes[c.id];
    if (r) routes[id] = { mode: r.mode, points: r.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
    newIds.push(id);
  }
  return { doc: { ...doc, equipment, connections, annotations, layout: { nodes, buses, routes } }, newIds };
}

// Topology queries over the project graph. Pure functions; no layout needed.
//
// Model: every power terminal is a vertex. Electrical nodes (equipotential sets) are found with
// union-find:
//   - a power connection joins its two terminals
//   - a CLOSED switching device joins its own terminals; an OPEN one does not
//   - a bus (and MCC / panelboard) joins all its terminals: one electrical node with dynamic taps
//   - a CT (zero-impedance, in-line) joins its power terminals
//   - tie / off-sheet connectors with the same link name are joined (across sheets)
// Passive devices (transformers, reactors, inverters) keep their terminals in separate nodes, but
// energy passes through them during a trace. Signal terminals and control wiring are ignored.

import { CATALOG } from './catalog';
import { terminalKind, terminalsOf } from './model';
import type { Connection, Equipment, Id, ProjectDoc } from './types';

type Graph = Pick<ProjectDoc, 'equipment' | 'connections'>;

const key = (equipmentId: Id, terminalId: string) => `${equipmentId}\u0000${terminalId}`;

class UnionFind {
  private parent = new Map<string, string>();
  add(a: string) { if (!this.parent.has(a)) this.parent.set(a, a); }
  find(a: string): string {
    let p = this.parent.get(a);
    if (p === undefined) { this.parent.set(a, a); return a; }
    let root = a;
    while (p !== root) { root = p; p = this.parent.get(root)!; }
    // path compression
    let cur = a;
    while (cur !== root) { const next = this.parent.get(cur)!; this.parent.set(cur, root); cur = next; }
    return root;
  }
  union(a: string, b: string) { const ra = this.find(a); const rb = this.find(b); if (ra !== rb) this.parent.set(ra, rb); }
}

function powerTerminals(e: Equipment): string[] {
  return terminalsOf(e).filter((t) => terminalKind(e, t.id) === 'power').map((t) => t.id);
}

export function isConducting(e: Equipment): boolean {
  const b = CATALOG[e.type].behavior;
  if (b === 'switch') return e.state !== 'open';
  return true;
}

export interface ElectricalNodes {
  /** terminal key -> node id */
  nodeOf(equipmentId: Id, terminalId: string): string;
  /** node id -> attached terminals */
  members: Map<string, { equipmentId: Id; terminalId: string }[]>;
}

export interface NodeOptions {
  /** Cables for which this returns true are NOT joined (the study reduction keeps them as branches). */
  keepApart?: (c: Connection) => boolean;
}

export function electricalNodes(g: Graph, opts: NodeOptions = {}): ElectricalNodes {
  const uf = new UnionFind();
  const ties = new Map<string, string>();
  for (const e of Object.values(g.equipment)) {
    const terms = powerTerminals(e);
    for (const t of terms) uf.add(key(e.id, t));
    const b = CATALOG[e.type].behavior;
    const joinAll = b === 'bus' || b === 'through' || (b === 'switch' && e.state !== 'open');
    if (joinAll) for (let i = 1; i < terms.length; i++) uf.union(key(e.id, terms[0]!), key(e.id, terms[i]!));
    if (b === 'tie') {
      const link = String(e.props['concept.link'] ?? '').trim().toLowerCase();
      if (link && terms[0]) {
        const k = key(e.id, terms[0]);
        const other = ties.get(link);
        if (other) uf.union(k, other); else ties.set(link, k);
      }
    }
  }
  for (const c of Object.values(g.connections)) {
    if (c.kind !== 'cable') continue;
    if (opts.keepApart?.(c)) continue;
    const a = g.equipment[c.from.equipmentId];
    const b = g.equipment[c.to.equipmentId];
    if (!a || !b) continue;
    if (terminalKind(a, c.from.terminalId) !== 'power' || terminalKind(b, c.to.terminalId) !== 'power') continue;
    uf.union(key(a.id, c.from.terminalId), key(b.id, c.to.terminalId));
  }
  const members = new Map<string, { equipmentId: Id; terminalId: string }[]>();
  for (const e of Object.values(g.equipment)) {
    for (const t of powerTerminals(e)) {
      const n = uf.find(key(e.id, t));
      let list = members.get(n);
      if (!list) members.set(n, (list = []));
      list.push({ equipmentId: e.id, terminalId: t });
    }
  }
  return { nodeOf: (eq, t) => uf.find(key(eq, t)), members };
}

export interface TraceResult {
  /** Equipment reached by energy (includes open devices on the boundary). */
  energized: Set<Id>;
  /** Cables carrying energy. */
  connections: Set<Id>;
  /** Open switching devices reached from the energized side. */
  boundary: Set<Id>;
}

/**
 * Energization trace from one or more starting devices. Energy spreads through electrical nodes,
 * through closed switches, buses and CTs, and through passive devices (transformers etc.).
 * Open switching devices stop the trace and are reported as the boundary.
 */
export function trace(g: Graph, startIds: Id[]): TraceResult {
  const nodes = electricalNodes(g);
  const energized = new Set<Id>();
  const boundary = new Set<Id>();
  const liveNodes = new Set<string>();
  const queue: Id[] = [];
  const visit = (id: Id) => { if (!energized.has(id)) { energized.add(id); queue.push(id); } };
  for (const id of startIds) if (g.equipment[id]) visit(id);

  while (queue.length) {
    const e = g.equipment[queue.shift()!]!;
    if (!isConducting(e)) {
      // Reached but open: energized on one side only. It stops the trace.
      boundary.add(e.id);
      continue;
    }
    for (const t of powerTerminals(e)) {
      const n = nodes.nodeOf(e.id, t);
      if (liveNodes.has(n)) continue;
      liveNodes.add(n);
      for (const m of nodes.members.get(n) ?? []) visit(m.equipmentId);
    }
  }

  const connections = new Set<Id>();
  for (const c of Object.values(g.connections)) {
    if (c.kind !== 'cable') continue;
    if (!g.equipment[c.from.equipmentId] || !g.equipment[c.to.equipmentId]) continue;
    if (liveNodes.has(nodes.nodeOf(c.from.equipmentId, c.from.terminalId))) connections.add(c.id);
  }
  return { energized, connections, boundary };
}

export function sourceIds(g: Graph): Id[] {
  return Object.values(g.equipment).filter((e) => CATALOG[e.type].behavior === 'source').map((e) => e.id);
}

/** Everything energized from all sources (used by the Operations lens). */
export function energizedFromSources(g: Graph): TraceResult {
  return trace(g, sourceIds(g));
}

/** Sources that energize `id` (upstream sources). */
export function upstreamSources(g: Graph, id: Id): Id[] {
  return sourceIds(g).filter((s) => trace(g, [s]).energized.has(id));
}

/** Everything energized from `id` through closed devices (its downstream when `id` is a source or feeder device). */
export function downstream(g: Graph, id: Id): Set<Id> {
  return trace(g, [id]).energized;
}

/**
 * Connected components of the whole graph, ignoring switch state (an open breaker does not split
 * a component). Control wiring is ignored. Returns arrays of equipment ids.
 */
export function connectedComponents(g: Graph): Id[][] {
  const uf = new UnionFind();
  for (const e of Object.values(g.equipment)) uf.add(e.id);
  for (const c of Object.values(g.connections)) {
    if (c.kind !== 'cable') continue;
    if (g.equipment[c.from.equipmentId] && g.equipment[c.to.equipmentId]) uf.union(c.from.equipmentId, c.to.equipmentId);
  }
  const ties = new Map<string, Id>();
  for (const e of Object.values(g.equipment)) {
    if (e.type !== 'tie') continue;
    const link = String(e.props['concept.link'] ?? '').trim().toLowerCase();
    if (!link) continue;
    const other = ties.get(link);
    if (other) uf.union(e.id, other); else ties.set(link, e.id);
  }
  const groups = new Map<string, Id[]>();
  for (const e of Object.values(g.equipment)) {
    const r = uf.find(e.id);
    let list = groups.get(r);
    if (!list) groups.set(r, (list = []));
    list.push(e.id);
  }
  return [...groups.values()];
}

/** Connections touching an equipment item, with the terminal on this side. */
export function connectionsOf(g: Graph, id: Id) {
  return Object.values(g.connections).filter((c) => c.from.equipmentId === id || c.to.equipmentId === id);
}

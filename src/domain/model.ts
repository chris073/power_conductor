// Constructors and small pure helpers for the domain model.

import { CATALOG, SWITCHING, type TerminalDef, typeDef } from './catalog';
import { schemaFor, CABLE_SCHEMA, CONTROL_SCHEMA, type FieldDef } from './schemas';
import type { Connection, Equipment, EquipmentType, Id, Phase, ProjectDoc, PropValue, Terminal } from './types';

export const SCHEMA_VERSION = 1;

export function newId(): Id {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function createProject(name = 'Untitled project'): ProjectDoc {
  const sheetId = newId();
  const t = nowIso();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId(),
    name,
    createdAt: t,
    updatedAt: t,
    sheets: [{ id: sheetId, name: 'Sheet 1' }],
    equipment: {},
    connections: {},
    annotations: {},
    layout: { nodes: {}, buses: {}, routes: {} },
  };
}

/** Next free tag for a prefix: CB-1, CB-2, ... Tags are labels, never keys. */
export function nextTag(doc: Pick<ProjectDoc, 'equipment' | 'connections'>, prefix: string, taken: Set<string> = new Set()): string {
  const used = new Set<string>(taken);
  for (const e of Object.values(doc.equipment)) used.add(e.tag);
  for (const c of Object.values(doc.connections)) used.add(c.tag);
  let max = 0;
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`);
  for (const t of used) {
    const m = re.exec(t);
    if (m) max = Math.max(max, Number(m[1]));
  }
  let n = max + 1;
  while (used.has(`${prefix}-${n}`)) n++;
  return `${prefix}-${n}`;
}

export function createEquipment(doc: ProjectDoc, type: EquipmentType, sheetId: Id): Equipment {
  const def = typeDef(type);
  const e: Equipment = {
    id: newId(),
    type,
    sheetId,
    tag: nextTag(doc, def.tagPrefix),
    props: {},
    custom: [],
    labelFields: [...def.defaultLabel],
  };
  if (SWITCHING.has(type)) e.state = 'closed';
  if (type === 'bus') e.taps = [];
  if (type === 'relay') e.props['design.functions'] = '50/51';
  if (type === 'breaker') e.props['design.mounting'] = 'Draw-out';
  if (type === 'xfmr2' || type === 'xfmr3') {
    e.props['design.hvWinding'] = 'Δ';
    e.props['design.lvWinding'] = 'Yg';
    if (type === 'xfmr3') e.props['design.tvWinding'] = 'Δ';
  }
  return e;
}

/** All terminals of an equipment instance: catalog terminals plus bus taps. */
export function terminalsOf(e: Equipment): Terminal[] {
  if (e.type === 'bus') return e.taps ?? [];
  return CATALOG[e.type].terminals.map((t) => ({ id: t.id, label: t.label }));
}

export function terminalDef(type: EquipmentType, terminalId: string): TerminalDef | undefined {
  return CATALOG[type].terminals.find((t) => t.id === terminalId);
}

/** Bus taps are power terminals; catalog terminals carry their own kind. */
export function terminalKind(e: Equipment, terminalId: string): 'power' | 'signal' | undefined {
  if (e.type === 'bus') return e.taps?.some((t) => t.id === terminalId) ? 'power' : undefined;
  return terminalDef(e.type, terminalId)?.kind;
}

export function createConnection(doc: ProjectDoc, sheetId: Id, from: { equipmentId: Id; terminalId: string }, to: { equipmentId: Id; terminalId: string }): Connection | null {
  if (from.equipmentId === to.equipmentId) return null;
  const a = doc.equipment[from.equipmentId];
  const b = doc.equipment[to.equipmentId];
  if (!a || !b) return null;
  const ka = terminalKind(a, from.terminalId);
  const kb = terminalKind(b, to.terminalId);
  if (!ka || !kb) return null;
  const kind = ka === 'signal' || kb === 'signal' ? 'control' : 'cable';
  // One connection per terminal pair.
  for (const c of Object.values(doc.connections)) {
    const same = (x: typeof from, y: typeof from) => x.equipmentId === y.equipmentId && x.terminalId === y.terminalId;
    if ((same(c.from, from) && same(c.to, to)) || (same(c.from, to) && same(c.to, from))) return null;
  }
  return {
    id: newId(),
    sheetId,
    kind,
    tag: nextTag(doc, kind === 'cable' ? 'C' : 'W'),
    from,
    to,
    props: {},
    custom: [],
  };
}

export function schemaForObject(o: Equipment | Connection): FieldDef[] {
  if ('type' in o) return schemaFor(o.type);
  return o.kind === 'cable' ? CABLE_SCHEMA : CONTROL_SCHEMA;
}

export function isEmpty(v: PropValue | undefined): boolean {
  return v === undefined || v === null || v === '' || (typeof v === 'number' && Number.isNaN(v));
}

/** Required fields for `phase` that are empty. */
export function missingRequired(o: Equipment | Connection, phase: Phase): FieldDef[] {
  return schemaForObject(o).filter((f) => f.requiredIn?.includes(phase) && isEmpty(o.props[f.key]));
}

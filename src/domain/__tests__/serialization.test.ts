import { describe, expect, it } from 'vitest';
import { copyFragment, pasteFragment } from '../clipboard';
import { SCHEMA_VERSION, createConnection, missingRequired, nextTag } from '../model';
import { migrate } from '../serialization/migrations';
import { parseProject, serializeProject } from '../serialization/projectFile';
import { trace } from '../topology';
import { referenceOneLine } from './helpers';

describe('project file', () => {
  it('round-trips exactly', () => {
    const { doc } = referenceOneLine();
    doc.layout.nodes[Object.keys(doc.equipment)[0]!] = { x: 20, y: 40, rot: 90, flip: true };
    const text = serializeProject(doc);
    const back = parseProject(text);
    expect(back).toEqual(doc);
    expect(serializeProject(back)).toBe(text);
  });

  it('accepts a bare ProjectDoc', () => {
    const { doc } = referenceOneLine();
    expect(parseProject(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  });

  it('writes format and schemaVersion', () => {
    const { doc } = referenceOneLine();
    const f = JSON.parse(serializeProject(doc));
    expect(f.format).toBe('conductor-project');
    expect(f.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('rejects junk and newer schema versions', () => {
    expect(() => parseProject('{"hello":1}')).toThrow(/Not a Conductor/);
    const { doc } = referenceOneLine();
    expect(() => parseProject({ ...doc, schemaVersion: SCHEMA_VERSION + 1 })).toThrow(/newer/);
    expect(() => parseProject({ ...doc, sheets: [] })).toThrow(/sheets/);
  });

  it('runs migrations in order', () => {
    const registry = {
      0: (d: Record<string, unknown>) => ({ ...d, a: 1 }),
      1: (d: Record<string, unknown>) => ({ ...d, b: (d.a as number) + 1 }),
    };
    const out = migrate({ schemaVersion: 0 }, 2, registry);
    expect(out).toEqual({ schemaVersion: 2, a: 1, b: 2 });
    expect(() => migrate({ schemaVersion: 0 }, 3, registry)).toThrow(/No migration/);
  });

  it('migrates an old file through a registry to the current shape', () => {
    const { doc } = referenceOneLine();
    // Pretend schema 0 had no annotations map.
    const { annotations: _drop, ...old } = doc;
    const parsed = parseProject({ ...old, schemaVersion: SCHEMA_VERSION - 1 }, { [SCHEMA_VERSION - 1]: (d) => ({ ...d, annotations: {} }) });
    expect(parsed.annotations).toEqual({});
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe('ids, tags and copy/paste', () => {
  it('next tag skips used numbers', () => {
    const { doc } = referenceOneLine();
    expect(nextTag(doc, 'CB')).toBe('CB-1');
    expect(nextTag({ equipment: { a: { tag: 'CB-4' } as never }, connections: {} }, 'CB')).toBe('CB-5');
  });

  it('paste gives new ids and tags and keeps the topology', () => {
    const { doc, ids } = referenceOneLine();
    const frag = copyFragment(doc, [ids.fm, ids.motor]);
    expect(frag.connections.length).toBe(1);
    const { doc: next, newIds } = pasteFragment(doc, frag, doc.sheets[0]!.id, 40, 0);
    expect(newIds.length).toBe(3);
    for (const id of newIds) expect(doc.equipment[id] ?? doc.connections[id]).toBeUndefined();
    const newBreaker = newIds.find((id) => next.equipment[id]?.type === 'breaker')!;
    const newMotor = newIds.find((id) => next.equipment[id]?.type === 'motor')!;
    expect(next.equipment[newBreaker]!.tag).not.toBe(doc.equipment[ids.fm]!.tag);
    expect(trace(next, [newBreaker]).energized.has(newMotor)).toBe(true);
  });

  it('refuses duplicate and self connections', () => {
    const { doc, ids } = referenceOneLine();
    const s = doc.sheets[0]!.id;
    expect(createConnection(doc, s, { equipmentId: ids.fm, terminalId: '2' }, { equipmentId: ids.motor, terminalId: 'T' })).toBeNull();
    expect(createConnection(doc, s, { equipmentId: ids.fm, terminalId: '1' }, { equipmentId: ids.fm, terminalId: '2' })).toBeNull();
  });

  it('control wiring is typed from signal terminals', () => {
    const { doc, ids } = referenceOneLine();
    const c = Object.values(doc.connections).find((x) => x.to.equipmentId === ids.relay)!;
    expect(c.kind).toBe('control');
  });

  it('finds missing required fields by phase', () => {
    const { doc, ids } = referenceOneLine();
    const t1 = doc.equipment[ids.t1]!;
    expect(missingRequired(t1, 'concept').map((f) => f.key)).toEqual(['concept.kva']);
    t1.props['concept.kva'] = 2500;
    expect(missingRequired(t1, 'concept')).toEqual([]);
  });
});

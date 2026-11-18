import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '../model';
import { parseProject } from '../serialization/projectFile';

const fixture = readFileSync(new URL('./fixtures/v1-project.json', import.meta.url), 'utf8');

describe('migration 1 → 2 (study export)', () => {
  const doc = parseProject(fixture);

  it('reaches the current schema with default study settings', () => {
    expect(doc.schemaVersion).toBe(SCHEMA_VERSION);
    expect(doc.study).toEqual({ baseMva: 100, freqHz: 60, rawVersion: 33, collapseFt: 10, collapseOhm: 0, busNumbers: {} });
    expect(doc.studyResults).toBeNull();
  });

  it('turns kvRatio text into numeric winding voltages', () => {
    const t1 = doc.equipment.t1!;
    expect(t1.props['design.kvRatio']).toBeUndefined();
    expect(t1.props['design.hvKv']).toBe(13.8);
    expect(t1.props['design.lvKv']).toBe(0.48);
    expect(t1.props['design.z']).toBe(5.75);
    expect(t1.labelFields).toEqual(['concept.kva', 'design.hvKv']);
    expect(doc.equipment.t2!.props['design.hvKv']).toBeCloseTo(4.16);
    expect(doc.equipment.t2!.props['design.lvKv']).toBeCloseTo(0.48);
    const t3 = doc.equipment.t3!;
    expect([t3.props['design.hvKv'], t3.props['design.lvKv'], t3.props['design.tvKv']]).toEqual([138, 34.5, 13.8]);
  });

  it('keeps unparseable ratios as a custom property', () => {
    const t4 = doc.equipment.t4!;
    expect(t4.props['design.hvKv']).toBeUndefined();
    expect(t4.custom.map((c) => [c.key, c.value])).toEqual([['Voltage ratio (old)', 'see vendor data']]);
  });

  it('leaves other equipment alone', () => {
    expect(doc.equipment.b1!.props).toEqual({ 'concept.kv': 13.8 });
  });
});

// Results import: the real ANDES 2.0.0 power-flow solution of the sample substation
// (fixtures/sample.pf.json, written by `npm run study:check`) mapped back onto objects.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildStudyCase, importAndesResults, parseAndesPf, persistBusNumbers } from '../../domain/study';
import { buildSampleProject } from '../sample';

const text = readFileSync(new URL('./fixtures/sample.pf.json', import.meta.url), 'utf8');

function sample() {
  const doc = buildSampleProject();
  return persistBusNumbers(doc, buildStudyCase(doc));
}

describe('ANDES results import', () => {
  const doc = sample();
  const tag = (t: string) => Object.values(doc.equipment).find((e) => e.tag === t)!.id;
  const cable = (to: string) => Object.values(doc.connections).find((c) => c.to.equipmentId === tag(to))!.id;
  const { results, warnings } = importAndesResults(doc, parseAndesPf(text), '2026-11-17T12:00:00.000Z');

  it('maps every bus and branch without warnings', () => {
    expect(warnings).toEqual([]);
    expect(results.converged).toBe(true);
    expect(results.at).toBe('2026-11-17T12:00:00.000Z');
    expect(results.source).toMatch(/^ANDES 2\.0\.0 power flow, solved /);
    expect(Object.keys(results.buses)).toHaveLength(7);
  });

  it('puts bus voltages on drawn buses, or on the elements of buses with no drawn bus', () => {
    expect(results.objects[tag('MV-BUS')]!.vm).toBeCloseTo(1.0035, 4);
    expect(results.objects[tag('LV-BUS')]!.va).toBeCloseTo(-28.889, 3);
    expect(results.objects[tag('UTIL-1')]!.vm).toBeCloseTo(1, 6);
    expect(results.objects[tag('MTR-1')]!.vm).toBeCloseTo(0.9889, 4);
  });

  it('puts branch flows on cables, lines and transformers', () => {
    // The motor feeder delivers the motor's 160.4 kW / 99.4 kvar.
    const m = results.objects[cable('MTR-1')]!;
    expect(m.pTo).toBeCloseTo(-0.1604, 4);
    expect(m.qTo).toBeCloseTo(-0.0994, 4);
    // The PV inverter feeder carries 0.75 MW at its -0.264 Mvar limit.
    expect(results.objects[cable('INV-1')]!.pTo).toBeCloseTo(0.75, 6);
    expect(results.objects[cable('INV-1')]!.qTo).toBeCloseTo(-0.264, 6);
    // The overhead line exports about 1.03 MW to the utility.
    expect(results.objects[tag('OHL-1')]!.pFrom).toBeCloseTo(-1.026, 3);
    expect(results.objects[tag('T2')]!.pFrom).toBeLessThan(0);
  });

  it('skips results that no longer match the one-line', () => {
    const pf = parseAndesPf(text);
    pf.branches[0] = { ...pf.branches[0]!, from: 99 };
    const r = importAndesResults(doc, pf);
    expect(r.warnings.join(' ')).toMatch(/1 branch result/);
    expect(r.results.objects[tag('OHL-1')]?.pFrom).toBeUndefined();
    expect(() => parseAndesPf('{"hello":1}')).toThrow(/Not an ANDES result/);
  });
});

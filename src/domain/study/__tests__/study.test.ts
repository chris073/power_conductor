import { describe, expect, it } from 'vitest';
import { referenceOneLine } from '../../__tests__/helpers';
import { buildStudyCase } from '../build';
import { connectionCode2, connectionCode3 } from '../seq';
import { applyTypicals, persistBusNumbers } from '../persist';
import { branchPu, shuntMvarAtBase, sourceZ0, splitZ, theveninOnOwnBase, xfmrZ, zBase } from '../perunit';

/** The reference one-line with enough data to solve: 13.8 kV utility, 2.5 MVA 13.8/0.48 kV transformers. */
function ready() {
  const r = referenceOneLine();
  const { doc, ids } = r;
  const set = (id: string, p: Record<string, number | string>) => Object.assign(doc.equipment[id]!.props, p);
  set(ids.util, { 'design.kv': 13.8, 'design.scMva': 500, 'design.xr': 15 });
  for (const t of [ids.t1, ids.t2]) set(t, { 'concept.kva': 2500, 'design.hvKv': 13.8, 'design.lvKv': 0.48, 'design.z': 5.75, 'design.xr': 7 });
  set(ids.motor, { 'concept.hp': 200 });
  set(ids.load, { 'concept.kw': 150 });
  return r;
}

const codes = (sc: ReturnType<typeof buildStudyCase>, sev?: string) => sc.issues.filter((i) => !sev || i.severity === sev).map((i) => i.code);

describe('node-breaker → bus-branch reduction', () => {
  it('merges a bus and its closed breakers into one study bus', () => {
    const { doc, ids } = ready();
    const sc = buildStudyCase(doc);
    expect(sc.buses).toHaveLength(2);
    const mv = sc.buses.find((b) => b.memberIds.includes(ids.mv))!;
    for (const id of [ids.util, ids.ct, ids.main, ids.f1, ids.f2, ids.t1, ids.t2]) expect(mv.memberIds).toContain(id);
    expect(mv.memberIds).not.toContain(ids.relay);
    const lv = sc.buses.find((b) => b.memberIds.includes(ids.lv))!;
    for (const id of [ids.lvMain1, ids.lvMain2, ids.fm, ids.fl, ids.motor, ids.load]) expect(lv.memberIds).toContain(id);
    expect(sc.xfmr2).toHaveLength(2);
    expect(sc.branches).toHaveLength(0);
    expect(mv.ide).toBe(3);
    expect(lv.ide).toBe(1);
    expect(codes(sc, 'error')).toEqual([]);
  });

  it('splits buses at an open breaker', () => {
    const { doc, ids } = ready();
    doc.equipment[ids.lvMain2]!.state = 'open';
    const sc = buildStudyCase(doc);
    expect(sc.buses).toHaveLength(3);
    const t2lv = sc.buses.find((b) => b.memberIds.includes(ids.t2) && !b.memberIds.includes(ids.mv))!;
    expect(t2lv.memberIds).toContain(ids.lvMain2);
    expect(t2lv.memberIds).not.toContain(ids.lv);
  });

  it('isolates a load behind an open feeder breaker and reports the island', () => {
    const { doc, ids } = ready();
    doc.equipment[ids.fm]!.state = 'open';
    const sc = buildStudyCase(doc);
    const motorBus = sc.buses.find((b) => b.memberIds.includes(ids.motor))!;
    expect(motorBus.ide).toBe(4);
    expect(sc.loads.find((l) => l.objectId === ids.motor)!.status).toBe(0);
    const issue = sc.issues.find((i) => i.code === 'island-no-swing')!;
    expect(issue.severity).toBe('error');
    expect(issue.objectId).toBeDefined();
  });

  it('keeps a cable with a length as a branch, and merges short ones', () => {
    const { doc, ids } = ready();
    const cable = Object.values(doc.connections).find((c) => c.to.equipmentId === ids.motor)!;
    Object.assign(cable.props, { 'concept.lengthFt': 180, 'design.size': '250 kcmil' });
    let sc = buildStudyCase(doc);
    expect(sc.buses).toHaveLength(3);
    const br = sc.branches[0]!;
    expect(br.objectId).toBe(cable.id);
    // 250 kcmil Cu: 0.052 Ω/kft · 0.18 kft = 0.00936 Ω on Zb = 0.48²/100 = 0.002304 Ω.
    expect(br.r).toBeCloseTo(0.00936 / 0.002304, 4);
    doc.study.collapseFt = 200;
    sc = buildStudyCase(doc);
    expect(sc.branches).toHaveLength(0);
    expect(sc.buses).toHaveLength(2);
  });
});

describe('base kV', () => {
  it('propagates through transformer winding voltages', () => {
    const { doc, ids } = ready();
    const sc = buildStudyCase(doc);
    expect(sc.buses.find((b) => b.memberIds.includes(ids.mv))!.baseKv).toBe(13.8);
    expect(sc.buses.find((b) => b.memberIds.includes(ids.lv))!.baseKv).toBe(0.48);
  });

  it('flags two different strong seeds in one voltage zone', () => {
    const { doc, ids } = ready();
    doc.equipment[ids.mv]!.props['concept.kv'] = 13.8;
    doc.equipment[ids.util]!.props['design.kv'] = 12.47;
    const sc = buildStudyCase(doc);
    const c = sc.issues.find((i) => i.code === 'basekv-conflict')!;
    expect(c.severity).toBe('error');
    expect(c.objectId).toBe(ids.util);
  });

  it('flags a transformer winding far from its bus base and reports missing base kV', () => {
    const { doc, ids } = ready();
    doc.equipment[ids.lv]!.props['concept.kv'] = 4.16;
    let sc = buildStudyCase(doc);
    expect(sc.issues.filter((i) => i.code === 'xfmr-kv-mismatch').map((i) => i.objectId).sort()).toEqual([ids.t1, ids.t2].sort());
    delete doc.equipment[ids.util]!.props['design.kv'];
    delete doc.equipment[ids.lv]!.props['concept.kv'];
    for (const t of [ids.t1, ids.t2]) {
      delete doc.equipment[t]!.props['design.hvKv'];
      delete doc.equipment[t]!.props['design.lvKv'];
    }
    sc = buildStudyCase(doc);
    expect(codes(sc, 'error')).toContain('missing-basekv');
  });
});

describe('per unit', () => {
  it('converts transformer %Z on its rating to the system base (hand-checked)', () => {
    // 5.75 % on 2.5 MVA → 0.0575 · 100/2.5 = 2.3 pu; X/R 7 → R = 2.3/√50 = 0.32527, X = 2.27688.
    const z = xfmrZ({ zPct: 5.75, xr: 7, mvaBase: 2.5, sbase: 100 });
    expect(z.r).toBeCloseTo(0.32527, 5);
    expect(z.x).toBeCloseTo(2.27688, 5);
    // A 0.46 kV winding on a 0.48 kV bus: × (0.46/0.48)².
    expect(xfmrZ({ zPct: 5.75, xr: 7, mvaBase: 2.5, sbase: 100, ratedKv: 0.46, baseKv: 0.48 }).x).toBeCloseTo(2.27688 * (0.46 / 0.48) ** 2, 5);
  });

  it('converts cables and lines per length (hand-checked)', () => {
    expect(zBase(13.8, 100)).toBeCloseTo(1.9044, 6);
    // 2/0 Cu 300 ft at 13.8 kV: R = 0.1 · 0.3 = 0.03 Ω → 0.015753 pu; B = 27 µS · 0.3 · 1.9044 = 1.5426e-5 pu.
    const c = branchPu({ r: 0.1, x: 0.0516, bUs: 27, length: 300, unitLength: 1000, kv: 13.8, sbase: 100 });
    expect(c.r).toBeCloseTo(0.015753, 6);
    expect(c.b).toBeCloseTo(1.5426e-5, 8);
    // Four parallel sets quarter R and X.
    expect(branchPu({ r: 0.027, x: 0.039, bUs: 0, length: 100, unitLength: 1000, sets: 4, kv: 0.48, sbase: 100 }).r).toBeCloseTo(0.0027 / 4 / 0.002304, 5);
    // Linnet 2 mi: 0.306 · 2 = 0.612 Ω → 0.321361 pu.
    expect(branchPu({ r: 0.306, x: 0, bUs: 0, length: 2, unitLength: 1, kv: 13.8, sbase: 100 }).r).toBeCloseTo(0.321361, 6);
  });

  it('builds source impedances and shunt ratings', () => {
    const z = theveninOnOwnBase(15);
    expect(Math.hypot(z.r, z.x)).toBeCloseTo(1, 9);
    expect(z.x / z.r).toBeCloseTo(15, 9);
    // 500 MVA 3φ, 400 MVA SLG on 100 MVA: Z1 = 0.2, Z0 = 3·100/400 − 0.4 = 0.35.
    const z0 = sourceZ0({ scMva: 500, slgMva: 400, xr: 15, sbase: 100 });
    expect(Math.hypot(z0.r, z0.x)).toBeCloseTo(0.35, 9);
    expect(splitZ(1, 0)).toEqual({ r: 1, x: 0 });
    // 600 kvar rated at 14.4 kV on a 13.8 kV bus: 0.6 · (13.8/14.4)² = 0.55104 Mvar.
    expect(shuntMvarAtBase(0.6, 14.4, 13.8)).toBeCloseTo(0.55104, 5);
  });
});

describe('bus numbers and typicals', () => {
  it('assigns numbers once and keeps them across exports and edits', () => {
    const { doc, ids } = ready();
    const sc1 = buildStudyCase(doc);
    expect(sc1.newNumbers).toHaveLength(2);
    const saved = persistBusNumbers(doc, sc1);
    expect(saved.equipment[ids.mv]!.props['design.busNum']).toBeTypeOf('number');
    const sc2 = buildStudyCase(saved);
    expect(sc2.newNumbers).toHaveLength(0);
    expect(sc2.buses.map((b) => b.number)).toEqual(sc1.buses.map((b) => b.number));
    // Opening a breaker creates a new bus; the old ones keep their numbers.
    saved.equipment[ids.lvMain2]!.state = 'open';
    const sc3 = buildStudyCase(saved);
    const n = (sc: typeof sc1, id: string) => sc.buses.find((b) => b.memberIds.includes(id))!.number;
    expect(n(sc3, ids.mv)).toBe(n(sc1, ids.mv));
    expect(n(sc3, ids.lv)).toBe(n(sc1, ids.lv));
    expect(sc3.newNumbers).toHaveLength(1);
  });

  it('respects entered numbers and reports duplicates', () => {
    const { doc, ids } = ready();
    doc.equipment[ids.mv]!.props['design.busNum'] = 101;
    doc.equipment[ids.lv]!.props['design.busNum'] = 101;
    const sc = buildStudyCase(doc);
    expect(codes(sc, 'error')).toContain('bus-number-duplicate');
    expect(new Set(sc.buses.map((b) => b.number)).size).toBe(2);
    expect(sc.buses.map((b) => b.number)).toContain(101);
  });

  it('fills, lists and applies typicals; zero impedance is an error', () => {
    const { doc, ids } = ready();
    delete doc.equipment[ids.t2]!.props['design.z'];
    delete doc.equipment[ids.t2]!.props['design.xr'];
    const sc = buildStudyCase(doc);
    const t2 = sc.typicals.filter((t) => t.objectId === ids.t2).map((t) => t.key);
    expect(t2).toEqual(expect.arrayContaining(['design.z', 'design.xr']));
    expect(sc.issues.some((i) => i.code === 'typical' && i.objectId === ids.t2)).toBe(true);
    const applied = applyTypicals(doc, sc);
    expect(applied.equipment[ids.t2]!.props['design.z']).toBe(5.75);
    expect(applied.equipment[ids.t2]!.typical).toEqual(expect.arrayContaining(['design.z', 'design.xr']));

    const cable = Object.values(doc.connections).find((c) => c.to.equipmentId === ids.load)!;
    cable.props['concept.lengthFt'] = 50;
    const sc2 = buildStudyCase(doc);
    expect(sc2.issues.find((i) => i.code === 'zero-impedance')!.objectId).toBe(cable.id);
    expect(sc2.issues.find((i) => i.code === 'missing-pf' && i.objectId === cable.id)).toBeDefined();
  });
});

describe('sequence data', () => {
  it('maps winding connections to PSS/E connection codes', () => {
    expect(connectionCode2('Yg', 'Yg')).toBe(1);
    expect(connectionCode2('Yg', 'Δ')).toBe(2);
    expect(connectionCode2('Δ', 'Yg')).toBe(3);
    expect(connectionCode2('Δ', 'Δ')).toBe(4);
    expect(connectionCode2('Y', 'Yg')).toBe(4);
    expect(connectionCode3(['Yg', 'Yg', 'Δ'])).toBe(2);
    expect(connectionCode3(['Yg', 'Yg', 'Yg'])).toBe(1);
  });
});

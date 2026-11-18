import { describe, expect, it } from 'vitest';
import { connectedComponents, electricalNodes, energizedFromSources, trace, upstreamSources } from '../topology';
import { builder, referenceOneLine } from './helpers';

describe('electrical nodes', () => {
  it('treats a bus as one node with any number of taps', () => {
    const { doc, ids } = referenceOneLine();
    const n = electricalNodes(doc);
    const mv = doc.equipment[ids.mv]!;
    const nodes = new Set(mv.taps!.map((t) => n.nodeOf(mv.id, t.id)));
    expect(mv.taps!.length).toBe(3);
    expect(nodes.size).toBe(1);
  });

  it('joins terminals of a closed breaker and splits an open one', () => {
    const { doc, ids } = referenceOneLine();
    expect(electricalNodes(doc).nodeOf(ids.main, '1')).toBe(electricalNodes(doc).nodeOf(ids.main, '2'));
    doc.equipment[ids.main]!.state = 'open';
    const n = electricalNodes(doc);
    expect(n.nodeOf(ids.main, '1')).not.toBe(n.nodeOf(ids.main, '2'));
  });

  it('keeps transformer windings in separate nodes', () => {
    const { doc, ids } = referenceOneLine();
    const n = electricalNodes(doc);
    expect(n.nodeOf(ids.t1, 'H1')).not.toBe(n.nodeOf(ids.t1, 'X1'));
  });

  it('CT is zero impedance in-line; its secondary is not part of the power graph', () => {
    const { doc, ids } = referenceOneLine();
    const n = electricalNodes(doc);
    expect(n.nodeOf(ids.ct, 'P1')).toBe(n.nodeOf(ids.util, 'T'));
    expect(n.nodeOf(ids.ct, 'P2')).toBe(n.nodeOf(ids.main, '1'));
  });
});

describe('trace', () => {
  it('energizes everything downstream through closed devices and transformers', () => {
    const { doc, ids } = referenceOneLine();
    const r = trace(doc, [ids.util]);
    for (const id of [ids.main, ids.mv, ids.t1, ids.t2, ids.lv, ids.motor, ids.load]) expect(r.energized.has(id)).toBe(true);
    expect(r.boundary.size).toBe(0);
    expect(r.energized.has(ids.relay)).toBe(false); // control wiring is not a power path
  });

  it('stops at an open breaker and reports it as the boundary', () => {
    const { doc, ids } = referenceOneLine();
    doc.equipment[ids.main]!.state = 'open';
    const r = trace(doc, [ids.util]);
    expect(r.energized.has(ids.ct)).toBe(true);
    expect(r.boundary).toEqual(new Set([ids.main]));
    expect(r.energized.has(ids.mv)).toBe(false);
    expect(r.energized.has(ids.motor)).toBe(false);
  });

  it('a parallel path keeps the LV bus live when one transformer feeder is open', () => {
    const { doc, ids } = referenceOneLine();
    doc.equipment[ids.f1]!.state = 'open';
    const r = trace(doc, [ids.util]);
    expect(r.boundary).toEqual(new Set([ids.f1]));
    expect(r.energized.has(ids.t1)).toBe(true); // back-fed from the LV bus through T2 and 52-L1
    expect(r.energized.has(ids.lv)).toBe(true);
    expect(r.energized.has(ids.motor)).toBe(true);
  });

  it('marks energized cables', () => {
    const { doc, ids } = referenceOneLine();
    doc.equipment[ids.fm]!.state = 'open';
    const r = trace(doc, [ids.util]);
    const motorCable = Object.values(doc.connections).find((c) => c.to.equipmentId === ids.motor)!;
    expect(r.connections.has(motorCable.id)).toBe(false);
    expect(r.energized.has(ids.motor)).toBe(false);
    expect(r.energized.has(ids.load)).toBe(true);
  });

  it('tie connectors with the same link name join (across sheets)', () => {
    const b = builder();
    const u = b.add('utility');
    const tA = b.add('tie');
    const tB = b.add('tie');
    const load = b.add('load');
    b.doc.equipment[tA]!.props['concept.link'] = 'A1';
    b.doc.equipment[tB]!.props['concept.link'] = 'a1 ';
    b.doc.equipment[tB]!.sheetId = 'other-sheet';
    b.wire(u, 'T', tA, 'T');
    b.wire(tB, 'T', load, 'T');
    expect(trace(b.doc, [u]).energized.has(load)).toBe(true);
  });

  it('energizedFromSources and upstreamSources', () => {
    const { doc, ids } = referenceOneLine();
    expect(energizedFromSources(doc).energized.has(ids.load)).toBe(true);
    expect(upstreamSources(doc, ids.motor)).toEqual([ids.util]);
  });
});

describe('connected components', () => {
  it('ignores switch state and splits islands', () => {
    const { doc, ids, add } = referenceOneLine();
    doc.equipment[ids.main]!.state = 'open';
    const lonely = add('motor');
    const comps = connectedComponents(doc);
    // main power system + lonely motor + relay (control wiring is not a power path)
    expect(comps.length).toBe(3);
    expect(comps.find((c) => c.includes(lonely))!.length).toBe(1);
    const main = comps.find((c) => c.includes(ids.util))!;
    expect(main).toContain(ids.load);
    expect(main).not.toContain(ids.relay);
  });
});

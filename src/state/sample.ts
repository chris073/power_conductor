// A realistic small one-line to start from (and to check lenses and trace against):
// utility -> CT + relay -> main breaker -> MV bus -> two transformers -> LV switchgear -> feeders
// -> motor + load.

import { createConnection, createEquipment, createProject, newId } from '../domain/model';
import type { EquipmentType, Id, NodeLayout, ProjectDoc, PropValue } from '../domain/types';

export function sampleBuilder(name: string) {
  const doc: ProjectDoc = createProject(name);
  const sheet = doc.sheets[0]!.id;
  const add = (type: EquipmentType, tag: string, x: number, y: number, props: Record<string, PropValue> = {}, extra: Partial<NodeLayout> = {}): Id => {
    const e = createEquipment(doc, type, sheet);
    e.tag = tag;
    Object.assign(e.props, props);
    doc.equipment[e.id] = e;
    doc.layout.nodes[e.id] = { x, y, rot: 0, flip: false, ...extra };
    if (type === 'bus') doc.layout.buses[e.id] = { taps: {} };
    return e.id;
  };
  const tap = (busId: Id, offset: number): string => {
    const bus = doc.equipment[busId]!;
    const id = newId();
    bus.taps = [...(bus.taps ?? []), { id, label: `Tap ${(bus.taps?.length ?? 0) + 1}` }];
    doc.layout.buses[busId]!.taps[id] = offset;
    return id;
  };
  const wire = (a: Id, at: string, b: Id, bt: string, props: Record<string, PropValue> = {}) => {
    const c = createConnection(doc, sheet, { equipmentId: a, terminalId: at }, { equipmentId: b, terminalId: bt });
    if (!c) throw new Error('sample wiring failed');
    Object.assign(c.props, props);
    doc.connections[c.id] = c;
    return c.id;
  };
  return { doc, sheet, add, tap, wire };
}

export function buildSampleProject(): ProjectDoc {
  const b = sampleBuilder('Sample substation');
  const { add, tap, wire } = b;
  const util = add('utility', 'UTIL-1', 400, 0, { 'design.kv': 13.8, 'design.scMva': 500, 'design.xr': 15 });
  const ct = add('ct', 'CT-1', 420, 120, { 'design.ratio': '1200:5', 'design.accuracy': 'C400' });
  const relay = add('relay', '50/51-M', 520, 120, { 'design.functions': '50/51' });
  const main = add('breaker', '52-M', 420, 240, { 'design.kv': 15, 'design.ratedA': 1200, 'design.interruptKa': 25 });
  const mv = add('bus', 'MV-BUS', 200, 380, { 'concept.kv': 13.8, 'design.kv': 15, 'design.ratedA': 1200 }, { w: 480 });
  const f1 = add('breaker', '52-T1', 260, 440, { 'design.kv': 15, 'design.ratedA': 600 });
  const f2 = add('breaker', '52-T2', 580, 440, { 'design.kv': 15, 'design.ratedA': 600 });
  const t1 = add('xfmr2', 'T1', 240, 560, { 'concept.kva': 2500, 'design.hvKv': 13.8, 'design.lvKv': 0.48, 'design.z': 5.75 });
  const t2 = add('xfmr2', 'T2', 560, 560, { 'concept.kva': 2500, 'design.hvKv': 13.8, 'design.lvKv': 0.48 });
  add('lineup', 'SWGR-1', 140, 700, { 'design.kv': 0.48, 'design.ratedA': 4000 }, { w: 600, h: 360 });
  const l1 = add('breaker', '52-L1', 260, 720, { 'design.mounting': 'Draw-out', 'design.kv': 0.48, 'design.ratedA': 3200 });
  const l2 = add('breaker', '52-L2', 580, 720, { 'design.mounting': 'Draw-out', 'design.kv': 0.48, 'design.ratedA': 3200 });
  const lv = add('bus', 'LV-BUS', 160, 860, { 'concept.kv': 0.48, 'design.kv': 0.48, 'design.ratedA': 4000 }, { w: 560 });
  const fm = add('breaker', '52-F1', 340, 920, { 'design.mounting': 'Fixed', 'design.kv': 0.48, 'design.ratedA': 400 });
  const fl = add('breaker', '52-F2', 500, 920, { 'design.mounting': 'Fixed', 'design.kv': 0.48, 'design.ratedA': 225 });
  const motor = add('motor', 'MTR-1', 320, 1100, { 'concept.hp': 200, 'concept.service': 'Cooling water pump', 'design.kv': 0.46 });
  const load = add('load', 'LD-1', 500, 1100, { 'concept.kw': 150, 'concept.service': 'Building load' });

  wire(util, 'T', ct, 'P1');
  wire(ct, 'P2', main, '1');
  wire(ct, 'S', relay, 'IN');
  wire(main, '2', mv, tap(mv, 240));
  wire(mv, tap(mv, 80), f1, '1');
  wire(mv, tap(mv, 400), f2, '1');
  wire(f1, '2', t1, 'H1', { 'design.size': '2/0 AWG', 'design.material': 'Cu', 'design.insulation': 'EPR' });
  wire(f2, '2', t2, 'H1', { 'design.size': '2/0 AWG' });
  wire(t1, 'X1', l1, '1', { 'design.size': '8×600 kcmil' });
  wire(t2, 'X1', l2, '1');
  wire(l1, '2', lv, tap(lv, 120));
  wire(l2, '2', lv, tap(lv, 440));
  wire(lv, tap(lv, 200), fm, '1');
  wire(lv, tap(lv, 360), fl, '1');
  wire(fm, '2', motor, 'T', { 'design.size': '250 kcmil', 'concept.lengthFt': 180 });
  wire(fl, '2', load, 'T');

  const note = newId();
  b.doc.annotations[note] = { id: note, sheetId: b.sheet, kind: 'note', text: 'Sample one-line. Select a source and press T to trace; toggle a breaker with O or double-click.' };
  b.doc.layout.nodes[note] = { x: 680, y: 0, rot: 0, flip: false, w: 260, h: 80 };
  return b.doc;
}

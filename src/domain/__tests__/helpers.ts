import { createConnection, createEquipment, createProject } from '../model';
import type { EquipmentType, Id, ProjectDoc } from '../types';

/** Tiny builder for graph tests: add equipment, wire terminals. */
export function builder() {
  const doc: ProjectDoc = createProject('test');
  const sheet = doc.sheets[0]!.id;
  const add = (type: EquipmentType, tag?: string): Id => {
    const e = createEquipment(doc, type, sheet);
    if (tag) e.tag = tag;
    doc.equipment[e.id] = e;
    return e.id;
  };
  const tap = (busId: Id): string => {
    const bus = doc.equipment[busId]!;
    const id = `tap${(bus.taps?.length ?? 0) + 1}`;
    bus.taps = [...(bus.taps ?? []), { id, label: id }];
    return id;
  };
  const wire = (a: Id, at: string, b: Id, bt: string): Id => {
    const c = createConnection(doc, sheet, { equipmentId: a, terminalId: at }, { equipmentId: b, terminalId: bt });
    if (!c) throw new Error(`cannot wire ${at} -> ${bt}`);
    doc.connections[c.id] = c;
    return c.id;
  };
  return { doc, sheet, add, tap, wire };
}

/**
 * The brief's reference one-line:
 * utility -> main breaker (with CT + relay) -> MV bus -> two transformers -> LV switchgear bus
 * -> feeders -> motor + load.
 */
export function referenceOneLine() {
  const b = builder();
  const util = b.add('utility', 'UTIL-1');
  const main = b.add('breaker', '52-M');
  const ct = b.add('ct', 'CT-1');
  const relay = b.add('relay', '50/51-M');
  const mv = b.add('bus', 'MV-BUS');
  const f1 = b.add('breaker', '52-T1');
  const f2 = b.add('breaker', '52-T2');
  const t1 = b.add('xfmr2', 'T1');
  const t2 = b.add('xfmr2', 'T2');
  const lv = b.add('bus', 'LV-SWGR');
  const lvMain1 = b.add('breaker', '52-L1');
  const lvMain2 = b.add('breaker', '52-L2');
  const fm = b.add('breaker', '52-F1');
  const fl = b.add('breaker', '52-F2');
  const motor = b.add('motor', 'MTR-1');
  const load = b.add('load', 'LD-1');

  b.wire(util, 'T', ct, 'P1');
  b.wire(ct, 'P2', main, '1');
  b.wire(ct, 'S', relay, 'IN');
  b.wire(main, '2', mv, b.tap(mv));
  b.wire(mv, b.tap(mv), f1, '1');
  b.wire(mv, b.tap(mv), f2, '1');
  b.wire(f1, '2', t1, 'H1');
  b.wire(f2, '2', t2, 'H1');
  b.wire(t1, 'X1', lvMain1, '1');
  b.wire(t2, 'X1', lvMain2, '1');
  b.wire(lvMain1, '2', lv, b.tap(lv));
  b.wire(lvMain2, '2', lv, b.tap(lv));
  b.wire(lv, b.tap(lv), fm, '1');
  b.wire(lv, b.tap(lv), fl, '1');
  b.wire(fm, '2', motor, 'T');
  b.wire(fl, '2', load, 'T');
  return { ...b, ids: { util, main, ct, relay, mv, f1, f2, t1, t2, lv, lvMain1, lvMain2, fm, fl, motor, load } };
}

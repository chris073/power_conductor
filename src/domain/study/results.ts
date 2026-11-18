// Import an ANDES power-flow solution (scripts/andes-check.py --json) onto project objects as
// read-only study results. Buses match by their sticky PSS/E number; branches match by the order
// ANDES lists its Line devices (RAW branches, then two-winding transformers, then three branches per
// three-winding transformer), checked against their end bus numbers.

import type { Id, ObjectResult, ProjectDoc, StudyResults } from '../types';
import { buildStudyCase } from './build';

export interface AndesPf {
  format: 'conductor-andes-pf';
  source: string;
  at?: string;
  converged: boolean;
  buses: { bus: number; vm: number; va: number }[];
  branches: { index: number; from: number; to: number; pFrom: number; qFrom: number; pTo: number; qTo: number }[];
}

export function parseAndesPf(text: string): AndesPf {
  const d = JSON.parse(text) as Partial<AndesPf>;
  if (d.format !== 'conductor-andes-pf' || !Array.isArray(d.buses) || !Array.isArray(d.branches)) {
    throw new Error('Not an ANDES result file from scripts/andes-check.py --json.');
  }
  return d as AndesPf;
}

export function importAndesResults(doc: ProjectDoc, pf: AndesPf, now = new Date().toISOString()): { results: StudyResults; warnings: string[] } {
  const sc = buildStudyCase(doc);
  const warnings: string[] = [];
  const objects: Record<Id, ObjectResult> = {};
  const buses: StudyResults['buses'] = {};
  const byNum = new Map(sc.buses.map((b) => [b.number, b]));

  for (const r of pf.buses) {
    const b = byNum.get(r.bus);
    if (!b) continue; // e.g. the star bus ANDES adds for a three-winding transformer
    buses[String(r.bus)] = { vm: r.vm, va: r.va };
    // Drawn buses carry the voltage; a study bus with no drawn bus shows it on its single-terminal elements.
    const targets = b.busIds.length
      ? b.busIds
      : b.memberIds.filter((id) => ['utility', 'generator', 'wind', 'pv', 'bess', 'inverter', 'load', 'motor', 'capacitor'].includes(doc.equipment[id]?.type ?? ''));
    for (const id of targets) objects[id] = { ...objects[id], vm: r.vm, va: r.va };
  }
  const missing = sc.buses.filter((b) => !buses[String(b.number)]);
  if (missing.length) warnings.push(`${missing.length} study bus(es) have no result (the case changed since the export?): ${missing.map((b) => b.number).join(', ')}.`);

  // Expected ANDES Line order.
  const expected: { objectId: Id; from: number; to: number }[] = [
    ...sc.branches.map((b) => ({ objectId: b.objectId, from: b.from, to: b.to })),
    ...sc.xfmr2.map((t) => ({ objectId: t.objectId, from: t.hv.bus, to: t.lv.bus })),
  ];
  let skipped = 0;
  pf.branches.forEach((r, i) => {
    const e = expected[i];
    if (!e) { skipped++; return; } // three-winding star branches
    if (e.from !== r.from || e.to !== r.to) { skipped++; return; }
    objects[e.objectId] = { ...objects[e.objectId], pFrom: r.pFrom, qFrom: r.qFrom, pTo: r.pTo, qTo: r.qTo };
  });
  const mismatched = skipped - sc.xfmr3.length * 3;
  if (mismatched > 0) warnings.push(`${mismatched} branch result(s) did not match the current one-line and were skipped. Re-export and re-run ANDES.`);
  if (!pf.converged) warnings.push('The power flow did not converge; the values are not a solution.');

  const source = pf.at ? `${pf.source}, solved ${pf.at.slice(0, 19).replace('T', ' ')} UTC` : pf.source;
  return { results: { at: now, source, converged: pf.converged, buses, objects }, warnings };
}

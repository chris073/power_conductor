// PSS/E DYR writer: one record per device and chosen dynamic model,
//   IBUS 'MODEL' ID  ICON(s)  CON(s)  /
// with values from the object (or the library typicals) in PSS/E order (libraries/dynamics.ts).

import { DYN_MODELS, dynKey } from './libraries/dynamics';
import { numOf } from './typicals';
import type { GenRec, StudyCase } from './types';

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : Number(n.toPrecision(6)).toString());
const idTok = (id: string) => (/^\d+$/.test(id.trim()) ? id.trim() : `'${id}'`);

export interface DyrRecord { objectId: string; bus: number; id: string; model: string; values: string[] }

/** The dynamic records the case needs, in write order. */
export function dyrRecords(sc: StudyCase): DyrRecord[] {
  const out: DyrRecord[] = [];
  const add = (objectId: string, dataId: string, bus: number, id: string, model: string, mbase: number, q?: { qmax: number; qmin: number }) => {
    const def = DYN_MODELS[model];
    if (!def) return;
    const p = sc.filledProps[dataId] ?? {};
    const values = def.params.map((prm) => {
      let v = numOf(p, dynKey(model, prm)) ?? prm.dflt;
      if (prm.auto === 'mbase' && !v) v = mbase;
      // Converter Q limits default to the machine's own capability (pu on MBASE), so they agree with the power flow.
      if (prm.auto === 'qmax' && !v) v = q && mbase > 0 ? q.qmax / mbase : 0.33;
      if (prm.auto === 'qmin' && !v) v = q && mbase > 0 ? q.qmin / mbase : -0.33;
      if (prm.name === 'CKTID') return `'${Math.round(v)}'`;
      return prm.icon ? String(Math.round(v)) : fmt(v);
    });
    out.push({ objectId, bus, id, model, values });
  };
  const sel = (g: GenRec, k: string) => String(sc.filledProps[g.dataId]?.[k] ?? '');
  for (const g of sc.gens) {
    if (g.status === 0) continue;
    const model = sel(g, 'design.dynModel');
    if (g.kind === 'utility') {
      if (model === 'GENCLS') add(g.objectId, g.dataId, g.bus, g.id, 'GENCLS', g.mbase);
    } else if (g.kind === 'sync') {
      if (!DYN_MODELS[model]) continue;
      add(g.objectId, g.dataId, g.bus, g.id, model, g.mbase);
      if (model === 'GENCLS') continue; // a classical machine has no field or governor
      const exc = sel(g, 'design.exciter');
      const gov = sel(g, 'design.governor');
      if (DYN_MODELS[exc]) add(g.objectId, g.dataId, g.bus, g.id, exc, g.mbase);
      if (DYN_MODELS[gov]) add(g.objectId, g.dataId, g.bus, g.id, gov, g.mbase);
    } else if (model === 'WECC generic') {
      const bess = g.equipmentType === 'bess';
      const q = { qmax: g.qmax, qmin: g.qmin };
      add(g.objectId, g.dataId, g.bus, g.id, 'REGCA1', g.mbase);
      add(g.objectId, g.dataId, g.bus, g.id, bess ? 'REECC1' : 'REECA1', g.mbase, q);
      if (sc.filledProps[g.dataId]?.['design.plantCtrl'] !== false) add(g.objectId, g.dataId, g.bus, g.id, 'REPCA1', g.mbase, q);
      if (g.equipmentType === 'wind' && String(sc.filledProps[g.dataId]?.['design.wtgType'] ?? '').startsWith('Type 3')) {
        for (const m of ['WTDTA1', 'WTARA1', 'WTPTA1', 'WTTQA1']) add(g.objectId, g.dataId, g.bus, g.id, m, g.mbase);
      }
    }
  }
  for (const l of sc.loads) {
    if (!l.motor || l.status === 0) continue;
    if (sc.filledProps[l.objectId]?.['design.dynModel'] !== 'CIM5') continue;
    const mbase = Math.hypot(l.pl, l.ql) || 1;
    add(l.objectId, l.objectId, l.bus, l.id, 'CIM5BL', mbase);
  }
  return out;
}

export function writeDyr(sc: StudyCase): string {
  // No header comment: PSS/E reads every '/' as the end of a record.
  const L: string[] = [];
  for (const r of dyrRecords(sc)) {
    const head = `${String(r.bus).padStart(6)} '${r.model}' ${idTok(r.id)}`;
    const chunks: string[] = [];
    for (let i = 0; i < r.values.length; i += 8) chunks.push(r.values.slice(i, i + 8).join(' '));
    if (!chunks.length) chunks.push('');
    L.push(`${head} ${chunks[0]}`);
    for (const c of chunks.slice(1)) L.push(`     ${c}`);
    L[L.length - 1] += ' /';
  }
  return L.join('\r\n') + '\r\n';
}

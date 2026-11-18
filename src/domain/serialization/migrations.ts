// Schema migrations. Each entry upgrades a document FROM that version to the next one.
// When the ProjectDoc shape changes: bump SCHEMA_VERSION in model.ts, add `migrations[old]`,
// add a test with a fixture of the old shape, and note it in docs/DECISIONS.md.

import { parseKvRatio } from '../study/libraries/transformers';

export type RawDoc = Record<string, unknown> & { schemaVersion?: number };
export type Migration = (doc: RawDoc) => RawDoc;

type RawEquipment = { type?: string; props?: Record<string, unknown>; labelFields?: unknown };

/**
 * 1 → 2 (D-011, study export):
 * - adds `study` (system base 100 MVA, 60 Hz, RAW v33, cable collapse 10 ft) and `studyResults: null`;
 * - transformers: the text `design.kvRatio` ("13.8-0.48 kV") becomes numeric `design.hvKv`,
 *   `design.lvKv` (and `design.tvKv` for 3-winding). Unparseable text is kept in a custom
 *   property so nothing is lost. Canvas labels that showed the ratio now show the HV voltage.
 */
function v1to2(doc: RawDoc): RawDoc {
  const equipment: Record<string, unknown> = {};
  for (const [id, raw] of Object.entries((doc.equipment as Record<string, RawEquipment>) ?? {})) {
    const e = raw as RawEquipment & Record<string, unknown>;
    if ((e.type === 'xfmr2' || e.type === 'xfmr3') && e.props && 'design.kvRatio' in e.props) {
      const props = { ...e.props };
      const text = props['design.kvRatio'];
      delete props['design.kvRatio'];
      const kvs = typeof text === 'string' ? parseKvRatio(text) : [];
      const keys = e.type === 'xfmr2' ? ['design.hvKv', 'design.lvKv'] : ['design.hvKv', 'design.lvKv', 'design.tvKv'];
      const custom = Array.isArray(e.custom) ? [...(e.custom as unknown[])] : [];
      if (kvs.length >= 2) keys.forEach((k, i) => { if (kvs[i] !== undefined) props[k] = kvs[i]!; });
      else if (typeof text === 'string' && text.trim()) custom.push({ id: `kvRatio-${id}`, key: 'Voltage ratio (old)', value: text });
      const labelFields = Array.isArray(e.labelFields) ? (e.labelFields as string[]).map((k) => (k === 'design.kvRatio' ? 'design.hvKv' : k)) : e.labelFields;
      equipment[id] = { ...e, props, custom, labelFields };
    } else {
      equipment[id] = e;
    }
  }
  return {
    ...doc,
    equipment,
    study: { baseMva: 100, freqHz: 60, rawVersion: 33, collapseFt: 10, collapseOhm: 0, busNumbers: {} },
    studyResults: null,
  };
}

export const migrations: Record<number, Migration> = { 1: v1to2 };

export function migrate(doc: RawDoc, target: number, registry: Record<number, Migration> = migrations): RawDoc {
  let cur = doc;
  let v = typeof cur.schemaVersion === 'number' ? cur.schemaVersion : 0;
  if (v > target) throw new Error(`This file was saved by a newer Conductor (schema ${v}; this app reads up to ${target}).`);
  while (v < target) {
    const step = registry[v];
    if (!step) throw new Error(`No migration from schema ${v} to ${v + 1}.`);
    cur = { ...step(cur), schemaVersion: v + 1 };
    v++;
  }
  return cur;
}

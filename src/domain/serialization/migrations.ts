// Schema migrations. Each entry upgrades a document FROM that version to the next one.
// When the ProjectDoc shape changes: bump SCHEMA_VERSION in model.ts, add `migrations[old]`,
// add a test with a fixture of the old shape, and note it in docs/DECISIONS.md.

export type RawDoc = Record<string, unknown> & { schemaVersion?: number };
export type Migration = (doc: RawDoc) => RawDoc;

/** Version 1 is the first released format, so there is nothing to migrate yet. */
export const migrations: Record<number, Migration> = {};

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

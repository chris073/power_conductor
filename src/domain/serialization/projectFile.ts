// One versioned project JSON. Autosave, export and import all use this exact format.

import { SCHEMA_VERSION } from '../model';
import type { ProjectDoc } from '../types';
import { migrate, migrations, type Migration, type RawDoc } from './migrations';

export const FILE_FORMAT = 'conductor-project';

export interface ProjectFile {
  format: typeof FILE_FORMAT;
  schemaVersion: number;
  project: ProjectDoc;
}

export function toProjectFile(doc: ProjectDoc): ProjectFile {
  return { format: FILE_FORMAT, schemaVersion: doc.schemaVersion, project: doc };
}

export function serializeProject(doc: ProjectDoc): string {
  return JSON.stringify(toProjectFile(doc), null, 2);
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Checks the parts every later step relies on. Throws a readable error. */
export function validateDoc(d: unknown): asserts d is ProjectDoc {
  if (!isObj(d)) throw new Error('Project is not an object.');
  if (typeof d.id !== 'string' || !d.id) throw new Error('Project has no id.');
  if (typeof d.name !== 'string') throw new Error('Project has no name.');
  if (!Array.isArray(d.sheets) || d.sheets.length === 0) throw new Error('Project has no sheets.');
  for (const k of ['equipment', 'connections', 'annotations', 'layout'] as const) {
    if (!isObj(d[k])) throw new Error(`Project is missing "${k}".`);
  }
  const layout = d.layout as Record<string, unknown>;
  for (const k of ['nodes', 'buses', 'routes'] as const) {
    if (!isObj(layout[k])) throw new Error(`Project layout is missing "${k}".`);
  }
}

/**
 * Accepts a project file ({ format, schemaVersion, project }) or a bare ProjectDoc,
 * migrates it to the current schema and validates it.
 */
export function parseProject(input: string | unknown, registry: Record<number, Migration> = migrations, target = SCHEMA_VERSION): ProjectDoc {
  const data: unknown = typeof input === 'string' ? JSON.parse(input) : input;
  if (!isObj(data)) throw new Error('Not a Conductor project file.');
  let raw: RawDoc;
  if (data.format === FILE_FORMAT) {
    if (!isObj(data.project)) throw new Error('Project file has no project.');
    raw = { ...(data.project as RawDoc) };
    if (typeof raw.schemaVersion !== 'number' && typeof data.schemaVersion === 'number') raw.schemaVersion = data.schemaVersion;
  } else if ('sheets' in data && 'equipment' in data) {
    raw = data as RawDoc;
  } else {
    throw new Error('Not a Conductor project file.');
  }
  const migrated = migrate(raw, target, registry);
  validateDoc(migrated);
  return migrated;
}

// Swappable storage adapter. Projects are one versioned JSON document each (the same format as
// export/import). The default adapter is localStorage; a file- or DB-backed adapter can replace it
// without touching the rest of the app (see docs/DECISIONS.md, D-005).

import { parseProject, serializeProject } from '../domain/serialization/projectFile';
import type { Id, ProjectDoc } from '../domain/types';

export interface ProjectMeta { id: Id; name: string; updatedAt: string; sheets: number; objects: number }

export interface ProjectStorage {
  list(): ProjectMeta[];
  load(id: Id): ProjectDoc | null;
  save(doc: ProjectDoc): void;
  remove(id: Id): void;
  getLast(): Id | null;
  setLast(id: Id): void;
  clearAll(): void;
}

const PREFIX = 'conductor:';
const INDEX = `${PREFIX}index`;
const LAST = `${PREFIX}last`;
const projectKey = (id: Id) => `${PREFIX}project:${id}`;

function readIndex(): ProjectMeta[] {
  try {
    const raw = localStorage.getItem(INDEX);
    return raw ? (JSON.parse(raw) as ProjectMeta[]) : [];
  } catch {
    return [];
  }
}

function writeIndex(list: ProjectMeta[]) {
  localStorage.setItem(INDEX, JSON.stringify(list));
}

export function metaOf(doc: ProjectDoc): ProjectMeta {
  return {
    id: doc.id,
    name: doc.name,
    updatedAt: doc.updatedAt,
    sheets: doc.sheets.length,
    objects: Object.keys(doc.equipment).length + Object.keys(doc.connections).length,
  };
}

export const localStorageAdapter: ProjectStorage = {
  list: () => readIndex().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  load(id) {
    const raw = localStorage.getItem(projectKey(id));
    if (!raw) return null;
    return parseProject(raw);
  },
  save(doc) {
    localStorage.setItem(projectKey(doc.id), serializeProject(doc));
    const list = readIndex().filter((m) => m.id !== doc.id);
    list.push(metaOf(doc));
    writeIndex(list);
  },
  remove(id) {
    localStorage.removeItem(projectKey(id));
    writeIndex(readIndex().filter((m) => m.id !== id));
  },
  getLast: () => {
    try { return localStorage.getItem(LAST); } catch { return null; }
  },
  setLast: (id) => {
    try { localStorage.setItem(LAST, id); } catch { /* ignore */ }
  },
  clearAll() {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(PREFIX) || k === 'pc-theme')) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  },
};

export const storage: ProjectStorage = localStorageAdapter;

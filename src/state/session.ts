// Opening, saving and switching projects. Autosave writes the whole project JSON through the
// storage adapter after a short idle delay (Settings → autosave interval).

import { createProject, newId, nowIso } from '../domain/model';
import { parseProject, serializeProject } from '../domain/serialization/projectFile';
import type { Id, ProjectDoc } from '../domain/types';
import { buildSampleProject } from './sample';
import { useProject } from './projectStore';
import { useSettings } from './settingsStore';
import { storage } from './storage';
import { useUi } from './uiStore';

let timer: ReturnType<typeof setTimeout> | null = null;
let lastSaved: ProjectDoc | null = null;
let started = false;

export function saveNow(): boolean {
  if (timer) { clearTimeout(timer); timer = null; }
  const doc = useProject.getState().doc;
  if (doc === lastSaved) return true;
  try {
    useUi.getState().setSaveStatus('saving');
    storage.save(doc);
    storage.setLast(doc.id);
    lastSaved = doc;
    useUi.getState().setSaveStatus('saved');
    return true;
  } catch (err) {
    useUi.getState().setSaveStatus('error');
    useUi.getState().toast(`Could not save: ${(err as Error).message}. Export the project as JSON to keep your work.`, 'error');
    return false;
  }
}

function schedule() {
  if (timer) clearTimeout(timer);
  const secs = Math.max(0.5, useSettings.getState().autosaveSeconds);
  timer = setTimeout(saveNow, secs * 1000);
}

export function openDoc(doc: ProjectDoc) {
  saveNow();
  lastSaved = doc;
  useProject.getState().load(doc);
  storage.setLast(doc.id);
  useUi.setState({ sheetId: doc.sheets[0]!.id, selection: [], trace: null, saveStatus: 'saved' });
}

export function startSession() {
  if (started) return;
  started = true;
  let doc: ProjectDoc | null = null;
  const last = storage.getLast();
  try {
    if (last) doc = storage.load(last);
    if (!doc) {
      const first = storage.list()[0];
      if (first) doc = storage.load(first.id);
    }
  } catch (err) {
    useUi.getState().toast(`Could not open the last project: ${(err as Error).message}`, 'error');
  }
  if (!doc) {
    doc = buildSampleProject();
    storage.save(doc);
  }
  openDoc(doc);
  useProject.subscribe((s, prev) => {
    if (s.doc === prev.doc) return;
    useUi.getState().setSaveStatus('unsaved');
    schedule();
  });
  window.addEventListener('beforeunload', () => { saveNow(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
}

export function newProject(name = 'Untitled project') {
  const doc = createProject(name);
  storage.save(doc);
  openDoc(doc);
}

export function newSampleProject() {
  const doc = buildSampleProject();
  storage.save(doc);
  openDoc(doc);
}

export function openProject(id: Id) {
  if (id === useProject.getState().doc.id) return;
  const doc = storage.load(id);
  if (doc) openDoc(doc);
}

export function duplicateProject(id: Id) {
  saveNow();
  const src = storage.load(id);
  if (!src) return;
  const t = nowIso();
  // New project id; object ids stay (they are scoped per project).
  const copy: ProjectDoc = { ...structuredClone(src), id: newId(), name: `${src.name} (copy)`, createdAt: t, updatedAt: t };
  storage.save(copy);
  return copy.id;
}

export function deleteProject(id: Id) {
  storage.remove(id);
  if (id === useProject.getState().doc.id) {
    const next = storage.list()[0];
    const doc = next ? storage.load(next.id) : null;
    if (doc) openDoc(doc);
    else newProject();
  }
}

export function renameProject(id: Id, name: string) {
  if (id === useProject.getState().doc.id) { useProject.getState().rename(name); return; }
  const doc = storage.load(id);
  if (doc) storage.save({ ...doc, name, updatedAt: nowIso() });
}

export function exportProject(id?: Id) {
  saveNow();
  const doc = id && id !== useProject.getState().doc.id ? storage.load(id) : useProject.getState().doc;
  if (!doc) return;
  const blob = new Blob([serializeProject(doc)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${doc.name.replace(/[^\w.-]+/g, '_') || 'project'}.conductor.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Import a project file. If a project with the same id exists, the import gets a new id. */
export async function importProjectFile(file: File) {
  try {
    const doc = parseProject(await file.text());
    const clash = storage.list().some((m) => m.id === doc.id);
    const toSave = clash ? { ...doc, id: newId(), name: `${doc.name} (imported)` } : doc;
    storage.save(toSave);
    openDoc(toSave);
    useUi.getState().toast(`Imported “${toSave.name}”.`);
  } catch (err) {
    useUi.getState().toast(`Import failed: ${(err as Error).message}`, 'error');
  }
}

export function resetLocalData() {
  storage.clearAll();
  useSettings.getState().reset();
  lastSaved = null;
  const doc = buildSampleProject();
  storage.save(doc);
  openDoc(doc);
}

export function openGenerated(doc: ProjectDoc) {
  storage.save(doc);
  openDoc(doc);
}

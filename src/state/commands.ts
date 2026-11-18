// Editing commands that act on the current selection. Shared by keyboard shortcuts, the toolbar
// and the inspector. No diagram-library code here.

import { CATALOG } from '../domain/catalog';
import { copyFragment, type Fragment } from '../domain/clipboard';
import type { Id } from '../domain/types';
import { align, distribute, type AlignMode, type Box } from '../layout/align';
import { placedSize, snap } from '../layout/geometry';
import { useProject } from './projectStore';
import { useSettings } from './settingsStore';
import { useUi } from './uiStore';

const CLIP_KEY = 'conductor:clipboard';
let clipboard: Fragment | null = null;
let pasteCount = 0;

const doc = () => useProject.getState().doc;
const sel = () => useUi.getState().selection;
const grid = () => useSettings.getState().gridSize;
export const currentSheet = (): Id => useUi.getState().sheetId ?? doc().sheets[0]!.id;

/** Selected equipment and annotations (things with a layout box). */
export function selectedNodes(): Id[] {
  const d = doc();
  return sel().filter((id) => d.layout.nodes[id]);
}

export function rotateSelection() {
  const ids = selectedNodes();
  if (ids.length) useProject.getState().rotate(ids, grid());
}

export function flipSelection() {
  const ids = selectedNodes();
  if (ids.length) useProject.getState().flip(ids);
}

export function deleteSelection() {
  const ids = sel();
  if (!ids.length) return;
  useProject.getState().remove(ids);
  useUi.getState().select([]);
}

export function toggleSelection() {
  const d = doc();
  const ids = sel().filter((id) => d.equipment[id]?.state);
  if (!ids.length) return false;
  for (const id of ids) useProject.getState().toggleState(id);
  return true;
}

export function copySelection(): boolean {
  const ids = sel();
  if (!ids.length) return false;
  clipboard = copyFragment(doc(), ids);
  pasteCount = 0;
  try { localStorage.setItem(CLIP_KEY, JSON.stringify(clipboard)); } catch { /* ignore */ }
  return true;
}

export function cutSelection() {
  if (copySelection()) deleteSelection();
}

function readClipboard(): Fragment | null {
  if (clipboard) return clipboard;
  try {
    const raw = localStorage.getItem(CLIP_KEY);
    return raw ? (JSON.parse(raw) as Fragment) : null;
  } catch {
    return null;
  }
}

/** Paste at `at` (flow coords, top-left of the pasted group), or offset from the original. */
export function paste(at?: { x: number; y: number }) {
  const frag = readClipboard();
  if (!frag || (!frag.equipment.length && !frag.annotations.length)) return;
  const g = grid();
  let dx: number;
  let dy: number;
  const xs = Object.values(frag.nodes).map((n) => n.x);
  const ys = Object.values(frag.nodes).map((n) => n.y);
  if (at && xs.length) {
    dx = snap(at.x - Math.min(...xs), g);
    dy = snap(at.y - Math.min(...ys), g);
  } else {
    pasteCount++;
    dx = dy = g * 2 * pasteCount;
  }
  const ids = useProject.getState().paste(frag, currentSheet(), dx, dy);
  useUi.getState().select(ids);
}

export function duplicateSelection() {
  const ids = sel();
  if (!ids.length) return;
  const created = useProject.getState().duplicate(ids, currentSheet(), grid());
  useUi.getState().select(created);
}

export function selectAll() {
  const d = doc();
  const s = currentSheet();
  const ids = [...Object.values(d.equipment), ...Object.values(d.annotations), ...Object.values(d.connections)].filter((o) => o.sheetId === s).map((o) => o.id);
  useUi.getState().select(ids);
}

function boxes(): Box[] {
  const d = doc();
  return selectedNodes().map((id) => {
    const n = d.layout.nodes[id]!;
    const e = d.equipment[id];
    const size = e ? placedSize(e, n) : { w: n.w ?? 200, h: n.h ?? 60 };
    return { id, x: n.x, y: n.y, w: size.w, h: size.h };
  });
}

/** Align by terminal centers would be nicer for one-lines; box centers are the predictable default. */
export function alignSelection(mode: AlignMode) {
  const g = grid();
  const pos = align(boxes(), mode);
  for (const p of Object.values(pos)) { p.x = snap(p.x, g); p.y = snap(p.y, g); }
  useProject.getState().moveNodes(pos);
}

export function distributeSelection(axis: 'h' | 'v') {
  const g = grid();
  const pos = distribute(boxes(), axis);
  for (const p of Object.values(pos)) { p.x = snap(p.x, g); p.y = snap(p.y, g); }
  useProject.getState().moveNodes(pos);
}

export function nudgeSelection(dx: number, dy: number) {
  const d = doc();
  const g = grid();
  const pos: Record<Id, { x: number; y: number }> = {};
  for (const id of selectedNodes()) {
    const n = d.layout.nodes[id]!;
    pos[id] = { x: n.x + dx * g, y: n.y + dy * g };
  }
  useProject.getState().moveNodes(pos);
}

/** Trace from the selected device (preferably a source). Returns a message for the user. */
export function traceSelection(): string {
  const d = doc();
  const ids = sel().filter((id) => d.equipment[id]);
  const src = ids.find((id) => CATALOG[d.equipment[id]!.type].behavior === 'source') ?? ids[0];
  if (!src) return 'Select a source (or any device) to trace from.';
  useUi.getState().setTrace({ from: src });
  return '';
}

export function clearTrace() {
  useUi.getState().setTrace(null);
}

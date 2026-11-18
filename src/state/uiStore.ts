import { create } from 'zustand';
import type { Id, Phase } from '../domain/types';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export interface Toast { id: number; text: string; kind: 'info' | 'error' }

interface UiState {
  /** Lifecycle lens (view only). */
  phase: Phase;
  sheetId: Id | null;
  selection: Id[];
  /** Energization trace start (result is derived from the live model, so toggling a breaker re-traces). */
  trace: { from: Id } | null;
  cursor: { x: number; y: number } | null;
  zoom: number;
  saveStatus: SaveStatus;
  toasts: Toast[];
  shortcutsOpen: boolean;
  /** Ask the canvas to center on an object (set by the inspector). */
  focusId: Id | null;
  setPhase: (p: Phase) => void;
  setSheet: (id: Id | null) => void;
  select: (ids: Id[]) => void;
  setTrace: (t: UiState['trace']) => void;
  setCursor: (c: UiState['cursor']) => void;
  setZoom: (z: number) => void;
  setSaveStatus: (s: SaveStatus) => void;
  toast: (text: string, kind?: Toast['kind']) => void;
  dismissToast: (id: number) => void;
  setShortcutsOpen: (v: boolean) => void;
  focus: (id: Id | null) => void;
}

let toastSeq = 1;

const sameIds = (a: Id[], b: Id[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export const useUi = create<UiState>((set, get) => ({
  phase: 'concept',
  sheetId: null,
  selection: [],
  trace: null,
  cursor: null,
  zoom: 1,
  saveStatus: 'saved',
  toasts: [],
  shortcutsOpen: false,
  focusId: null,
  setPhase: (phase) => set({ phase }),
  setSheet: (sheetId) => set({ sheetId, selection: [] }),
  select: (ids) => { if (!sameIds(ids, get().selection)) set({ selection: ids }); },
  setTrace: (trace) => set({ trace }),
  setCursor: (cursor) => set({ cursor }),
  setZoom: (zoom) => set({ zoom }),
  setSaveStatus: (saveStatus) => { if (get().saveStatus !== saveStatus) set({ saveStatus }); },
  toast: (text, kind = 'info') => {
    const id = toastSeq++;
    set({ toasts: [...get().toasts, { id, text, kind }] });
    setTimeout(() => get().dismissToast(id), kind === 'error' ? 6000 : 3000);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  focus: (focusId) => set({ focusId }),
}));

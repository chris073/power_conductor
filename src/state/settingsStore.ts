import { create } from 'zustand';
import type { VoltageUnit } from '../domain/units';

export type ThemeChoice = 'auto' | 'light' | 'dark';

export interface Settings {
  symbolStandard: 'ANSI' | 'IEC';
  voltageUnit: VoltageUnit;
  gridSize: 10 | 20 | 40;
  snap: boolean;
  routing: 'orthogonal' | 'straight';
  theme: ThemeChoice;
  autosaveSeconds: number;
  showMinimap: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  symbolStandard: 'ANSI',
  voltageUnit: 'kV',
  gridSize: 20,
  snap: true,
  routing: 'orthogonal',
  theme: 'auto',
  autosaveSeconds: 2,
  showMinimap: true,
};

const KEY = 'conductor:settings';

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULT_SETTINGS };
    const t = localStorage.getItem('pc-theme');
    if (t === 'light' || t === 'dark') s.theme = t;
    return s;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function applyTheme(t: ThemeChoice) {
  const root = document.documentElement;
  if (t === 'auto') delete root.dataset.theme;
  else root.dataset.theme = t;
  try {
    if (t === 'auto') localStorage.removeItem('pc-theme');
    else localStorage.setItem('pc-theme', t);
  } catch { /* ignore */ }
}

interface SettingsState extends Settings {
  set: (patch: Partial<Settings>) => void;
  reset: () => void;
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...load(),
  set: (patch) => {
    set(patch);
    const { set: _s, reset: _r, ...values } = get();
    try { localStorage.setItem(KEY, JSON.stringify(values)); } catch { /* ignore */ }
    if (patch.theme) applyTheme(patch.theme);
  },
  reset: () => {
    set({ ...DEFAULT_SETTINGS });
    applyTheme('auto');
  },
}));

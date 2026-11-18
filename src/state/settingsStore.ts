import { create } from 'zustand';
import type { VoltageUnit } from '../domain/units';

/** 'light' / 'dark' are Desert light / night (ids kept from 0.1 so saved choices still work). */
export type ThemeChoice = 'auto' | 'light' | 'dark' | 'glacier' | 'retro' | 'ember' | 'robot';

/** Home Conductor's theme list (apps/web/public/js/settings.js), with Conductor's ids. */
export const THEMES: { id: ThemeChoice; name: string; note: string; swatch: string[] }[] = [
  { id: 'auto', name: 'Desert (auto)', note: 'NOMAD palette, follows Windows light/dark', swatch: ['#f7eedc', '#424420', '#6d7042', '#c85815'] },
  { id: 'light', name: 'Desert light', note: 'Sand and olive', swatch: ['#f7eedc', '#424420', '#6d7042', '#c85815'] },
  { id: 'dark', name: 'Desert night', note: 'NOMAD dark', swatch: ['#1c1b16', '#2a2a15', '#a5ab7d', '#e69556'] },
  { id: 'glacier', name: 'Glacier', note: 'Cool blue: navy slate and ice', swatch: ['#0e1726', '#142137', '#4cc2ff', '#4fd1a5'] },
  { id: 'retro', name: 'Retro', note: 'White phosphor on black, all monospace', swatch: ['#000000', '#121212', '#f2f2e8', '#8f8f86'] },
  { id: 'ember', name: 'Ember', note: 'Graphite with molten amber', swatch: ['#161619', '#27272c', '#ff8a2a', '#7fd38b'] },
  { id: 'robot', name: 'Robot', note: 'Brushed steel, hazard stripes, status LEDs', swatch: ['#2a2d31', '#1b1d20', '#7ee08a', '#f5b301'] },
];

export const isTheme = (t: unknown): t is ThemeChoice => THEMES.some((x) => x.id === t);

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
    if (isTheme(t) && t !== 'auto') s.theme = t;
    if (!isTheme(s.theme)) s.theme = 'auto';
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

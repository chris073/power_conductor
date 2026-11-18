import { useEffect, useState, type ReactNode } from 'react';
import { PHASES, PHASE_LABEL } from '../domain/types';
import { useProject } from '../state/projectStore';
import { useSettings, type ThemeChoice } from '../state/settingsStore';
import { useUi } from '../state/uiStore';
import { Icon, type IconName } from './icons';

export type Route = 'projects' | 'sld' | 'study' | 'revisions' | 'features' | 'claude' | 'settings';

const NAV: { route: Route; label: string; icon: IconName; group: string }[] = [
  { route: 'projects', label: 'Projects', icon: 'folder', group: 'Work' },
  { route: 'sld', label: 'SLD', icon: 'sld', group: 'Work' },
  { route: 'study', label: 'Study', icon: 'study', group: 'Work' },
  { route: 'revisions', label: 'Revisions', icon: 'history', group: 'Conductor' },
  { route: 'features', label: 'Features', icon: 'flag', group: 'Conductor' },
  { route: 'claude', label: 'Claude Instructions', icon: 'doc', group: 'Conductor' },
  { route: 'settings', label: 'Settings', icon: 'gear', group: 'Conductor' },
];

export function useHashRoute(): Route {
  const read = (): Route => {
    const r = window.location.hash.replace(/^#\/?/, '') as Route;
    return NAV.some((n) => n.route === r) ? r : 'sld';
  };
  const [route, setRoute] = useState<Route>(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

function Brand() {
  return (
    <a className="brand" href="#/sld">
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="17" style={{ fill: 'none', stroke: 'var(--brand-ring)', strokeWidth: 2.5 }} />
        <circle cx="20" cy="20" r="11" style={{ fill: 'none', stroke: 'var(--brand-dash)', strokeWidth: 1.5, strokeDasharray: '2 3' }} />
        <path d="M20 5v10M20 25v10" style={{ stroke: 'var(--header-ink)', strokeWidth: 2.5 }} />
        <rect x="15" y="15" width="10" height="10" style={{ fill: 'var(--brand-ring)' }} />
      </svg>
      <div>
        <h1>CONDUCTOR</h1>
        <p>Power systems sketch &amp; lifecycle</p>
      </div>
    </a>
  );
}

function ProjectName() {
  const name = useProject((s) => s.doc.name);
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);
  const commit = () => {
    const v = draft.trim();
    if (v && v !== name) useProject.getState().rename(v);
    else setDraft(name);
  };
  return (
    <input
      className="project-name"
      value={draft}
      aria-label="Project name"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') { setDraft(name); (e.target as HTMLInputElement).blur(); }
      }}
    />
  );
}

function PhaseSwitcher() {
  const phase = useUi((s) => s.phase);
  return (
    <div className="phase-switch" role="group" aria-label="Lifecycle lens">
      {PHASES.map((p) => (
        <button key={p} aria-pressed={p === phase} onClick={() => useUi.getState().setPhase(p)} title={`${PHASE_LABEL[p]} lens (view only)`}>
          {PHASE_LABEL[p]}
        </button>
      ))}
    </div>
  );
}

function SaveIndicator() {
  const status = useUi((s) => s.saveStatus);
  const label = { saved: 'Saved', saving: 'Saving…', unsaved: 'Unsaved changes', error: 'Save failed' }[status];
  return (
    <div className="save-ind" title="Projects autosave to this browser (localStorage)">
      <span className={`pulse ${status}`} />
      {label}
    </div>
  );
}

const NEXT_THEME: Record<ThemeChoice, ThemeChoice> = { auto: 'light', light: 'dark', dark: 'auto' };

function ThemeToggle() {
  const theme = useSettings((s) => s.theme);
  const icon: IconName = theme === 'auto' ? 'auto' : theme === 'light' ? 'sun' : 'moon';
  return (
    <button className="icon-btn" title={`Theme: ${theme} (click to change)`} aria-label="Toggle theme" onClick={() => useSettings.getState().set({ theme: NEXT_THEME[theme] })}>
      <Icon name={icon} />
    </button>
  );
}

export function TopBar() {
  return (
    <header className="topbar">
      <Brand />
      <ProjectName />
      <div className="spacer" />
      <PhaseSwitcher />
      <SaveIndicator />
      <button className="icon-btn" title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts" onClick={() => useUi.getState().setShortcutsOpen(true)}>
        <Icon name="keyboard" />
      </button>
      <ThemeToggle />
    </header>
  );
}

export function SideNav({ route }: { route: Route }) {
  let group = '';
  return (
    <nav className="nav" aria-label="Sections">
      {NAV.map((n) => {
        const head = n.group !== group ? <div className="nav-group">{(group = n.group)}</div> : null;
        return (
          <div key={n.route}>
            {head}
            <a href={`#/${n.route}`} aria-current={route === n.route ? 'page' : undefined}>
              <Icon name={n.icon} />
              {n.label}
            </a>
          </div>
        );
      })}
    </nav>
  );
}

export function StatusBar() {
  const cursor = useUi((s) => s.cursor);
  const zoom = useUi((s) => s.zoom);
  const selection = useUi((s) => s.selection.length);
  const sheetId = useUi((s) => s.sheetId);
  const sheet = useProject((s) => s.doc.sheets.find((x) => x.id === sheetId)?.name ?? s.doc.sheets[0]?.name);
  const phase = useUi((s) => s.phase);
  return (
    <footer className="statusbar">
      <span title="Cursor (sheet coordinates)">X {cursor?.x ?? '–'} · Y {cursor?.y ?? '–'}</span>
      <span>Zoom {Math.round(zoom * 100)}%</span>
      <span>{selection} selected</span>
      <span>Sheet: {sheet}</span>
      <span>Lens: {PHASE_LABEL[phase]}</span>
      <span className="spacer" />
      <a href="#/revisions" title="App version">Conductor v{__APP_VERSION__}</a>
    </footer>
  );
}

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  return (
    <div className="toasts" role="status">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind === 'error' ? 'err' : ''}`} onClick={() => useUi.getState().dismissToast(t.id)}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

const SHORTCUTS: [string, string][] = [
  ['Drag from palette / click item', 'Place equipment'],
  ['Drag terminal → terminal', 'Connect (drop on a bus anywhere for a new tap)'],
  ['Click, Shift/Ctrl+click, drag on empty canvas', 'Select, add to selection, marquee'],
  ['Space+drag or middle mouse', 'Pan'],
  ['Scroll', 'Zoom at cursor'],
  ['F', 'Zoom to fit'],
  ['R / M', 'Rotate 90° / mirror (flip)'],
  ['O or double-click', 'Toggle open / closed (switching devices)'],
  ['T', 'Trace energization from the selected source'],
  ['Esc', 'Clear selection and trace'],
  ['Delete / Backspace', 'Delete'],
  ['Arrow keys', 'Nudge by one grid step'],
  ['Ctrl+C / Ctrl+X / Ctrl+V', 'Copy / cut / paste at cursor'],
  ['Ctrl+D', 'Duplicate'],
  ['Ctrl+A', 'Select all on sheet'],
  ['Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z)', 'Undo / redo'],
  ['?', 'This overlay'],
];

export function ShortcutOverlay() {
  const open = useUi((s) => s.shortcutsOpen);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;
      if (e.key === '?') useUi.getState().setShortcutsOpen(!useUi.getState().shortcutsOpen);
      else if (e.key === 'Escape' && useUi.getState().shortcutsOpen) useUi.getState().setShortcutsOpen(false);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
  if (!open) return null;
  return (
    <div className="overlay" onClick={() => useUi.getState().setShortcutsOpen(false)}>
      <div className="panel overlay-card" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-head">
          <h2>Keyboard shortcuts</h2>
          <button className="btn ghost small" onClick={() => useUi.getState().setShortcutsOpen(false)}>Close</button>
        </div>
        <table className="mini">
          <tbody>
            {SHORTCUTS.map(([k, v]) => (
              <tr key={k}>
                <td><kbd>{k}</kbd></td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Page({ title, sub, actions, children }: { title: string; sub?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          {sub && <p className="muted">{sub}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
      {children}
    </div>
  );
}


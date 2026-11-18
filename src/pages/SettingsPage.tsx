import { useRef } from 'react';
import { exportProject, importProjectFile, resetLocalData } from '../state/session';
import { THEMES, useSettings, type Settings } from '../state/settingsStore';
import { useUi } from '../state/uiStore';
import { Page } from '../shell/Shell';
import { Icon } from '../shell/icons';

function Seg<T extends string | number | boolean>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map(([v, label]) => (
        <button key={String(v)} aria-pressed={v === value} onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  );
}

function Row({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="setting-row">
      <div>
        <div className="setting-label">{label}</div>
        {help && <small className="muted">{help}</small>}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const s = useSettings();
  const set = (p: Partial<Settings>) => s.set(p);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <Page title="Settings" sub="Stored in this browser.">
      <section className="section">
        <div className="section-head"><h2>Drawing</h2><span className="rule" /></div>
        <div className="panel pad settings">
          <Row label="Symbol standard" help="IEC symbols are on the roadmap; IEC currently falls back to ANSI.">
            <Seg value={s.symbolStandard} options={[['ANSI', 'ANSI / IEEE'], ['IEC', 'IEC']]} onChange={(v) => set({ symbolStandard: v })} />
          </Row>
          <Row label="Voltage display" help="Values are stored in kV; this only changes how they are shown and entered.">
            <Seg value={s.voltageUnit} options={[['kV', 'kV'], ['V', 'V']]} onChange={(v) => set({ voltageUnit: v })} />
          </Row>
          <Row label="Grid size">
            <Seg value={s.gridSize} options={[[10, '10'], [20, '20'], [40, '40']]} onChange={(v) => set({ gridSize: v })} />
          </Row>
          <Row label="Snap to grid">
            <Seg value={s.snap} options={[[true, 'On'], [false, 'Off']]} onChange={(v) => set({ snap: v })} />
          </Row>
          <Row label="Default line routing" help="Orthogonal draws right-angle one-line routes with draggable segments.">
            <Seg value={s.routing} options={[['orthogonal', 'Orthogonal'], ['straight', 'Straight']]} onChange={(v) => set({ routing: v })} />
          </Row>
          <Row label="Minimap">
            <Seg value={s.showMinimap} options={[[true, 'Show'], [false, 'Hide']]} onChange={(v) => set({ showMinimap: v })} />
          </Row>
        </div>
      </section>
      <section className="section">
        <div className="section-head"><h2>App</h2><span className="rule" /></div>
        <div className="panel pad settings">
          <div className="setting-row themes-row">
            <div>
              <div className="setting-label">Theme</div>
              <small className="muted">Home Conductor's themes. The top-bar button steps through them.</small>
            </div>
            <div className="themes" role="group" aria-label="Theme">
              {THEMES.map((t) => (
                <button key={t.id} className="panel theme-card" aria-pressed={t.id === s.theme} onClick={() => set({ theme: t.id })}>
                  <span className="swatch">{t.swatch.map((c) => <i key={c} style={{ background: c }} />)}</span>
                  <strong>{t.name}</strong>
                  <span className="muted small">{t.note}</span>
                </button>
              ))}
            </div>
          </div>
          <Row label="Autosave delay" help="Seconds after the last change before the project is written to local storage.">
            <Seg value={s.autosaveSeconds} options={[[1, '1 s'], [2, '2 s'], [5, '5 s'], [15, '15 s']]} onChange={(v) => set({ autosaveSeconds: v })} />
          </Row>
        </div>
      </section>
      <section className="section">
        <div className="section-head"><h2>Data</h2><span className="rule" /></div>
        <div className="panel pad settings">
          <Row label="Export current project" help="One versioned JSON file (the same format the app saves).">
            <button className="btn" onClick={() => exportProject()}><Icon name="download" size={14} /> Export JSON</button>
          </Row>
          <Row label="Import project" help="Opens it as a new project.">
            <button className="btn" onClick={() => fileRef.current?.click()}><Icon name="upload" size={14} /> Import JSON</button>
            <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) await importProjectFile(f); e.target.value = ''; }} />
          </Row>
          <Row label="Reset local data" help="Deletes every project and setting in this browser, then opens the sample project.">
            <button
              className="btn danger"
              onClick={() => {
                if (!confirm('Delete ALL local projects and settings? Export anything you want to keep first.')) return;
                resetLocalData();
                useUi.getState().toast('Local data reset.');
              }}
            >
              Reset local data
            </button>
          </Row>
        </div>
      </section>
    </Page>
  );
}

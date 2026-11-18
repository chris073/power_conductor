// Study page: project study settings, readiness report, bus-branch table, PSS/E exports and the
// ANDES results import. The domain does the work (src/domain/study); this page only shows it.

import { useMemo, useState } from 'react';
import { buildStudyCase, persistBusNumbers, applyTypicals, writeRaw, writeSeq, type Issue, type StudyCase } from '../domain/study';
import type { Id, StudySettings } from '../domain/types';
import { Page } from '../shell/Shell';
import { Icon } from '../shell/icons';
import { useProject } from '../state/projectStore';
import { useUi } from '../state/uiStore';

function download(name: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Select an object on the SLD (switching sheet and page). */
export function showOnSld(id: Id) {
  const d = useProject.getState().doc;
  const o = d.equipment[id] ?? d.connections[id];
  if (!o) return;
  window.location.hash = '#/sld';
  if (o.sheetId !== useUi.getState().sheetId) useUi.getState().setSheet(o.sheetId);
  useUi.getState().select([id]);
  setTimeout(() => useUi.getState().focus(id), 50);
}

function NumberSetting({ label, value, unit, help, onCommit, min = 0 }: { label: string; value: number; unit?: string; help?: string; onCommit: (v: number) => void; min?: number }) {
  const [draft, setDraft] = useState(String(value));
  const [last, setLast] = useState(value);
  if (last !== value) { setLast(value); setDraft(String(value)); }
  return (
    <label className="field">
      <span>{label}{unit && <em className="unit"> ({unit})</em>}</span>
      <input
        className="input"
        type="number"
        min={min}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { const n = Number(draft); if (Number.isFinite(n) && n >= min && n !== value) onCommit(n); else setDraft(String(value)); }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      />
      {help && <small>{help}</small>}
    </label>
  );
}

const SEV_CLASS: Record<Issue['severity'], string> = { error: 'bad', warning: 'warnish', info: 'okish' };

function Readiness({ sc }: { sc: StudyCase }) {
  const [showInfo, setShowInfo] = useState(false);
  const count = (s: Issue['severity']) => sc.issues.filter((i) => i.severity === s).length;
  const list = sc.issues.filter((i) => showInfo || i.severity !== 'info');
  return (
    <section className="section">
      <div className="section-head">
        <h2>Readiness</h2>
        <span className="meta">{count('error')} errors · {count('warning')} warnings · {count('info')} notes (typical values used)</span>
        <span className="rule" />
        <label className="small"><input type="checkbox" checked={showInfo} onChange={(e) => setShowInfo(e.target.checked)} /> Show notes</label>
      </div>
      <div className="panel">
        {list.length === 0 ? (
          <p className="muted" style={{ padding: 12 }}>{count('error') + count('warning') === 0 ? 'Ready: no errors or warnings.' : ''}</p>
        ) : (
          <ul className="issue-list">
            {list.map((i, k) => (
              <li key={k}>
                <span className={`tag ${SEV_CLASS[i.severity]}`}>{i.severity}</span>
                {i.objectId ? <button className="link-btn" onClick={() => showOnSld(i.objectId!)} title="Show on the SLD">{i.message}</button> : <span>{i.message}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function BusTable({ sc }: { sc: StudyCase }) {
  const doc = useProject((s) => s.doc);
  const IDE = { 1: 'PQ', 2: 'PV', 3: 'Swing', 4: 'Isolated' } as const;
  const res = doc.studyResults;
  return (
    <section className="section">
      <div className="section-head">
        <h2>Bus-branch model</h2>
        <span className="meta">{sc.buses.length} buses · {sc.branches.length} branches · {sc.xfmr2.length + sc.xfmr3.length} transformers · {sc.gens.length} machines · {sc.loads.length} loads · {sc.fixedShunts.length + sc.switchedShunts.length} shunts</span>
        <span className="rule" />
      </div>
      <div className="panel table-scroll">
        <table>
          <thead>
            <tr><th>Bus</th><th>Name</th><th>Base kV</th><th>Type</th><th>Island</th>{res && <th>Vm / Va</th>}<th>Members</th></tr>
          </thead>
          <tbody>
            {sc.buses.map((b) => {
              const r = res?.buses[String(b.number)];
              return (
                <tr key={b.number}>
                  <td><code>{b.number}</code>{!b.numberSticky && <span className="muted small" title="Assigned in this build; saved on export or with Save bus numbers"> new</span>}</td>
                  <td>{b.name}</td>
                  <td>{b.baseKv}</td>
                  <td>{IDE[b.ide]}</td>
                  <td>{b.island}</td>
                  {res && <td className="num">{r ? `${r.vm.toFixed(4)} ∠${r.va.toFixed(2)}°` : '—'}</td>}
                  <td className="members">
                    {b.memberIds.map((id) => doc.equipment[id]).filter(Boolean).map((e) => (
                      <button key={e!.id} className="link-btn small" onClick={() => showOnSld(e!.id)}>{e!.tag}</button>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function StudyPage() {
  const doc = useProject((s) => s.doc);
  const sc = useMemo(() => buildStudyCase(doc), [doc]);
  const st = doc.study;
  const set = (patch: Partial<StudySettings>) => useProject.getState().setStudy(patch);
  const base = doc.name.replace(/[^\w.-]+/g, '_') || 'study';
  const errors = sc.issues.filter((i) => i.severity === 'error').length;

  /** Saves new bus numbers first, so the files and the project agree. */
  const exportCase = () => {
    const d0 = useProject.getState().doc;
    const saved = persistBusNumbers(d0, buildStudyCase(d0));
    if (saved !== d0) useProject.getState().replaceDoc(saved);
    return buildStudyCase(saved);
  };
  const meta = { app: `Conductor ${__APP_VERSION__}`, date: new Date().toISOString().slice(0, 10) };
  const exportRaw = () => download(`${base}.raw`, writeRaw(exportCase(), meta));
  const exportSeq = () => download(`${base}.seq`, writeSeq(exportCase()));

  return (
    <Page
      title="Study"
      sub={<>Bus-branch model of the one-line for PSS/E (RAW v33) and ANDES. Closed switching devices and buses merge; cables with a length become branches. See D-011.</>}
      actions={
        <>
          <button className="btn" onClick={exportRaw} title="PSS/E RAW v33 power-flow case"><Icon name="download" size={14} /> RAW</button>
          <button className="btn" onClick={exportSeq} title="PSS/E 33 sequence data (short circuit)"><Icon name="download" size={14} /> SEQ</button>
        </>
      }
    >
      {errors > 0 && <p className="banner">{errors} readiness error{errors > 1 ? 's' : ''}. The files still export, but PSS/E or ANDES may reject them or solve the wrong case.</p>}
      <section className="section">
        <div className="section-head"><h2>Study settings</h2><span className="rule" /></div>
        <div className="panel settings-grid">
          <NumberSetting label="System MVA base" unit="MVA" value={st.baseMva} min={1} onCommit={(v) => set({ baseMva: v })} help="PSS/E SBASE. Per-unit values use this base." />
          <NumberSetting label="Frequency" unit="Hz" value={st.freqHz} min={1} onCommit={(v) => set({ freqHz: v })} />
          <label className="field"><span>RAW version</span><input className="input" value="33" disabled /><small>Fixed at 33 (bus-branch). RAW v35 node-breaker is on the roadmap.</small></label>
          <NumberSetting label="Collapse cables shorter than" unit="ft" value={st.collapseFt} onCommit={(v) => set({ collapseFt: v })} help="They merge as zero-impedance ties. 0 keeps every cable with a length." />
          <NumberSetting label="Collapse cables with |Z| below" unit="Ω" value={st.collapseOhm} onCommit={(v) => set({ collapseOhm: v })} help="0 disables the impedance test." />
        </div>
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className="btn small" disabled={!sc.newNumbers.length} onClick={() => useProject.getState().replaceDoc(persistBusNumbers(doc, sc))} title="Store the bus numbers so they stay the same in later exports">
            Save bus numbers{sc.newNumbers.length ? ` (${sc.newNumbers.length} new)` : ''}
          </button>
          <button className="btn small" disabled={!sc.typicals.length} onClick={() => { useProject.getState().replaceDoc(applyTypicals(doc, sc)); useUi.getState().toast(`Applied ${sc.typicals.length} typical values (marked “typical” in the inspector).`); }} title="Write the typical values into the objects, marked as typical">
            Apply typicals ({sc.typicals.length})
          </button>
        </div>
      </section>
      <Readiness sc={sc} />
      <BusTable sc={sc} />
    </Page>
  );
}

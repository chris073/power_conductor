// Schema-driven inspector: ID / type / tag, open-closed state, label choice, properties by
// lifecycle phase, custom properties, and clickable connections.

import { useEffect, useState } from 'react';
import { CATALOG } from '../../domain/catalog';
import { fieldVisible, isTypical, missingRequired, missingStudy, newId, schemaForObject, terminalsOf } from '../../domain/model';
import { STUDY_LABEL, type FieldDef, type StudyTag } from '../../domain/schemas';
import { connectionsOf } from '../../domain/topology';
import { PHASES, PHASE_LABEL, type Annotation, type Connection, type CustomProp, type Equipment, type Id, type Phase, type PropValue } from '../../domain/types';
import { displayUnit, fromDisplay, toDisplay } from '../../domain/units';
import * as cmd from '../../state/commands';
import { useProject } from '../../state/projectStore';
import { useSettings } from '../../state/settingsStore';
import { useUi } from '../../state/uiStore';
import { Icon } from '../../shell/icons';

function goTo(id: Id) {
  const d = useProject.getState().doc;
  const o = d.equipment[id] ?? d.connections[id];
  if (o && o.sheetId !== useUi.getState().sheetId) useUi.getState().setSheet(o.sheetId);
  useUi.getState().select([id]);
  if (d.layout.nodes[id]) useUi.getState().focus(id);
}

/** Text input that commits on blur / Enter (one undo step per edit, not per keystroke). */
function CommitInput({ value, onCommit, type = 'text', placeholder, className = 'input', ariaLabel }: { value: string; onCommit: (v: string) => void; type?: string; placeholder?: string; className?: string; ariaLabel?: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      className={className}
      type={type}
      value={draft}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft !== value) onCommit(draft); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') { setDraft(value); }
      }}
    />
  );
}

function CommitArea({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return <textarea className="input" rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => { if (draft !== value) onCommit(draft); }} />;
}

function FieldEditor({ id, f, value, missing, typical }: { id: Id; f: FieldDef; value: PropValue | undefined; missing: boolean; typical?: boolean }) {
  const vu = useSettings((s) => s.voltageUnit);
  const set = (v: PropValue) => useProject.getState().setProp(id, f.key, v);
  const unit = displayUnit(f, vu);
  const shown = toDisplay(f, value, vu);
  let control;
  switch (f.type) {
    case 'enum':
      control = (
        <select className="input" value={typeof value === 'string' ? value : ''} onChange={(e) => set(e.target.value || null)}>
          <option value="">—</option>
          {f.options!.filter(Boolean).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
      break;
    case 'bool':
      control = <input type="checkbox" checked={value === true} onChange={(e) => set(e.target.checked)} />;
      break;
    case 'number':
      control = (
        <CommitInput
          type="number"
          placeholder={typeof f.dflt === 'number' ? `typical ${f.dflt}` : undefined}
          value={shown === undefined || shown === null ? '' : String(shown)}
          onCommit={(v) => {
            if (v.trim() === '') return set(null);
            const n = Number(v);
            if (Number.isFinite(n)) set(fromDisplay(f, n, vu));
          }}
        />
      );
      break;
    case 'date':
      control = <input className="input" type="date" value={typeof value === 'string' ? value : ''} onChange={(e) => set(e.target.value || null)} />;
      break;
    case 'textarea':
      control = <CommitArea value={typeof value === 'string' ? value : ''} onCommit={(v) => set(v || null)} />;
      break;
    default:
      control = <CommitInput value={value === undefined || value === null ? '' : String(value)} onCommit={(v) => set(v || null)} />;
  }
  return (
    <label className={`field ${f.type === 'bool' ? 'field-bool' : ''} ${missing ? 'field-missing' : ''}`}>
      <span>
        {f.label}
        {unit && <em className="unit"> ({unit})</em>}
        {f.requiredIn?.length ? <em className="req" title={`Required in: ${f.requiredIn.map((p) => PHASE_LABEL[p]).join(', ')}`}> *</em> : null}
        {f.need && !f.requiredIn?.length ? <em className="req study" title={`Needed for ${STUDY_LABEL[f.study ?? 'pf']} (a typical value can fill it)`}> °</em> : null}
        {typical && <em className="typ" title="Typical value from a library, filled by the study tools. Edit it to enter your own.">typical</em>}
      </span>
      {control}
      {f.help && <small>{f.help}</small>}
    </label>
  );
}

function CustomProps({ id, custom }: { id: Id; custom: CustomProp[] }) {
  const update = (next: CustomProp[]) => useProject.getState().setCustom(id, next);
  const patch = (cid: Id, p: Partial<CustomProp>) => update(custom.map((c) => (c.id === cid ? { ...c, ...p } : c)));
  return (
    <section className="insp-section">
      <h4>Custom properties</h4>
      {custom.length > 0 && (
        <div className="custom-grid">
          <span className="muted small">Key</span><span className="muted small">Value</span><span className="muted small">Unit</span><span />
          {custom.map((c) => (
            <div key={c.id} className="custom-row">
              <CommitInput value={c.key} placeholder="key" ariaLabel="Custom key" onCommit={(v) => patch(c.id, { key: v })} />
              <CommitInput value={c.value} placeholder="value" ariaLabel="Custom value" onCommit={(v) => patch(c.id, { value: v })} />
              <CommitInput value={c.unit ?? ''} placeholder="unit" ariaLabel="Custom unit" onCommit={(v) => patch(c.id, { unit: v || undefined })} />
              <button className="btn icon ghost" title="Remove" onClick={() => update(custom.filter((x) => x.id !== c.id))}><Icon name="x" size={14} /></button>
            </div>
          ))}
        </div>
      )}
      <button className="btn small" onClick={() => update([...custom, { id: newId(), key: '', value: '' }])}><Icon name="plus" size={14} /> Add property</button>
    </section>
  );
}

function PhaseTabs({ obj }: { obj: Equipment | Connection }) {
  const lens = useUi((s) => s.phase);
  const fields = schemaForObject(obj);
  // Open the lens phase, or the first phase that has fields for this type.
  const initial = (p: Phase): Phase => (fields.some((f) => f.phase === p) ? p : PHASES.find((x) => fields.some((f) => f.phase === x)) ?? p);
  const [tab, setTab] = useState<Phase>(() => initial(lens));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setTab(initial(lens)), [lens]);
  const shown = fields.filter((f) => f.phase === tab && fieldVisible(f, obj.props));
  const missing = new Set(missingRequired(obj, tab).map((f) => f.key));
  const general = shown.filter((f) => !f.study);
  const editor = (f: FieldDef) => <FieldEditor key={f.key} id={obj.id} f={f} value={obj.props[f.key]} missing={missing.has(f.key)} typical={isTypical(obj, f.key)} />;
  return (
    <section className="insp-section">
      <div className="tabs" role="tablist">
        {PHASES.map((p) => {
          const n = fields.filter((f) => f.phase === p).length;
          const miss = missingRequired(obj, p).length;
          return (
            <button key={p} role="tab" aria-selected={p === tab} onClick={() => setTab(p)} disabled={!n} title={n ? `${PHASE_LABEL[p]}: ${n} fields` : `No ${PHASE_LABEL[p]} fields`}>
              {PHASE_LABEL[p]}
              {miss > 0 && <i className="tab-miss">{miss}</i>}
            </button>
          );
        })}
      </div>
      <div className="fields">
        {general.map(editor)}
        {!shown.length && <p className="muted small">No {PHASE_LABEL[tab]} fields for this type.</p>}
      </div>
      {(['pf', 'sc', 'dyn'] as StudyTag[]).map((tag) => {
        const group = shown.filter((f) => f.study === tag);
        if (!group.length) return null;
        return <ModelGroup key={tag} obj={obj} tag={tag} fields={group} editor={editor} />;
      })}
    </section>
  );
}

/** "Model: Power flow / Short circuit / Dynamics" group with a readiness badge. Dynamic model parameters fold per model. */
function ModelGroup({ obj, tag, fields, editor }: { obj: Equipment | Connection; tag: StudyTag; fields: FieldDef[]; editor: (f: FieldDef) => React.ReactNode }) {
  const miss = missingStudy(obj, tag).length;
  const plain = fields.filter((f) => !f.key.startsWith('design.dyn.'));
  const byModel = new Map<string, FieldDef[]>();
  for (const f of fields) {
    const m = /^design\.dyn\.([^.]+)\./.exec(f.key);
    if (!m) continue;
    const list = byModel.get(m[1]!) ?? [];
    list.push(f);
    byModel.set(m[1]!, list);
  }
  return (
    <details className="model-group" open={tag === 'pf'}>
      <summary>
        Model: {STUDY_LABEL[tag]}
        {miss > 0 ? <i className="tab-miss" title={`${miss} value(s) the ${STUDY_LABEL[tag].toLowerCase()} study needs are empty (typicals can fill them on the Study page)`}>{miss}</i> : <i className="model-ok" title="Ready">✓</i>}
      </summary>
      <div className="fields">{plain.map(editor)}</div>
      {[...byModel].map(([model, list]) => (
        <details key={model} className="model-params">
          <summary>{model} parameters <span className="muted small">({list.length})</span></summary>
          <div className="fields">{list.map(editor)}</div>
        </details>
      ))}
    </details>
  );
}

/** Read-only values from the last imported power-flow solution. */
function StudyResultsSection({ id }: { id: Id }) {
  const res = useProject((s) => s.doc.studyResults);
  const r = res?.objects[id];
  if (!res || !r) return null;
  const n = (v: number | undefined, d: number) => (v === undefined ? '—' : v.toFixed(d));
  return (
    <section className="insp-section">
      <h4>Study results <span className="muted small">(read-only)</span></h4>
      <dl className="results-grid">
        {r.vm !== undefined && (<><dt>Voltage</dt><dd>{n(r.vm, 4)} pu ∠ {n(r.va, 2)}°</dd></>)}
        {r.pFrom !== undefined && (<><dt>From end</dt><dd>{n(r.pFrom, 3)} MW, {n(r.qFrom, 3)} Mvar</dd><dt>To end</dt><dd>{n(r.pTo, 3)} MW, {n(r.qTo, 3)} Mvar</dd><dt>Losses</dt><dd>{n((r.pFrom ?? 0) + (r.pTo ?? 0), 4)} MW</dd></>)}
      </dl>
      <small className="muted">{res.converged ? '' : 'Not converged. '}{res.source}; imported {new Date(res.at).toLocaleString()}.</small>
    </section>
  );
}

function IdRow({ id }: { id: Id }) {
  return (
    <div className="id-row" title="Stable ID (never changes; tags are just labels)">
      <code>{id.slice(0, 8)}…</code>
      <button className="btn ghost small" onClick={() => { void navigator.clipboard?.writeText(id); useUi.getState().toast('ID copied'); }}>Copy ID</button>
    </div>
  );
}

function EquipmentPanel({ e }: { e: Equipment }) {
  const doc = useProject((s) => s.doc);
  const def = CATALOG[e.type];
  const conns = connectionsOf(doc, e.id);
  const labelable = schemaForObject(e).filter((f) => f.type !== 'textarea' && (f.phase === 'concept' || f.phase === 'design'));
  const setLabel = (i: number, key: string) => {
    const next = [...e.labelFields];
    next[i] = key;
    useProject.getState().setLabelFields(e.id, next.filter(Boolean));
  };
  const termLabel = (eq: Equipment, tid: string) => terminalsOf(eq).find((t) => t.id === tid)?.label ?? tid;
  return (
    <>
      <header className="insp-head">
        <div className="insp-type">{def.label}</div>
        <CommitInput className="input insp-tag" value={e.tag} ariaLabel="Tag" onCommit={(v) => v.trim() && useProject.getState().setTag(e.id, v.trim())} />
        <IdRow id={e.id} />
      </header>
      {e.state && (
        <div className="insp-state">
          <span className={`status ${e.state === 'closed' ? 'closed' : 'open'}`}>{e.state === 'closed' ? 'Closed' : 'Open'}</span>
          <button className="btn small" onClick={() => useProject.getState().toggleState(e.id)}>
            <Icon name="power" size={14} /> {e.state === 'closed' ? 'Open it' : 'Close it'}
          </button>
        </div>
      )}
      <div className="insp-actions">
        <button className="btn small" onClick={() => { const m = cmd.traceSelection(); if (m) useUi.getState().toast(m); }} title="Trace energization from here (T)">
          <Icon name="trace" size={14} /> Trace from here
        </button>
      </div>
      <StudyResultsSection id={e.id} />
      <PhaseTabs obj={e} />
      {e.type !== 'lineup' && (
        <section className="insp-section">
          <h4>Canvas label</h4>
          <div className="label-pick">
            {[0, 1].map((i) => (
              <select key={i} className="input" value={e.labelFields[i] ?? ''} onChange={(ev) => setLabel(i, ev.target.value)} aria-label={`Label rating ${i + 1}`}>
                <option value="">— none —</option>
                {labelable.map((f) => <option key={f.key} value={f.key}>{f.label} ({PHASE_LABEL[f.phase]})</option>)}
              </select>
            ))}
          </div>
          <small className="muted">Shown under the tag in the Design lens.</small>
        </section>
      )}
      <section className="insp-section">
        <h4>Connections ({conns.length})</h4>
        {conns.length === 0 && <p className="muted small">Not connected. Drag from a terminal dot to another terminal or onto a bus.</p>}
        <ul className="conn-list">
          {conns.map((c) => {
            const mine = c.from.equipmentId === e.id ? c.from : c.to;
            const other = c.from.equipmentId === e.id ? c.to : c.from;
            const oe = doc.equipment[other.equipmentId];
            return (
              <li key={c.id}>
                <span className="muted small">{termLabel(e, mine.terminalId)} →</span>{' '}
                <button className="link-btn" onClick={() => goTo(c.id)} title="Select this cable">{c.tag}</button>{' '}
                <span className="muted small">→</span>{' '}
                {oe ? <button className="link-btn" onClick={() => goTo(oe.id)}>{oe.tag}</button> : '?'}
                {oe && <span className="muted small"> ({termLabel(oe, other.terminalId)})</span>}
              </li>
            );
          })}
        </ul>
      </section>
      <CustomProps id={e.id} custom={e.custom} />
    </>
  );
}

function ConnectionPanel({ c }: { c: Connection }) {
  const doc = useProject((s) => s.doc);
  const a = doc.equipment[c.from.equipmentId];
  const b = doc.equipment[c.to.equipmentId];
  const route = doc.layout.routes[c.id];
  return (
    <>
      <header className="insp-head">
        <div className="insp-type">{c.kind === 'cable' ? 'Cable' : 'Control wiring'}</div>
        <CommitInput className="input insp-tag" value={c.tag} ariaLabel="Tag" onCommit={(v) => v.trim() && useProject.getState().setTag(c.id, v.trim())} />
        <IdRow id={c.id} />
      </header>
      <section className="insp-section">
        <h4>Ends</h4>
        <ul className="conn-list">
          <li>From {a ? <button className="link-btn" onClick={() => goTo(a.id)}>{a.tag}</button> : '?'} <span className="muted small">({c.from.terminalId.length > 8 ? 'tap' : c.from.terminalId})</span></li>
          <li>To {b ? <button className="link-btn" onClick={() => goTo(b.id)}>{b.tag}</button> : '?'} <span className="muted small">({c.to.terminalId.length > 8 ? 'tap' : c.to.terminalId})</span></li>
        </ul>
        {route?.mode === 'manual' && (
          <button className="btn small" onClick={() => useProject.getState().setRoute(c.id, null)}>Reset to auto route</button>
        )}
        <small className="muted"> Select the cable and drag its segment handles to reshape it.</small>
      </section>
      <StudyResultsSection id={c.id} />
      <PhaseTabs obj={c} />
      <CustomProps id={c.id} custom={c.custom} />
    </>
  );
}

function AnnotationPanel({ a }: { a: Annotation }) {
  return (
    <>
      <header className="insp-head">
        <div className="insp-type">{a.kind === 'note' ? 'Text note' : 'Revision cloud'}</div>
      </header>
      <section className="insp-section">
        <label className="field">
          <span>{a.kind === 'note' ? 'Text' : 'Cloud label'}</span>
          <CommitArea value={a.text} onCommit={(v) => useProject.getState().setNoteText(a.id, v)} />
        </label>
      </section>
    </>
  );
}

export function Inspector() {
  const sel = useUi((s) => s.selection);
  const doc = useProject((s) => s.doc);
  const sheetId = useUi((s) => s.sheetId);
  if (sel.length === 0) {
    const onSheet = Object.values(doc.equipment).filter((e) => e.sheetId === sheetId).length;
    const cables = Object.values(doc.connections).filter((c) => c.sheetId === sheetId).length;
    return (
      <aside className="inspector">
        <header className="insp-head"><div className="insp-type">Nothing selected</div></header>
        <section className="insp-section">
          <p className="muted small">{onSheet} objects and {cables} connections on this sheet.</p>
          <ul className="tips small">
            <li>Drag symbols from the palette, or click one to drop it in the middle.</li>
            <li>Drag from a terminal dot to another terminal. Drop on a bus anywhere to tap it.</li>
            <li>Click any object or cable to edit its properties here.</li>
            <li>Use the lens switcher in the top bar to view the drawing by lifecycle phase.</li>
            <li>Press <kbd>?</kbd> for all shortcuts.</li>
          </ul>
        </section>
      </aside>
    );
  }
  if (sel.length > 1) {
    return (
      <aside className="inspector">
        <header className="insp-head"><div className="insp-type">{sel.length} selected</div></header>
        <section className="insp-section">
          <div className="btn-row">
            <button className="btn small" onClick={() => cmd.alignSelection('left')}>Align left</button>
            <button className="btn small" onClick={() => cmd.alignSelection('top')}>Align top</button>
            <button className="btn small" onClick={() => cmd.alignSelection('hcenter')}>Align centers</button>
            <button className="btn small" onClick={() => cmd.distributeSelection('h')}>Distribute ↔</button>
            <button className="btn small" onClick={() => cmd.distributeSelection('v')}>Distribute ↕</button>
          </div>
          <div className="btn-row">
            <button className="btn small" onClick={cmd.duplicateSelection}>Duplicate</button>
            <button className="btn small danger" onClick={cmd.deleteSelection}>Delete</button>
          </div>
        </section>
      </aside>
    );
  }
  const id = sel[0]!;
  const e = doc.equipment[id];
  const c = doc.connections[id];
  const a = doc.annotations[id];
  return (
    <aside className="inspector" key={id}>
      {e && <EquipmentPanel e={e} />}
      {c && <ConnectionPanel c={c} />}
      {a && <AnnotationPanel a={a} />}
    </aside>
  );
}

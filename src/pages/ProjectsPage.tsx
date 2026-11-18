import { useRef, useState } from 'react';
import { useProject } from '../state/projectStore';
import { deleteProject, duplicateProject, exportProject, importProjectFile, newProject, newSampleProject, openProject, renameProject, saveNow } from '../state/session';
import { storage } from '../state/storage';
import { useUi } from '../state/uiStore';
import { Page } from '../shell/Shell';
import { Icon } from '../shell/icons';

export function ProjectsPage() {
  const current = useProject((s) => s.doc);
  const [, force] = useState(0);
  const refresh = () => force((n) => n + 1);
  const fileRef = useRef<HTMLInputElement>(null);
  saveNow();
  const list = storage.list();

  return (
    <Page
      title="Projects"
      sub="Projects live in this browser and autosave. Each project holds one or more SLD sheets. Export a project to keep or share it as one JSON file."
      actions={
        <>
          <button className="btn primary" onClick={() => { newProject(); location.hash = '#/sld'; }}><Icon name="plus" size={14} /> New project</button>
          <button className="btn" onClick={() => { newSampleProject(); location.hash = '#/sld'; }}>New from sample</button>
          <button className="btn" onClick={() => fileRef.current?.click()}><Icon name="upload" size={14} /> Import JSON</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { await importProjectFile(f); refresh(); } e.target.value = ''; }} />
        </>
      }
    >
      <div className="panel">
        <table>
          <thead>
            <tr><th>Name</th><th>Sheets</th><th>Objects</th><th>Last changed</th><th className="r">Actions</th></tr>
          </thead>
          <tbody>
            {list.map((m) => {
              const isCurrent = m.id === current.id;
              return (
                <tr key={m.id} className={isCurrent ? 'current' : ''}>
                  <td>
                    <input
                      className="input inline-name"
                      defaultValue={isCurrent ? current.name : m.name}
                      key={`${m.id}-${isCurrent ? current.name : m.name}`}
                      aria-label="Project name"
                      onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== m.name) { renameProject(m.id, v); refresh(); } }}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    />
                    {isCurrent && <span className="tag okish">open</span>}
                  </td>
                  <td className="num">{m.sheets}</td>
                  <td className="num">{m.objects}</td>
                  <td className="muted small">{new Date(m.updatedAt).toLocaleString()}</td>
                  <td className="r">
                    <div className="btn-row end">
                      <button className="btn small" onClick={() => { openProject(m.id); location.hash = '#/sld'; }}>Open</button>
                      <button className="btn small" onClick={() => { duplicateProject(m.id); refresh(); useUi.getState().toast('Project duplicated.'); }}>Duplicate</button>
                      <button className="btn small" onClick={() => exportProject(m.id)} title="Download as JSON"><Icon name="download" size={14} /> Export</button>
                      <button className="btn small danger" onClick={() => { if (confirm(`Delete “${m.name}”? This cannot be undone.`)) { deleteProject(m.id); refresh(); } }}>Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!list.length && <p className="empty">No projects yet.</p>}
      </div>
    </Page>
  );
}

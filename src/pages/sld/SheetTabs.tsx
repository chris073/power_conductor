import { useState } from 'react';
import { useProject } from '../../state/projectStore';
import { useUi } from '../../state/uiStore';
import { Icon } from '../../shell/icons';

export function SheetTabs({ current }: { current: string }) {
  const sheets = useProject((s) => s.doc.sheets);
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="sheet-tabs" role="tablist" aria-label="Sheets">
      {sheets.map((s) => (
        <div key={s.id} className={`sheet-tab ${s.id === current ? 'active' : ''}`} role="tab" aria-selected={s.id === current}>
          {editing === s.id ? (
            <input
              className="input sheet-edit"
              autoFocus
              defaultValue={s.name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== s.name) useProject.getState().renameSheet(s.id, v);
                setEditing(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur();
              }}
            />
          ) : (
            <button onClick={() => useUi.getState().setSheet(s.id)} onDoubleClick={() => setEditing(s.id)} title="Double-click to rename">
              {s.name}
            </button>
          )}
          {sheets.length > 1 && s.id === current && (
            <button
              className="sheet-x"
              title="Delete sheet"
              onClick={() => {
                if (!confirm(`Delete “${s.name}” and everything on it?`)) return;
                const other = sheets.find((x) => x.id !== s.id)!;
                useUi.getState().setSheet(other.id);
                useProject.getState().removeSheet(s.id);
              }}
            >
              <Icon name="x" size={12} />
            </button>
          )}
        </div>
      ))}
      <button className="sheet-add" title="Add sheet" onClick={() => useUi.getState().setSheet(useProject.getState().addSheet())}>
        <Icon name="plus" size={14} />
      </button>
    </div>
  );
}

import { memo, useMemo, useState } from 'react';
import { DRAG_MIME, placeItem, useCanvasApi } from '../../canvas/SldCanvas';
import { SWITCHING, TYPES, type Category } from '../../domain/catalog';
import type { Equipment, EquipmentType } from '../../domain/types';
import { currentSheet } from '../../state/commands';
import { useSettings } from '../../state/settingsStore';
import { useUi } from '../../state/uiStore';
import { SymbolSvg } from '../../symbols/Symbol';
import { Icon } from '../../shell/icons';

interface Item { id: string; label: string; category: Category | 'Annotations'; keywords: string; type?: EquipmentType }

const ITEMS: Item[] = [
  ...TYPES.map((t) => ({ id: t.type, label: t.label, category: t.category, keywords: `${t.label} ${t.keywords} ${t.tagPrefix}`.toLowerCase(), type: t.type })),
  { id: 'note', label: 'Text note', category: 'Annotations', keywords: 'text note label comment' },
  { id: 'cloud', label: 'Revision cloud', category: 'Annotations', keywords: 'revision cloud markup' },
];

const ORDER: (Category | 'Annotations')[] = ['Sources', 'Transformers', 'Switching', 'Buses & gear', 'Protection & metering', 'Loads', 'Other', 'Annotations'];

const Preview = memo(function Preview({ item }: { item: Item }) {
  if (!item.type) {
    return (
      <svg viewBox="0 0 40 40" width={32} height={32} className="pal-svg">
        {item.id === 'note' ? (
          <g fill="none" stroke="currentColor" strokeWidth={2}><path d="M8 10h24M8 18h24M8 26h14" /></g>
        ) : (
          <path d="M6 14 a5 5 0 0 1 9 -4 a5 5 0 0 1 10 0 a5 5 0 0 1 9 4 a5 5 0 0 1 0 12 a5 5 0 0 1 -9 4 a5 5 0 0 1 -10 0 a5 5 0 0 1 -9 -4 a5 5 0 0 1 0 -12z" fill="none" stroke="currentColor" strokeWidth={1.6} />
        )}
      </svg>
    );
  }
  const t = TYPES.find((x) => x.type === item.type)!;
  const fake: Equipment = { id: 'p', type: t.type, sheetId: '', tag: '', props: {}, custom: [], labelFields: [], state: SWITCHING.has(t.type) ? 'closed' : undefined };
  if (t.type === 'bus') {
    return (
      <svg viewBox="0 0 40 40" width={32} height={32} className="pal-svg">
        <path d="M4 20h32" stroke="currentColor" strokeWidth={5} />
        <path d="M12 20v12M28 20v12M20 8v12" stroke="currentColor" strokeWidth={1.6} />
      </svg>
    );
  }
  const w = t.w;
  const h = t.h;
  const pad = 6;
  return (
    <svg viewBox={`${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`} width={32} height={32} className="pal-svg">
      <SymbolSvg eq={fake} w={w} h={h} />
    </svg>
  );
});

export function Palette() {
  const [q, setQ] = useState('');
  const api = useCanvasApi();
  const grid = useSettings((s) => s.gridSize);
  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = term ? ITEMS.filter((i) => term.split(/\s+/).every((w) => i.keywords.includes(w) || i.label.toLowerCase().includes(w))) : ITEMS;
    return ORDER.map((c) => ({ c, items: list.filter((i) => i.category === c) })).filter((g) => g.items.length);
  }, [q]);

  const place = (item: Item) => {
    const id = placeItem(item.id, currentSheet(), api.center(), grid);
    useUi.getState().select([id]);
  };

  return (
    <aside className="palette" aria-label="Symbol palette">
      <div className="palette-search">
        <Icon name="search" size={16} />
        <input className="input" placeholder="Search symbols…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="palette-list">
        {groups.map((g) => (
          <section key={g.c}>
            <h3 className="palette-cat">{g.c}</h3>
            <div className="palette-grid">
              {g.items.map((i) => (
                <button
                  key={i.id}
                  className="pal-item"
                  draggable
                  title={`${i.label}: drag onto the sheet, or click to place in the middle`}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DRAG_MIME, i.id);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => place(i)}
                >
                  <Preview item={i} />
                  <span>{i.label}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
        {!groups.length && <p className="empty">No symbols match “{q}”.</p>}
      </div>
    </aside>
  );
}

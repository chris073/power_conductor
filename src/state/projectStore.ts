// The open project: one ProjectDoc (domain + layout) with undo/redo (zundo).
// Every user action is one `mutate` call, so it is one undo step. Drags commit once on drag stop.

import { create } from 'zustand';
import { temporal } from 'zundo';
import { CATALOG } from '../domain/catalog';
import { copyFragment, pasteFragment, type Fragment } from '../domain/clipboard';
import { createConnection, createEquipment, createProject, newId, nowIso } from '../domain/model';
import type { AnnotationKind, CustomProp, EquipmentType, Id, NodeLayout, ProjectDoc, PropValue, RouteLayout, StudySettings, TerminalRef } from '../domain/types';
import { DEFAULT_BUS_LENGTH, isBusVertical, rotateLayout, snap } from '../layout/geometry';

interface ProjectState {
  doc: ProjectDoc;
  load: (doc: ProjectDoc) => void;
  rename: (name: string) => void;
  addSheet: (name?: string) => Id;
  renameSheet: (id: Id, name: string) => void;
  removeSheet: (id: Id) => void;
  addEquipment: (type: EquipmentType, sheetId: Id, at: { x: number; y: number }) => Id;
  addAnnotation: (kind: AnnotationKind, sheetId: Id, at: { x: number; y: number }) => Id;
  moveNodes: (pos: Record<Id, { x: number; y: number }>) => void;
  patchNode: (id: Id, patch: Partial<NodeLayout>) => void;
  rotate: (ids: Id[], grid: number) => void;
  flip: (ids: Id[]) => void;
  remove: (ids: Id[]) => void;
  connect: (from: TerminalRef, to: TerminalRef, sheetId: Id) => Id | null;
  connectToBus: (from: TerminalRef, busId: Id, offset: number, sheetId: Id, grid: number) => Id | null;
  setRoute: (connId: Id, route: RouteLayout | null) => void;
  moveTap: (busId: Id, tapId: string, offset: number) => void;
  resizeBus: (busId: Id, x: number, y: number, length: number) => void;
  resizeBox: (id: Id, x: number, y: number, w: number, h: number) => void;
  setProp: (id: Id, key: string, value: PropValue) => void;
  setStudy: (patch: Partial<StudySettings>) => void;
  /** Replace the document with a derived one (study tools: apply typicals, assign bus numbers, import results). One undo step. */
  replaceDoc: (next: ProjectDoc) => void;
  setTag: (id: Id, tag: string) => void;
  toggleState: (id: Id) => void;
  setLabelFields: (id: Id, keys: string[]) => void;
  setCustom: (id: Id, custom: CustomProp[]) => void;
  setNoteText: (id: Id, text: string) => void;
  paste: (frag: Fragment, sheetId: Id, dx: number, dy: number) => Id[];
  duplicate: (ids: Id[], sheetId: Id, grid: number) => Id[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const useProject = create<ProjectState>()(
  temporal(
    (set, get) => {
      const mutate = (fn: (d: ProjectDoc) => ProjectDoc) => {
        const before = get().doc;
        const next = fn(before);
        if (next === before) return; // no-op: no save, no undo step
        set({ doc: { ...next, updatedAt: nowIso() } });
      };
      const withLayout = (d: ProjectDoc, l: Partial<ProjectDoc['layout']>): ProjectDoc => ({ ...d, layout: { ...d.layout, ...l } });

      return {
        doc: createProject(),
        load: (doc) => {
          set({ doc });
          useProject.temporal.getState().clear();
        },
        rename: (name) => mutate((d) => ({ ...d, name })),
        addSheet: (name) => {
          const id = newId();
          mutate((d) => ({ ...d, sheets: [...d.sheets, { id, name: name ?? `Sheet ${d.sheets.length + 1}` }] }));
          return id;
        },
        renameSheet: (id, name) => mutate((d) => ({ ...d, sheets: d.sheets.map((s) => (s.id === id ? { ...s, name } : s)) })),
        removeSheet: (id) => {
          const d0 = get().doc;
          if (d0.sheets.length <= 1) return;
          const ids = [...Object.values(d0.equipment), ...Object.values(d0.annotations), ...Object.values(d0.connections)].filter((o) => o.sheetId === id).map((o) => o.id);
          get().remove(ids);
          mutate((d) => ({ ...d, sheets: d.sheets.filter((s) => s.id !== id) }));
        },
        addEquipment: (type, sheetId, at) => {
          const d0 = get().doc;
          const e = createEquipment(d0, type, sheetId);
          const def = CATALOG[type];
          const node: NodeLayout = { x: at.x, y: at.y, rot: 0, flip: false };
          if (type === 'bus') node.w = DEFAULT_BUS_LENGTH;
          else if (def.resizable) { node.w = def.w; node.h = def.h; }
          mutate((d) => ({
            ...withLayout(d, {
              nodes: { ...d.layout.nodes, [e.id]: node },
              ...(type === 'bus' ? { buses: { ...d.layout.buses, [e.id]: { taps: {} } } } : {}),
            }),
            equipment: { ...d.equipment, [e.id]: e },
          }));
          return e.id;
        },
        addAnnotation: (kind, sheetId, at) => {
          const id = newId();
          mutate((d) => ({
            ...withLayout(d, { nodes: { ...d.layout.nodes, [id]: { x: at.x, y: at.y, rot: 0, flip: false, w: kind === 'note' ? 200 : 240, h: kind === 'note' ? 60 : 160 } } }),
            annotations: { ...d.annotations, [id]: { id, sheetId, kind, text: kind === 'note' ? 'Note' : '' } },
          }));
          return id;
        },
        moveNodes: (pos) =>
          mutate((d) => {
            const nodes = { ...d.layout.nodes };
            const routes = { ...d.layout.routes };
            let moved = false;
            for (const [id, p] of Object.entries(pos)) {
              const n = nodes[id];
              if (!n || (n.x === p.x && n.y === p.y)) continue;
              moved = true;
              nodes[id] = { ...n, x: p.x, y: p.y };
            }
            if (!moved) return d;
            // Connections between two moved objects keep their bends, shifted along.
            const ids = new Set(Object.keys(pos));
            for (const c of Object.values(d.connections)) {
              const r = routes[c.id];
              if (!r || r.mode !== 'manual' || !ids.has(c.from.equipmentId) || !ids.has(c.to.equipmentId)) continue;
              const before = d.layout.nodes[c.from.equipmentId];
              const after = nodes[c.from.equipmentId];
              if (!before || !after) continue;
              const dx = after.x - before.x;
              const dy = after.y - before.y;
              routes[c.id] = { ...r, points: r.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
            }
            return withLayout(d, { nodes, routes });
          }),
        patchNode: (id, patch) =>
          mutate((d) => {
            const n = d.layout.nodes[id];
            return n ? withLayout(d, { nodes: { ...d.layout.nodes, [id]: { ...n, ...patch } } }) : d;
          }),
        rotate: (ids, grid) =>
          mutate((d) => {
            const nodes = { ...d.layout.nodes };
            for (const id of ids) {
              const e = d.equipment[id];
              const n = nodes[id];
              if (!e || !n || e.type === 'lineup') continue;
              nodes[id] = rotateLayout(e, n, grid);
            }
            return withLayout(d, { nodes, routes: resetRoutesOf(d, ids) });
          }),
        flip: (ids) =>
          mutate((d) => {
            const nodes = { ...d.layout.nodes };
            for (const id of ids) {
              const n = nodes[id];
              if (n && d.equipment[id] && d.equipment[id].type !== 'bus') nodes[id] = { ...n, flip: !n.flip };
            }
            return withLayout(d, { nodes, routes: resetRoutesOf(d, ids) });
          }),
        remove: (ids) =>
          mutate((d) => {
            const kill = new Set(ids);
            const equipment = { ...d.equipment };
            const connections = { ...d.connections };
            const annotations = { ...d.annotations };
            const nodes = { ...d.layout.nodes };
            const buses = { ...d.layout.buses };
            const routes = { ...d.layout.routes };
            for (const id of kill) {
              delete equipment[id];
              delete annotations[id];
              delete nodes[id];
              delete buses[id];
            }
            for (const c of Object.values(d.connections)) {
              if (kill.has(c.id) || kill.has(c.from.equipmentId) || kill.has(c.to.equipmentId)) {
                delete connections[c.id];
                delete routes[c.id];
              }
            }
            // Drop bus taps nobody uses any more.
            for (const e of Object.values(equipment)) {
              if (e.type !== 'bus' || !e.taps?.length) continue;
              const used = new Set<string>();
              for (const c of Object.values(connections)) {
                if (c.from.equipmentId === e.id) used.add(c.from.terminalId);
                if (c.to.equipmentId === e.id) used.add(c.to.terminalId);
              }
              if (used.size === e.taps.length) continue;
              equipment[e.id] = { ...e, taps: e.taps.filter((t) => used.has(t.id)) };
              const bl = buses[e.id];
              if (bl) buses[e.id] = { taps: Object.fromEntries(Object.entries(bl.taps).filter(([k]) => used.has(k))) };
            }
            return { ...d, equipment, connections, annotations, layout: { nodes, buses, routes } };
          }),
        connect: (from, to, sheetId) => {
          const c = createConnection(get().doc, sheetId, from, to);
          if (!c) return null;
          mutate((d) => ({ ...d, connections: { ...d.connections, [c.id]: c } }));
          return c.id;
        },
        connectToBus: (from, busId, offset, sheetId, grid) => {
          const d0 = get().doc;
          const bus = d0.equipment[busId];
          const n = d0.layout.nodes[busId];
          if (!bus || bus.type !== 'bus' || !n) return null;
          const len = n.w ?? DEFAULT_BUS_LENGTH;
          const off = clamp(snap(offset, grid), 0, len);
          // Reuse an existing tap at the same spot.
          const taps = d0.layout.buses[busId]?.taps ?? {};
          let tapId = Object.keys(taps).find((k) => taps[k] === off);
          const nextBus = { ...bus, taps: [...(bus.taps ?? [])] };
          if (!tapId) {
            tapId = newId();
            nextBus.taps.push({ id: tapId, label: `Tap ${nextBus.taps.length + 1}` });
          }
          const draft: ProjectDoc = { ...d0, equipment: { ...d0.equipment, [busId]: nextBus } };
          const c = createConnection(draft, sheetId, from, { equipmentId: busId, terminalId: tapId });
          if (!c) return null;
          const tid = tapId;
          mutate((d) => ({
            ...withLayout(d, { buses: { ...d.layout.buses, [busId]: { taps: { ...(d.layout.buses[busId]?.taps ?? {}), [tid]: off } } } }),
            equipment: { ...d.equipment, [busId]: nextBus },
            connections: { ...d.connections, [c.id]: c },
          }));
          return c.id;
        },
        setRoute: (connId, route) =>
          mutate((d) => {
            const routes = { ...d.layout.routes };
            if (route) routes[connId] = route; else delete routes[connId];
            return withLayout(d, { routes });
          }),
        moveTap: (busId, tapId, offset) =>
          mutate((d) => {
            const n = d.layout.nodes[busId];
            const bl = d.layout.buses[busId];
            if (!n || !bl) return d;
            const off = clamp(offset, 0, n.w ?? DEFAULT_BUS_LENGTH);
            return withLayout(d, { buses: { ...d.layout.buses, [busId]: { taps: { ...bl.taps, [tapId]: off } } } });
          }),
        resizeBus: (busId, x, y, length) =>
          mutate((d) => {
            const n = d.layout.nodes[busId];
            if (!n) return d;
            const shift = isBusVertical(n) ? n.y - y : n.x - x;
            const bl = d.layout.buses[busId] ?? { taps: {} };
            const taps = Object.fromEntries(Object.entries(bl.taps).map(([k, v]) => [k, clamp(v + shift, 0, length)]));
            return withLayout(d, {
              nodes: { ...d.layout.nodes, [busId]: { ...n, x, y, w: length } },
              buses: { ...d.layout.buses, [busId]: { taps } },
            });
          }),
        resizeBox: (id, x, y, w, h) =>
          mutate((d) => {
            const n = d.layout.nodes[id];
            return n ? withLayout(d, { nodes: { ...d.layout.nodes, [id]: { ...n, x, y, w, h } } }) : d;
          }),
        setProp: (id, key, value) =>
          mutate((d) => {
            // A value the user types is "entered": it drops the "typical" mark.
            const untypical = <T extends { typical?: string[] }>(o: T): T => {
              if (!o.typical?.includes(key)) return o;
              const typical = o.typical.filter((k) => k !== key);
              const { typical: _t, ...rest } = o;
              return (typical.length ? { ...rest, typical } : rest) as T;
            };
            const e = d.equipment[id];
            if (e) return { ...d, equipment: { ...d.equipment, [id]: untypical({ ...e, props: { ...e.props, [key]: value } }) } };
            const c = d.connections[id];
            if (c) return { ...d, connections: { ...d.connections, [id]: untypical({ ...c, props: { ...c.props, [key]: value } }) } };
            return d;
          }),
        setStudy: (patch) => mutate((d) => ({ ...d, study: { ...d.study, ...patch } })),
        replaceDoc: (next) => mutate(() => next),
        setTag: (id, tag) =>
          mutate((d) => {
            const e = d.equipment[id];
            if (e) return { ...d, equipment: { ...d.equipment, [id]: { ...e, tag } } };
            const c = d.connections[id];
            if (c) return { ...d, connections: { ...d.connections, [id]: { ...c, tag } } };
            return d;
          }),
        toggleState: (id) =>
          mutate((d) => {
            const e = d.equipment[id];
            if (!e || !e.state) return d;
            return { ...d, equipment: { ...d.equipment, [id]: { ...e, state: e.state === 'open' ? 'closed' : 'open' } } };
          }),
        setLabelFields: (id, keys) =>
          mutate((d) => {
            const e = d.equipment[id];
            return e ? { ...d, equipment: { ...d.equipment, [id]: { ...e, labelFields: keys.slice(0, 2) } } } : d;
          }),
        setCustom: (id, custom) =>
          mutate((d) => {
            const e = d.equipment[id];
            if (e) return { ...d, equipment: { ...d.equipment, [id]: { ...e, custom } } };
            const c = d.connections[id];
            if (c) return { ...d, connections: { ...d.connections, [id]: { ...c, custom } } };
            return d;
          }),
        setNoteText: (id, text) =>
          mutate((d) => {
            const a = d.annotations[id];
            return a ? { ...d, annotations: { ...d.annotations, [id]: { ...a, text } } } : d;
          }),
        paste: (frag, sheetId, dx, dy) => {
          const { doc, newIds } = pasteFragment(get().doc, frag, sheetId, dx, dy);
          mutate(() => doc);
          return newIds;
        },
        duplicate: (ids, sheetId, grid) => get().paste(copyFragment(get().doc, ids), sheetId, grid * 2, grid * 2),
      };
    },
    {
      partialize: (s) => ({ doc: s.doc }),
      equality: (a, b) => a.doc === b.doc,
      limit: 200,
    },
  ),
);

/** Auto routes for connections touching rotated/flipped objects (manual bends would no longer fit). */
function resetRoutesOf(d: ProjectDoc, ids: Id[]) {
  const set = new Set(ids);
  const routes = { ...d.layout.routes };
  for (const c of Object.values(d.connections)) if (set.has(c.from.equipmentId) || set.has(c.to.equipmentId)) delete routes[c.id];
  return routes;
}

export const undo = () => useProject.temporal.getState().undo();
export const redo = () => useProject.temporal.getState().redo();

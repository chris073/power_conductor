// Write study results back into the project: sticky bus numbers and applied typical values.
// Pure functions: they return a new ProjectDoc (the store commits it as one undo step).

import type { Connection, Equipment, Id, ProjectDoc } from '../types';
import type { StudyCase } from './types';

/** Stores newly assigned bus numbers so the next export uses the same ones. Returns `doc` itself when nothing changes. */
export function persistBusNumbers(doc: ProjectDoc, sc: StudyCase): ProjectDoc {
  if (!sc.newNumbers.length) return doc;
  const equipment = { ...doc.equipment };
  const busNumbers = { ...doc.study.busNumbers };
  for (const { home, number } of sc.newNumbers) {
    if (home.kind === 'bus') {
      const e = equipment[home.id];
      if (e) equipment[home.id] = { ...e, props: { ...e.props, 'design.busNum': number } };
    } else {
      busNumbers[home.key] = number;
    }
  }
  // Drop anchors whose equipment is gone.
  for (const k of Object.keys(busNumbers)) if (!equipment[k.split(':')[0]!]) delete busNumbers[k];
  return { ...doc, equipment, study: { ...doc.study, busNumbers } };
}

/** Writes every typical value the study used into the project and marks it `typical`. */
export function applyTypicals(doc: ProjectDoc, sc: StudyCase): ProjectDoc {
  if (!sc.typicals.length) return doc;
  const equipment = { ...doc.equipment };
  const connections = { ...doc.connections };
  const mark = <T extends Equipment | Connection>(o: T, key: string, value: unknown): T => ({
    ...o,
    props: { ...o.props, [key]: value },
    typical: [...new Set([...(o.typical ?? []), key])],
  });
  const seen = new Set<string>();
  for (const t of sc.typicals) {
    const k = `${t.objectId}\u0000${t.key}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const id: Id = t.objectId;
    if (equipment[id]) equipment[id] = mark(equipment[id], t.key, t.value);
    else if (connections[id]) connections[id] = mark(connections[id], t.key, t.value);
  }
  return { ...doc, equipment, connections };
}

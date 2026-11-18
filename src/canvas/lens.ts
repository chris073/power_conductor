// Lifecycle lens (view only) and trace decorations for canvas objects.

import { CATALOG } from '../domain/catalog';
import { missingRequired } from '../domain/model';
import { findField, schemaFor, type CxStatus } from '../domain/schemas';
import type { TraceResult } from '../domain/topology';
import type { Connection, Equipment, Phase, ProjectDoc } from '../domain/types';
import { formatValue, type VoltageUnit } from '../domain/units';

export interface Decoration {
  /** CSS classes for coloring (lens/trace). */
  cls: string;
  lines: string[];
  badge: number;
  flag: boolean;
  /** Stable key so unchanged decorations keep node identity. */
  key: string;
}

export const CX_CLASS: Record<CxStatus, string> = {
  'Not started': 'cx-notstarted',
  'In progress': 'cx-progress',
  Passed: 'cx-passed',
  Failed: 'cx-failed',
  'Punch item': 'cx-punch',
};

function cxClass(o: Equipment | Connection): string {
  const s = o.props['commissioning.status'];
  return typeof s === 'string' && s in CX_CLASS ? CX_CLASS[s as CxStatus] : 'cx-notstarted';
}

export interface LensInput {
  doc: ProjectDoc;
  phase: Phase;
  trace: TraceResult | null;
  /** Energization from all sources (Operations lens). */
  live: TraceResult | null;
  voltageUnit: VoltageUnit;
}

function make(cls: string, lines: string[], badge: number, flag: boolean): Decoration {
  return { cls, lines, badge, flag, key: `${cls}|${lines.join('\u0001')}|${badge}|${flag ? 1 : 0}` };
}

function traceClass(id: string, trace: TraceResult | null): string {
  if (!trace) return '';
  if (trace.boundary.has(id)) return 'tr-boundary';
  if (trace.energized.has(id) || trace.connections.has(id)) return 'tr-live';
  return 'tr-dim';
}

export function equipmentDecoration(e: Equipment, i: LensInput): Decoration {
  const tr = traceClass(e.id, i.trace);
  const def = CATALOG[e.type];
  const lines: string[] = [];
  let cls = '';
  let badge = 0;
  let flag = false;
  const fields = schemaFor(e.type);
  const labelValues = () => {
    for (const k of e.labelFields.slice(0, 2)) {
      const f = findField(fields, k);
      if (!f) continue;
      const v = formatValue(f, e.props[k], i.voltageUnit);
      if (v) lines.push(v);
    }
  };
  switch (i.phase) {
    case 'concept':
      break;
    case 'design':
    case 'procurement':
    case 'construction':
      labelValues();
      badge = missingRequired(e, i.phase).length;
      break;
    case 'commissioning': {
      cls = cxClass(e);
      const s = e.props['commissioning.status'];
      if (typeof s === 'string' && s) lines.push(s);
      break;
    }
    case 'operations': {
      if (def.behavior !== 'signal' && def.behavior !== 'container' && i.live) {
        cls = i.live.boundary.has(e.id) ? 'op-boundary' : i.live.energized.has(e.id) ? 'op-live' : 'op-dead';
      }
      flag = e.props['operations.omFlag'] === true;
      if (e.state) lines.push(e.state === 'open' ? 'OPEN' : 'CLOSED');
      break;
    }
  }
  return make(tr || cls, lines, badge, flag);
}

export function connectionDecoration(c: Connection, i: LensInput): Decoration {
  const tr = traceClass(c.id, i.trace);
  let cls = '';
  let badge = 0;
  if (c.kind === 'cable') {
    if (i.phase === 'commissioning') cls = cxClass(c);
    if (i.phase === 'operations' && i.live) cls = i.live.connections.has(c.id) ? 'op-live' : 'op-dead';
    if (i.phase === 'design') badge = missingRequired(c, 'design').length;
  }
  return make(tr || cls, [], badge, false);
}

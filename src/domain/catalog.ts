// Equipment catalog: what each type is, its terminals (in unrotated local coordinates),
// and how it behaves electrically. Symbol drawings live in src/symbols; geometry here is
// the contract both sides share. All sizes are multiples of 40 and terminal coordinates
// multiples of 20, so rotated parts stay on a 20 px grid.

import type { EquipmentType } from './types';

export type Dir = 'up' | 'down' | 'left' | 'right';
export type TerminalKind = 'power' | 'signal';

export interface TerminalDef {
  id: string;
  label: string;
  x: number;
  y: number;
  dir: Dir;
  kind: TerminalKind;
}

/**
 * Electrical behavior used by topology:
 * - source: starts an energization trace
 * - switch: has open/closed state; closed joins its terminals
 * - bus: all terminals are one electrical node (bus, MCC, panelboard)
 * - through: zero-impedance in-line device (CT): power terminals are one node
 * - passive: energy passes between terminals, but they are different nodes (transformer, reactor, inverter)
 * - sink: end-of-line device (load, motor, capacitor, arrester, VT, ground)
 * - tie: off-sheet / tie connector; connectors with the same link name are joined
 * - signal: protection or metering device on control wiring only
 * - container: visual grouping only (switchgear lineup)
 */
export type Behavior = 'source' | 'switch' | 'bus' | 'through' | 'passive' | 'sink' | 'tie' | 'signal' | 'container';

export type Category = 'Sources' | 'Transformers' | 'Switching' | 'Buses & gear' | 'Protection & metering' | 'Loads' | 'Other';

export interface TypeDef {
  type: EquipmentType;
  label: string;
  category: Category;
  behavior: Behavior;
  tagPrefix: string;
  w: number;
  h: number;
  terminals: TerminalDef[];
  keywords: string;
  /** Default fields shown on the canvas label (schema keys). */
  defaultLabel: string[];
  resizable?: boolean;
}

const P = (id: string, x: number, y: number, dir: Dir, label = id): TerminalDef => ({ id, label, x, y, dir, kind: 'power' });
const S = (id: string, x: number, y: number, dir: Dir, label = id): TerminalDef => ({ id, label, x, y, dir, kind: 'signal' });

const inline = (h = 80): TerminalDef[] => [P('1', 20, 0, 'up', 'Line'), P('2', 20, h, 'down', 'Load')];

export const CATALOG: Record<EquipmentType, TypeDef> = {
  utility: { type: 'utility', label: 'Utility source', category: 'Sources', behavior: 'source', tagPrefix: 'UTIL', w: 80, h: 80, terminals: [P('T', 40, 80, 'down', 'Out')], keywords: 'grid poi service', defaultLabel: ['design.kv', 'design.scMva'] },
  generator: { type: 'generator', label: 'Generator', category: 'Sources', behavior: 'source', tagPrefix: 'G', w: 80, h: 80, terminals: [P('T', 40, 80, 'down', 'Out')], keywords: 'genset diesel gas sync', defaultLabel: ['concept.kw', 'design.kv'] },
  pv: { type: 'pv', label: 'PV array', category: 'Sources', behavior: 'source', tagPrefix: 'PV', w: 80, h: 80, terminals: [P('T', 40, 80, 'down', 'DC out')], keywords: 'solar photovoltaic', defaultLabel: ['concept.kw'] },
  bess: { type: 'bess', label: 'BESS', category: 'Sources', behavior: 'source', tagPrefix: 'BESS', w: 80, h: 80, terminals: [P('T', 40, 80, 'down', 'DC')], keywords: 'battery storage', defaultLabel: ['concept.kw', 'concept.kwh'] },
  inverter: { type: 'inverter', label: 'Inverter / PCS', category: 'Sources', behavior: 'passive', tagPrefix: 'INV', w: 80, h: 80, terminals: [P('DC', 40, 0, 'up', 'DC'), P('AC', 40, 80, 'down', 'AC')], keywords: 'pcs converter', defaultLabel: ['concept.kw'] },
  wind: { type: 'wind', label: 'Wind turbine', category: 'Sources', behavior: 'source', tagPrefix: 'WTG', w: 80, h: 80, terminals: [P('T', 40, 80, 'down', 'Out')], keywords: 'wtg turbine', defaultLabel: ['concept.kw'] },

  xfmr2: { type: 'xfmr2', label: 'Transformer, 2-winding', category: 'Transformers', behavior: 'passive', tagPrefix: 'T', w: 80, h: 120, terminals: [P('H1', 40, 0, 'up'), P('X1', 40, 120, 'down')], keywords: 'xfmr tx power transformer', defaultLabel: ['concept.kva', 'design.kvRatio'] },
  xfmr3: { type: 'xfmr3', label: 'Transformer, 3-winding', category: 'Transformers', behavior: 'passive', tagPrefix: 'T', w: 120, h: 120, terminals: [P('H1', 60, 0, 'up'), P('X1', 40, 120, 'down'), P('Y1', 80, 120, 'down')], keywords: 'xfmr tertiary three winding', defaultLabel: ['concept.kva', 'design.kvRatio'] },

  breaker: { type: 'breaker', label: 'Circuit breaker', category: 'Switching', behavior: 'switch', tagPrefix: 'CB', w: 40, h: 80, terminals: inline(), keywords: '52 cb drawout fixed', defaultLabel: ['design.frameA', 'design.tripA'] },
  disconnect: { type: 'disconnect', label: 'Disconnect switch', category: 'Switching', behavior: 'switch', tagPrefix: 'DS', w: 40, h: 80, terminals: inline(), keywords: '89 isolator', defaultLabel: ['design.ratedA'] },
  lbs: { type: 'lbs', label: 'Load-break switch', category: 'Switching', behavior: 'switch', tagPrefix: 'LBS', w: 40, h: 80, terminals: inline(), keywords: 'load break interrupter', defaultLabel: ['design.ratedA'] },
  fuse: { type: 'fuse', label: 'Fuse', category: 'Switching', behavior: 'switch', tagPrefix: 'F', w: 40, h: 80, terminals: inline(), keywords: 'fuse', defaultLabel: ['design.ratedA'] },
  recloser: { type: 'recloser', label: 'Recloser', category: 'Switching', behavior: 'switch', tagPrefix: 'REC', w: 40, h: 80, terminals: inline(), keywords: '79 recloser', defaultLabel: ['design.ratedA'] },
  contactor: { type: 'contactor', label: 'Contactor', category: 'Switching', behavior: 'switch', tagPrefix: 'K', w: 40, h: 80, terminals: inline(), keywords: '42 starter contactor', defaultLabel: ['design.ratedA'] },

  bus: { type: 'bus', label: 'Bus', category: 'Buses & gear', behavior: 'bus', tagPrefix: 'BUS', w: 240, h: 20, terminals: [], keywords: 'busbar bus bar node', defaultLabel: ['design.kv', 'design.ratedA'], resizable: true },
  lineup: { type: 'lineup', label: 'Switchgear lineup', category: 'Buses & gear', behavior: 'container', tagPrefix: 'SWGR', w: 320, h: 240, terminals: [], keywords: 'switchgear swgr lineup container', defaultLabel: ['design.kv'], resizable: true },
  mcc: { type: 'mcc', label: 'MCC', category: 'Buses & gear', behavior: 'bus', tagPrefix: 'MCC', w: 120, h: 80, terminals: [P('LINE', 60, 0, 'up', 'Line'), P('L1', 20, 80, 'down'), P('L2', 60, 80, 'down'), P('L3', 100, 80, 'down')], keywords: 'motor control center', defaultLabel: ['design.kv', 'design.ratedA'] },
  panelboard: { type: 'panelboard', label: 'Panelboard', category: 'Buses & gear', behavior: 'bus', tagPrefix: 'PNL', w: 120, h: 80, terminals: [P('LINE', 60, 0, 'up', 'Line'), P('L1', 20, 80, 'down'), P('L2', 60, 80, 'down'), P('L3', 100, 80, 'down')], keywords: 'panel lighting distribution', defaultLabel: ['design.kv', 'design.ratedA'] },

  ct: { type: 'ct', label: 'Current transformer (CT)', category: 'Protection & metering', behavior: 'through', tagPrefix: 'CT', w: 40, h: 80, terminals: [P('P1', 20, 0, 'up'), P('P2', 20, 80, 'down'), S('S', 40, 40, 'right', 'Secondary')], keywords: 'ct current transformer', defaultLabel: ['design.ratio'] },
  vt: { type: 'vt', label: 'Voltage transformer (VT/PT)', category: 'Protection & metering', behavior: 'sink', tagPrefix: 'VT', w: 40, h: 80, terminals: [P('P', 20, 0, 'up', 'Primary'), S('S', 40, 40, 'right', 'Secondary')], keywords: 'vt pt potential voltage transformer', defaultLabel: ['design.ratio'] },
  relay: { type: 'relay', label: 'Protective relay', category: 'Protection & metering', behavior: 'signal', tagPrefix: 'R', w: 80, h: 80, terminals: [S('IN', 0, 40, 'left', 'Inputs'), S('TRIP', 80, 40, 'right', 'Trip')], keywords: 'relay ansi 50 51 87 protection ied', defaultLabel: ['design.functions'] },
  meter: { type: 'meter', label: 'Meter', category: 'Protection & metering', behavior: 'signal', tagPrefix: 'M', w: 40, h: 40, terminals: [S('IN', 0, 20, 'left', 'Inputs')], keywords: 'meter revenue power quality', defaultLabel: [] },
  arrester: { type: 'arrester', label: 'Surge arrester', category: 'Protection & metering', behavior: 'sink', tagPrefix: 'SA', w: 40, h: 80, terminals: [P('T', 20, 0, 'up')], keywords: 'lightning surge arrester mov', defaultLabel: ['design.mcovKv'] },

  motor: { type: 'motor', label: 'Motor', category: 'Loads', behavior: 'sink', tagPrefix: 'MTR', w: 80, h: 80, terminals: [P('T', 40, 0, 'up')], keywords: 'motor pump fan', defaultLabel: ['concept.hp', 'design.kv'] },
  load: { type: 'load', label: 'Load (generic)', category: 'Loads', behavior: 'sink', tagPrefix: 'LD', w: 40, h: 80, terminals: [P('T', 20, 0, 'up')], keywords: 'load lumped', defaultLabel: ['concept.kw'] },
  capacitor: { type: 'capacitor', label: 'Capacitor bank', category: 'Loads', behavior: 'sink', tagPrefix: 'CAP', w: 40, h: 80, terminals: [P('T', 20, 0, 'up')], keywords: 'capacitor pf correction', defaultLabel: ['concept.kvar'] },
  reactor: { type: 'reactor', label: 'Reactor', category: 'Loads', behavior: 'passive', tagPrefix: 'RX', w: 40, h: 80, terminals: inline(), keywords: 'reactor inductor current limiting', defaultLabel: ['design.ratedA'] },

  ground: { type: 'ground', label: 'Ground', category: 'Other', behavior: 'sink', tagPrefix: 'GND', w: 40, h: 40, terminals: [P('T', 20, 0, 'up')], keywords: 'earth ground', defaultLabel: [] },
  tie: { type: 'tie', label: 'Tie / off-sheet connector', category: 'Other', behavior: 'tie', tagPrefix: 'OSC', w: 80, h: 40, terminals: [P('T', 40, 0, 'up')], keywords: 'off sheet continuation tie link', defaultLabel: ['concept.link'] },
};

export const TYPES = Object.values(CATALOG);

export const SWITCHING: ReadonlySet<EquipmentType> = new Set(TYPES.filter((t) => t.behavior === 'switch').map((t) => t.type));
export const SOURCES: ReadonlySet<EquipmentType> = new Set(TYPES.filter((t) => t.behavior === 'source').map((t) => t.type));

export function typeDef(type: EquipmentType): TypeDef {
  return CATALOG[type];
}

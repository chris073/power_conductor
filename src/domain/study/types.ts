// Bus-branch study case: what the node-breaker SLD reduces to. All impedances are per unit on
// the system MVA base and the bus base kV unless a field says otherwise. Writers only format.

import type { Id, PropValue, StudySettings } from '../types';

export type Severity = 'error' | 'warning' | 'info';

export interface Issue {
  severity: Severity;
  code: string;
  message: string;
  /** Object to select when the item is clicked. */
  objectId?: Id;
  study?: 'pf' | 'sc' | 'dyn';
}

export interface TypicalUse {
  objectId: Id;
  key: string;
  value: PropValue;
  /** Where the value came from, e.g. "NEC Table 9" or "schema default". */
  source: string;
}

export interface StudyBus {
  /** Internal key (union-find root). */
  key: string;
  number: number;
  /** PSS/E name, at most 12 characters. */
  name: string;
  baseKv: number;
  /** 1 PQ, 2 PV, 3 swing, 4 isolated. */
  ide: 1 | 2 | 3 | 4;
  area: number;
  zone: number;
  owner: number;
  vm0: number;
  va0: number;
  vmax: number;
  vmin: number;
  island: number;
  /** Drawn Bus / MCC / panelboard objects merged into this study bus. */
  busIds: Id[];
  /** Every equipment with a power terminal on this bus (switches, CTs, loads, ...). */
  memberIds: Id[];
  /** Where the number is stored: a drawn bus id, or an anchor terminal key in doc.study.busNumbers. */
  numberHome: { kind: 'bus'; id: Id } | { kind: 'anchor'; key: string };
  /** The bus number came from the project (not newly assigned in this build). */
  numberSticky: boolean;
}

export interface LoadRec {
  objectId: Id;
  bus: number;
  id: string;
  status: 0 | 1;
  /** MW / Mvar split into constant power, current and admittance parts (at 1 pu). */
  pl: number; ql: number; ip: number; iq: number; yp: number; yq: number;
  motor: boolean;
}

export interface ShuntRec {
  objectId: Id;
  bus: number;
  id: string;
  status: 0 | 1;
  /** Mvar at 1 pu voltage (positive = capacitive). */
  bMvar: number;
  switched?: { steps: number; stepMvar: number; stepsOn: number; vHigh: number; vLow: number };
}

export type MachineKind = 'utility' | 'sync' | 'ibr';

export interface GenRec {
  objectId: Id;
  /** The equipment whose props hold the model data (PV/BESS behind an inverter, else objectId). */
  dataId: Id;
  equipmentType: string;
  kind: MachineKind;
  bus: number;
  id: string;
  status: 0 | 1;
  pg: number; qg: number; qmax: number; qmin: number; vs: number; ireg: number; mbase: number;
  /** ZSORCE on MBASE. */
  zr: number; zx: number;
  pmax: number; pmin: number;
  wmod: number;
  swing: boolean;
}

export interface BranchRec {
  objectId: Id;
  equipmentType: 'cable' | 'line' | 'reactor';
  from: number;
  to: number;
  ckt: string;
  r: number; x: number; b: number;
  rateA: number; rateB: number; rateC: number;
  status: 0 | 1;
  /** Miles. */
  length: number;
  r0: number; x0: number; b0: number;
}

export interface Winding {
  bus: number;
  /** Rated winding kV and its bus base kV. */
  kv: number;
  baseKv: number;
  conn: string;
  groundOhm: number;
  rateA: number; rateB: number; rateC: number;
}

export interface Xfmr2Rec {
  objectId: Id;
  name: string;
  ckt: string;
  status: 0 | 1;
  hv: Winding;
  lv: Winding;
  /** Off-nominal tap on the HV winding, pu (1 = nominal). */
  tap: number;
  tapMax: number; tapMin: number; tapSteps: number; ctrlBus: number;
  shiftDeg: number;
  /** R, X on system base (CZ = 1). */
  r: number; x: number;
  mva: number;
  r0: number; x0: number;
  vecGroup: string;
}

export interface Xfmr3Rec {
  objectId: Id;
  name: string;
  ckt: string;
  status: 0 | 1;
  w: [Winding, Winding, Winding];
  /** Pairwise R, X on system base: 1-2, 2-3, 3-1. */
  z: { r12: number; x12: number; r23: number; x23: number; r31: number; x31: number };
  mva: [number, number, number];
  z0Scale: number;
  vecGroup: string;
}

export interface StudyCase {
  settings: StudySettings;
  title: string;
  buses: StudyBus[];
  loads: LoadRec[];
  fixedShunts: ShuntRec[];
  switchedShunts: ShuntRec[];
  gens: GenRec[];
  branches: BranchRec[];
  xfmr2: Xfmr2Rec[];
  xfmr3: Xfmr3Rec[];
  areas: number[];
  zones: number[];
  owners: number[];
  issues: Issue[];
  typicals: TypicalUse[];
  /** Study bus number for every equipment/connection terminal that landed on a bus. */
  busOfObject: Record<Id, number[]>;
  /** Numbers to write back so they stay the same next time (drawn bus props and anchors). */
  newNumbers: { home: StudyBus['numberHome']; number: number }[];
  /** Object props after typicals were filled (what the writers read). */
  filledProps: Record<Id, Record<string, PropValue>>;
}

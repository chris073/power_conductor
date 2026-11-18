// Conductor domain model. Plain TypeScript: no React, no diagram library.
// The drawing is one view of this model; geometry lives in `Layout`, keyed by object id.

export type Id = string;

export const PHASES = ['concept', 'design', 'procurement', 'construction', 'commissioning', 'operations'] as const;
export type Phase = (typeof PHASES)[number];

export const PHASE_LABEL: Record<Phase, string> = {
  concept: 'Concept',
  design: 'Design',
  procurement: 'Procurement',
  construction: 'Construction',
  commissioning: 'Commissioning',
  operations: 'Operations',
};

export type EquipmentType =
  | 'utility' | 'generator' | 'pv' | 'bess' | 'inverter' | 'wind'
  | 'xfmr2' | 'xfmr3'
  | 'breaker' | 'disconnect' | 'lbs' | 'fuse' | 'recloser' | 'contactor'
  | 'bus' | 'lineup' | 'mcc' | 'panelboard'
  | 'ct' | 'vt' | 'relay' | 'meter' | 'arrester'
  | 'motor' | 'load' | 'capacitor' | 'reactor'
  | 'line'
  | 'ground' | 'tie';

export type AnnotationKind = 'note' | 'cloud';

export type PropValue = string | number | boolean | null;

export interface CustomProp { id: Id; key: string; value: string; unit?: string }

/** A terminal declared on an equipment instance (bus taps are dynamic terminals). */
export interface Terminal { id: string; label: string }

export interface TerminalRef { equipmentId: Id; terminalId: string }

export type SwitchState = 'open' | 'closed';

export interface Equipment {
  id: Id;
  type: EquipmentType;
  sheetId: Id;
  /** User-facing, editable. Never used as a key. */
  tag: string;
  /** Switching devices only. */
  state?: SwitchState;
  props: Record<string, PropValue>;
  custom: CustomProp[];
  /** Up to two schema field keys shown on the canvas label. */
  labelFields: string[];
  /** Bus only: dynamic taps. */
  taps?: Terminal[];
  /** Prop keys whose value is a library typical (filled by the study tools), not entered by the user. */
  typical?: string[];
}

export type ConnectionKind = 'cable' | 'control';

export interface Connection {
  id: Id;
  sheetId: Id;
  /** 'cable' joins power terminals; 'control' joins signal terminals (CT/VT to relay/meter). */
  kind: ConnectionKind;
  tag: string;
  from: TerminalRef;
  to: TerminalRef;
  props: Record<string, PropValue>;
  custom: CustomProp[];
  /** Prop keys whose value is a library typical, not entered by the user. */
  typical?: string[];
}

export interface Annotation {
  id: Id;
  sheetId: Id;
  kind: AnnotationKind;
  text: string;
}

export interface Sheet { id: Id; name: string }

// ---------- layout (geometry only, keyed by object id)

export type Rotation = 0 | 90 | 180 | 270;
export interface Pt { x: number; y: number }

export interface NodeLayout {
  x: number;
  y: number;
  rot: Rotation;
  flip: boolean;
  /** Containers, annotations and buses (length along the bus axis). */
  w?: number;
  h?: number;
}

export interface BusLayout {
  /** Offset of each tap from the bus start, along the bus axis. */
  taps: Record<string, number>;
}

export interface RouteLayout {
  mode: 'auto' | 'manual';
  /** Interior bend points (absolute). Endpoints always come from the terminals. */
  points: Pt[];
}

export interface Layout {
  nodes: Record<Id, NodeLayout>;
  buses: Record<Id, BusLayout>;
  routes: Record<Id, RouteLayout>;
}

// ---------- study (PSS/E / ANDES export) settings and imported results

export interface StudySettings {
  /** System MVA base for per-unit conversion (PSS/E SBASE). */
  baseMva: number;
  /** System frequency, Hz (PSS/E BASFRQ). */
  freqHz: number;
  /** RAW revision written. Fixed at 33 for now. */
  rawVersion: 33;
  /** Cables shorter than this (ft) are merged as zero-impedance ties. 0 disables. */
  collapseFt: number;
  /** Cables with |Z| below this (ohms) are merged as zero-impedance ties. 0 disables. */
  collapseOhm: number;
  /**
   * Sticky PSS/E bus numbers for study buses that have no drawn Bus object, keyed by an
   * anchor terminal `equipmentId:terminalId`. Drawn buses keep theirs in `design.busNum`.
   */
  busNumbers: Record<string, number>;
}

/** One object's read-only study results (from an imported power-flow solution). */
export interface ObjectResult {
  /** Bus voltage magnitude (pu) and angle (deg). */
  vm?: number;
  va?: number;
  /** Branch flows at the from / to ends, MW and Mvar. */
  pFrom?: number;
  qFrom?: number;
  pTo?: number;
  qTo?: number;
}

export interface StudyResults {
  /** ISO timestamp of the import. */
  at: string;
  /** e.g. 'ANDES 1.9.x power flow'. */
  source: string;
  converged: boolean;
  /** By PSS/E bus number. */
  buses: Record<string, { vm: number; va: number }>;
  /** By object id (buses, branches). */
  objects: Record<Id, ObjectResult>;
}

export interface ProjectDoc {
  schemaVersion: number;
  id: Id;
  name: string;
  createdAt: string;
  updatedAt: string;
  sheets: Sheet[];
  equipment: Record<Id, Equipment>;
  connections: Record<Id, Connection>;
  annotations: Record<Id, Annotation>;
  layout: Layout;
  /** Study (power flow / short circuit / dynamics export) settings. Schema 2+. */
  study: StudySettings;
  /** Last imported power-flow results, or null. Schema 2+. */
  studyResults: StudyResults | null;
}

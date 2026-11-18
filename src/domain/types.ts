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
}

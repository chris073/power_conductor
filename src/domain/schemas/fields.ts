import type { Phase } from '../types';

export type FieldType = 'text' | 'number' | 'enum' | 'bool' | 'date' | 'textarea';
export type UnitFamily = 'voltage';

export interface FieldDef {
  /** Stored as `props[key]`. Keys are prefixed by phase, e.g. `design.kv`. */
  key: string;
  label: string;
  phase: Phase;
  type: FieldType;
  /** Display unit, e.g. 'A', 'kVA'. Voltage fields store kV and display per settings. */
  unit?: string;
  unitFamily?: UnitFamily;
  options?: string[];
  min?: number;
  max?: number;
  /** Phases in which this field must be filled ("missing required" badge). */
  requiredIn?: Phase[];
  help?: string;
}

// Small builders keep the schema files readable.
type Opt = Partial<Omit<FieldDef, 'key' | 'label' | 'phase' | 'type'>>;
export const text = (phase: Phase, key: string, label: string, o: Opt = {}): FieldDef => ({ key: `${phase}.${key}`, label, phase, type: 'text', ...o });
export const area = (phase: Phase, key: string, label: string, o: Opt = {}): FieldDef => ({ key: `${phase}.${key}`, label, phase, type: 'textarea', ...o });
export const num = (phase: Phase, key: string, label: string, unit?: string, o: Opt = {}): FieldDef => ({ key: `${phase}.${key}`, label, phase, type: 'number', unit, ...o });
export const kv = (phase: Phase, key: string, label: string, o: Opt = {}): FieldDef => ({ key: `${phase}.${key}`, label, phase, type: 'number', unit: 'kV', unitFamily: 'voltage', ...o });
export const pick = (phase: Phase, key: string, label: string, options: string[], o: Opt = {}): FieldDef => ({ key: `${phase}.${key}`, label, phase, type: 'enum', options, ...o });
export const flag = (phase: Phase, key: string, label: string, o: Opt = {}): FieldDef => ({ key: `${phase}.${key}`, label, phase, type: 'bool', ...o });
export const date = (phase: Phase, key: string, label: string, o: Opt = {}): FieldDef => ({ key: `${phase}.${key}`, label, phase, type: 'date', ...o });

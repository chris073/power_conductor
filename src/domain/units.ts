// Display units. Voltage fields are stored in kV and shown in kV or V per settings.

import type { FieldDef } from './schemas';
import type { PropValue } from './types';

export type VoltageUnit = 'kV' | 'V';

export function displayUnit(f: FieldDef, v: VoltageUnit): string | undefined {
  if (f.unitFamily === 'voltage') return v;
  return f.unit;
}

export function toDisplay(f: FieldDef, value: PropValue | undefined, v: VoltageUnit): PropValue | undefined {
  if (f.unitFamily === 'voltage' && typeof value === 'number' && v === 'V') return round(value * 1000);
  return value;
}

export function fromDisplay(f: FieldDef, value: PropValue, v: VoltageUnit): PropValue {
  if (f.unitFamily === 'voltage' && typeof value === 'number' && v === 'V') return value / 1000;
  return value;
}

function round(n: number) {
  return Math.round(n * 1e6) / 1e6;
}

export function formatValue(f: FieldDef, value: PropValue | undefined, v: VoltageUnit): string {
  const d = toDisplay(f, value, v);
  if (d === undefined || d === null || d === '') return '';
  if (typeof d === 'boolean') return d ? 'Yes' : 'No';
  const unit = displayUnit(f, v);
  return unit ? `${d} ${unit}` : String(d);
}

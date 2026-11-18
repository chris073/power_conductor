// Schema-driven properties, grouped by lifecycle phase.
// Each type gets its own concept/design fields plus shared procurement, construction,
// commissioning and operations groups.

import type { EquipmentType, Phase } from '../types';
import { area, date, flag, kv, num, pick, text, type FieldDef } from './fields';

export type { FieldDef } from './fields';

export const CX_STATUS = ['Not started', 'In progress', 'Passed', 'Failed', 'Punch item'] as const;
export type CxStatus = (typeof CX_STATUS)[number];

export const WINDINGS = ['Δ', 'Y', 'Yg'];

const procurement: FieldDef[] = [
  text('procurement', 'manufacturer', 'Manufacturer'),
  text('procurement', 'model', 'Model / catalog no.'),
  text('procurement', 'po', 'PO number'),
  num('procurement', 'leadWeeks', 'Lead time', 'weeks', { min: 0 }),
  pick('procurement', 'status', 'Procurement status', ['Not ordered', 'RFQ', 'Ordered', 'Delivered']),
];

const construction: FieldDef[] = [
  text('construction', 'location', 'Location / room'),
  pick('construction', 'status', 'Install status', ['Not started', 'Set', 'Terminated', 'Complete']),
  date('construction', 'installed', 'Installed on'),
  area('construction', 'notes', 'Construction notes'),
];

const commissioning: FieldDef[] = [
  pick('commissioning', 'status', 'Commissioning status', [...CX_STATUS], { help: 'Drives the Commissioning lens colors.' }),
  date('commissioning', 'testDate', 'Test date'),
  text('commissioning', 'testedBy', 'Tested by'),
  area('commissioning', 'results', 'Test results'),
  area('commissioning', 'settings', 'Settings applied'),
  pick('commissioning', 'asLeft', 'As-left status', ['', 'Open', 'Closed', 'Locked out', 'In service', 'Out of service']),
];

const operations: FieldDef[] = [
  flag('operations', 'omFlag', 'O&M attention flag', { help: 'Shows a flag on the Operations lens.' }),
  area('operations', 'omNotes', 'O&M notes'),
  date('operations', 'lastMaint', 'Last maintenance'),
  num('operations', 'maintIntervalMonths', 'Maintenance interval', 'months', { min: 0 }),
];

const cxLite: FieldDef[] = [commissioning[0]!, commissioning[1]!, commissioning[3]!];

const common = [...procurement, ...construction, ...commissioning, ...operations];

const switchingDesign = (): FieldDef[] => [
  kv('design', 'kv', 'Rated voltage', { requiredIn: ['design'] }),
  num('design', 'ratedA', 'Continuous rating', 'A', { requiredIn: ['design'], min: 0 }),
  num('design', 'interruptKa', 'Interrupting rating', 'kA', { min: 0 }),
];

const byType: Record<EquipmentType, FieldDef[]> = {
  utility: [
    text('concept', 'name', 'Utility / POI name'),
    kv('design', 'kv', 'Nominal voltage', { requiredIn: ['concept', 'design'] }),
    num('design', 'scMva', 'Available fault', 'MVA', { requiredIn: ['design'], min: 0 }),
    num('design', 'xr', 'X/R ratio', undefined, { min: 0 }),
    ...common,
  ],
  generator: [
    num('concept', 'kw', 'Rating', 'kW', { requiredIn: ['concept', 'design'], min: 0 }),
    pick('concept', 'fuel', 'Fuel', ['Diesel', 'Natural gas', 'Dual fuel', 'Other']),
    kv('design', 'kv', 'Voltage', { requiredIn: ['design'] }),
    num('design', 'pf', 'Power factor', undefined, { min: 0, max: 1 }),
    num('design', 'xdpp', "X''d", 'pu', { min: 0 }),
    ...common,
  ],
  pv: [
    num('concept', 'kw', 'DC capacity', 'kWdc', { requiredIn: ['concept', 'design'], min: 0 }),
    num('design', 'strings', 'Strings', undefined, { min: 0 }),
    num('design', 'vocMax', 'Max Voc', 'V', { min: 0 }),
    ...common,
  ],
  bess: [
    num('concept', 'kw', 'Power', 'kW', { requiredIn: ['concept', 'design'], min: 0 }),
    num('concept', 'kwh', 'Energy', 'kWh', { requiredIn: ['concept', 'design'], min: 0 }),
    pick('design', 'chemistry', 'Chemistry', ['LFP', 'NMC', 'Other']),
    num('design', 'vdc', 'DC voltage', 'V', { min: 0 }),
    ...common,
  ],
  inverter: [
    num('concept', 'kw', 'AC rating', 'kVA', { requiredIn: ['concept', 'design'], min: 0 }),
    kv('design', 'kvAc', 'AC voltage', { requiredIn: ['design'] }),
    num('design', 'vdc', 'DC voltage', 'V', { min: 0 }),
    pick('design', 'mode', 'Mode', ['Grid-following', 'Grid-forming']),
    ...common,
  ],
  wind: [
    num('concept', 'kw', 'Rating', 'kW', { requiredIn: ['concept', 'design'], min: 0 }),
    kv('design', 'kv', 'Output voltage', { requiredIn: ['design'] }),
    pick('design', 'wtgType', 'WTG type', ['Type 3 (DFIG)', 'Type 4 (full converter)']),
    ...common,
  ],
  xfmr2: [
    num('concept', 'kva', 'Rating', 'kVA', { requiredIn: ['concept', 'design'], min: 0 }),
    text('design', 'kvRatio', 'Voltage ratio', { requiredIn: ['design'], help: 'e.g. 13.8-0.48 kV' }),
    pick('design', 'hvWinding', 'HV winding', WINDINGS, { requiredIn: ['design'] }),
    pick('design', 'lvWinding', 'LV winding', WINDINGS, { requiredIn: ['design'] }),
    num('design', 'z', 'Impedance', '%Z', { requiredIn: ['design'], min: 0 }),
    pick('design', 'cooling', 'Cooling', ['ONAN', 'ONAN/ONAF', 'AA', 'AA/FA']),
    text('design', 'taps', 'Taps', { help: 'e.g. ±2×2.5%' }),
    ...common,
  ],
  xfmr3: [
    num('concept', 'kva', 'Rating', 'kVA', { requiredIn: ['concept', 'design'], min: 0 }),
    text('design', 'kvRatio', 'Voltage ratio', { requiredIn: ['design'], help: 'e.g. 138-34.5-13.8 kV' }),
    pick('design', 'hvWinding', 'H winding', WINDINGS, { requiredIn: ['design'] }),
    pick('design', 'lvWinding', 'X winding', WINDINGS, { requiredIn: ['design'] }),
    pick('design', 'tvWinding', 'Y winding', WINDINGS, { requiredIn: ['design'] }),
    num('design', 'z', 'Impedance H-X', '%Z', { min: 0 }),
    ...common,
  ],
  breaker: [
    pick('design', 'mounting', 'Mounting', ['Fixed', 'Draw-out'], { help: 'Draw-out shows chevrons on the symbol.' }),
    ...switchingDesign(),
    num('design', 'frameA', 'Frame', 'A', { min: 0 }),
    num('design', 'tripA', 'Trip / sensor', 'A', { min: 0 }),
    pick('design', 'medium', 'Interrupting medium', ['Vacuum', 'SF6', 'Air', 'Molded case', 'Insulated case']),
    ...common,
  ],
  disconnect: [...switchingDesign(), pick('design', 'operation', 'Operation', ['Manual', 'Motor-operated']), flag('design', 'groundSwitch', 'Ground switch'), ...common],
  lbs: [...switchingDesign(), ...common],
  fuse: [kv('design', 'kv', 'Rated voltage', { requiredIn: ['design'] }), num('design', 'ratedA', 'Fuse size', 'A', { requiredIn: ['design'], min: 0 }), text('design', 'fuseType', 'Fuse type / class'), ...common],
  recloser: [...switchingDesign(), text('design', 'control', 'Control model'), ...common],
  contactor: [...switchingDesign(), text('design', 'nemaSize', 'NEMA size'), ...common],
  bus: [
    kv('concept', 'kv', 'Nominal voltage', { requiredIn: ['concept'] }),
    kv('design', 'kv', 'Rated voltage', { requiredIn: ['design'] }),
    num('design', 'ratedA', 'Bus rating', 'A', { requiredIn: ['design'], min: 0 }),
    num('design', 'braceKa', 'Bracing', 'kA', { min: 0 }),
    pick('design', 'material', 'Material', ['Copper', 'Aluminum']),
    ...cxLite,
    ...operations,
  ],
  lineup: [kv('design', 'kv', 'Rated voltage'), num('design', 'ratedA', 'Main bus', 'A', { min: 0 }), text('design', 'enclosure', 'Enclosure'), ...procurement, ...construction, ...cxLite, ...operations],
  mcc: [kv('design', 'kv', 'Rated voltage', { requiredIn: ['design'] }), num('design', 'ratedA', 'Main bus', 'A', { requiredIn: ['design'], min: 0 }), num('design', 'sccrKa', 'SCCR', 'kA', { min: 0 }), ...common],
  panelboard: [kv('design', 'kv', 'Rated voltage', { requiredIn: ['design'] }), num('design', 'ratedA', 'Bus rating', 'A', { requiredIn: ['design'], min: 0 }), num('design', 'circuits', 'Circuits', undefined, { min: 0 }), ...common],
  ct: [text('design', 'ratio', 'Ratio', { requiredIn: ['design'], help: 'e.g. 1200:5' }), text('design', 'accuracy', 'Accuracy class', { help: 'e.g. C400' }), num('design', 'qty', 'Quantity', undefined, { min: 1 }), ...common],
  vt: [text('design', 'ratio', 'Ratio', { requiredIn: ['design'], help: 'e.g. 14400:120' }), text('design', 'accuracy', 'Accuracy class'), ...common],
  relay: [
    text('concept', 'functions', 'Functions', { help: 'Shown in the symbol' }),
    text('design', 'functions', 'ANSI device numbers', { requiredIn: ['design'], help: 'e.g. 50/51, 50N/51N, 87T' }),
    text('design', 'model', 'Relay model'),
    area('design', 'settingsRef', 'Settings file / reference'),
    ...common,
  ],
  meter: [pick('design', 'meterType', 'Type', ['Revenue', 'Power quality', 'Panel']), text('design', 'model', 'Model'), ...common],
  arrester: [num('design', 'mcovKv', 'MCOV', 'kV', { requiredIn: ['design'], min: 0 }), pick('design', 'class', 'Class', ['Station', 'Intermediate', 'Distribution']), ...common],
  motor: [
    num('concept', 'hp', 'Rating', 'hp', { requiredIn: ['concept', 'design'], min: 0 }),
    text('concept', 'service', 'Service', { help: 'e.g. Cooling water pump' }),
    kv('design', 'kv', 'Voltage', { requiredIn: ['design'] }),
    num('design', 'fla', 'FLA', 'A', { min: 0 }),
    pick('design', 'starter', 'Starter', ['FVNR', 'RVSS', 'VFD']),
    ...common,
  ],
  load: [num('concept', 'kw', 'Demand', 'kW', { requiredIn: ['concept', 'design'], min: 0 }), text('concept', 'service', 'Service'), kv('design', 'kv', 'Voltage', { requiredIn: ['design'] }), num('design', 'pf', 'Power factor', undefined, { min: 0, max: 1 }), ...common],
  capacitor: [num('concept', 'kvar', 'Rating', 'kvar', { requiredIn: ['concept', 'design'], min: 0 }), kv('design', 'kv', 'Voltage', { requiredIn: ['design'] }), num('design', 'steps', 'Steps', undefined, { min: 1 }), ...common],
  reactor: [kv('design', 'kv', 'Voltage', { requiredIn: ['design'] }), num('design', 'ratedA', 'Rating', 'A', { requiredIn: ['design'], min: 0 }), num('design', 'ohms', 'Impedance', 'Ω', { min: 0 }), ...common],
  ground: [pick('design', 'groundType', 'Grounding', ['Solid', 'Low-resistance', 'High-resistance', 'Grid']), ...cxLite],
  tie: [text('concept', 'link', 'Link name', { requiredIn: ['concept'], help: 'Connectors with the same link name are electrically joined (across sheets too).' }), text('concept', 'toSheet', 'Continues on')],
};

export const CABLE_SCHEMA: FieldDef[] = [
  text('concept', 'description', 'Description'),
  num('concept', 'lengthFt', 'Approx. length', 'ft', { min: 0 }),
  text('design', 'size', 'Conductor size', { requiredIn: ['design'], help: 'e.g. 500 kcmil' }),
  num('design', 'sets', 'Parallel sets', undefined, { min: 1 }),
  pick('design', 'material', 'Material', ['Cu', 'Al']),
  pick('design', 'insulation', 'Insulation', ['XLPE', 'EPR', 'THHN/THWN', 'XHHW', 'Other']),
  kv('design', 'kv', 'Insulation rating'),
  num('design', 'ampacity', 'Ampacity', 'A', { min: 0 }),
  text('design', 'raceway', 'Raceway'),
  ...procurement.slice(0, 2),
  ...construction,
  pick('commissioning', 'status', 'Commissioning status', [...CX_STATUS]),
  text('commissioning', 'hipot', 'Hipot / VLF result'),
  num('commissioning', 'meggerMohm', 'Insulation resistance', 'MΩ', { min: 0 }),
  ...operations,
];

export const CONTROL_SCHEMA: FieldDef[] = [text('design', 'description', 'Description'), text('design', 'wire', 'Wire / cable'), area('design', 'notes', 'Notes')];

export function schemaFor(type: EquipmentType): FieldDef[] {
  return byType[type];
}

export function fieldsInPhase(fields: FieldDef[], phase: Phase): FieldDef[] {
  return fields.filter((f) => f.phase === phase);
}

export function findField(fields: FieldDef[], key: string): FieldDef | undefined {
  return fields.find((f) => f.key === key);
}

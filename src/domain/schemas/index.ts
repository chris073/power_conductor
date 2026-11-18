// Schema-driven properties, grouped by lifecycle phase.
// Each type gets its own concept/design fields plus shared procurement, construction,
// commissioning and operations groups. Study (modeling) fields live in the Design phase and carry
// a `study` tag (pf / sc / dyn); the inspector groups them as "Model: …" sections.

import { ACSR, SPACINGS } from '../study/libraries/conductors';
import { dynParamFields, EXCITERS, GOVERNORS, MACHINES } from '../study/libraries/dynamics';
import type { EquipmentType, Phase } from '../types';
import { area, date, flag, kv, num, pick, text, type FieldDef } from './fields';

export type { FieldDef, StudyTag } from './fields';
export { STUDY_LABEL } from './fields';

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

// ---------- study fields (Design phase; the inspector groups them as "Model: …")

const PF = { study: 'pf' as const };
const SC = { study: 'sc' as const };
const DYN = { study: 'dyn' as const };

const busStudy: FieldDef[] = [
  num('design', 'busNum', 'PSS/E bus number', undefined, { ...PF, min: 1, max: 999997, help: 'Sticky across exports. Empty: assigned on export.' }),
  kv('design', 'baseKv', 'Base kV', { ...PF, help: 'Empty: the nominal voltage (Concept), else propagated from sources and transformers.' }),
  num('design', 'area', 'Area', undefined, { ...PF, min: 1, dflt: 1 }),
  num('design', 'zone', 'Zone', undefined, { ...PF, min: 1, dflt: 1 }),
  num('design', 'owner', 'Owner', undefined, { ...PF, min: 1, dflt: 1 }),
  num('design', 'vmax', 'Vmax', 'pu', { ...PF, dflt: 1.1 }),
  num('design', 'vmin', 'Vmin', 'pu', { ...PF, dflt: 0.9 }),
  num('design', 'vm0', 'Initial Vm', 'pu', { ...PF, dflt: 1 }),
  num('design', 'va0', 'Initial Va', 'deg', { ...PF, dflt: 0 }),
];

const machinePf = (o: { swing?: boolean } = {}): FieldDef[] => [
  ...(o.swing ? [flag('design', 'swing', 'Swing (slack) unit', { ...PF, help: 'One swing per island. Default: the utility, else the largest machine.' })] : []),
  text('design', 'machineId', 'Machine ID', { ...PF, dflt: '1', help: 'PSS/E machine ID (1–2 characters).' }),
  num('design', 'pg', 'Pg', 'MW', { ...PF, need: true }),
  num('design', 'qmax', 'Qmax', 'Mvar', { ...PF, need: true }),
  num('design', 'qmin', 'Qmin', 'Mvar', { ...PF, need: true }),
  num('design', 'pmax', 'Pmax', 'MW', { ...PF, need: true }),
  num('design', 'pmin', 'Pmin', 'MW', { ...PF, dflt: 0 }),
  num('design', 'vsched', 'Scheduled voltage', 'pu', { ...PF, dflt: 1 }),
  num('design', 'regBus', 'Regulated bus', undefined, { ...PF, min: 0, help: 'PSS/E bus number. Empty or 0: its own terminal bus.' }),
  num('design', 'mbase', 'Machine base', 'MVA', { ...PF, need: true, min: 0 }),
];

export const IBR_WMOD = ['0 Conventional', '1 Q limits', '2 Q from P and pf', '3 Fixed pf'];

const WECC = 'WECC generic';
const ibrStudy = (bess: boolean, wind: boolean): FieldDef[] => [
  ...machinePf(),
  pick('design', 'wmod', 'WMOD (IBR control)', IBR_WMOD, { ...PF, dflt: '1 Q limits', help: 'PSS/E WMOD: how the reactive limits of a renewable plant are set.' }),
  num('design', 'iflt', 'Fault current limit', 'pu', { ...SC, need: true, min: 0, help: 'Maximum fault current on the machine base (typically 1.1–1.5).' }),
  pick('design', 'dynModel', 'Dynamic model', [WECC, 'None'], {
    ...DYN,
    dflt: WECC,
    help: bess ? 'REGCA1 + REECC1 + REPCA1.' : wind ? 'REGCA1 + REECA1 + REPCA1, plus WTDTA1/WTARA1/WTPTA1/WTTQA1 for Type 3.' : 'REGCA1 + REECA1 + REPCA1.',
  }),
  flag('design', 'plantCtrl', 'Plant controller (REPCA1)', { ...DYN, dflt: true, showIf: { key: 'design.dynModel', equals: WECC, fallback: WECC } }),
  ...dynParamFields(bess ? ['REGCA1', 'REECC1', 'REPCA1'] : wind ? ['REGCA1', 'REECA1', 'REPCA1', 'WTDTA1', 'WTARA1', 'WTPTA1', 'WTTQA1'] : ['REGCA1', 'REECA1', 'REPCA1'], 'design.dynModel', WECC, WECC),
];

const GROUNDING = ['Solid', 'Low-resistance', 'High-resistance', 'Ungrounded'];
const SERIES = 'Series (current-limiting)';

const byType: Record<EquipmentType, FieldDef[]> = {
  utility: [
    text('concept', 'name', 'Utility / POI name'),
    kv('design', 'kv', 'Nominal voltage', { requiredIn: ['concept', 'design'] }),
    num('design', 'scMva', 'Available fault (3-phase)', 'MVA', { requiredIn: ['design'], min: 0, ...SC, need: true, help: 'Thevenin source: |Z1| = 1 pu on this MVA.' }),
    num('design', 'xr', 'X/R ratio', undefined, { min: 0, ...SC, need: true, dflt: 10 }),
    flag('design', 'swing', 'Swing (slack) bus', { ...PF, dflt: true }),
    num('design', 'vsched', 'Scheduled voltage', 'pu', { ...PF, dflt: 1 }),
    text('design', 'machineId', 'Machine ID', { ...PF, dflt: '1' }),
    num('design', 'slgMva', 'Available fault (SLG)', 'MVA', { ...SC, min: 0, help: 'Sets the zero-sequence source impedance. Empty: Z0 = Z1.' }),
    num('design', 'x0r0', 'X0/R0 ratio', undefined, { ...SC, min: 0, help: 'Empty: same as X/R.' }),
    pick('design', 'dynModel', 'Dynamic model', ['GENCLS', 'None'], { ...DYN, dflt: 'GENCLS', help: 'Classical machine behind the Thevenin reactance (a stiff grid).' }),
    ...dynParamFields(['GENCLS'], 'design.dynModel', null, 'GENCLS'),
    ...common,
  ],
  generator: [
    num('concept', 'kw', 'Rating', 'kW', { requiredIn: ['concept', 'design'], min: 0 }),
    pick('concept', 'fuel', 'Fuel', ['Diesel', 'Natural gas', 'Dual fuel', 'Other']),
    kv('design', 'kv', 'Voltage', { requiredIn: ['design'] }),
    num('design', 'pf', 'Power factor', undefined, { min: 0, max: 1 }),
    ...machinePf({ swing: true }),
    num('design', 'zr', 'Source R (ZSORCE)', 'pu', { ...SC, min: 0, dflt: 0, help: 'On the machine base.' }),
    num('design', 'xdpp', "X''d", 'pu', { min: 0, ...SC, need: true, help: 'Subtransient reactance on the machine base; also ZSORCE X and the GENROU/GENSAL X″d.' }),
    num('design', 'x2', 'X2 (negative sequence)', 'pu', { ...SC, min: 0, help: "Empty: X''d." }),
    num('design', 'x0', 'X0 (zero sequence)', 'pu', { ...SC, min: 0, need: true }),
    pick('design', 'grounding', 'Neutral grounding', GROUNDING, { ...SC, dflt: 'High-resistance' }),
    num('design', 'groundOhm', 'Neutral resistance', 'Ω', { ...SC, min: 0, showIf: { key: 'design.grounding', equals: ['Low-resistance', 'High-resistance'], fallback: 'High-resistance' } }),
    pick('design', 'dynModel', 'Machine model', [...MACHINES, 'None'], { ...DYN, dflt: 'GENROU' }),
    ...dynParamFields([...MACHINES], 'design.dynModel', null, 'GENROU'),
    pick('design', 'exciter', 'Exciter', [...EXCITERS, 'None'], { ...DYN, dflt: 'SEXS' }),
    ...dynParamFields([...EXCITERS], 'design.exciter', null, 'SEXS'),
    pick('design', 'governor', 'Governor', [...GOVERNORS, 'None'], { ...DYN, dflt: 'TGOV1' }),
    ...dynParamFields([...GOVERNORS], 'design.governor', null, 'TGOV1'),
    ...common,
  ],
  pv: [
    num('concept', 'kw', 'DC capacity', 'kWdc', { requiredIn: ['concept', 'design'], min: 0 }),
    num('design', 'strings', 'Strings', undefined, { min: 0 }),
    num('design', 'vocMax', 'Max Voc', 'V', { min: 0 }),
    ...ibrStudy(false, false),
    ...common,
  ],
  bess: [
    num('concept', 'kw', 'Power', 'kW', { requiredIn: ['concept', 'design'], min: 0 }),
    num('concept', 'kwh', 'Energy', 'kWh', { requiredIn: ['concept', 'design'], min: 0 }),
    pick('design', 'chemistry', 'Chemistry', ['LFP', 'NMC', 'Other']),
    num('design', 'vdc', 'DC voltage', 'V', { min: 0 }),
    ...ibrStudy(true, false),
    ...common,
  ],
  inverter: [
    num('concept', 'kw', 'AC rating', 'kVA', { requiredIn: ['concept', 'design'], min: 0 }),
    kv('design', 'kvAc', 'AC voltage', { requiredIn: ['design'] }),
    num('design', 'vdc', 'DC voltage', 'V', { min: 0 }),
    pick('design', 'mode', 'Mode', ['Grid-following', 'Grid-forming']),
    ...ibrStudy(false, false).map((f) => (f.key === 'design.pg' ? { ...f, help: 'Model data for a stand-alone inverter. With a PV array or BESS on the DC side, the export uses that source’s data at this inverter’s AC bus.' } : f)),
    ...common,
  ],
  wind: [
    num('concept', 'kw', 'Rating', 'kW', { requiredIn: ['concept', 'design'], min: 0 }),
    kv('design', 'kv', 'Output voltage', { requiredIn: ['design'] }),
    pick('design', 'wtgType', 'WTG type', ['Type 3 (DFIG)', 'Type 4 (full converter)']),
    ...ibrStudy(false, true),
    ...common,
  ],
  xfmr2: [
    num('concept', 'kva', 'Rating', 'kVA', { requiredIn: ['concept', 'design'], min: 0 }),
    kv('design', 'hvKv', 'HV winding voltage', { requiredIn: ['design'], ...PF, need: true }),
    kv('design', 'lvKv', 'LV winding voltage', { requiredIn: ['design'], ...PF, need: true }),
    pick('design', 'hvWinding', 'HV winding', WINDINGS, { requiredIn: ['design'], ...SC }),
    pick('design', 'lvWinding', 'LV winding', WINDINGS, { requiredIn: ['design'], ...SC }),
    num('design', 'z', 'Impedance', '%Z', { requiredIn: ['design'], min: 0, ...PF, need: true, help: 'On the impedance MVA base at rated winding voltages.' }),
    pick('design', 'cooling', 'Cooling', ['ONAN', 'ONAN/ONAF', 'AA', 'AA/FA']),
    text('design', 'taps', 'Taps', { help: 'e.g. ±2×2.5%' }),
    num('design', 'mvaBase', 'Impedance MVA base', 'MVA', { ...PF, min: 0, help: 'Empty: the kVA rating.' }),
    num('design', 'xr', 'X/R ratio', undefined, { ...PF, need: true, min: 0 }),
    num('design', 'tapPct', 'Tap position', '%', { ...PF, dflt: 0, help: 'Off-nominal HV tap, e.g. +2.5.' }),
    num('design', 'tapMaxPct', 'Tap range max', '%', { ...PF, dflt: 5 }),
    num('design', 'tapMinPct', 'Tap range min', '%', { ...PF, dflt: -5 }),
    num('design', 'tapSteps', 'Tap positions', undefined, { ...PF, dflt: 5, min: 2 }),
    num('design', 'ctrlBus', 'Controlled bus (LTC)', undefined, { ...PF, min: 0, help: 'PSS/E bus number. Empty: no automatic tap control.' }),
    num('design', 'shiftDeg', 'Phase shift (HV leads LV)', 'deg', { ...PF, help: 'Empty: from the vector group (30° for Δ-Y and Y-Δ, else 0).' }),
    num('design', 'rateA', 'Rating A', 'MVA', { ...PF, min: 0, help: 'Empty: the kVA rating.' }),
    num('design', 'rateB', 'Rating B', 'MVA', { ...PF, min: 0 }),
    num('design', 'rateC', 'Rating C', 'MVA', { ...PF, min: 0 }),
    num('design', 'z0', 'Zero-sequence impedance', '%Z', { ...SC, min: 0, help: 'Empty: equal to the positive-sequence %Z (core type).' }),
    num('design', 'hvGroundOhm', 'HV neutral resistance', 'Ω', { ...SC, min: 0, dflt: 0, showIf: { key: 'design.hvWinding', equals: 'Yg' } }),
    num('design', 'lvGroundOhm', 'LV neutral resistance', 'Ω', { ...SC, min: 0, dflt: 0, showIf: { key: 'design.lvWinding', equals: 'Yg' } }),
    ...common,
  ],
  xfmr3: [
    num('concept', 'kva', 'Rating', 'kVA', { requiredIn: ['concept', 'design'], min: 0 }),
    kv('design', 'hvKv', 'H winding voltage', { requiredIn: ['design'], ...PF, need: true }),
    kv('design', 'lvKv', 'X winding voltage', { requiredIn: ['design'], ...PF, need: true }),
    kv('design', 'tvKv', 'Y winding voltage', { requiredIn: ['design'], ...PF, need: true }),
    pick('design', 'hvWinding', 'H winding', WINDINGS, { requiredIn: ['design'], ...SC }),
    pick('design', 'lvWinding', 'X winding', WINDINGS, { requiredIn: ['design'], ...SC }),
    pick('design', 'tvWinding', 'Y winding', WINDINGS, { requiredIn: ['design'], ...SC }),
    num('design', 'z', 'Impedance H-X', '%Z', { min: 0, ...PF, need: true }),
    num('design', 'zHXBase', 'H-X impedance base', 'MVA', { ...PF, min: 0, help: 'Empty: the H rating.' }),
    num('design', 'zHY', 'Impedance H-Y', '%Z', { min: 0, ...PF, need: true }),
    num('design', 'zHYBase', 'H-Y impedance base', 'MVA', { ...PF, min: 0, help: 'Empty: the Y rating.' }),
    num('design', 'zXY', 'Impedance X-Y', '%Z', { min: 0, ...PF, need: true }),
    num('design', 'zXYBase', 'X-Y impedance base', 'MVA', { ...PF, min: 0, help: 'Empty: the Y rating.' }),
    num('design', 'xr', 'X/R ratio', undefined, { ...PF, need: true, min: 0 }),
    num('design', 'kvaX', 'X winding rating', 'kVA', { ...PF, min: 0, help: 'Empty: the H rating.' }),
    num('design', 'kvaY', 'Y winding rating', 'kVA', { ...PF, min: 0, help: 'Empty: half the H rating.' }),
    num('design', 'rateH', 'H rating A', 'MVA', { ...PF, min: 0 }),
    num('design', 'rateX', 'X rating A', 'MVA', { ...PF, min: 0 }),
    num('design', 'rateY', 'Y rating A', 'MVA', { ...PF, min: 0 }),
    num('design', 'z0', 'Zero-sequence impedance H-X', '%Z', { ...SC, min: 0, help: 'Empty: equal to the positive-sequence values.' }),
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
    ...busStudy,
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
    num('design', 'pKw', 'P at operating point', 'kW', { ...PF, need: true, min: 0 }),
    num('design', 'qKvar', 'Q at operating point', 'kvar', { ...PF, need: true }),
    num('design', 'lrc', 'Locked-rotor current', '× FLA', { ...SC, need: true, min: 0 }),
    num('design', 'lrXr', 'Locked-rotor X/R', undefined, { ...SC, min: 0, dflt: 5 }),
    pick('design', 'dynModel', 'Dynamic model', ['ZIP (static)', 'CIM5'], { ...DYN, dflt: 'ZIP (static)', help: 'CIM5: induction motor (written as CIM5BL). ZIP: the load stays static.' }),
    ...dynParamFields(['CIM5BL'], 'design.dynModel', 'CIM5', null),
    ...common,
  ],
  load: [
    num('concept', 'kw', 'Demand', 'kW', { requiredIn: ['concept', 'design'], min: 0, ...PF, need: true }),
    text('concept', 'service', 'Service'),
    kv('design', 'kv', 'Voltage', { requiredIn: ['design'] }),
    num('design', 'pf', 'Power factor', undefined, { min: 0, max: 1, ...PF, need: true, help: 'Lagging. Ignored when Q is entered.' }),
    num('design', 'kvar', 'Q', 'kvar', { ...PF, help: 'Overrides the power factor.' }),
    num('design', 'zipP', 'Constant power', '%', { ...PF, dflt: 100, min: 0, max: 100 }),
    num('design', 'zipI', 'Constant current', '%', { ...PF, dflt: 0, min: 0, max: 100 }),
    num('design', 'zipZ', 'Constant impedance', '%', { ...PF, dflt: 0, min: 0, max: 100 }),
    ...common,
  ],
  capacitor: [
    num('concept', 'kvar', 'Rating', 'kvar', { requiredIn: ['concept', 'design'], min: 0, ...PF, need: true, help: 'At rated voltage.' }),
    kv('design', 'kv', 'Voltage', { requiredIn: ['design'] }),
    num('design', 'steps', 'Steps', undefined, { min: 1 }),
    pick('design', 'shuntMode', 'Shunt type', ['Fixed', 'Switched'], { ...PF, dflt: 'Fixed' }),
    num('design', 'stepsOn', 'Steps in service', undefined, { ...PF, min: 0, showIf: { key: 'design.shuntMode', equals: 'Switched' }, help: 'Empty: all steps.' }),
    num('design', 'vHigh', 'Control band high', 'pu', { ...PF, dflt: 1.05, showIf: { key: 'design.shuntMode', equals: 'Switched' } }),
    num('design', 'vLow', 'Control band low', 'pu', { ...PF, dflt: 0.95, showIf: { key: 'design.shuntMode', equals: 'Switched' } }),
    ...common,
  ],
  reactor: [
    kv('design', 'kv', 'Voltage', { requiredIn: ['design'] }),
    num('design', 'ratedA', 'Rating', 'A', { requiredIn: ['design'], min: 0 }),
    pick('design', 'application', 'Application', [SERIES, 'Shunt'], { ...PF, dflt: SERIES, help: 'Shunt: terminal 1 to the bus; terminal 2 is the grounded end.' }),
    num('design', 'ohms', 'Impedance', 'Ω', { min: 0, ...PF, need: true, showIf: { key: 'design.application', equals: SERIES, fallback: SERIES } }),
    num('design', 'xr', 'X/R ratio', undefined, { ...PF, min: 0, dflt: 50, showIf: { key: 'design.application', equals: SERIES, fallback: SERIES } }),
    num('design', 'kvar', 'Rating', 'kvar', { ...PF, need: true, min: 0, showIf: { key: 'design.application', equals: 'Shunt' }, help: 'At rated voltage.' }),
    ...common,
  ],
  line: [
    text('concept', 'description', 'Description'),
    kv('design', 'kv', 'Nominal voltage', { requiredIn: ['design'] }),
    pick('design', 'conductor', 'Conductor (ACSR)', Object.keys(ACSR), { requiredIn: ['design'], ...PF }),
    pick('design', 'spacing', 'Phase spacing', Object.keys(SPACINGS), { ...PF, help: 'With the conductor, sets typical R, X and B.' }),
    num('design', 'lengthMi', 'Length', 'mi', { requiredIn: ['design'], min: 0, ...PF, need: true }),
    num('design', 'r', 'R', 'Ω/mi', { ...PF, need: true, min: 0 }),
    num('design', 'x', 'X', 'Ω/mi', { ...PF, need: true, min: 0 }),
    num('design', 'b', 'B', 'µS/mi', { ...PF, min: 0 }),
    num('design', 'rateA', 'Rating A', 'MVA', { ...PF, min: 0, help: 'Empty: conductor ampacity at the nominal voltage.' }),
    num('design', 'rateB', 'Rating B', 'MVA', { ...PF, min: 0 }),
    num('design', 'rateC', 'Rating C', 'MVA', { ...PF, min: 0 }),
    num('design', 'r0', 'R0', 'Ω/mi', { ...SC, need: true, min: 0 }),
    num('design', 'x0', 'X0', 'Ω/mi', { ...SC, need: true, min: 0 }),
    num('design', 'b0', 'B0', 'µS/mi', { ...SC, min: 0 }),
    ...common,
  ],
  ground: [pick('design', 'groundType', 'Grounding', ['Solid', 'Low-resistance', 'High-resistance', 'Grid']), ...cxLite],
  tie: [text('concept', 'link', 'Link name', { requiredIn: ['concept'], help: 'Connectors with the same link name are electrically joined (across sheets too).' }), text('concept', 'toSheet', 'Continues on')],
};

export const CABLE_SCHEMA: FieldDef[] = [
  text('concept', 'description', 'Description'),
  num('concept', 'lengthFt', 'Approx. length', 'ft', { min: 0, study: 'pf', help: 'Cables with no length (or under the Study page threshold) are merged as zero-impedance ties.' }),
  text('design', 'size', 'Conductor size', { requiredIn: ['design'], help: 'e.g. 500 kcmil or 4×600 kcmil' }),
  num('design', 'sets', 'Parallel sets', undefined, { min: 1 }),
  pick('design', 'material', 'Material', ['Cu', 'Al']),
  pick('design', 'insulation', 'Insulation', ['XLPE', 'EPR', 'THHN/THWN', 'XHHW', 'Other']),
  kv('design', 'kv', 'Insulation rating'),
  num('design', 'ampacity', 'Ampacity', 'A', { min: 0 }),
  text('design', 'raceway', 'Raceway'),
  num('design', 'r', 'R', 'Ω/1000 ft', { ...PF, need: true, min: 0, help: 'Per conductor set. Empty: typical from size and material.' }),
  num('design', 'x', 'X', 'Ω/1000 ft', { ...PF, need: true, min: 0 }),
  num('design', 'b', 'B', 'µS/1000 ft', { ...PF, min: 0 }),
  num('design', 'rateA', 'Rating A', 'MVA', { ...PF, min: 0, help: 'Empty: ampacity × sets at the bus voltage.' }),
  num('design', 'rateB', 'Rating B', 'MVA', { ...PF, min: 0 }),
  num('design', 'rateC', 'Rating C', 'MVA', { ...PF, min: 0 }),
  num('design', 'r0', 'R0', 'Ω/1000 ft', { ...SC, need: true, min: 0 }),
  num('design', 'x0', 'X0', 'Ω/1000 ft', { ...SC, need: true, min: 0 }),
  num('design', 'b0', 'B0', 'µS/1000 ft', { ...SC, min: 0 }),
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

// Dynamic model parameter sets for the DYR export. Each model lists its ICONs then CONs in the
// PSS/E DYR record order (PSS/E 33 Program Application Guide / Model Library), which is also
// the column order ANDES reads (andes/io/psse-dyr.yaml), except where noted. Defaults are
// typical, conservative values from the PSS/E model library examples and the WECC "Solar
// Photovoltaic Power Plant Modeling and Validation Guideline" / "Wind Power Plant Dynamic
// Modeling Guide"; they make a stable flat run, not a validated model of a real unit.

import type { FieldDef } from '../../schemas/fields';

export interface DynParam {
  name: string;
  dflt: number;
  /** Integer control flag written before the CONs. */
  icon?: boolean;
  unit?: string;
  /** Reads this prop instead of a generated `design.dyn.<MODEL>.<name>` field (shared values). */
  field?: string;
  /** Filled by the writer (machine base, bus numbers) when the value is 0. */
  auto?: 'mbase';
}

export interface DynModel {
  name: string;
  kind: 'machine' | 'exciter' | 'governor' | 'ibr' | 'wind' | 'load';
  label: string;
  params: DynParam[];
  note?: string;
}

const p = (name: string, dflt: number, unit?: string, extra: Partial<DynParam> = {}): DynParam => ({ name, dflt, unit, ...extra });
const ic = (name: string, dflt: number): DynParam => ({ name, dflt, icon: true });

export const DYN_MODELS: Record<string, DynModel> = {
  GENCLS: { name: 'GENCLS', kind: 'machine', label: 'Classical machine', params: [p('H', 10, 's'), p('D', 0)] },
  GENROU: {
    name: 'GENROU', kind: 'machine', label: 'Round-rotor machine',
    params: [
      p("T'do", 6.5, 's'), p("T''do", 0.035, 's'), p("T'qo", 0.75, 's'), p("T''qo", 0.05, 's'), p('H', 2, 's'), p('D', 0),
      p('Xd', 1.8, 'pu'), p('Xq', 1.7, 'pu'), p("X'd", 0.25, 'pu'), p("X'q", 0.45, 'pu'), p("X''d", 0.18, 'pu', { field: 'design.xdpp' }), p('Xl', 0.1, 'pu'),
      p('S(1.0)', 0.05), p('S(1.2)', 0.3),
    ],
  },
  GENSAL: {
    name: 'GENSAL', kind: 'machine', label: 'Salient-pole machine',
    params: [
      p("T'do", 5, 's'), p("T''do", 0.04, 's'), p("T''qo", 0.06, 's'), p('H', 2, 's'), p('D', 0),
      p('Xd', 1.8, 'pu'), p('Xq', 1.0, 'pu'), p("X'd", 0.25, 'pu'), p("X''d", 0.18, 'pu', { field: 'design.xdpp' }), p('Xl', 0.1, 'pu'),
      p('S(1.0)', 0.05), p('S(1.2)', 0.3),
    ],
  },
  SEXS: { name: 'SEXS', kind: 'exciter', label: 'Simplified excitation system', params: [p('TA/TB', 0.1), p('TB', 10, 's'), p('K', 100), p('TE', 0.1, 's'), p('EMIN', 0, 'pu'), p('EMAX', 4, 'pu')] },
  IEEET1: {
    name: 'IEEET1', kind: 'exciter', label: 'IEEE type 1 (DC) exciter',
    params: [p('TR', 0, 's'), p('KA', 40), p('TA', 0.04, 's'), p('VRMAX', 7.3, 'pu'), p('VRMIN', -7.3, 'pu'), p('KE', 1), p('TE', 0.8, 's'), p('KF', 0.03), p('TF', 1, 's'), p('Switch', 0), p('E1', 2.8, 'pu'), p('SE(E1)', 0.04), p('E2', 3.73, 'pu'), p('SE(E2)', 0.33)],
  },
  ESST1A: {
    name: 'ESST1A', kind: 'exciter', label: 'IEEE ST1A static exciter',
    note: 'CONs in PSS/E order (TR, VIMAX, VIMIN, TC, TB, TC1, TB1, KA, TA, VAMAX, VAMIN, VRMAX, VRMIN, KC, KF, TF, KLR, ILR). ANDES 2.0 maps a different order, so ANDES may misread ESST1A.',
    params: [
      ic('UEL', 1), ic('VOS', 1),
      p('TR', 0.02, 's'), p('VIMAX', 10, 'pu'), p('VIMIN', -10, 'pu'), p('TC', 1, 's'), p('TB', 1, 's'), p('TC1', 0, 's'), p('TB1', 0, 's'),
      p('KA', 200), p('TA', 0.02, 's'), p('VAMAX', 7, 'pu'), p('VAMIN', -7, 'pu'), p('VRMAX', 6, 'pu'), p('VRMIN', -6, 'pu'),
      p('KC', 0.04), p('KF', 0), p('TF', 1, 's'), p('KLR', 0), p('ILR', 0, 'pu'),
    ],
  },
  TGOV1: { name: 'TGOV1', kind: 'governor', label: 'Steam turbine governor', params: [p('R', 0.05, 'pu'), p('T1', 0.5, 's'), p('VMAX', 1, 'pu'), p('VMIN', 0, 'pu'), p('T2', 2.1, 's'), p('T3', 7, 's'), p('Dt', 0)] },
  GAST: { name: 'GAST', kind: 'governor', label: 'Gas turbine governor', params: [p('R', 0.05, 'pu'), p('T1', 0.4, 's'), p('T2', 0.1, 's'), p('T3', 3, 's'), p('AT', 1, 'pu'), p('KT', 2), p('VMAX', 1, 'pu'), p('VMIN', -0.05, 'pu'), p('Dturb', 0)] },
  IEEEG1: {
    name: 'IEEEG1', kind: 'governor', label: 'IEEE type 1 speed governor',
    params: [
      ic('IBUS2', 0), ic('M', 0),
      p('K', 20), p('T1', 0, 's'), p('T2', 0, 's'), p('T3', 0.1, 's'), p('Uo', 1, 'pu/s'), p('Uc', -1, 'pu/s'), p('PMAX', 1, 'pu'), p('PMIN', 0, 'pu'),
      p('T4', 0.3, 's'), p('K1', 0.3), p('K2', 0), p('T5', 7, 's'), p('K3', 0.3), p('K4', 0), p('T6', 0.6, 's'), p('K5', 0.4), p('K6', 0), p('T7', 0, 's'), p('K7', 0), p('K8', 0),
    ],
  },
  REGCA1: {
    name: 'REGCA1', kind: 'ibr', label: 'WECC generator/converter',
    params: [
      ic('LVPLSW', 1),
      p('Tg', 0.02, 's'), p('Rrpwr', 10, 'pu/s'), p('Brkpt', 0.9, 'pu'), p('Zerox', 0.4, 'pu'), p('Lvpl1', 1.22, 'pu'), p('Volim', 1.2, 'pu'), p('Lvpnt1', 0.8, 'pu'),
      p('Lvpnt0', 0.4, 'pu'), p('Iolim', -1.3, 'pu'), p('Tfltr', 0.02, 's'), p('Khv', 0.7), p('Iqrmax', 999, 'pu/s'), p('Iqrmin', -999, 'pu/s'), p('Accel', 0.7),
    ],
  },
  REECA1: {
    name: 'REECA1', kind: 'ibr', label: 'WECC electrical control (PV/wind)',
    params: [
      ic('BUSR', 0), ic('PFFLAG', 0), ic('VFLAG', 0), ic('QFLAG', 0), ic('PFLAG', 0), ic('PQFLAG', 0),
      p('Vdip', 0.9, 'pu'), p('Vup', 1.1, 'pu'), p('Trv', 0.02, 's'), p('dbd1', -0.05, 'pu'), p('dbd2', 0.05, 'pu'), p('Kqv', 0), p('Iqh1', 1.05, 'pu'), p('Iql1', -1.05, 'pu'),
      p('Vref0', 0, 'pu'), p('Iqfrz', 0, 'pu'), p('Thld', 0, 's'), p('Thld2', 0, 's'), p('Tp', 0.05, 's'), p('QMax', 0.436, 'pu'), p('QMin', -0.436, 'pu'), p('VMAX', 1.1, 'pu'), p('VMIN', 0.9, 'pu'),
      p('Kqp', 0), p('Kqi', 0.1), p('Kvp', 0), p('Kvi', 40), p('Vref1', 1, 'pu'), p('Tiq', 0.02, 's'), p('dPmax', 99, 'pu/s'), p('dPmin', -99, 'pu/s'), p('PMAX', 1, 'pu'), p('PMIN', 0, 'pu'),
      p('Imax', 1.2, 'pu'), p('Tpord', 0.02, 's'),
      p('Vq1', 0), p('Iq1', 1.1), p('Vq2', 0.5), p('Iq2', 1.1), p('Vq3', 1), p('Iq3', 1.1), p('Vq4', 1.5), p('Iq4', 1.1),
      p('Vp1', 0), p('Ip1', 1.1), p('Vp2', 0.5), p('Ip2', 1.1), p('Vp3', 1), p('Ip3', 1.1), p('Vp4', 1.5), p('Ip4', 1.1),
    ],
  },
  REECC1: {
    name: 'REECC1', kind: 'ibr', label: 'WECC electrical control (BESS)',
    note: 'Not supported by ANDES 2.0 (it skips the record).',
    params: [
      ic('PFFLAG', 0), ic('VFLAG', 0), ic('QFLAG', 0), ic('PQFLAG', 0),
      p('Vdip', 0.9, 'pu'), p('Vup', 1.1, 'pu'), p('Trv', 0.02, 's'), p('dbd1', -0.05, 'pu'), p('dbd2', 0.05, 'pu'), p('Kqv', 0), p('Iqh1', 1.05, 'pu'), p('Iql1', -1.05, 'pu'),
      p('Vref0', 0, 'pu'), p('Tp', 0.05, 's'), p('QMax', 0.436, 'pu'), p('QMin', -0.436, 'pu'), p('VMAX', 1.1, 'pu'), p('VMIN', 0.9, 'pu'),
      p('Kqp', 0), p('Kqi', 0.1), p('Kvp', 0), p('Kvi', 40), p('Tiq', 0.02, 's'), p('dPmax', 99, 'pu/s'), p('dPmin', -99, 'pu/s'), p('PMAX', 1, 'pu'), p('PMIN', -1, 'pu'),
      p('Imax', 1.2, 'pu'), p('Tpord', 0.02, 's'),
      p('Vq1', 0), p('Iq1', 1.1), p('Vq2', 0.5), p('Iq2', 1.1), p('Vq3', 1), p('Iq3', 1.1), p('Vq4', 1.5), p('Iq4', 1.1),
      p('Vp1', 0), p('Ip1', 1.1), p('Vp2', 0.5), p('Ip2', 1.1), p('Vp3', 1), p('Ip3', 1.1), p('Vp4', 1.5), p('Ip4', 1.1),
      p('T', 999, 's'), p('SOCini', 0.5, 'pu'), p('SOCmax', 0.9, 'pu'), p('SOCmin', 0.1, 'pu'),
    ],
  },
  REPCA1: {
    name: 'REPCA1', kind: 'ibr', label: 'WECC plant controller',
    params: [
      ic('BUSR', 0), ic('BUS1', 0), ic('BUS2', 0), ic('CKTID', 1), ic('VCFlag', 0), ic('RefFlag', 1), ic('Fflag', 0),
      p('Tfltr', 0.02, 's'), p('Kp', 18), p('Ki', 5), p('Tft', 0, 's'), p('Tfv', 0.075, 's'), p('Vfrz', 0, 'pu'), p('Rc', 0, 'pu'), p('Xc', 0, 'pu'), p('Kc', 0),
      p('emax', 0.1, 'pu'), p('emin', -0.1, 'pu'), p('dbd1', 0, 'pu'), p('dbd2', 0, 'pu'), p('Qmax', 0.436, 'pu'), p('Qmin', -0.436, 'pu'), p('Kpg', 0.1), p('Kig', 0.05),
      p('Tp', 0.25, 's'), p('fdbd1', -0.0006, 'pu'), p('fdbd2', 0.0006, 'pu'), p('femax', 999, 'pu'), p('femin', -999, 'pu'), p('Pmax', 1, 'pu'), p('Pmin', 0, 'pu'), p('Tg', 0.1, 's'), p('Ddn', 20), p('Dup', 0),
    ],
  },
  WTDTA1: { name: 'WTDTA1', kind: 'wind', label: 'WECC drive train', params: [p('H', 3, 's'), p('DAMP', 0), p('Htfrac', 0.92), p('Freq1', 1.8, 'Hz'), p('Dshaft', 1.5)] },
  WTARA1: { name: 'WTARA1', kind: 'wind', label: 'WECC aerodynamics', params: [p('Ka', 0.007), p('Theta0', 0, 'deg')] },
  WTPTA1: { name: 'WTPTA1', kind: 'wind', label: 'WECC pitch control', params: [p('Kiw', 0.1), p('Kpw', 150), p('Kic', 0.1), p('Kpc', 3), p('Kcc', 0), p('Tp', 0.3, 's'), p('TetaMax', 27, 'deg'), p('TetaMin', 0, 'deg'), p('RTetaMax', 10, 'deg/s'), p('RTetaMin', -10, 'deg/s')] },
  WTTQA1: {
    name: 'WTTQA1', kind: 'wind', label: 'WECC torque control',
    params: [ic('Tflag', 0), p('Kpp', 3), p('Kip', 0.6), p('Tp', 0.05, 's'), p('Twref', 30, 's'), p('Temax', 1.2, 'pu'), p('Temin', 0, 'pu'), p('p1', 0.2), p('spd1', 0.58), p('p2', 0.4), p('spd2', 0.72), p('p3', 0.6), p('spd3', 0.86), p('p4', 0.8), p('spd4', 1), p('TRATE', 0, 'MW', { auto: 'mbase' })],
  },
  CIM5BL: {
    name: 'CIM5BL', kind: 'load', label: 'Induction motor (load-connected)',
    note: 'Bus-and-load record; ANDES 2.0 does not support it and keeps the motor as a static load.',
    params: [
      ic('IT', 1),
      p('RA', 0, 'pu'), p('XA', 0.1, 'pu'), p('XM', 3, 'pu'), p('R1', 0.03, 'pu'), p('X1', 0.1, 'pu'), p('R2', 0, 'pu'), p('X2', 0, 'pu'),
      p('E1', 1, 'pu'), p('SE(E1)', 0.06), p('E2', 1.2, 'pu'), p('SE(E2)', 0.3), p('MBASE', 0, 'MVA', { auto: 'mbase' }), p('PMULT', 0), p('H', 0.5, 's'),
      p('VT', 0.7, 'pu'), p('TV', 0.1, 's'), p('TB', 0, 's'), p('D', 2), p('TNOM', 0, 'pu'),
    ],
  },
};

export const MACHINES = ['GENROU', 'GENSAL', 'GENCLS'] as const;
export const EXCITERS = ['SEXS', 'ESST1A', 'IEEET1'] as const;
export const GOVERNORS = ['TGOV1', 'GAST', 'IEEEG1'] as const;

/** Prop key of a model parameter. */
export function dynKey(model: string, param: DynParam): string {
  return param.field ?? `design.dyn.${model}.${param.name}`;
}

/**
 * Inspector fields for model parameters, shown only when `selectorKey` selects the model
 * (or `equals` when several models share one selector value, e.g. the WECC set).
 */
export function dynParamFields(models: string[], selectorKey: string, equals: string | null, fallback: string | null): FieldDef[] {
  const out: FieldDef[] = [];
  for (const m of models) {
    const def = DYN_MODELS[m]!;
    for (const prm of def.params) {
      if (prm.field) continue;
      out.push({
        key: dynKey(m, prm),
        label: `${m} ${prm.name}`,
        phase: 'design',
        type: 'number',
        unit: prm.unit,
        study: 'dyn',
        dflt: prm.dflt,
        help: prm.auto === 'mbase' ? '0: the machine base.' : prm.icon ? 'ICON (integer flag)' : undefined,
        showIf: { key: selectorKey, equals: equals ?? m, ...(fallback ? { fallback } : {}) },
      });
    }
  }
  return out;
}

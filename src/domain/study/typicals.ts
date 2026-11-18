// Typical values for empty study fields. Nothing here mutates the project: it returns filled
// props per object plus the list of values it filled, which the readiness report shows and the
// Study page can write back ("Apply typicals", marking them `typical`).

import { fieldVisible, isEmpty, schemaForObject } from '../model';
import type { Connection, Equipment, Id, PropValue } from '../types';
import { cableTypical, CABLE_Z0_FACTOR, lineConstants, SPACINGS } from './libraries/conductors';
import { typicalXr, typicalZPct } from './libraries/transformers';
import type { TypicalUse } from './types';

export type Props = Record<string, PropValue>;

export const numOf = (p: Props, k: string): number | undefined => {
  const v = p[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
};

const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

/** Typical utility fault level by voltage class when none is entered (conservative, mid-range). */
function typicalScMva(kv: number): number {
  if (kv <= 15) return 250;
  if (kv <= 35) return 500;
  if (kv <= 69) return 1500;
  if (kv <= 138) return 3000;
  return 6000;
}

export function typicalSpacing(kv: number): string {
  const keys = Object.keys(SPACINGS);
  if (kv <= 25) return keys[0]!;
  if (kv <= 40) return keys[1]!;
  if (kv <= 90) return keys[2]!;
  if (kv <= 125) return keys[3]!;
  if (kv <= 175) return keys[4]!;
  return keys[5]!;
}

/** Collects filled values for one object. */
export class Filler {
  readonly props: Props;
  constructor(private readonly id: Id, base: Props, private readonly uses: TypicalUse[]) {
    this.props = { ...base };
  }
  has(k: string) {
    return !isEmpty(this.props[k]);
  }
  set(k: string, v: PropValue | undefined, source: string) {
    if (v === undefined || v === null || (typeof v === 'number' && !Number.isFinite(v))) return;
    if (this.has(k)) return;
    this.props[k] = typeof v === 'number' ? r4(v) : v;
    this.uses.push({ objectId: this.id, key: k, value: this.props[k]!, source });
  }
  num(k: string) {
    return numOf(this.props, k);
  }
}

/** Schema defaults (`dflt`) for visible empty fields. Two passes so model selectors open their parameters. */
function schemaDefaults(o: Equipment | Connection, f: Filler) {
  const fields = schemaForObject(o).filter((x) => x.dflt !== undefined);
  for (let pass = 0; pass < 2; pass++) {
    for (const fd of fields) if (fieldVisible(fd, f.props)) f.set(fd.key, fd.dflt, fd.key.startsWith('design.dyn.') ? 'model library default' : 'schema default');
  }
}

export function fillEquipment(e: Equipment, uses: TypicalUse[], freqHz = 60): Props {
  const f = new Filler(e.id, e.props, uses);
  const kw = f.num('concept.kw');
  switch (e.type) {
    case 'utility': {
      const kv = f.num('design.kv');
      if (kv) f.set('design.scMva', typicalScMva(kv), 'typical fault level for the voltage class');
      break;
    }
    case 'generator': {
      if (kw) {
        const pf = f.num('design.pf') ?? 0.8;
        const mbase = kw / 1000 / pf;
        f.set('design.pmax', kw / 1000, 'rating');
        f.set('design.mbase', mbase, 'rating / power factor');
        f.set('design.pg', (f.num('design.pmax') ?? kw / 1000) * 0.8, '80 % of Pmax');
        const qmax = Math.sqrt(Math.max(0, mbase * mbase - (kw / 1000) ** 2));
        f.set('design.qmax', qmax, 'capability at rated pf');
        f.set('design.qmin', -qmax / 2, 'half of Qmax, absorbing');
      }
      f.set('design.xdpp', 0.18, 'typical X″d');
      f.set('design.x2', f.num('design.xdpp') ?? 0.18, 'X2 = X″d');
      f.set('design.x0', 0.07, 'typical X0');
      break;
    }
    case 'pv':
    case 'bess':
    case 'wind':
    case 'inverter': {
      if (kw) {
        const pmax = e.type === 'pv' ? kw / 1000 / 1.25 : kw / 1000; // PV: DC rating over a 1.25 inverter loading ratio
        f.set('design.pmax', pmax, e.type === 'pv' ? 'kWdc / 1.25' : 'rating');
        const mbase = (f.num('design.pmax') ?? pmax) / 0.95;
        f.set('design.mbase', mbase, 'Pmax / 0.95');
        const q = 0.33 * (f.num('design.mbase') ?? mbase);
        f.set('design.qmax', q, '0.95 pf capability');
        f.set('design.qmin', -q, '0.95 pf capability');
        f.set('design.pg', e.type === 'bess' ? 0 : f.num('design.pmax') ?? pmax, e.type === 'bess' ? 'idle' : 'Pmax');
        if (e.type === 'bess') f.set('design.pmin', -(f.num('design.pmax') ?? pmax), 'charging at rating');
      }
      f.set('design.iflt', 1.2, 'typical inverter fault current');
      break;
    }
    case 'xfmr2':
    case 'xfmr3': {
      const mva = f.num('design.mvaBase') ?? (f.num('concept.kva') ?? 0) / 1000;
      if (mva > 0) {
        f.set('design.z', typicalZPct(mva), 'typical %Z for the rating');
        f.set('design.xr', typicalXr(mva), 'IEEE C37.010 typical X/R');
        if (e.type === 'xfmr3') {
          f.set('design.zHY', typicalZPct(mva), 'typical %Z for the rating');
          f.set('design.zXY', typicalZPct(mva), 'typical %Z for the rating');
        }
      }
      break;
    }
    case 'load':
      f.set('design.pf', 0.9, 'typical load power factor');
      break;
    case 'motor': {
      const hp = f.num('concept.hp');
      if (hp) {
        const p = (hp * 0.746) / 0.93;
        f.set('design.pKw', p, 'hp × 0.746 / 93 % efficiency');
        f.set('design.qKvar', p * Math.tan(Math.acos(0.85)), '0.85 pf');
      }
      f.set('design.lrc', 6, 'typical NEMA design B locked-rotor current');
      break;
    }
    case 'line': {
      const kv = f.num('design.kv');
      const cond = f.props['design.conductor'];
      if (kv && typeof cond === 'string') {
        f.set('design.spacing', typicalSpacing(kv), 'typical spacing for the voltage class');
        const c = lineConstants(cond, String(f.props['design.spacing']), freqHz);
        if (c) {
          const src = 'ACSR table + Carson';
          f.set('design.r', c.r, src);
          f.set('design.x', c.x, src);
          f.set('design.b', c.bUs, src);
          f.set('design.r0', c.r0, src);
          f.set('design.x0', c.x0, src);
          f.set('design.b0', c.b0Us, src);
        }
      }
      break;
    }
    default:
      break;
  }
  schemaDefaults(e, f);
  return f.props;
}

/** Cable typicals. `kv` is the bus base kV when known (MV charging is added above 1 kV). */
export function fillCable(c: Connection, uses: TypicalUse[], kv: number | undefined): Props {
  const f = new Filler(c.id, c.props, uses);
  const size = f.props['design.size'];
  if (typeof size === 'string' && size.trim()) {
    const mat = f.props['design.material'] === 'Al' ? 'Al' : 'Cu';
    const t = cableTypical(size, mat, kv ?? f.num('design.kv') ?? 0.6);
    if (t) {
      f.set('design.r', t.r, 'NEC Ch. 9 Table 9');
      f.set('design.x', t.x, 'NEC Ch. 9 Table 9');
      f.set('design.b', t.b, 'typical cable charging');
      f.set('design.r0', t.r * CABLE_Z0_FACTOR.r, 'R0 ≈ 3·R1 rule of thumb');
      f.set('design.x0', t.x * CABLE_Z0_FACTOR.x, 'X0 ≈ 3·X1 rule of thumb');
      f.set('design.b0', t.b * CABLE_Z0_FACTOR.b, 'B0 = B1');
      if (t.sets > 1) f.set('design.sets', t.sets, 'from the size text');
    }
  }
  schemaDefaults(c, f);
  return f.props;
}

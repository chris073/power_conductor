// PSS/E 33 sequence data (.seq) writer: machine positive/negative/zero impedances, zero-sequence
// branch data and zero-sequence transformer data with winding connection codes and neutral
// grounding. Record layouts follow the PSS/E 33 POM "Sequence Data File" chapter as far as we can
// confirm without the manual at hand; see D-015 for what is certain and what is not.

import { numOf } from './typicals';
import { ohmsToPu, sourceZ0, theveninOnOwnBase } from './perunit';
import type { StudyCase, Winding } from './types';

const f = (n: number, d = 6) => (Number.isFinite(n) ? n.toFixed(d) : '0');
const q2 = (s: string) => `'${s.padEnd(2).slice(0, 2)}'`;
/** Effectively open zero-sequence path (ungrounded neutral, inverter behind a delta). */
const OPEN = 999;

/**
 * Two-winding connection code CC (PSS/E 33):
 * 1 = series path, ground paths both sides (Yg-Yg); 2 = no series path, ground path on winding 1
 * (Yg-Δ); 3 = no series path, ground path on winding 2 (Δ-Yg); 4 = no series or ground path
 * (Δ-Δ, or any ungrounded Y).
 */
export function connectionCode2(hv: string, lv: string): number {
  if (hv === 'Yg' && lv === 'Yg') return 1;
  if (hv === 'Yg' && lv === 'Δ') return 2;
  if (hv === 'Δ' && lv === 'Yg') return 3;
  return 4;
}

/**
 * Three-winding connection code (best-effort mapping, D-015): 1 when all windings are grounded wye,
 * 2 when H and X are grounded wye and Y is delta (the common autotransformer-with-tertiary case),
 * otherwise 4 (no series path).
 */
export function connectionCode3(w: string[]): number {
  if (w.every((c) => c === 'Yg')) return 1;
  if (w[0] === 'Yg' && w[1] === 'Yg' && w[2] === 'Δ') return 2;
  return 4;
}

export function writeSeq(sc: StudyCase): string {
  const L: string[] = [];
  const sbase = sc.settings.baseMva;
  const end = (what: string, next?: string) => L.push(`0 / END OF ${what} DATA${next ? `, BEGIN ${next} DATA` : ''}`);
  L.push(`0, 33     / PSS(R)E-33 SEQ created by Conductor: ${sc.title.slice(0, 40)}`);

  // Machine impedance data: I, ID, ZRPOS, ZXPOS, ZRNEG, ZXNEG, RZERO, XZERO (pu on MBASE).
  for (const g of sc.gens) {
    const p = sc.filledProps[g.dataId] ?? {};
    const n = (k: string) => numOf(p, k);
    let pos = { r: g.zr, x: g.zx };
    let neg = pos;
    let zero = { r: OPEN, x: OPEN };
    if (g.kind === 'utility') {
      const xr = n('design.xr') ?? 10;
      pos = theveninOnOwnBase(xr);
      neg = pos;
      const z0 = sourceZ0({ scMva: g.mbase, slgMva: n('design.slgMva'), xr, x0r0: n('design.x0r0'), sbase });
      zero = { r: (z0.r * g.mbase) / sbase, x: (z0.x * g.mbase) / sbase };
    } else if (g.kind === 'sync') {
      neg = { r: g.zr, x: n('design.x2') ?? g.zx };
      const grounding = String(p['design.grounding'] ?? 'High-resistance');
      if (grounding !== 'Ungrounded') {
        // The neutral impedance appears as 3·Zn in the zero-sequence path.
        const kv = n('design.kv') ?? 1;
        const rn = grounding === 'Solid' ? 0 : n('design.groundOhm') ?? 0;
        zero = { r: g.zr + 3 * (rn / ((kv * kv) / g.mbase)), x: n('design.x0') ?? 0.07 };
      }
    }
    L.push(`${g.bus},${q2(g.id)},${f(pos.r)},${f(pos.x)},${f(neg.r)},${f(neg.x)},${f(zero.r)},${f(zero.x)}`);
  }
  end('MACHINE IMPEDANCE', 'NEGATIVE SEQUENCE SHUNT LOAD');
  end('NEGATIVE SEQUENCE SHUNT LOAD', 'ZERO SEQUENCE SHUNT LOAD');
  end('ZERO SEQUENCE SHUNT LOAD', 'ZERO SEQUENCE NON-TRANSFORMER BRANCH');

  // Zero sequence non-transformer branch: I, J, ICKT, RLINZ, XLINZ, BCHZ, GI, BI, GJ, BJ (system base).
  for (const br of sc.branches) L.push(`${br.from},${br.to},${q2(br.ckt)},${f(br.r0)},${f(br.x0)},${f(br.b0)},0.0,0.0,0.0,0.0`);
  end('ZERO SEQUENCE NON-TRANSFORMER BRANCH', 'ZERO SEQUENCE MUTUAL IMPEDANCE');
  end('ZERO SEQUENCE MUTUAL IMPEDANCE', 'ZERO SEQUENCE TRANSFORMER');

  // Zero sequence transformer: I, J, K, ICKT, CZ0, CZG, CC, RG1, XG1, R01, X01, RG2, XG2, R02, X02, RNUTRL, XNUTRL
  // CZ0 = CZG = 1 (system base). RG = neutral resistance in pu at the winding's bus base.
  const rg = (w: Winding) => (w.conn === 'Yg' && w.groundOhm > 0 && w.baseKv > 0 ? ohmsToPu(w.groundOhm, w.baseKv, sbase) : 0);
  for (const t of sc.xfmr2) {
    const cc = connectionCode2(t.hv.conn, t.lv.conn);
    L.push(`${t.hv.bus},${t.lv.bus},0,${q2(t.ckt)},1,1,${cc},${f(rg(t.hv))},0.0,${f(t.r0)},${f(t.x0)},${f(rg(t.lv))},0.0,0.0,0.0,0.0,0.0`);
  }
  for (const t of sc.xfmr3) {
    const cc = connectionCode3(t.w.map((w) => w.conn));
    const s = t.z0Scale;
    // Star-equivalent zero-sequence winding impedances from the pairwise values.
    const r1 = ((t.z.r12 + t.z.r31 - t.z.r23) / 2) * s, x1 = ((t.z.x12 + t.z.x31 - t.z.x23) / 2) * s;
    const r2 = ((t.z.r12 + t.z.r23 - t.z.r31) / 2) * s, x2 = ((t.z.x12 + t.z.x23 - t.z.x31) / 2) * s;
    const r3 = ((t.z.r23 + t.z.r31 - t.z.r12) / 2) * s, x3 = ((t.z.x23 + t.z.x31 - t.z.x12) / 2) * s;
    L.push(`${t.w[0].bus},${t.w[1].bus},${t.w[2].bus},${q2(t.ckt)},1,1,${cc},${f(rg(t.w[0]))},0.0,${f(r1)},${f(x1)},${f(rg(t.w[1]))},0.0,${f(r2)},${f(x2)},${f(rg(t.w[2]))},0.0,${f(r3)},${f(x3)},0.0,0.0`);
  }
  end('ZERO SEQUENCE TRANSFORMER', 'ZERO SEQUENCE SWITCHED SHUNT');
  end('ZERO SEQUENCE SWITCHED SHUNT', 'ZERO SEQUENCE FIXED SHUNT');
  end('ZERO SEQUENCE FIXED SHUNT');
  L.push('Q');
  return L.join('\r\n') + '\r\n';
}

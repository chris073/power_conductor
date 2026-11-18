// Per-unit conversions on the system MVA base. Every function is small and hand-checkable.

/** Base impedance in ohms: Zb = kV² / MVA. */
export function zBase(kv: number, sbaseMva: number): number {
  return (kv * kv) / sbaseMva;
}

/** Splits an impedance magnitude into R and X by X/R. */
export function splitZ(z: number, xr: number): { r: number; x: number } {
  if (!(xr > 0)) return { r: z, x: 0 };
  const r = z / Math.sqrt(1 + xr * xr);
  return { r, x: r * xr };
}

/**
 * Transformer impedance on the system base (CZ = 1):
 *   Z = %Z/100 · (Sbase / Snom) · (kV_rated / kV_base)²
 * The voltage factor refers the nameplate impedance to the bus base on the winding that carries
 * the impedance in the pi model (winding 2 in PSS/E and ANDES; the tap sits on winding 1).
 */
export function xfmrZ(o: { zPct: number; xr: number; mvaBase: number; sbase: number; ratedKv?: number; baseKv?: number }): { r: number; x: number } {
  const vf = o.ratedKv && o.baseKv ? (o.ratedKv / o.baseKv) ** 2 : 1;
  const z = (o.zPct / 100) * (o.sbase / o.mvaBase) * vf;
  return splitZ(z, o.xr);
}

/**
 * Series branch from impedance per length. `perLength` is in Ω (or µS for B) per `unitLength`
 * (e.g. 1000 ft for cables, 1 mi for lines); `length` is in the same length unit as `unitLength`.
 * Parallel sets divide R and X and multiply B.
 */
export function branchPu(o: { r: number; x: number; bUs: number; length: number; unitLength: number; sets?: number; kv: number; sbase: number }): { r: number; x: number; b: number; rOhm: number; xOhm: number } {
  const sets = o.sets && o.sets > 0 ? o.sets : 1;
  const k = o.length / o.unitLength;
  const rOhm = (o.r * k) / sets;
  const xOhm = (o.x * k) / sets;
  const bS = o.bUs * 1e-6 * k * sets;
  const zb = zBase(o.kv, o.sbase);
  return { r: rOhm / zb, x: xOhm / zb, b: bS * zb, rOhm, xOhm };
}

/** Ohms to per unit at a bus. */
export function ohmsToPu(ohms: number, kv: number, sbase: number): number {
  return ohms / zBase(kv, sbase);
}

/** Thevenin source on its own MVA base (MBASE = fault MVA): |Z1| = 1 pu, split by X/R. */
export function theveninOnOwnBase(xr: number): { r: number; x: number } {
  return splitZ(1, xr);
}

/**
 * Zero-sequence source impedance (system base) from 3-phase and SLG fault MVA:
 *   I_slg = 3 / (2·Z1 + Z0)  →  Z0 = 3·Sbase/S_slg − 2·Z1, with Z1 = Sbase/S_3ph.
 * Magnitudes only (the phase angles are close for utility sources).
 */
export function sourceZ0(o: { scMva: number; slgMva?: number; xr: number; x0r0?: number; sbase: number }): { r: number; x: number } {
  const z1 = o.sbase / o.scMva;
  const z0 = o.slgMva && o.slgMva > 0 ? Math.max(1e-6, (3 * o.sbase) / o.slgMva - 2 * z1) : z1;
  return splitZ(z0, o.x0r0 && o.x0r0 > 0 ? o.x0r0 : o.xr);
}

/** Shunt Mvar at 1 pu bus voltage from a rating at rated kV: Q·(V_base / V_rated)². */
export function shuntMvarAtBase(ratedMvar: number, ratedKv: number | undefined, baseKv: number): number {
  if (!ratedKv || !(ratedKv > 0)) return ratedMvar;
  return ratedMvar * (baseKv / ratedKv) ** 2;
}

/** Three-phase MVA rating from amps at kV. */
export function mvaFromAmps(amps: number, kv: number): number {
  return (Math.sqrt(3) * kv * amps) / 1000;
}

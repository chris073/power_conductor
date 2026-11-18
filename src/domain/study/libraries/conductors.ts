// Typical conductor impedances for study defaults. Values are representative, rounded and
// deliberately conservative; replace them with project data (cable submittals, utility line
// constants) as soon as they exist. Every value the export takes from here is marked "typical".

/** Ohms per 1000 ft at 60 Hz (positive sequence). */
export interface CableZ { r: number; x: number }

/**
 * 600 V cables, three conductors in PVC conduit, AC resistance at 75 °C and reactance.
 * Source: NFPA 70 (NEC) Chapter 9, Table 9 "Alternating-Current Resistance and Reactance for
 * 600-Volt Cables, 3-Phase, 60 Hz, 75 °C, Three Single Conductors in Conduit" (PVC conduit
 * columns), rounded. MV cables use the same R (conductor-dominated) and a slightly larger X
 * (see MV_X_FACTOR).
 */
const CU: Record<string, CableZ> = {
  '14': { r: 3.1, x: 0.058 }, '12': { r: 2.0, x: 0.054 }, '10': { r: 1.2, x: 0.05 }, '8': { r: 0.78, x: 0.052 },
  '6': { r: 0.49, x: 0.051 }, '4': { r: 0.31, x: 0.048 }, '3': { r: 0.25, x: 0.047 }, '2': { r: 0.19, x: 0.045 },
  '1': { r: 0.15, x: 0.046 }, '1/0': { r: 0.12, x: 0.044 }, '2/0': { r: 0.1, x: 0.043 }, '3/0': { r: 0.077, x: 0.042 },
  '4/0': { r: 0.062, x: 0.041 }, '250': { r: 0.052, x: 0.041 }, '300': { r: 0.044, x: 0.041 }, '350': { r: 0.038, x: 0.04 },
  '400': { r: 0.033, x: 0.04 }, '500': { r: 0.027, x: 0.039 }, '600': { r: 0.023, x: 0.039 }, '750': { r: 0.019, x: 0.038 },
  '1000': { r: 0.015, x: 0.037 },
};
const AL: Record<string, CableZ> = {
  '12': { r: 3.2, x: 0.054 }, '10': { r: 2.0, x: 0.05 }, '8': { r: 1.3, x: 0.052 }, '6': { r: 0.81, x: 0.051 },
  '4': { r: 0.51, x: 0.048 }, '3': { r: 0.4, x: 0.047 }, '2': { r: 0.32, x: 0.045 }, '1': { r: 0.25, x: 0.046 },
  '1/0': { r: 0.2, x: 0.044 }, '2/0': { r: 0.16, x: 0.043 }, '3/0': { r: 0.13, x: 0.042 }, '4/0': { r: 0.1, x: 0.041 },
  '250': { r: 0.085, x: 0.041 }, '300': { r: 0.071, x: 0.041 }, '350': { r: 0.061, x: 0.04 }, '400': { r: 0.054, x: 0.04 },
  '500': { r: 0.043, x: 0.039 }, '600': { r: 0.036, x: 0.039 }, '750': { r: 0.029, x: 0.038 }, '1000': { r: 0.023, x: 0.037 },
};

/** Shielded MV cables sit further apart than 600 V conductors in one conduit: about +20 % X. */
const MV_X_FACTOR = 1.2;

/**
 * Charging susceptance of shielded MV cable, µS per 1000 ft. C ≈ 2π·ε0·εr / ln(D/d) with εr ≈ 3
 * (EPR/XLPE) and D/d ≈ 2 gives about 0.07 µF per 1000 ft, so B = ωC ≈ 27 µS. 600 V cable charging
 * is negligible and taken as zero.
 */
export const MV_CABLE_B_US_PER_KFT = 27;

/**
 * Zero sequence, rule of thumb for three-conductor cable with sheath/ground return:
 * R0 ≈ 3·R1, X0 ≈ 3·X1 (IEEE Std 399 "Brown Book" discussion of cable zero-sequence impedance;
 * the real ratio depends strongly on the return path, so treat as a placeholder).
 */
export const CABLE_Z0_FACTOR = { r: 3, x: 3, b: 1 };

/** Parses "2/0 AWG", "500 kcmil", "8×600 kcmil", "#4" into a library size key and parallel sets. */
export function parseCableSize(size: string): { key: string; sets: number } | null {
  let s = size.trim().toLowerCase().replace(/\s+/g, ' ');
  let sets = 1;
  const m = /^(\d+)\s*[x×*]\s*(.+)$/.exec(s);
  if (m) { sets = Number(m[1]); s = m[2]!; }
  s = s.replace(/^#/, '').replace(/\b(awg|kcmil|mcm|cu|al)\b/g, '').trim();
  if (/^\d\/0$/.test(s)) return { key: s, sets };
  if (/^\d+$/.test(s)) return { key: String(Number(s)), sets };
  return null;
}

/** Typical positive-sequence impedance (Ω/1000 ft) for a cable size, or null when unknown. */
export function cableTypical(size: string, material: 'Cu' | 'Al', kv: number): (CableZ & { b: number; sets: number }) | null {
  const p = parseCableSize(size);
  if (!p) return null;
  const z = (material === 'Al' ? AL : CU)[p.key];
  if (!z) return null;
  const mv = kv > 1;
  return { r: z.r, x: mv ? round(z.x * MV_X_FACTOR) : z.x, b: mv ? MV_CABLE_B_US_PER_KFT : 0, sets: p.sets };
}

// ---------- overhead conductors

/**
 * ACSR conductors: AC resistance at 50 °C, 60 Hz (Ω/mile), geometric mean radius (ft) and outside
 * diameter (in). Source: typical ACSR tables, e.g. Glover, Sarma & Overbye, "Power System Analysis
 * and Design", Table A.4 (from the Aluminum Association / Alcoa data), rounded.
 */
export interface OhConductor { r: number; gmrFt: number; diaIn: number; ampacity: number }
export const ACSR: Record<string, OhConductor> = {
  'Raven 1/0': { r: 1.12, gmrFt: 0.00446, diaIn: 0.398, ampacity: 242 },
  'Penguin 4/0': { r: 0.592, gmrFt: 0.00814, diaIn: 0.563, ampacity: 357 },
  'Partridge 266.8': { r: 0.385, gmrFt: 0.0217, diaIn: 0.642, ampacity: 460 },
  'Linnet 336.4': { r: 0.306, gmrFt: 0.0243, diaIn: 0.721, ampacity: 530 },
  'Hawk 477': { r: 0.216, gmrFt: 0.0289, diaIn: 0.858, ampacity: 660 },
  'Drake 795': { r: 0.1284, gmrFt: 0.0373, diaIn: 1.108, ampacity: 900 },
  'Cardinal 954': { r: 0.1092, gmrFt: 0.0403, diaIn: 1.196, ampacity: 1010 },
};

/**
 * Typical phase spacings, as geometric mean distance (ft) between phases. Representative US
 * structures; the class voltage is only a hint.
 */
export const SPACINGS: Record<string, number> = {
  'Distribution crossarm (GMD 4.5 ft)': 4.5,
  '34.5 kV (GMD 6 ft)': 6,
  '69 kV (GMD 10 ft)': 10,
  '115 kV H-frame (GMD 18 ft)': 18,
  '138 kV (GMD 20 ft)': 20,
  '230 kV (GMD 27 ft)': 27,
};

/** Earth return depth De = 2160·√(ρ/f) ft (Carson), with ρ = 100 Ω·m. */
const EARTH_DEPTH_FT = (f: number) => 2160 * Math.sqrt(100 / f);

/**
 * Line constants per mile from conductor and spacing (transposed, no ground wire):
 *   X1 = 2π f · 2e-7 · ln(GMD/GMR) · 1609.34 Ω/mi   (= 0.12134·ln(GMD/GMR) at 60 Hz)
 *   B1 = 2π f · 2π ε0 / ln(GMD/r) · 1609.34 S/mi
 *   Z0 = R + 3·Re(earth) + j·3·X(earth) per Carson: R0 = R + 0.004764·f, X0 = 0.006985·f·ln(De³/(GMR·GMD²))·…
 * Carson's simplified 60 Hz form gives R0 = R + 0.2858 Ω/mi and X0 = 0.36402·ln(De / ∛(GMR·GMD²)) Ω/mi.
 * B0 is taken as 0.6·B1 (typical for single-circuit lines without ground wires).
 */
export function lineConstants(conductor: string, spacing: string, f = 60): { r: number; x: number; bUs: number; r0: number; x0: number; b0Us: number; ampacity: number } | null {
  const c = ACSR[conductor];
  const gmd = SPACINGS[spacing];
  if (!c || !gmd) return null;
  const kx = 2 * Math.PI * f * 2e-7 * 1609.34; // Ω/mi per neper
  const x = kx * Math.log(gmd / c.gmrFt);
  const rFt = c.diaIn / 24;
  const eps0 = 8.854e-12;
  const bUs = 2 * Math.PI * f * ((2 * Math.PI * eps0) / Math.log(gmd / rFt)) * 1609.34 * 1e6;
  const de = EARTH_DEPTH_FT(f);
  const r0 = c.r + 0.0047636 * f; // 9.869e-7·f Ω/m → per mile ×1609.34 ×3
  const x0 = 3 * kx * Math.log(de / Math.cbrt(c.gmrFt * gmd * gmd));
  return { r: c.r, x: round(x), bUs: round(bUs), r0: round(r0), x0: round(x0), b0Us: round(0.6 * bUs), ampacity: c.ampacity };
}

function round(n: number) {
  return Math.round(n * 1e5) / 1e5;
}

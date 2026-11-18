// Typical transformer data for study defaults (marked "typical" when used).

/**
 * Typical X/R by self-cooled rating (MVA). Approximates the median curve of IEEE Std C37.010
 * (Application Guide for AC High-Voltage Circuit Breakers), Fig. "X/R range for power
 * transformers"; small units from IEEE Std 399 (Brown Book) typical tables. Interpolated on log(MVA).
 */
const XR_POINTS: [number, number][] = [
  [0.1, 2.5], [0.5, 4.5], [1, 5.5], [2.5, 7], [5, 10], [10, 14], [20, 18], [50, 26], [100, 33], [200, 40], [500, 50],
];

export function typicalXr(mva: number): number {
  if (!(mva > 0)) return XR_POINTS[0]![1];
  const pts = XR_POINTS;
  if (mva <= pts[0]![0]) return pts[0]![1];
  for (let i = 1; i < pts.length; i++) {
    const [m1, x1] = pts[i - 1]!;
    const [m2, x2] = pts[i]!;
    if (mva <= m2) {
      const t = (Math.log(mva) - Math.log(m1)) / (Math.log(m2) - Math.log(m1));
      return Math.round((x1 + t * (x2 - x1)) * 10) / 10;
    }
  }
  return pts[pts.length - 1]![1];
}

/**
 * Typical %Z on the self-cooled rating. Liquid-filled distribution and small power transformers
 * per the ranges in IEEE Std C57.12.00 / C57.12.10 practice (5.75 % is the common 750–2500 kVA
 * value), larger units per IEEE Std 399 typical tables.
 */
export function typicalZPct(mva: number): number {
  if (mva <= 0.5) return 4.5;
  if (mva <= 2.5) return 5.75;
  if (mva <= 10) return 6.5;
  if (mva <= 30) return 8;
  if (mva <= 100) return 10;
  return 12;
}

/** Vector-group phase shift (degrees, LV lagging HV per ANSI: Δ-Y and Y-Δ shift 30°). */
export function vectorShiftDeg(hv: string, lv: string): number {
  const d = (w: string) => w === 'Δ';
  return d(hv) !== d(lv) ? 30 : 0;
}

/** Parses "13.8-0.48 kV", "138/34.5/13.8", "13,800-480 V" into winding voltages in kV (HV first). */
export function parseKvRatio(text: string): number[] {
  const s = String(text).trim();
  if (!s) return [];
  const isVolts = /\bv\b/i.test(s) && !/kv/i.test(s);
  const parts = s
    .replace(/kv|v\b/gi, ' ')
    .split(/\s*(?:-|–|\/|:|\bto\b)\s*/i)
    .map((p) => p.replace(/,/g, '').replace(/y.*$/i, '').trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  // Heuristic: values over 1000 are volts.
  return parts.map((n) => (isVolts || n >= 1000 ? n / 1000 : n));
}

import { describe, expect, it } from 'vitest';
import { cableTypical, lineConstants, parseCableSize } from '../libraries/conductors';
import { DYN_MODELS } from '../libraries/dynamics';
import { parseKvRatio, typicalXr, typicalZPct, vectorShiftDeg } from '../libraries/transformers';

describe('typical-value libraries', () => {
  it('parses voltage ratios', () => {
    expect(parseKvRatio('13.8-0.48 kV')).toEqual([13.8, 0.48]);
    expect(parseKvRatio('138/34.5/13.8')).toEqual([138, 34.5, 13.8]);
    expect(parseKvRatio('13,800-480 V')).toEqual([13.8, 0.48]);
    expect(parseKvRatio('nonsense')).toEqual([]);
  });

  it('parses cable sizes with parallel sets', () => {
    expect(parseCableSize('2/0 AWG')).toEqual({ key: '2/0', sets: 1 });
    expect(parseCableSize('8×600 kcmil')).toEqual({ key: '600', sets: 8 });
    expect(parseCableSize('#4')).toEqual({ key: '4', sets: 1 });
    expect(parseCableSize('weird')).toBeNull();
  });

  it('gives NEC Table 9 values for 600 V copper and adds charging for MV', () => {
    expect(cableTypical('250 kcmil', 'Cu', 0.48)).toEqual({ r: 0.052, x: 0.041, b: 0, sets: 1 });
    const mv = cableTypical('2/0 AWG', 'Cu', 13.8)!;
    expect(mv.r).toBe(0.1);
    expect(mv.x).toBeCloseTo(0.0516, 4);
    expect(mv.b).toBeGreaterThan(0);
  });

  it('computes Hawk line constants by hand', () => {
    // X = 0.12134·ln(10 / 0.0289) = 0.12134·5.8466 = 0.7094 Ω/mi at 60 Hz.
    const c = lineConstants('Hawk 477', '69 kV (GMD 10 ft)')!;
    expect(c.r).toBe(0.216);
    expect(c.x).toBeCloseTo(0.7094, 3);
    // B = 377·(2π·8.854e-12 / ln(10/0.03575))·1609.34 S/mi ≈ 5.995 µS/mi.
    expect(c.bUs).toBeCloseTo(5.995, 2);
    expect(c.r0).toBeCloseTo(0.216 + 0.2858, 3);
    expect(c.x0).toBeGreaterThan(2.5 * c.x);
  });

  it('interpolates transformer X/R and typical %Z', () => {
    expect(typicalXr(2.5)).toBe(7);
    expect(typicalXr(5)).toBe(10);
    expect(typicalXr(3.5)).toBeGreaterThan(7);
    expect(typicalXr(3.5)).toBeLessThan(10);
    expect(typicalZPct(2.5)).toBe(5.75);
    expect(vectorShiftDeg('Δ', 'Yg')).toBe(30);
    expect(vectorShiftDeg('Yg', 'Yg')).toBe(0);
  });

  it('keeps PSS/E parameter counts for the DYR models', () => {
    const cons = (m: string) => DYN_MODELS[m]!.params.filter((p) => !p.icon).length;
    const icons = (m: string) => DYN_MODELS[m]!.params.filter((p) => p.icon).length;
    expect(cons('GENROU')).toBe(14);
    expect(cons('GENSAL')).toBe(12);
    expect(cons('SEXS')).toBe(6);
    expect(cons('TGOV1')).toBe(7);
    expect(cons('IEEET1')).toBe(14);
    expect([icons('ESST1A'), cons('ESST1A')]).toEqual([2, 18]);
    expect([icons('IEEEG1'), cons('IEEEG1')]).toEqual([2, 20]);
    expect([icons('REGCA1'), cons('REGCA1')]).toEqual([1, 14]);
    expect([icons('REECA1'), cons('REECA1')]).toEqual([6, 45]);
    expect([icons('REPCA1'), cons('REPCA1')]).toEqual([7, 27]);
  });
});

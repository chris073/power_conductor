// Golden snippets: the sample substation exported as PSS/E RAW v33.
import { describe, expect, it } from 'vitest';
import { buildStudyCase, persistBusNumbers, writeRaw } from '../../domain/study';
import { buildSampleProject } from '../sample';

function sampleCase() {
  let doc = buildSampleProject();
  doc = persistBusNumbers(doc, buildStudyCase(doc));
  return { doc, sc: buildStudyCase(doc) };
}

describe('sample substation study export', () => {
  const { sc } = sampleCase();
  const raw = writeRaw(sc);
  const lines = raw.split('\r\n');

  it('reduces to seven study buses with no errors or warnings', () => {
    expect(sc.buses.map((b) => `${b.number} ${b.name} ${b.baseKv} ${b.ide}`)).toEqual([
      '1 G-1 0.48 2', '2 INV-1 0.48 2', '3 LV-BUS 0.48 1', '4 MTR-1 0.48 1', '5 MV-BUS 13.8 1', '6 T1 13.8 1', '7 UTIL-1 13.8 3',
    ]);
    expect(sc.issues.filter((i) => i.severity !== 'info')).toEqual([]);
  });

  it('writes the v33 case identification and section terminators', () => {
    expect(lines[0]).toMatch(/^0, 100\.00, 33, 0, 1, 60\.00 {5}\/ PSS\(R\)E-33 RAW/);
    const ends = lines.filter((l) => l.startsWith('0 / END OF'));
    expect(ends).toHaveLength(19);
    expect(ends[0]).toBe('0 / END OF BUS DATA, BEGIN LOAD DATA');
    expect(ends[18]).toBe('0 / END OF INDUCTION MACHINE DATA');
    expect(lines.at(-2)).toBe('Q');
  });

  it('matches golden records', () => {
    expect(lines).toContain("7,'UTIL-1      ',13.8000,3,1,1,1,1.00000,0.0000,1.10000,0.90000,1.10000,0.90000");
    expect(lines).toContain("3,'1 ',1,1,1,0.1500,0.0726,0.0000,0.0000,0.0000,0.0000,1,1,0");
    expect(lines).toContain("5,'1 ',1,0.0000,0.6000");
    expect(lines).toContain("7,'1 ',0.0000,0.0000,9999.0000,-9999.0000,1.00000,0,500.000,0.06652,0.99779,0.00000,0.00000,1.00000,1,100.0,9999.0000,-9999.0000,1,1.0000,0,1.0000,0,1.0000,0,1.0000,0,1.0000");
    expect(lines).toContain("7,5,'1 ',0.321361,0.665406,0.000026,12.67,12.67,12.67,0.0,0.0,0.0,0.0,1,1,2.000,1,1.0000,0,1.0000,0,1.0000,0,1.0000");
    const t1 = lines.indexOf("6,3,0,'1 ',2,1,1,0.0,0.0,2,'T1          ',1,1,1.0000,0,1.0000,0,1.0000,0,1.0000,'Dyn1        '");
    expect(t1).toBeGreaterThan(0);
    expect(lines.slice(t1 + 1, t1 + 4)).toEqual([
      '0.325269,2.276884,2.500',
      '13.80000,0.000,30.000,2.50,2.50,2.50,0,0,14.49000,13.11000,1.05000,0.95000,5,0,0.0,0.0,0.0',
      '0.48000,0.000',
    ]);
  });
});

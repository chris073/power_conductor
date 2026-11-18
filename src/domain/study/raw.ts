// PSS/E RAW v33 writer (bus-branch). Record layouts follow the PSS/E 33 Program Operation Manual,
// "Power Flow Raw Data File Contents". ANDES (andes/io/psse.py) reads the same file; notes on how
// it reads specific fields are in docs/DECISIONS.md (D-013).

import type { StudyCase } from './types';

const f = (n: number, d = 4) => (Number.isFinite(n) ? n.toFixed(d) : '0');
const q = (s: string, w = 12) => `'${s.replace(/'/g, '"').padEnd(w).slice(0, w)}'`;
const ownership = '1,1.0000,0,1.0000,0,1.0000,0,1.0000';

export function writeRaw(sc: StudyCase, meta: { app?: string; date?: string } = {}): string {
  const s = sc.settings;
  const L: string[] = [];
  const end = (what: string, next?: string) => L.push(`0 / END OF ${what} DATA${next ? `, BEGIN ${next} DATA` : ''}`);

  // Case identification: IC, SBASE, REV, XFRRAT, NXFRAT, BASFRQ
  L.push(`0, ${f(s.baseMva, 2)}, 33, 0, 1, ${f(s.freqHz, 2)}     / PSS(R)E-33 RAW created by ${meta.app ?? 'Conductor'}${meta.date ? ` ${meta.date}` : ''}`);
  L.push(sc.title.slice(0, 60) || 'Conductor study case');
  L.push(`Bus-branch reduction of the one-line, ${s.baseMva} MVA base`);

  // Bus: I,'NAME',BASKV,IDE,AREA,ZONE,OWNER,VM,VA,NVHI,NVLO,EVHI,EVLO
  for (const b of sc.buses) {
    L.push(`${b.number},${q(b.name)},${f(b.baseKv)},${b.ide},${b.area},${b.zone},${b.owner},${f(b.vm0, 5)},${f(b.va0, 4)},${f(b.vmax, 5)},${f(b.vmin, 5)},${f(b.vmax, 5)},${f(b.vmin, 5)}`);
  }
  end('BUS', 'LOAD');

  // Load: I,ID,STATUS,AREA,ZONE,PL,QL,IP,IQ,YP,YQ,OWNER,SCALE,INTRPT
  const busOf = new Map(sc.buses.map((b) => [b.number, b]));
  for (const l of sc.loads) {
    const b = busOf.get(l.bus)!;
    L.push(`${l.bus},${q(l.id, 2)},${l.status},${b.area},${b.zone},${f(l.pl)},${f(l.ql)},${f(l.ip)},${f(l.iq)},${f(l.yp)},${f(l.yq)},${b.owner},1,0`);
  }
  end('LOAD', 'FIXED SHUNT');

  // Fixed shunt: I,ID,STATUS,GL,BL
  for (const sh of sc.fixedShunts) L.push(`${sh.bus},${q(sh.id, 2)},${sh.status},${f(0)},${f(sh.bMvar)}`);
  end('FIXED SHUNT', 'GENERATOR');

  // Generator: I,ID,PG,QG,QT,QB,VS,IREG,MBASE,ZR,ZX,RT,XT,GTAP,STAT,RMPCT,PT,PB,O1,F1,...,O4,F4,WMOD,WPF
  for (const g of sc.gens) {
    L.push(`${g.bus},${q(g.id, 2)},${f(g.pg)},${f(g.qg)},${f(g.qmax)},${f(g.qmin)},${f(g.vs, 5)},${g.ireg},${f(g.mbase, 3)},${f(g.zr, 5)},${f(g.zx, 5)},0.00000,0.00000,1.00000,${g.status},100.0,${f(g.pmax)},${f(g.pmin)},${ownership},${g.wmod},1.0000`);
  }
  end('GENERATOR', 'BRANCH');

  // Non-transformer branch: I,J,CKT,R,X,B,RATEA,RATEB,RATEC,GI,BI,GJ,BJ,ST,MET,LEN,O1,F1,...,O4,F4
  for (const br of sc.branches) {
    L.push(`${br.from},${br.to},${q(br.ckt, 2)},${f(br.r, 6)},${f(br.x, 6)},${f(br.b, 6)},${f(br.rateA, 2)},${f(br.rateB, 2)},${f(br.rateC, 2)},0.0,0.0,0.0,0.0,${br.status},1,${f(br.length, 3)},${ownership}`);
  }
  end('BRANCH', 'TRANSFORMER');

  // Transformer (CZ = 1: R, X on system base; CM = 1; magnetizing admittance neglected).
  for (const t of sc.xfmr2) {
    // Two-winding: CW = 2 (winding voltages in kV), NOMV = 0 (bus base kV).
    L.push(`${t.hv.bus},${t.lv.bus},0,${q(t.ckt, 2)},2,1,1,0.0,0.0,2,${q(t.name)},${t.status},${ownership},${q(t.vecGroup)}`);
    L.push(`${f(t.r, 6)},${f(t.x, 6)},${f(t.mva, 3)}`);
    const w1 = t.hv.kv * t.tap;
    const cod = t.ctrlBus ? 1 : 0;
    L.push(`${f(w1, 5)},0.000,${f(t.shiftDeg, 3)},${f(t.hv.rateA, 2)},${f(t.hv.rateB, 2)},${f(t.hv.rateC, 2)},${cod},${t.ctrlBus},${f(t.hv.kv * t.tapMax, 5)},${f(t.hv.kv * t.tapMin, 5)},1.05000,0.95000,${t.tapSteps},0,0.0,0.0,0.0`);
    L.push(`${f(t.lv.kv, 5)},0.000`);
  }
  for (const t of sc.xfmr3) {
    // Three-winding: CW = 1 (winding voltage in pu of the bus base kV), NOMV = 0.
    const [a, b, c] = t.w;
    L.push(`${a.bus},${b.bus},${c.bus},${q(t.ckt, 2)},1,1,1,0.0,0.0,2,${q(t.name)},${t.status},${ownership},${q(t.vecGroup)}`);
    L.push(`${f(t.z.r12, 6)},${f(t.z.x12, 6)},${f(t.mva[0], 3)},${f(t.z.r23, 6)},${f(t.z.x23, 6)},${f(t.mva[2], 3)},${f(t.z.r31, 6)},${f(t.z.x31, 6)},${f(t.mva[2], 3)},1.00000,0.0000`);
    t.w.forEach((w, i) => {
      const ratio = w.baseKv > 0 ? w.kv / w.baseKv : 1;
      const ang = i === 0 ? 0 : shift3(t.w[0].conn, w.conn);
      L.push(`${f(ratio, 5)},0.000,${f(ang, 3)},${f(w.rateA, 2)},${f(w.rateB, 2)},${f(w.rateC, 2)},0,0,1.10000,0.90000,1.10000,0.90000,33,0,0.0,0.0,0.0`);
    });
  }
  end('TRANSFORMER', 'AREA');

  // Area: I,ISW,PDES,PTOL,'ARNAME'
  for (const a of sc.areas) {
    const sw = sc.buses.find((b) => b.area === a && b.ide === 3)?.number ?? 0;
    L.push(`${a},${sw},0.000,10.000,${q(`AREA ${a}`)}`);
  }
  end('AREA', 'TWO-TERMINAL DC');
  end('TWO-TERMINAL DC', 'VSC DC LINE');
  end('VSC DC LINE', 'IMPEDANCE CORRECTION');
  end('IMPEDANCE CORRECTION', 'MULTI-TERMINAL DC');
  end('MULTI-TERMINAL DC', 'MULTI-SECTION LINE');
  end('MULTI-SECTION LINE', 'ZONE');
  for (const z of sc.zones) L.push(`${z},${q(`ZONE ${z}`)}`);
  end('ZONE', 'INTER-AREA TRANSFER');
  end('INTER-AREA TRANSFER', 'OWNER');
  for (const o of sc.owners) L.push(`${o},${q(`OWNER ${o}`)}`);
  end('OWNER', 'FACTS DEVICE');
  end('FACTS DEVICE', 'SWITCHED SHUNT');

  // Switched shunt: I,MODSW,ADJM,STAT,VSWHI,VSWLO,SWREM,RMPCT,'RMIDNT',BINIT,N1,B1,...,N8,B8
  for (const sh of sc.switchedShunts) {
    const sw = sh.switched!;
    L.push(`${sh.bus},1,0,${sh.status},${f(sw.vHigh, 5)},${f(sw.vLow, 5)},0,100.0,${q('')},${f(sh.bMvar, 3)},${sw.steps},${f(sw.stepMvar, 3)}`);
  }
  end('SWITCHED SHUNT', 'GNE');
  end('GNE', 'INDUCTION MACHINE');
  end('INDUCTION MACHINE');
  L.push('Q');
  return L.join('\r\n') + '\r\n';
}

function shift3(hv: string, w: string): number {
  return (hv === 'Δ') !== (w === 'Δ') ? -30 : 0;
}

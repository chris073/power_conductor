// Node-breaker → bus-branch reduction and study-case build (D-011).
//
// 1. Typicals fill empty study values (typicals.ts); nothing in the project changes.
// 2. Cables with a length (above the collapse thresholds) stay branches; everything joined through
//    closed switching devices, buses, CTs and ties merges into one study bus (topology union-find).
// 3. Study buses get sticky PSS/E numbers, names, base kV (basekv), islands and IDE codes.
// 4. Elements become per-unit records on the system base; problems become readiness issues.

import { CATALOG } from '../catalog';
import { defaultStudySettings, fieldVisible, isEmpty, schemaForObject } from '../model';
import { electricalNodes } from '../topology';
import type { Connection, Equipment, EquipmentType, Id, ProjectDoc, PropValue } from '../types';
import { lineConstants } from './libraries/conductors';
import { vectorShiftDeg } from './libraries/transformers';
import { branchPu, mvaFromAmps, ohmsToPu, shuntMvarAtBase, theveninOnOwnBase, xfmrZ } from './perunit';
import { fillCable, fillEquipment, numOf, type Props } from './typicals';
import type { BranchRec, GenRec, Issue, LoadRec, ShuntRec, StudyBus, StudyCase, TypicalUse, Winding, Xfmr2Rec, Xfmr3Rec } from './types';

const BUSLIKE: ReadonlySet<EquipmentType> = new Set(['bus', 'mcc', 'panelboard']);
const MACHINES: ReadonlySet<EquipmentType> = new Set(['utility', 'generator', 'wind', 'pv', 'bess', 'inverter']);
/** Types that make an electrical node a study bus. */
const RELEVANT: ReadonlySet<EquipmentType> = new Set(['bus', 'mcc', 'panelboard', 'utility', 'generator', 'wind', 'pv', 'bess', 'inverter', 'xfmr2', 'xfmr3', 'line', 'reactor', 'load', 'motor', 'capacitor']);

const tkey = (eq: Id, t: string) => `${eq}:${t}`;

function anchorRank(type: EquipmentType): number {
  if (type === 'mcc' || type === 'panelboard') return 0;
  if (MACHINES.has(type)) return 1;
  if (type === 'xfmr2' || type === 'xfmr3') return 2;
  if (type === 'line' || type === 'reactor') return 3;
  if (type === 'load' || type === 'motor' || type === 'capacitor') return 4;
  return 5;
}

const psseName = (s: string) => s.replace(/'/g, '"').slice(0, 12);

class UF {
  private p = new Map<string, string>();
  find(a: string): string {
    let r = this.p.get(a) ?? a;
    if (r === a) { this.p.set(a, a); return a; }
    r = this.find(r);
    this.p.set(a, r);
    return r;
  }
  union(a: string, b: string) { const ra = this.find(a); const rb = this.find(b); if (ra !== rb) this.p.set(ra, rb); }
}

interface NodeInfo {
  root: string;
  members: { equipmentId: Id; terminalId: string }[];
}

export function buildStudyCase(doc: ProjectDoc): StudyCase {
  const settings = doc.study ?? defaultStudySettings();
  const sbase = settings.baseMva > 0 ? settings.baseMva : 100;
  const issues: Issue[] = [];
  const typicals: TypicalUse[] = [];
  const eqs = Object.values(doc.equipment);
  const P: Record<Id, Props> = {};
  for (const e of eqs) P[e.id] = fillEquipment(e, typicals, settings.freqHz);

  // ---------- 1. which cables stay branches
  const isDcTerm = (eqId: Id, t: string) => doc.equipment[eqId]?.type === 'inverter' && t === 'DC';
  const cables = Object.values(doc.connections).filter((c) => c.kind === 'cable' && doc.equipment[c.from.equipmentId] && doc.equipment[c.to.equipmentId]);
  const prelim: TypicalUse[] = [];
  const branchCables = new Set<Id>();
  for (const c of cables) {
    if (isDcTerm(c.from.equipmentId, c.from.terminalId) || isDcTerm(c.to.equipmentId, c.to.terminalId)) continue;
    const len = numOf(c.props, 'concept.lengthFt') ?? 0;
    if (!(len > 0)) continue;
    if (settings.collapseFt > 0 && len < settings.collapseFt) continue;
    if (settings.collapseOhm > 0) {
      const p = fillCable(c, prelim, undefined);
      const r = numOf(p, 'design.r') ?? 0;
      const x = numOf(p, 'design.x') ?? 0;
      const sets = numOf(p, 'design.sets') ?? 1;
      if ((Math.hypot(r, x) * len) / 1000 / sets < settings.collapseOhm) continue;
    }
    branchCables.add(c.id);
  }

  // ---------- 2. electrical nodes → study buses
  const en = electricalNodes(doc, { keepApart: (c) => branchCables.has(c.id) });
  const branchEnds = new Set<string>();
  for (const c of cables) if (branchCables.has(c.id)) { branchEnds.add(en.nodeOf(c.from.equipmentId, c.from.terminalId)); branchEnds.add(en.nodeOf(c.to.equipmentId, c.to.terminalId)); }
  const nodes: NodeInfo[] = [];
  for (const [root, members] of en.members) {
    const dc = members.some((m) => isDcTerm(m.equipmentId, m.terminalId));
    if (dc) continue;
    const relevant = branchEnds.has(root) || members.some((m) => {
      const e = doc.equipment[m.equipmentId]!;
      if (e.type === 'reactor' && m.terminalId === '2' && P[e.id]!['design.application'] === 'Shunt') return false;
      return RELEVANT.has(e.type);
    });
    if (relevant) nodes.push({ root, members });
  }

  // ---------- 3. identity: anchors, names and sticky numbers
  const byRoot = new Map<string, StudyBus>();
  const stored = settings.busNumbers ?? {};
  const buses: StudyBus[] = nodes.map((n) => {
    const memberIds = [...new Set(n.members.map((m) => m.equipmentId))];
    const drawn = memberIds.map((id) => doc.equipment[id]!).filter((e) => e.type === 'bus').sort((a, b) => a.tag.localeCompare(b.tag) || a.id.localeCompare(b.id));
    const busLike = memberIds.filter((id) => BUSLIKE.has(doc.equipment[id]!.type));
    // Sticky number: the lowest of the drawn buses' numbers and any stored anchor numbers.
    let number = 0;
    let home: StudyBus['numberHome'] | null = null;
    for (const b of drawn) {
      const v = numOf(b.props, 'design.busNum');
      if (v && v > 0 && (!number || v < number)) { number = Math.round(v); home = { kind: 'bus', id: b.id }; }
    }
    for (const m of n.members) {
      const v = stored[tkey(m.equipmentId, m.terminalId)];
      if (v && v > 0 && (!number || v < number)) { number = v; home = { kind: 'anchor', key: tkey(m.equipmentId, m.terminalId) }; }
    }
    const anchor = [...n.members].sort((a, b) => {
      const ea = doc.equipment[a.equipmentId]!;
      const eb = doc.equipment[b.equipmentId]!;
      return anchorRank(ea.type) - anchorRank(eb.type) || ea.id.localeCompare(eb.id) || a.terminalId.localeCompare(b.terminalId);
    })[0]!;
    if (!home) home = drawn[0] ? { kind: 'bus', id: drawn[0].id } : { kind: 'anchor', key: tkey(anchor.equipmentId, anchor.terminalId) };
    const nameSrc = drawn[0] ?? doc.equipment[anchor.equipmentId]!;
    const bp = drawn[0] ? P[drawn[0].id]! : {};
    const sb: StudyBus = {
      key: n.root, number, name: psseName(nameSrc.tag), baseKv: 0, ide: 1,
      area: numOf(bp, 'design.area') ?? 1, zone: numOf(bp, 'design.zone') ?? 1, owner: numOf(bp, 'design.owner') ?? 1,
      vm0: numOf(bp, 'design.vm0') ?? 1, va0: numOf(bp, 'design.va0') ?? 0, vmax: numOf(bp, 'design.vmax') ?? 1.1, vmin: numOf(bp, 'design.vmin') ?? 0.9,
      island: 0, busIds: busLike, memberIds, numberHome: home, numberSticky: number > 0,
    };
    byRoot.set(n.root, sb);
    return sb;
  });
  // Duplicates keep the first (by name); the others are renumbered for this export.
  buses.sort((a, b) => (a.number || 1e9) - (b.number || 1e9) || a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
  const used = new Map<number, StudyBus>();
  for (const b of buses) {
    if (!b.number) continue;
    const prev = used.get(b.number);
    if (prev) {
      issues.push({ severity: 'error', code: 'bus-number-duplicate', message: `Bus number ${b.number} is used by ${prev.name} and ${b.name}; ${b.name} gets a new number in this export.`, objectId: b.numberHome.kind === 'bus' ? b.numberHome.id : b.memberIds[0], study: 'pf' });
      b.number = 0;
      b.numberSticky = false;
    } else used.set(b.number, b);
  }
  let next = Math.max(0, ...used.keys()) + 1;
  const newNumbers: StudyCase['newNumbers'] = [];
  for (const b of [...buses].sort((x, y) => x.name.localeCompare(y.name) || x.key.localeCompare(y.key))) {
    if (b.number) continue;
    while (used.has(next)) next++;
    b.number = next;
    used.set(next, b);
    newNumbers.push({ home: b.numberHome, number: next });
  }
  buses.sort((a, b) => a.number - b.number);

  const busAt = (eqId: Id, t: string): StudyBus | undefined => byRoot.get(en.nodeOf(eqId, t));

  // ---------- 4. base kV
  baseKv(doc, P, buses, busAt, cables.filter((c) => branchCables.has(c.id)), issues);
  // Transformer windings with no kV take the bus base kV (typical); cables take bus-kV typicals.
  for (const e of eqs) {
    if (e.type !== 'xfmr2' && e.type !== 'xfmr3') continue;
    const wind: [string, string][] = e.type === 'xfmr2' ? [['H1', 'design.hvKv'], ['X1', 'design.lvKv']] : [['H1', 'design.hvKv'], ['X1', 'design.lvKv'], ['Y1', 'design.tvKv']];
    for (const [t, k] of wind) {
      const b = busAt(e.id, t);
      if (b?.baseKv && isEmpty(P[e.id]![k])) {
        P[e.id]![k] = b.baseKv;
        typicals.push({ objectId: e.id, key: k, value: b.baseKv, source: 'bus base kV' });
      }
    }
  }
  const CP: Record<Id, Props> = {};
  for (const c of cables) CP[c.id] = fillCable(c, branchCables.has(c.id) ? typicals : [], busAt(c.from.equipmentId, c.from.terminalId)?.baseKv);

  // ---------- 5. elements
  const loads: LoadRec[] = [];
  const fixedShunts: ShuntRec[] = [];
  const switchedShunts: ShuntRec[] = [];
  const gens: GenRec[] = [];
  const branches: BranchRec[] = [];
  const xfmr2: Xfmr2Rec[] = [];
  const xfmr3: Xfmr3Rec[] = [];
  const ids = new Map<string, Set<string>>();
  const nextId = (scope: string, want?: string) => {
    let set = ids.get(scope);
    if (!set) ids.set(scope, (set = new Set()));
    let id = (want ?? '').trim().slice(0, 2) || '1';
    if (set.has(id)) { let i = 1; while (set.has(String(i))) i++; id = String(i); }
    set.add(id);
    return id;
  };
  const pair = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const notOnBus = (e: Equipment | Connection, what: string) =>
    issues.push({ severity: 'warning', code: 'not-connected', message: `${'tag' in e ? e.tag : ''} ${what} is not connected to a study bus and is left out.`, objectId: e.id, study: 'pf' });

  for (const e of eqs) {
    const p = P[e.id]!;
    const n = (k: string) => numOf(p, k);
    switch (e.type) {
      case 'load': {
        const b = busAt(e.id, 'T');
        if (!b) { notOnBus(e, 'load'); break; }
        const pmw = (n('concept.kw') ?? 0) / 1000;
        const kvar = n('design.kvar');
        const pf = n('design.pf') ?? 1;
        const qmv = kvar !== undefined ? kvar / 1000 : pf > 0 && pf < 1 ? pmw * Math.tan(Math.acos(pf)) : 0;
        const zp = (n('design.zipP') ?? 100) / 100, zi = (n('design.zipI') ?? 0) / 100, zz = (n('design.zipZ') ?? 0) / 100;
        const sum = zp + zi + zz || 1;
        if (Math.abs(sum - 1) > 0.005) issues.push({ severity: 'warning', code: 'zip-sum', message: `${e.tag}: ZIP split adds to ${Math.round(sum * 100)} %; scaled to 100 %.`, objectId: e.id, study: 'pf' });
        loads.push({ objectId: e.id, bus: b.number, id: nextId(`L${b.number}`), status: 1, motor: false, pl: (pmw * zp) / sum, ql: (qmv * zp) / sum, ip: (pmw * zi) / sum, iq: (qmv * zi) / sum, yp: (pmw * zz) / sum, yq: (-qmv * zz) / sum });
        break;
      }
      case 'motor': {
        const b = busAt(e.id, 'T');
        if (!b) { notOnBus(e, 'motor'); break; }
        loads.push({ objectId: e.id, bus: b.number, id: nextId(`L${b.number}`, 'M'), status: 1, motor: true, pl: (n('design.pKw') ?? 0) / 1000, ql: (n('design.qKvar') ?? 0) / 1000, ip: 0, iq: 0, yp: 0, yq: 0 });
        break;
      }
      case 'capacitor': {
        const b = busAt(e.id, 'T');
        if (!b) { notOnBus(e, 'capacitor'); break; }
        const q = shuntMvarAtBase((n('concept.kvar') ?? 0) / 1000, n('design.kv'), b.baseKv);
        if (p['design.shuntMode'] === 'Switched') {
          const steps = Math.max(1, Math.round(n('design.steps') ?? 1));
          const on = Math.min(steps, Math.max(0, Math.round(n('design.stepsOn') ?? steps)));
          switchedShunts.push({ objectId: e.id, bus: b.number, id: '1', status: 1, bMvar: (q * on) / steps, switched: { steps, stepMvar: q / steps, stepsOn: on, vHigh: n('design.vHigh') ?? 1.05, vLow: n('design.vLow') ?? 0.95 } });
        } else {
          fixedShunts.push({ objectId: e.id, bus: b.number, id: nextId(`S${b.number}`), status: 1, bMvar: q });
        }
        break;
      }
      case 'reactor': {
        if (p['design.application'] === 'Shunt') {
          const b = busAt(e.id, '1');
          if (!b) { notOnBus(e, 'shunt reactor'); break; }
          fixedShunts.push({ objectId: e.id, bus: b.number, id: nextId(`S${b.number}`), status: 1, bMvar: -shuntMvarAtBase((n('design.kvar') ?? 0) / 1000, n('design.kv'), b.baseKv) });
        } else {
          const a = busAt(e.id, '1'), b = busAt(e.id, '2');
          if (!a || !b) { notOnBus(e, 'series reactor'); break; }
          const x = ohmsToPu(n('design.ohms') ?? 0, a.baseKv || 1, sbase);
          const xr = n('design.xr') ?? 50;
          branches.push({ objectId: e.id, equipmentType: 'reactor', from: a.number, to: b.number, ckt: nextId(pair(a.number, b.number)), r: xr > 0 ? x / xr : 0, x, b: 0, rateA: mvaFromAmps(n('design.ratedA') ?? 0, a.baseKv), rateB: 0, rateC: 0, status: 1, length: 0, r0: xr > 0 ? x / xr : 0, x0: x, b0: 0 });
        }
        break;
      }
      case 'line': {
        const a = busAt(e.id, '1'), b = busAt(e.id, '2');
        if (!a || !b) { notOnBus(e, 'line'); break; }
        const kv = a.baseKv || n('design.kv') || 1;
        const len = n('design.lengthMi') ?? 0;
        const z1 = branchPu({ r: n('design.r') ?? 0, x: n('design.x') ?? 0, bUs: n('design.b') ?? 0, length: len, unitLength: 1, kv, sbase });
        const z0 = branchPu({ r: n('design.r0') ?? 0, x: n('design.x0') ?? 0, bUs: n('design.b0') ?? 0, length: len, unitLength: 1, kv, sbase });
        const cond = typeof p['design.conductor'] === 'string' ? lineConstants(p['design.conductor'] as string, String(p['design.spacing'] ?? ''), settings.freqHz) : null;
        const rateA = n('design.rateA') ?? (cond ? mvaFromAmps(cond.ampacity, kv) : 0);
        branches.push({ objectId: e.id, equipmentType: 'line', from: a.number, to: b.number, ckt: nextId(pair(a.number, b.number)), r: z1.r, x: z1.x, b: z1.b, rateA, rateB: n('design.rateB') ?? rateA, rateC: n('design.rateC') ?? rateA, status: 1, length: len, r0: z0.r, x0: z0.x, b0: z0.b });
        break;
      }
      case 'xfmr2': {
        const h = busAt(e.id, 'H1'), l = busAt(e.id, 'X1');
        if (!h || !l) { notOnBus(e, 'transformer'); break; }
        const mva = n('design.mvaBase') ?? (n('concept.kva') ?? 0) / 1000;
        const hvKv = n('design.hvKv') ?? h.baseKv, lvKv = n('design.lvKv') ?? l.baseKv;
        const xr = n('design.xr') ?? 10;
        const z = mva > 0 ? xfmrZ({ zPct: n('design.z') ?? 0, xr, mvaBase: mva, sbase, ratedKv: lvKv, baseKv: l.baseKv }) : { r: 0, x: 0 };
        const z0 = mva > 0 ? xfmrZ({ zPct: n('design.z0') ?? n('design.z') ?? 0, xr, mvaBase: mva, sbase, ratedKv: lvKv, baseKv: l.baseKv }) : { r: 0, x: 0 };
        const hw = String(p['design.hvWinding'] ?? 'Δ'), lw = String(p['design.lvWinding'] ?? 'Yg');
        const rate = (k: string) => n(k) ?? mva;
        const wnd = (bus: StudyBus, kv: number, conn: string, g: number): Winding => ({ bus: bus.number, kv, baseKv: bus.baseKv, conn, groundOhm: g, rateA: rate('design.rateA'), rateB: rate('design.rateB'), rateC: rate('design.rateC') });
        if (!(mva > 0)) issues.push({ severity: 'error', code: 'missing-rating', message: `${e.tag}: no kVA rating, so its impedance cannot be converted.`, objectId: e.id, study: 'pf' });
        xfmr2.push({
          objectId: e.id, name: psseName(e.tag), ckt: nextId(pair(h.number, l.number)), status: 1,
          hv: wnd(h, hvKv, hw, n('design.hvGroundOhm') ?? 0), lv: wnd(l, lvKv, lw, n('design.lvGroundOhm') ?? 0),
          tap: 1 + (n('design.tapPct') ?? 0) / 100, tapMax: 1 + (n('design.tapMaxPct') ?? 5) / 100, tapMin: 1 + (n('design.tapMinPct') ?? -5) / 100,
          tapSteps: Math.round(n('design.tapSteps') ?? 5), ctrlBus: Math.round(n('design.ctrlBus') ?? 0),
          shiftDeg: n('design.shiftDeg') ?? vectorShiftDeg(hw, lw), r: z.r, x: z.x, mva, r0: z0.r, x0: z0.x, vecGroup: vectorGroup([hw, lw]),
        });
        break;
      }
      case 'xfmr3': {
        const t = ['H1', 'X1', 'Y1'].map((x) => busAt(e.id, x));
        if (t.some((b) => !b)) { notOnBus(e, 'three-winding transformer'); break; }
        const [h, x, y] = t as [StudyBus, StudyBus, StudyBus];
        const mH = (n('concept.kva') ?? 0) / 1000;
        const mX = (n('design.kvaX') ?? 0) / 1000 || mH;
        const mY = (n('design.kvaY') ?? 0) / 1000 || mH / 2;
        const xr = n('design.xr') ?? 10;
        const pairZ = (pct: number, base: number) => (base > 0 ? xfmrZ({ zPct: pct, xr, mvaBase: base, sbase }) : { r: 0, x: 0 });
        const hx = pairZ(n('design.z') ?? 0, n('design.zHXBase') ?? mH);
        const hy = pairZ(n('design.zHY') ?? 0, n('design.zHYBase') ?? mY);
        const xy = pairZ(n('design.zXY') ?? 0, n('design.zXYBase') ?? mY);
        const conns = ['design.hvWinding', 'design.lvWinding', 'design.tvWinding'].map((k) => String(p[k] ?? 'Δ'));
        const kvs = [n('design.hvKv') ?? h.baseKv, n('design.lvKv') ?? x.baseKv, n('design.tvKv') ?? y.baseKv];
        const rates = [n('design.rateH') ?? mH, n('design.rateX') ?? mX, n('design.rateY') ?? mY];
        const w = [h, x, y].map((b, i): Winding => ({ bus: b.number, kv: kvs[i]!, baseKv: b.baseKv, conn: conns[i]!, groundOhm: 0, rateA: rates[i]!, rateB: rates[i]!, rateC: rates[i]! })) as [Winding, Winding, Winding];
        if (!(mH > 0)) issues.push({ severity: 'error', code: 'missing-rating', message: `${e.tag}: no kVA rating, so its impedances cannot be converted.`, objectId: e.id, study: 'pf' });
        const z0 = (n('design.z0') ?? n('design.z') ?? 0) / Math.max(1e-9, n('design.z') ?? 1);
        xfmr3.push({ objectId: e.id, name: psseName(e.tag), ckt: nextId(`${h.number}-${x.number}-${y.number}`), status: 1, w, z: { r12: hx.r, x12: hx.x, r23: xy.r, x23: xy.x, r31: hy.r, x31: hy.x }, mva: [mH, mX, mY], z0Scale: z0 || 1, vecGroup: vectorGroup(conns) });
        break;
      }
      default:
        if (MACHINES.has(e.type)) addMachine(e);
    }
  }

  function addMachine(e: Equipment) {
    const p = P[e.id]!;
    const n = (k: string) => numOf(p, k);
    let bus: StudyBus | undefined;
    let dataId = e.id;
    if (e.type === 'inverter') {
      // An inverter with PV/BESS on its DC side passes through: those sources are the machines.
      const dcRoot = en.nodeOf(e.id, 'DC');
      const behind = (en.members.get(dcRoot) ?? []).some((m) => ['pv', 'bess'].includes(doc.equipment[m.equipmentId]!.type));
      if (behind) return;
      bus = busAt(e.id, 'AC');
    } else if (e.type === 'pv' || e.type === 'bess') {
      const dcRoot = en.nodeOf(e.id, 'T');
      const inv = (en.members.get(dcRoot) ?? []).find((m) => m.terminalId === 'DC' && doc.equipment[m.equipmentId]!.type === 'inverter');
      bus = inv ? busAt(inv.equipmentId, 'AC') : busAt(e.id, 'T');
      dataId = e.id;
    } else {
      bus = busAt(e.id, 'T');
    }
    if (!bus) { notOnBus(e, CATALOG[e.type].label.toLowerCase()); return; }
    const base = { objectId: e.id, dataId, equipmentType: e.type, bus: bus.number, status: 1 as const, qg: 0, ireg: Math.round(n('design.regBus') ?? 0), vs: n('design.vsched') ?? 1 };
    if (e.type === 'utility') {
      const mbase = n('design.scMva') ?? 1000;
      const z = theveninOnOwnBase(n('design.xr') ?? 10);
      gens.push({ ...base, kind: 'utility', id: nextId(`G${bus.number}`, String(p['design.machineId'] ?? '1')), pg: 0, qmax: 9999, qmin: -9999, pmax: 9999, pmin: -9999, mbase, zr: z.r, zx: z.x, wmod: 0, swing: p['design.swing'] !== false });
    } else if (e.type === 'generator') {
      const mbase = n('design.mbase') ?? 1;
      gens.push({ ...base, kind: 'sync', id: nextId(`G${bus.number}`, String(p['design.machineId'] ?? '1')), pg: n('design.pg') ?? 0, qmax: n('design.qmax') ?? 0, qmin: n('design.qmin') ?? 0, pmax: n('design.pmax') ?? mbase, pmin: n('design.pmin') ?? 0, mbase, zr: n('design.zr') ?? 0, zx: n('design.xdpp') ?? 0.18, wmod: 0, swing: p['design.swing'] === true });
    } else {
      const mbase = n('design.mbase') ?? 1;
      const wmod = Number.parseInt(String(p['design.wmod'] ?? '1'), 10);
      const iflt = n('design.iflt') ?? 1.2;
      gens.push({ ...base, kind: 'ibr', id: nextId(`G${bus.number}`, String(p['design.machineId'] ?? '1')), pg: n('design.pg') ?? 0, qmax: n('design.qmax') ?? 0, qmin: n('design.qmin') ?? 0, pmax: n('design.pmax') ?? mbase, pmin: n('design.pmin') ?? 0, mbase, zr: 0, zx: iflt > 0 ? 1 / iflt : 9999, wmod: Number.isFinite(wmod) ? wmod : 1, swing: false });
    }
  }

  for (const c of cables) {
    if (!branchCables.has(c.id)) continue;
    const a = busAt(c.from.equipmentId, c.from.terminalId), b = busAt(c.to.equipmentId, c.to.terminalId);
    if (!a || !b) continue;
    if (a === b) { issues.push({ severity: 'warning', code: 'branch-loop', message: `${c.tag} has both ends on the same study bus (${a.name}) and is left out.`, objectId: c.id, study: 'pf' }); continue; }
    const p = CP[c.id]!;
    const n = (k: string) => numOf(p, k);
    const kv = a.baseKv || 1;
    const sets = n('design.sets') ?? 1;
    const lenFt = n('concept.lengthFt') ?? 0;
    const z1 = branchPu({ r: n('design.r') ?? 0, x: n('design.x') ?? 0, bUs: n('design.b') ?? 0, length: lenFt, unitLength: 1000, sets, kv, sbase });
    const z0 = branchPu({ r: n('design.r0') ?? 0, x: n('design.x0') ?? 0, bUs: n('design.b0') ?? 0, length: lenFt, unitLength: 1000, sets, kv, sbase });
    const amp = n('design.ampacity');
    const rateA = n('design.rateA') ?? (amp ? mvaFromAmps(amp * sets, kv) : 0);
    branches.push({ objectId: c.id, equipmentType: 'cable', from: a.number, to: b.number, ckt: nextId(pair(a.number, b.number)), r: z1.r, x: z1.x, b: z1.b, rateA, rateB: n('design.rateB') ?? rateA, rateC: n('design.rateC') ?? rateA, status: 1, length: lenFt / 5280, r0: z0.r, x0: z0.x, b0: z0.b });
  }

  // ---------- 6. islands, swing and IDE
  const uf = new UF();
  for (const b of buses) uf.find(String(b.number));
  for (const br of branches) uf.union(String(br.from), String(br.to));
  for (const t of xfmr2) uf.union(String(t.hv.bus), String(t.lv.bus));
  for (const t of xfmr3) { uf.union(String(t.w[0].bus), String(t.w[1].bus)); uf.union(String(t.w[0].bus), String(t.w[2].bus)); }
  const islandIdx = new Map<string, number>();
  for (const b of buses) {
    const r = uf.find(String(b.number));
    if (!islandIdx.has(r)) islandIdx.set(r, islandIdx.size + 1);
    b.island = islandIdx.get(r)!;
  }
  const busByNum = new Map(buses.map((b) => [b.number, b]));
  const dead = new Set<number>();
  for (const isl of islandIdx.values()) {
    const ib = buses.filter((b) => b.island === isl);
    const ig = gens.filter((g) => busByNum.get(g.bus)!.island === isl);
    if (!ig.length) {
      dead.add(isl);
      const hasLoad = loads.some((l) => busByNum.get(l.bus)!.island === isl);
      const anchor = ib[0]!;
      issues.push({ severity: hasLoad ? 'error' : 'warning', code: 'island-no-swing', message: `Island with ${ib.map((b) => b.name).join(', ')} has no source, so it has no swing bus. Its buses are written as isolated (IDE 4) and its elements out of service.`, objectId: anchor.busIds[0] ?? anchor.memberIds[0], study: 'pf' });
      continue;
    }
    const flagged = ig.filter((g) => g.swing);
    const rank = (g: GenRec) => (g.kind === 'utility' ? 0 : g.kind === 'sync' ? 1 : 2);
    const pickFrom = flagged.length ? flagged : ig;
    const swing = [...pickFrom].sort((a, b) => rank(a) - rank(b) || b.mbase - a.mbase)[0]!;
    if (flagged.length > 1) issues.push({ severity: 'warning', code: 'swing-many', message: `${flagged.length} units in one island are flagged as swing; ${doc.equipment[swing.objectId]!.tag} is used.`, objectId: swing.objectId, study: 'pf' });
    if (!flagged.length) issues.push({ severity: swing.kind === 'ibr' ? 'warning' : 'info', code: 'swing-auto', message: `No swing unit is flagged in this island; ${doc.equipment[swing.objectId]!.tag} (largest ${swing.kind === 'ibr' ? 'inverter-based ' : ''}source) is used.`, objectId: swing.objectId, study: 'pf' });
    for (const g of ig) g.swing = g === swing;
  }
  for (const b of buses) {
    if (dead.has(b.island)) b.ide = 4;
    else if (gens.some((g) => g.bus === b.number && g.swing)) b.ide = 3;
    else if (gens.some((g) => g.bus === b.number)) b.ide = 2;
    else b.ide = 1;
  }
  const off = (bus: number) => dead.has(busByNum.get(bus)?.island ?? -1);
  for (const r of [...loads, ...fixedShunts, ...switchedShunts, ...gens]) if (off(r.bus)) r.status = 0;
  for (const r of branches) if (off(r.from)) r.status = 0;
  for (const r of xfmr2) if (off(r.hv.bus)) r.status = 0;
  for (const r of xfmr3) if (off(r.w[0].bus)) r.status = 0;

  // ---------- 7. readiness
  for (const br of branches) {
    if (br.r < 0 || br.x < 0) issues.push({ severity: 'error', code: 'negative-impedance', message: `${tagOf(doc, br.objectId)}: negative impedance.`, objectId: br.objectId, study: 'pf' });
    else if (Math.abs(br.r) + Math.abs(br.x) < 1e-7) issues.push({ severity: 'error', code: 'zero-impedance', message: `${tagOf(doc, br.objectId)}: zero impedance. Enter R and X (or a conductor size), or remove its length so it merges as a tie.`, objectId: br.objectId, study: 'pf' });
  }
  for (const t of xfmr2) {
    if (!(t.x > 0)) issues.push({ severity: 'error', code: 'zero-impedance', message: `${t.name}: zero or negative reactance.`, objectId: t.objectId, study: 'pf' });
    if (t.hv.bus === t.lv.bus) issues.push({ severity: 'error', code: 'xfmr-shorted', message: `${t.name}: both windings land on the same study bus.`, objectId: t.objectId, study: 'pf' });
    for (const w of [t.hv, t.lv]) checkKv(t.objectId, t.name, w);
  }
  for (const t of xfmr3) {
    if (!(t.z.x12 > 0 && t.z.x23 > 0 && t.z.x31 > 0)) issues.push({ severity: 'error', code: 'zero-impedance', message: `${t.name}: a winding-pair reactance is zero.`, objectId: t.objectId, study: 'pf' });
    for (const w of t.w) checkKv(t.objectId, t.name, w);
  }
  function checkKv(id: Id, name: string, w: Winding) {
    if (w.baseKv > 0 && w.kv > 0 && Math.abs(w.kv / w.baseKv - 1) > 0.1) {
      issues.push({ severity: 'warning', code: 'xfmr-kv-mismatch', message: `${name}: winding ${w.kv} kV is more than 10 % off its bus base ${w.baseKv} kV.`, objectId: id, study: 'pf' });
    }
  }
  for (const g of gens) if (g.kind !== 'utility' && !(g.mbase > 0)) issues.push({ severity: 'error', code: 'missing-mbase', message: `${tagOf(doc, g.objectId)}: machine base is zero.`, objectId: g.objectId, study: 'pf' });

  // Missing study values (after typicals) on exported objects.
  const exported = new Set<Id>([...loads, ...fixedShunts, ...switchedShunts, ...branches, ...xfmr2, ...xfmr3].map((r) => r.objectId));
  for (const g of gens) exported.add(g.dataId);
  for (const id of exported) {
    const o: Equipment | Connection | undefined = doc.equipment[id] ?? doc.connections[id];
    if (!o) continue;
    const props = P[id] ?? CP[id] ?? o.props;
    for (const tag of ['pf', 'sc', 'dyn'] as const) {
      const miss = schemaForObject(o).filter((f) => f.study === tag && f.need && fieldVisible(f, props) && isEmpty(props[f.key]));
      if (miss.length) issues.push({ severity: tag === 'pf' ? 'error' : 'warning', code: `missing-${tag}`, message: `${o.tag}: missing ${miss.map((f) => f.label).join(', ')}.`, objectId: id, study: tag });
    }
  }
  // Typicals used, one line per object.
  const byObj = new Map<Id, TypicalUse[]>();
  for (const t of typicals) if (exported.has(t.objectId) || doc.equipment[t.objectId]?.type === 'bus') byObj.set(t.objectId, [...(byObj.get(t.objectId) ?? []), t]);
  for (const [id, list] of byObj) {
    const o = doc.equipment[id] ?? doc.connections[id];
    if (!o) continue;
    const shown = list.filter((t) => !t.key.startsWith('design.dyn.'));
    const dyn = list.length - shown.length;
    const fields = schemaForObject(o);
    const label = (k: string) => fields.find((f) => f.key === k)?.label ?? k;
    const parts = shown.map((t) => `${label(t.key)} ${t.value}`);
    if (dyn) parts.push(`${dyn} model parameters`);
    issues.push({ severity: 'info', code: 'typical', message: `${o.tag}: typical ${parts.join(', ')}.`, objectId: id });
  }

  const busOfObject: Record<Id, number[]> = {};
  for (const b of buses) for (const id of b.memberIds) (busOfObject[id] ??= []).push(b.number);
  for (const br of branches) busOfObject[br.objectId] = [br.from, br.to];
  for (const g of gens) if (g.dataId !== g.objectId) (busOfObject[g.dataId] ??= []).push(g.bus);

  const filledProps: Record<Id, Record<string, PropValue>> = { ...P };
  for (const c of cables) if (branchCables.has(c.id)) filledProps[c.id] = CP[c.id]!;
  const uniq = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);
  const order: Record<Issue['severity'], number> = { error: 0, warning: 1, info: 2 };
  issues.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    settings: { ...settings, baseMva: sbase },
    title: doc.name,
    buses,
    loads, fixedShunts, switchedShunts, gens, branches, xfmr2, xfmr3,
    areas: uniq(buses.map((b) => b.area)), zones: uniq(buses.map((b) => b.zone)), owners: uniq(buses.map((b) => b.owner)),
    issues, typicals, busOfObject, newNumbers, filledProps,
  };
}

function tagOf(doc: ProjectDoc, id: Id): string {
  return doc.equipment[id]?.tag ?? doc.connections[id]?.tag ?? id;
}

/** IEC-style vector group from the winding connections (ANSI 30° lag for mixed Δ/Y). */
export function vectorGroup(conns: string[]): string {
  const letter = (c: string, hv: boolean) => {
    const s = c === 'Δ' ? 'D' : c === 'Yg' ? 'YN' : 'Y';
    return hv ? s : s.toLowerCase();
  };
  const hv = conns[0] ?? 'Δ';
  return conns.map((c, i) => letter(c, i === 0) + (i === 0 ? '' : vectorShiftDeg(hv, c) ? '1' : '0')).join('');
}

// ---------- base kV

interface Seed { kv: number; strength: number; objectId: Id }

function baseKv(doc: ProjectDoc, P: Record<Id, Props>, buses: StudyBus[], busAt: (eq: Id, t: string) => StudyBus | undefined, branchCables: Connection[], issues: Issue[]) {
  const seeds = new Map<string, Seed[]>();
  const add = (b: StudyBus | undefined, kv: PropValue | undefined, strength: number, objectId: Id) => {
    if (!b || typeof kv !== 'number' || !(kv > 0)) return;
    seeds.set(b.key, [...(seeds.get(b.key) ?? []), { kv, strength, objectId }]);
  };
  const zones = new UF();
  for (const b of buses) zones.find(b.key);
  for (const e of Object.values(doc.equipment)) {
    const p = P[e.id]!;
    switch (e.type) {
      case 'bus': { const b = buses.find((x) => x.memberIds.includes(e.id)); add(b, p['design.baseKv'], 5, e.id); add(b, p['concept.kv'], 4, e.id); break; }
      case 'mcc': case 'panelboard': add(buses.find((x) => x.memberIds.includes(e.id)), p['design.kv'], 2, e.id); break;
      case 'utility': case 'generator': case 'wind': add(busAt(e.id, 'T'), p['design.kv'], 3, e.id); break;
      case 'inverter': add(busAt(e.id, 'AC'), p['design.kvAc'], 3, e.id); break;
      case 'xfmr2': add(busAt(e.id, 'H1'), e.props['design.hvKv'], 1, e.id); add(busAt(e.id, 'X1'), e.props['design.lvKv'], 1, e.id); break;
      case 'xfmr3': add(busAt(e.id, 'H1'), e.props['design.hvKv'], 1, e.id); add(busAt(e.id, 'X1'), e.props['design.lvKv'], 1, e.id); add(busAt(e.id, 'Y1'), e.props['design.tvKv'], 1, e.id); break;
      case 'line': {
        const a = busAt(e.id, '1'), b = busAt(e.id, '2');
        if (a && b) zones.union(a.key, b.key);
        break;
      }
      case 'reactor': {
        if (p['design.application'] === 'Shunt') break;
        const a = busAt(e.id, '1'), b = busAt(e.id, '2');
        if (a && b) zones.union(a.key, b.key);
        break;
      }
      default: break;
    }
  }
  for (const c of branchCables) {
    const a = busAt(c.from.equipmentId, c.from.terminalId), b = busAt(c.to.equipmentId, c.to.terminalId);
    if (a && b) zones.union(a.key, b.key);
  }
  const byZone = new Map<string, StudyBus[]>();
  for (const b of buses) { const z = zones.find(b.key); byZone.set(z, [...(byZone.get(z) ?? []), b]); }
  const tag = (id: Id) => doc.equipment[id]?.tag ?? id;
  for (const zb of byZone.values()) {
    const all = zb.flatMap((b) => seeds.get(b.key) ?? []).sort((a, b) => b.strength - a.strength);
    const best = all[0];
    if (!best) {
      for (const b of zb) issues.push({ severity: 'error', code: 'missing-basekv', message: `${b.name}: no base kV. Enter the bus nominal voltage, or a source or transformer winding voltage.`, objectId: b.busIds[0] ?? b.memberIds[0], study: 'pf' });
      for (const b of zb) b.baseKv = 1;
      continue;
    }
    for (const s of all) {
      if (Math.abs(s.kv / best.kv - 1) <= 0.01) continue;
      if (s.strength >= 2) issues.push({ severity: 'error', code: 'basekv-conflict', message: `${tag(s.objectId)} says ${s.kv} kV but this voltage zone is ${best.kv} kV (from ${tag(best.objectId)}).`, objectId: s.objectId, study: 'pf' });
      else if (best.strength === 1) issues.push({ severity: 'warning', code: 'basekv-conflict', message: `${tag(s.objectId)} winding ${s.kv} kV differs from ${best.kv} kV (from ${tag(best.objectId)}) in the same voltage zone.`, objectId: s.objectId, study: 'pf' });
    }
    for (const b of zb) b.baseKv = best.kv;
  }
}

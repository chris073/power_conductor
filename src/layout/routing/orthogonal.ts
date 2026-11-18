// Orthogonal (right-angle) connector routing for one-line diagrams.
//
// A route is a polyline [source, ...bends, target]. Auto routes leave each terminal along its
// outward direction and pick the simplest L / Z / U shape. Manual routes keep the user's bends;
// when an end moves, only the segment next to that end is adjusted so the route stays orthogonal.
// No obstacle avoidance yet (see roadmap).

import type { Dir } from '../../domain/catalog';
import type { Pt } from '../../domain/types';

export interface End extends Pt { dir: Dir }

const vertical = (d: Dir) => d === 'up' || d === 'down';
const unit = (d: Dir): Pt => (d === 'up' ? { x: 0, y: -1 } : d === 'down' ? { x: 0, y: 1 } : d === 'left' ? { x: -1, y: 0 } : { x: 1, y: 0 });
const step = (p: End, len: number): Pt => { const u = unit(p.dir); return { x: p.x + u.x * len, y: p.y + u.y * len }; };
const snapTo = (v: number, g: number) => Math.round(v / g) * g;

/** Remove repeated points and the middle point of collinear triples. */
export function simplify(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && last.x === p.x && last.y === p.y) continue;
    out.push({ x: p.x, y: p.y });
  }
  let i = 1;
  while (i < out.length - 1) {
    const a = out[i - 1]!, b = out[i]!, c = out[i + 1]!;
    if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)) out.splice(i, 1);
    else i++;
  }
  return out;
}

export function isOrthogonal(pts: Pt[]): boolean {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    if (a.x !== b.x && a.y !== b.y) return false;
  }
  return true;
}

const T = (p: Pt): Pt => ({ x: p.y, y: p.x });
const TD: Record<Dir, Dir> = { up: 'left', down: 'right', left: 'up', right: 'down' };
const TE = (e: End): End => ({ x: e.y, y: e.x, dir: TD[e.dir] });

/** Both ends vertical. */
function routeVV(s: End, t: End, stub: number, grid: number): Pt[] {
  const s1 = step(s, stub);
  const t1 = step(t, stub);
  // Facing each other (even with a gap shorter than two stubs): one Z through the middle.
  const facing = (s.dir === 'down' && t.dir === 'up' && t.y >= s.y) || (s.dir === 'up' && t.dir === 'down' && t.y <= s.y);
  if (facing) {
    let midY = snapTo((s.y + t.y) / 2, grid);
    if ((midY - s.y) * (t.y - midY) < 0) midY = (s.y + t.y) / 2; // gap smaller than a grid step
    return [s, { x: s.x, y: midY }, { x: t.x, y: midY }, t];
  }
  if (s.dir === t.dir) {
    const y = s.dir === 'down' ? Math.max(s1.y, t1.y) : Math.min(s1.y, t1.y);
    return [s, { x: s.x, y }, { x: t.x, y }, t];
  }
  let midX = snapTo((s1.x + t1.x) / 2, grid);
  if (midX === s.x || midX === t.x) midX = Math.max(s.x, t.x) + 2 * stub;
  return [s, s1, { x: midX, y: s1.y }, { x: midX, y: t1.y }, t1, t];
}

/** Source vertical, target horizontal. */
function routeVH(s: End, t: End, stub: number): Pt[] {
  const s1 = step(s, stub);
  const t1 = step(t, stub);
  const c = { x: s.x, y: t.y };
  const sOk = s.dir === 'down' ? c.y > s.y : c.y < s.y;
  const tOk = t.dir === 'left' ? c.x < t.x : c.x > t.x;
  if (sOk && tOk) return [s, c, t];
  return [s, s1, { x: t1.x, y: s1.y }, t1, t];
}

export function autoRoute(s: End, t: End, grid = 20): Pt[] {
  const stub = grid;
  let pts: Pt[];
  if (vertical(s.dir) && vertical(t.dir)) pts = routeVV(s, t, stub, grid);
  else if (!vertical(s.dir) && !vertical(t.dir)) pts = routeVV(TE(s), TE(t), stub, grid).map(T);
  else if (vertical(s.dir)) pts = routeVH(s, t, stub);
  else pts = routeVH(t, s, stub).reverse();
  return simplify(pts);
}

/** A straight (non-orthogonal) route, for the "straight" routing setting. */
export function straightRoute(s: Pt, t: Pt): Pt[] {
  return [{ x: s.x, y: s.y }, { x: t.x, y: t.y }];
}

/**
 * Re-attach a manual route's bends to (possibly moved) ends. Only the bend next to each end is
 * adjusted, along the axis that keeps the segment orthogonal.
 */
export function fitManualRoute(s: End, t: End, bends: Pt[]): Pt[] {
  if (bends.length === 0) return autoRoute(s, t);
  const b = bends.map((p) => ({ ...p }));
  if (b.length === 1) {
    const c = vertical(s.dir) ? { x: s.x, y: t.y } : { x: t.x, y: s.y };
    return simplify([s, c, t]);
  }
  const first = b[0]!, second = b[1]!;
  if (first.y === second.y) first.x = s.x; else first.y = s.y;
  const last = b[b.length - 1]!, prev = b[b.length - 2]!;
  if (last.y === prev.y) last.x = t.x; else last.y = t.y;
  const full = [{ x: s.x, y: s.y }, ...b, { x: t.x, y: t.y }];
  return isOrthogonal(full) ? simplify(full) : autoRoute(s, t);
}

/**
 * Drag segment `i` (between pts[i] and pts[i+1]) of a full polyline to `value` (the new y of a
 * horizontal segment, or the new x of a vertical one). The terminals stay fixed: dragging the first
 * or last segment inserts a bend next to the terminal.
 */
export function moveSegment(full: Pt[], i: number, value: number): Pt[] {
  if (i < 0 || i >= full.length - 1) return full;
  let pts = full.map((p) => ({ ...p }));
  let idx = i;
  if (idx === 0) { pts = [pts[0]!, { ...pts[0]! }, ...pts.slice(1)]; idx = 1; }
  if (idx + 1 === pts.length - 1) { const last = pts[pts.length - 1]!; pts = [...pts.slice(0, -1), { ...last }, last]; }
  const a = pts[idx]!, b = pts[idx + 1]!;
  if (a.y === b.y) { a.y = value; b.y = value; } else { a.x = value; b.x = value; }
  return pts;
}

export function segmentOrientation(a: Pt, b: Pt): 'h' | 'v' {
  return a.y === b.y ? 'h' : 'v';
}

/** Interior bend points of a full polyline (what the layout model stores). */
export function bendsOf(full: Pt[]): Pt[] {
  return simplify(full).slice(1, -1);
}

export function pathD(pts: Pt[]): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
}

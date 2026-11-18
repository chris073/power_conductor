// Geometry of placed objects: rotated sizes and absolute terminal positions.
// Rotation is clockwise about the node box; flip mirrors left/right before rotating.

import { CATALOG, type Dir } from '../domain/catalog';
import type { Equipment, NodeLayout, Pt, Rotation } from '../domain/types';

export const BUS_THICKNESS = 20;
export const DEFAULT_BUS_LENGTH = 240;

export function isBusVertical(n: NodeLayout): boolean {
  return n.rot === 90 || n.rot === 270;
}

/** Unrotated (local) size. */
export function localSize(e: Equipment, n: NodeLayout): { w: number; h: number } {
  const def = CATALOG[e.type];
  if (e.type === 'bus') return { w: n.w ?? DEFAULT_BUS_LENGTH, h: BUS_THICKNESS };
  if (def.resizable) return { w: n.w ?? def.w, h: n.h ?? def.h };
  return { w: def.w, h: def.h };
}

/** Size of the box on the sheet after rotation. */
export function placedSize(e: Equipment, n: NodeLayout): { w: number; h: number } {
  const s = localSize(e, n);
  if (e.type === 'lineup') return s;
  return n.rot === 90 || n.rot === 270 ? { w: s.h, h: s.w } : s;
}

export function transformLocal(p: Pt, w: number, h: number, rot: Rotation, flip: boolean): Pt {
  const x = flip ? w - p.x : p.x;
  const y = p.y;
  switch (rot) {
    case 90: return { x: h - y, y: x };
    case 180: return { x: w - x, y: h - y };
    case 270: return { x: y, y: w - x };
    default: return { x, y };
  }
}

const CW: Record<Dir, Dir> = { up: 'right', right: 'down', down: 'left', left: 'up' };
const MIRROR: Record<Dir, Dir> = { up: 'up', down: 'down', left: 'right', right: 'left' };

export function transformDir(d: Dir, rot: Rotation, flip: boolean): Dir {
  let r = flip ? MIRROR[d] : d;
  for (let i = 0; i < rot / 90; i++) r = CW[r];
  return r;
}

/** SVG transform that draws a local-coordinates symbol into the placed box. */
export function svgTransform(w: number, h: number, rot: Rotation, flip: boolean): string {
  const parts: string[] = [];
  if (rot === 90) parts.push(`translate(${h} 0) rotate(90)`);
  else if (rot === 180) parts.push(`translate(${w} ${h}) rotate(180)`);
  else if (rot === 270) parts.push(`translate(0 ${w}) rotate(270)`);
  if (flip) parts.push(`translate(${w} 0) scale(-1 1)`);
  return parts.join(' ');
}

export interface PlacedTerminal { id: string; x: number; y: number; dir: Dir; kind: 'power' | 'signal' }

/**
 * Terminal positions relative to the node's top-left corner. Bus taps report the direction
 * pointing "down"/"right"; the router flips it toward the other end of the connection.
 */
export function placedTerminals(e: Equipment, n: NodeLayout, busTaps?: Record<string, number>): PlacedTerminal[] {
  if (e.type === 'bus') {
    const vertical = isBusVertical(n);
    return (e.taps ?? []).map((t) => {
      const off = busTaps?.[t.id] ?? 0;
      return vertical
        ? { id: t.id, x: BUS_THICKNESS / 2, y: off, dir: 'right' as Dir, kind: 'power' as const }
        : { id: t.id, x: off, y: BUS_THICKNESS / 2, dir: 'down' as Dir, kind: 'power' as const };
    });
  }
  const { w, h } = localSize(e, n);
  return CATALOG[e.type].terminals.map((t) => {
    const p = transformLocal(t, w, h, n.rot, n.flip);
    return { id: t.id, x: p.x, y: p.y, dir: transformDir(t.dir, n.rot, n.flip), kind: t.kind };
  });
}

export function snap(v: number, grid: number): number {
  return Math.round(v / grid) * grid;
}

/** Rotate 90° clockwise about the box center, keeping the result on the grid. */
export function rotateLayout(e: Equipment, n: NodeLayout, grid: number): NodeLayout {
  const before = placedSize(e, n);
  const next: NodeLayout = { ...n, rot: (((n.rot + 90) % 360) as Rotation) };
  const after = placedSize(e, next);
  const cx = n.x + before.w / 2;
  const cy = n.y + before.h / 2;
  return { ...next, x: snap(cx - after.w / 2, grid), y: snap(cy - after.h / 2, grid) };
}

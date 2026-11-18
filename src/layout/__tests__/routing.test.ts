import { describe, expect, it } from 'vitest';
import type { Dir } from '../../domain/catalog';
import { align, distribute } from '../align';
import { placedTerminals, rotateLayout, transformDir, transformLocal } from '../geometry';
import { autoRoute, fitManualRoute, isOrthogonal, moveSegment, simplify } from '../routing/orthogonal';
import { builder } from '../../domain/__tests__/helpers';

const dirs: Dir[] = ['up', 'down', 'left', 'right'];

describe('auto routing', () => {
  it('is orthogonal for every pair of terminal directions and many positions', () => {
    for (const sd of dirs) for (const td of dirs) for (const [tx, ty] of [[0, 200], [160, 200], [-160, -200], [200, 0], [0, -200], [20, 20]] as const) {
      const r = autoRoute({ x: 0, y: 0, dir: sd }, { x: tx, y: ty, dir: td });
      expect(isOrthogonal(r), `${sd}->${td} @${tx},${ty}`).toBe(true);
      expect(r[0]).toEqual({ x: 0, y: 0 });
      expect(r[r.length - 1]).toEqual({ x: tx, y: ty });
    }
  });

  it('draws a straight vertical line between aligned terminals', () => {
    expect(autoRoute({ x: 40, y: 0, dir: 'down' }, { x: 40, y: 200, dir: 'up' })).toEqual([{ x: 40, y: 0 }, { x: 40, y: 200 }]);
  });

  it('connects close facing terminals without a U-turn', () => {
    expect(autoRoute({ x: 440, y: 80, dir: 'down' }, { x: 440, y: 120, dir: 'up' })).toEqual([{ x: 440, y: 80 }, { x: 440, y: 120 }]);
    const r = autoRoute({ x: 0, y: 0, dir: 'down' }, { x: 60, y: 20, dir: 'up' });
    expect(isOrthogonal(r)).toBe(true);
    expect(r.every((p) => p.y >= 0 && p.y <= 20)).toBe(true);
  });

  it('draws a Z between offset vertical terminals', () => {
    const r = autoRoute({ x: 0, y: 0, dir: 'down' }, { x: 100, y: 200, dir: 'up' });
    expect(r).toEqual([{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 200 }]);
  });
});

describe('segment drag', () => {
  it('moves an interior segment and stays orthogonal', () => {
    const r = autoRoute({ x: 0, y: 0, dir: 'down' }, { x: 100, y: 200, dir: 'up' });
    const moved = moveSegment(r, 1, 60);
    expect(isOrthogonal(moved)).toBe(true);
    expect(moved[1]).toEqual({ x: 0, y: 60 });
    expect(moved[2]).toEqual({ x: 100, y: 60 });
  });

  it('dragging the first segment inserts a bend and keeps the terminal fixed', () => {
    const r = [{ x: 0, y: 0 }, { x: 0, y: 200 }];
    const moved = simplify(moveSegment(r, 0, 40));
    expect(moved[0]).toEqual({ x: 0, y: 0 });
    expect(moved[moved.length - 1]).toEqual({ x: 0, y: 200 });
    expect(isOrthogonal(moved)).toBe(true);
    expect(moved.some((p) => p.x === 40)).toBe(true);
  });

  it('manual bends follow a moved end without losing orthogonality', () => {
    const bends = [{ x: 0, y: 80 }, { x: 100, y: 80 }];
    const r = fitManualRoute({ x: 20, y: 0, dir: 'down' }, { x: 140, y: 200, dir: 'up' }, bends);
    expect(isOrthogonal(r)).toBe(true);
    expect(r).toEqual([{ x: 20, y: 0 }, { x: 20, y: 80 }, { x: 140, y: 80 }, { x: 140, y: 200 }]);
  });
});

describe('geometry', () => {
  it('rotates terminals clockwise and flips', () => {
    expect(transformLocal({ x: 20, y: 0 }, 40, 80, 90, false)).toEqual({ x: 80, y: 20 });
    expect(transformDir('up', 90, false)).toBe('right');
    expect(transformDir('left', 0, true)).toBe('right');
    expect(transformLocal({ x: 20, y: 80 }, 40, 80, 180, false)).toEqual({ x: 20, y: 0 });
  });

  it('rotation keeps a breaker centered and on grid', () => {
    const b = builder();
    const id = b.add('breaker');
    const e = b.doc.equipment[id]!;
    const r = rotateLayout(e, { x: 100, y: 100, rot: 0, flip: false }, 20);
    expect(r).toEqual({ x: 80, y: 120, rot: 90, flip: false });
    const terms = placedTerminals(e, r);
    expect(terms.map((t) => t.dir)).toEqual(['right', 'left']);
  });

  it('bus taps sit on the bus axis', () => {
    const b = builder();
    const bus = b.add('bus');
    const tap = b.tap(bus);
    const t = placedTerminals(b.doc.equipment[bus]!, { x: 0, y: 0, rot: 0, flip: false, w: 300 }, { [tap]: 120 });
    expect(t[0]).toMatchObject({ x: 120, y: 10 });
  });
});

describe('align / distribute', () => {
  const boxes = [{ id: 'a', x: 0, y: 0, w: 40, h: 80 }, { id: 'b', x: 100, y: 30, w: 40, h: 80 }, { id: 'c', x: 400, y: 10, w: 40, h: 80 }];
  it('aligns top', () => {
    expect(Object.values(align(boxes, 'top')).every((p) => p.y === 0)).toBe(true);
  });
  it('distributes evenly', () => {
    expect(distribute(boxes, 'h').b!.x).toBe(200);
  });
});

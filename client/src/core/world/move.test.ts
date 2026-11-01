import { describe, expect, it } from 'vitest';
import { step } from './move';
import { nearest } from './nearby';
import type { Bounds, Collider, Vec2 } from './types';

const rect = (x1: number, z1: number, x2: number, z2: number): Vec2[] => [
  { x: x1, z: z1 }, { x: x2, z: z1 }, { x: x2, z: z2 }, { x: x1, z: z2 },
];
const bounds: Bounds = { outer: rect(-5, -5, 5, 5), holes: [], bridges: [] };
const walk = (pos: Vec2, input: Vec2, count: number, colliders: Collider[] = [], area = bounds, speed = 1.4): Vec2 => {
  for (let i = 0; i < count; i++) pos = step(pos, input, 0.05, colliders, area, { speed });
  return pos;
};

describe('world movement', () => {
  it('limits diagonal input and elapsed time', () => {
    const straight = step({ x: 0, z: 0 }, { x: 1, z: 0 }, 1, [], bounds);
    const diagonal = step({ x: 0, z: 0 }, { x: 1, z: 1 }, 1, [], bounds);
    expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(straight.x);
    expect(straight.x).toBeCloseTo(0.07);
  });

  it('slides along a circular obstacle', () => {
    const p = walk({ x: -1, z: -0.3 }, { x: 1, z: 0.2 }, 20, [{ type: 'circle', x: 0, z: 0, radius: 0.5 }]);
    expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(0.67999);
    expect(p.z).toBeLessThan(-0.3);
  });

  it('cannot cross a thin rotated fence even at high speed', () => {
    const p = step({ x: -1, z: 0 }, { x: 1, z: 0 }, 0.05, [{ type: 'box', x: 0, z: 0, halfX: 0.01, halfZ: 2, rot: Math.PI / 4 }], bounds, { speed: 60 });
    expect(p.x - p.z).toBeLessThan(-0.25);
  });

  it('keeps the whole player inside the island', () => {
    const p = walk({ x: 4, z: 0 }, { x: 1, z: 0.5 }, 30);
    expect(p.x).toBeLessThanOrEqual(4.820001);
    expect(p.z).toBeGreaterThan(0.5);
    const corner = walk({ x: 4, z: 4 }, { x: 1, z: 1 }, 30);
    expect(corner.x).toBeLessThanOrEqual(4.820001);
    expect(corner.z).toBeLessThanOrEqual(4.820001);
  });

  it('blocks water but permits a bridge across it', () => {
    const area: Bounds = { outer: rect(-5, -5, 5, 5), holes: [rect(-1, -2, 1, 2)], bridges: [{ points: rect(-2, -0.5, 2, 0.5) }] };
    const blocked = walk({ x: -2, z: 1 }, { x: 1, z: 0 }, 50, [], area);
    const crossed = walk({ x: -2, z: 0 }, { x: 1, z: 0 }, 60, [], area);
    expect(blocked.x).toBeLessThanOrEqual(-1.17999);
    expect(crossed.x).toBeGreaterThan(1.5);
    const extending: Bounds = { ...area, bridges: [{ points: rect(-6, -0.5, 6, 0.5) }] };
    expect(walk({ x: 4, z: 0 }, { x: 1, z: 0 }, 30, [], extending).x).toBeLessThanOrEqual(4.820001);
  });

  it('chooses the nearest target with deterministic ties and hysteresis', () => {
    const targets = [{ id: 'b', x: 0.5, z: 0 }, { id: 'a', x: -0.5, z: 0 }];
    expect(nearest({ x: 0, z: 0 }, targets)).toBe('a');
    expect(nearest({ x: -0.03, z: 0 }, targets, 0.85, 'b')).toBe('b');
    expect(nearest({ x: -0.1, z: 0 }, targets, 0.85, 'b')).toBe('a');
    expect(nearest({ x: 0, z: 0 }, targets, 0.4, 'b')).toBe('b');
    expect(nearest({ x: 0, z: 0 }, targets, 0.39, 'b')).toBeNull();
  });
});

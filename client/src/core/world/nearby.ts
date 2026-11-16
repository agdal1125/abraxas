import type { Collider, Vec2 } from './types';

type Target = { id: string; x: number; z: number; colliders?: Collider[] };

/** Distance from a position to a target: to the nearest collision edge when the target has colliders, otherwise to its center. */
export function targetDistance(pos: Vec2, target: Omit<Target, 'id'>): number {
  if (!target.colliders?.length) return Math.hypot(target.x - pos.x, target.z - pos.z);
  let best = Infinity;
  for (const shape of target.colliders) {
    const x = pos.x - shape.x, z = pos.z - shape.z;
    let distance: number;
    if (shape.type === 'circle') distance = Math.max(0, Math.hypot(x, z) - shape.radius);
    else {
      const c = Math.cos(shape.rot), s = Math.sin(shape.rot);
      distance = Math.hypot(Math.max(0, Math.abs(c * x - s * z) - shape.halfX), Math.max(0, Math.abs(s * x + c * z) - shape.halfZ));
    }
    if (distance < best) best = distance;
  }
  return best;
}

export function nearest(pos: Vec2, targets: Target[], range = 0.85, previous?: string | null): string | null {
  const distances = targets.map(target => ({ id: target.id, distance: targetDistance(pos, target) }));
  const best = distances.filter(target => target.distance <= range)
    .sort((a, b) => a.distance - b.distance || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
  const prior = distances.find(target => target.id === previous);
  if (prior && prior.distance <= range + 0.1 && (!best || prior.distance <= best.distance + 0.1)) return prior.id;
  return best?.id ?? null;
}

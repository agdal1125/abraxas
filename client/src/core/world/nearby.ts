import type { Vec2 } from './types';

export function nearest(pos: Vec2, targets: { id: string; x: number; z: number }[], range = 0.85, previous?: string | null): string | null {
  const distances = targets.map(target => ({ id: target.id, distance: Math.hypot(target.x - pos.x, target.z - pos.z) }));
  const best = distances.filter(target => target.distance <= range)
    .sort((a, b) => a.distance - b.distance || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
  const prior = distances.find(target => target.id === previous);
  if (prior && prior.distance <= range + 0.1 && (!best || prior.distance <= best.distance + 0.1)) return prior.id;
  return best?.id ?? null;
}

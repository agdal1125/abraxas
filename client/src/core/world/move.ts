import type { Bounds, Collider, Vec2 } from './types';

const EPS = 1e-9;
const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, z: a.z + b.z });
const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, z: a.z - b.z });
const mul = (a: Vec2, n: number): Vec2 => ({ x: a.x * n, z: a.z * n });
const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.z * b.z;
const cross = (a: Vec2, b: Vec2): number => a.x * b.z - a.z * b.x;
const length = (a: Vec2): number => Math.hypot(a.x, a.z);
type Segment = { a: Vec2; b: Vec2 };
type Hit = { t: number; normal: Vec2 };

function inside(p: Vec2, polygon: Vec2[]): boolean {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!, b = polygon[j]!;
    if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) result = !result;
  }
  return result;
}

function allowed(p: Vec2, bounds: Bounds): boolean {
  return inside(p, bounds.outer) && (!bounds.holes.some(hole => inside(p, hole)) || bounds.bridges.some(bridge => inside(p, bridge.points)));
}

function segments(polygon: Vec2[]): Segment[] {
  return polygon.map((a, i) => ({ a, b: polygon[(i + 1) % polygon.length]! })).filter(s => length(sub(s.b, s.a)) > EPS);
}

// Bounds and colliders are never mutated after they are created, so their derived edge lists are computed once.
// boundaries() is quadratic in the number of edges and used to run again on every movement step.
const boundaryCache = new WeakMap<Bounds, Segment[]>();
const boxCache = new WeakMap<object, Segment[]>();

function boundaries(bounds: Bounds): Segment[] {
  let result = boundaryCache.get(bounds);
  if (!result) boundaryCache.set(bounds, result = computeBoundaries(bounds));
  return result;
}

function computeBoundaries(bounds: Bounds): Segment[] {
  const all = [bounds.outer, ...bounds.holes, ...bounds.bridges.map(b => b.points)].flatMap(segments);
  const result: Segment[] = [];
  for (const edge of all) {
    const d = sub(edge.b, edge.a), dd = dot(d, d), cuts = [0, 1];
    for (const other of all) {
      const e = sub(other.b, other.a), offset = sub(other.a, edge.a), denominator = cross(d, e);
      if (Math.abs(denominator) > EPS) {
        const t = cross(offset, e) / denominator, u = cross(offset, d) / denominator;
        if (t > EPS && t < 1 - EPS && u >= -EPS && u <= 1 + EPS) cuts.push(t);
      } else if (Math.abs(cross(offset, d)) < EPS) {
        for (const p of [other.a, other.b]) {
          const t = dot(sub(p, edge.a), d) / dd;
          if (t > EPS && t < 1 - EPS) cuts.push(t);
        }
      }
    }
    cuts.sort((a, b) => a - b);
    for (let i = 1; i < cuts.length; i++) {
      if (cuts[i]! - cuts[i - 1]! < EPS) continue;
      const a = add(edge.a, mul(d, cuts[i - 1]!)), b = add(edge.a, mul(d, cuts[i]!));
      const midpoint = mul(add(a, b), 0.5), normal = mul({ x: -d.z, z: d.x }, 1e-7 / Math.sqrt(dd));
      if (allowed(add(midpoint, normal), bounds) !== allowed(sub(midpoint, normal), bounds)) result.push({ a, b });
    }
  }
  return result;
}

function circleHit(p: Vec2, v: Vec2, center: Vec2, radius: number): Hit | null {
  const offset = sub(p, center), a = dot(v, v), b = dot(offset, v), c = dot(offset, offset) - radius * radius;
  if (a < EPS || b >= 0) return null;
  const discriminant = b * b - a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / a;
  if (t < -EPS || t > 1 + EPS) return null;
  const n = add(offset, mul(v, Math.max(0, t))), size = length(n);
  return size > EPS ? { t: Math.max(0, t), normal: mul(n, 1 / size) } : null;
}

function segmentHit(p: Vec2, v: Vec2, edge: Segment, radius: number): Hit | null {
  const d = sub(edge.b, edge.a), len = length(d), tangent = mul(d, 1 / len), normal = { x: -tangent.z, z: tangent.x };
  const hits: Hit[] = [];
  for (const end of [edge.a, edge.b]) {
    const hit = circleHit(p, v, end, radius);
    if (hit) hits.push(hit);
  }
  for (const sign of [-1, 1]) {
    const n = mul(normal, sign), speed = dot(v, n);
    if (speed >= -EPS) continue;
    const t = (radius - dot(sub(p, edge.a), n)) / speed;
    const along = dot(sub(add(p, mul(v, t)), edge.a), tangent);
    if (t >= -EPS && t <= 1 + EPS && along >= 0 && along <= len) hits.push({ t: Math.max(0, t), normal: n });
  }
  return hits.sort((a, b) => a.t - b.t)[0] ?? null;
}

function boxEdges(box: Extract<Collider, { type: 'box' }>): Segment[] {
  let edges = boxCache.get(box);
  if (!edges) boxCache.set(box, edges = computeBoxEdges(box));
  return edges;
}

function computeBoxEdges(box: Extract<Collider, { type: 'box' }>): Segment[] {
  const c = Math.cos(box.rot), s = Math.sin(box.rot);
  const points: [number, number][] = [[-box.halfX, -box.halfZ], [box.halfX, -box.halfZ], [box.halfX, box.halfZ], [-box.halfX, box.halfZ]];
  return segments(points.map(([x, z]) => ({ x: box.x + c * x + s * z, z: box.z - s * x + c * z })));
}

function distanceToSegment(p: Vec2, edge: Segment): number {
  // Same arithmetic as the vector helpers, written out so the per-step safety checks do not allocate.
  const dx = edge.b.x - edge.a.x, dz = edge.b.z - edge.a.z;
  const t = Math.max(0, Math.min(1, ((p.x - edge.a.x) * dx + (p.z - edge.a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p.x - (edge.a.x + dx * t), p.z - (edge.a.z + dz * t));
}

export function walkable(colliders: Collider[], bounds: Bounds, radius = 0.18): (a: Vec2, b: Vec2) => boolean {
  const edges = boundaries(bounds), boxes = colliders.filter((c): c is Extract<Collider, { type: 'box' }> => c.type === 'box').map(boxEdges);
  const circles = colliders.filter((c): c is Extract<Collider, { type: 'circle' }> => c.type === 'circle');
  const allEdges = [...edges, ...boxes.flat()];
  return (a, b) => allowed(b, bounds)
    && edges.every(edge => distanceToSegment(b, edge) >= radius - EPS)
    && circles.every(c => length(sub(b, c)) >= radius + c.radius - EPS)
    && boxes.every(box => !inside(b, box.map(edge => edge.a)) && box.every(edge => distanceToSegment(b, edge) >= radius - EPS))
    && allEdges.every(edge => !segmentHit(a, sub(b, a), edge, radius))
    && circles.every(c => !circleHit(a, sub(b, a), c, radius + c.radius));
}

export function step(pos: Vec2, input: Vec2, dt: number, colliders: Collider[], bounds: Bounds, opts?: { speed?: number; radius?: number }): Vec2 {
  const radius = opts?.radius ?? 0.18, speed = opts?.speed ?? 1.4;
  const edges = boundaries(bounds), boxes = colliders.filter((c): c is Extract<Collider, { type: 'box' }> => c.type === 'box').map(boxEdges);
  const safe = (p: Vec2): boolean => allowed(p, bounds)
    && edges.every(edge => distanceToSegment(p, edge) >= radius - EPS)
    && colliders.every(c => c.type !== 'circle' || length(sub(p, c)) >= radius + c.radius - EPS)
    && boxes.every(box => !inside(p, box.map(edge => edge.a)) && box.every(edge => distanceToSegment(p, edge) >= radius - EPS));
  if (!safe(pos)) return pos;
  const magnitude = length(input), displacement = mul(input, Math.max(0, Math.min(dt, 0.05)) * speed / Math.max(1, magnitude));
  const count = Math.max(1, Math.ceil(length(displacement) / 0.04)), delta = mul(displacement, 1 / count);
  let current = pos;
  const solid = [...edges, ...boxes.flat()];
  for (let i = 0; i < count; i++) {
    let remaining = delta, candidate = current;
    for (let iteration = 0; iteration < 3 && length(remaining) > EPS; iteration++) {
      // A hit needs the candidate to come within radius + |remaining| of the shape, so far shapes are skipped without allocating.
      const reach = radius + length(remaining) * 1.000001 + 1e-6;
      let hit: Hit | undefined;
      for (const edge of solid) {
        if (Math.min(edge.a.x, edge.b.x) - reach > candidate.x || Math.max(edge.a.x, edge.b.x) + reach < candidate.x
          || Math.min(edge.a.z, edge.b.z) - reach > candidate.z || Math.max(edge.a.z, edge.b.z) + reach < candidate.z) continue;
        const found = segmentHit(candidate, remaining, edge, radius);
        if (found && (!hit || found.t < hit.t)) hit = found;
      }
      for (const collider of colliders) {
        if (collider.type !== 'circle' || Math.hypot(candidate.x - collider.x, candidate.z - collider.z) > reach + collider.radius) continue;
        const found = circleHit(candidate, remaining, collider, radius + collider.radius);
        if (found && (!hit || found.t < hit.t)) hit = found;
      }
      if (!hit) { candidate = add(candidate, remaining); remaining = { x: 0, z: 0 }; break; }
      candidate = add(candidate, mul(remaining, hit.t));
      remaining = mul(remaining, 1 - hit.t);
      remaining = sub(remaining, mul(hit.normal, Math.min(0, dot(remaining, hit.normal))));
    }
    if (!safe(candidate)) return current;
    current = candidate;
  }
  return current;
}

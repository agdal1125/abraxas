import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const map = JSON.parse(readFileSync(process.argv[2] ?? new URL('../content/world/village.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('../content/assets/manifest.json', import.meta.url), 'utf8')).assets;
const source = readFileSync(new URL('../client/src/core/world/move.ts', import.meta.url), 'utf8');
const module = await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(source) + '\nexport { inside, allowed, boundaries, boxEdges, distanceToSegment };')}`);
const { inside, allowed, boundaries, boxEdges, distanceToSegment } = module;
const colliders = [...map.props, ...map.actors].flatMap(p => {
  const asset = manifest[p.asset];
  if (!asset) throw new Error(`Missing asset: ${p.asset}`);
  const scale = asset.scale * (p.scale ?? 1), rot = p.rot ?? 0, c = Math.cos(rot), s = Math.sin(rot);
  return asset.collision.map(shape => {
    const x = p.x + (c * shape.x + s * shape.z) * scale, z = p.z + (-s * shape.x + c * shape.z) * scale;
    return shape.type === 'circle' ? { type: 'circle', x, z, radius: shape.radius * scale, owner: p.id } :
      { type: 'box', x, z, halfX: shape.halfX * scale, halfZ: shape.halfZ * scale, rot, owner: p.id };
  });
});
const edges = boundaries(map.bounds);
const boxes = colliders.filter(c => c.type === 'box').map(c => ({ ...c, edges: boxEdges(c) }));
const circles = colliders.filter(c => c.type === 'circle');
const radius = 0.3, spacing = 0.15, eps = 1e-9;
const safe = p => allowed(p, map.bounds) && edges.every(e => distanceToSegment(p, e) >= radius - eps)
  && circles.every(c => Math.hypot(p.x - c.x, p.z - c.z) >= radius + c.radius - eps)
  && boxes.every(b => !inside(p, b.edges.map(e => e.a)) && b.edges.every(e => distanceToSegment(p, e) >= radius - eps));
const cross = (a, b, c) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
const intersects = (a, b, c, d) => cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0
  && Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) <= Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) + eps
  && Math.max(Math.min(a.z, b.z), Math.min(c.z, d.z)) <= Math.min(Math.max(a.z, b.z), Math.max(c.z, d.z)) + eps;
const segmentDistance = (a, b, e) => intersects(a, b, e.a, e.b) ? 0 : Math.min(distanceToSegment(a, e), distanceToSegment(b, e), distanceToSegment(e.a, { a, b }), distanceToSegment(e.b, { a, b }));
const canMove = (a, b) => safe(b) && edges.every(e => segmentDistance(a, b, e) >= radius - eps)
  && circles.every(c => distanceToSegment(c, { a, b }) >= radius + c.radius - eps)
  && boxes.every(box => box.edges.every(e => segmentDistance(a, b, e) >= radius - eps));
const targets = [...map.actors, ...['lake', 'plaza', 'gate'].map(id => ({ id, ...map.zones[id] }))];
const visible = (p, target) => colliders.every(c => {
  if (c.owner === target.id || map.actors.some(a => a.id === c.owner && a.x === target.x && a.z === target.z)) return true;
  if (c.type === 'circle') return distanceToSegment(c, { a: p, b: target }) >= c.radius;
  const box = boxes.find(b => b === c || b.owner === c.owner && b.x === c.x && b.z === c.z);
  return !inside(p, box.edges.map(e => e.a)) && !box.edges.some(e => intersects(p, target, e.a, e.b));
});
if (!safe(map.spawn)) throw new Error('Spawn lacks 0.3m clearance');
const queue = [[0, 0]], visited = new Set(['0,0']), found = new Map();
for (let head = 0; head < queue.length; head++) {
  const [x, z] = queue[head], p = { x: map.spawn.x + x * spacing, z: map.spawn.z + z * spacing };
  for (const target of targets) if (!found.has(target.id) && Math.hypot(p.x - target.x, p.z - target.z) <= 0.85 && visible(p, target)) found.set(target.id, p);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, nz = z + dz, key = `${nx},${nz}`;
    if (visited.has(key)) continue;
    visited.add(key);
    const next = { x: map.spawn.x + nx * spacing, z: map.spawn.z + nz * spacing };
    if (canMove(p, next)) queue.push([nx, nz]);
  }
}
const missing = targets.filter(t => !found.has(t.id)).map(t => t.id);
console.log(`Reachable: ${found.size}/${targets.length}, grid ${spacing}m, corridor ${radius * 2}m, visited ${queue.length}`);
if (missing.length) throw new Error(`Unreachable: ${missing.join(', ')}`);

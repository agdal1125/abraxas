import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const map = JSON.parse(readFileSync(process.argv[2] ?? new URL('../content/world/village.json', import.meta.url), 'utf8'));
const assets = JSON.parse(readFileSync(new URL('../content/assets/manifest.json', import.meta.url), 'utf8')).assets;
const quests = Object.fromEntries(['moka', 'lumi', 'echo', 'or'].map(npc => [npc, JSON.parse(readFileSync(new URL(`../content/quests/${npc}-errand.json`, import.meta.url), 'utf8'))]));
const source = readFileSync(new URL('../client/src/core/world/move.ts', import.meta.url), 'utf8');
const { inside, allowed, boundaries, boxEdges, distanceToSegment } = await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(source) + '\nexport { inside, allowed, boundaries, boxEdges, distanceToSegment };')}`);
const nearby = readFileSync(new URL('../client/src/core/world/nearby.ts', import.meta.url), 'utf8');
const { nearest } = await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(nearby))}`);
const npcIds = { lumi: ['lumi-neighbor-1', 'lumi-neighbor-2'], echo: ['echo-borrower'], or: ['or-fisher', 'or-merchant'] };
const moved = { moka: ['v1j2', 'moka-guide'], lumi: ['s1j2', 'lumi-stagekeeper'], echo: ['t1p2', 'echo-organizer'], or: ['s2j2', 'or-assistant'] };
const zone = id => { const p = map.zones[id]; if (!p) throw new Error(`Missing zone: ${id}`); return p; };
const eps = 1e-9, radius = .18, spacing = .15;
const cross = (a, b, c) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
const intersects = (a, b, c, d) => cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0
  && Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) <= Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) + eps
  && Math.max(Math.min(a.z, b.z), Math.min(c.z, d.z)) <= Math.min(Math.max(a.z, b.z), Math.max(c.z, d.z)) + eps;
const segmentDistance = (a, b, e) => intersects(a, b, e.a, e.b) ? 0 : Math.min(distanceToSegment(a, e), distanceToSegment(b, e), distanceToSegment(e.a, { a, b }), distanceToSegment(e.b, { a, b }));
const edges = boundaries(map.bounds);

function check(active, completed, variant = '') {
  const actors = map.actors.map(actor => ({ ...actor }));
  if (active) { const [id, point] = moved[active]; Object.assign(actors.find(a => a.id === id), zone(point)); }
  for (const id of npcIds[active] ?? []) actors.push({ id, asset: 'resident-villager-a', ...zone(active === 'or' && variant === 'review' ? id.replace('or-', 'or-review-') : id) });
  if (active === 'or' && variant === 'report' || !active && completed.includes('or') && variant === 'report') Object.assign(actors.find(a => a.id === 'D'), zone('or-report'));
  const props = map.props.filter(p => !/^(moka|lumi|echo|or)-/.test(p.id) || p.id.startsWith(`${active}-`) || completed.some(npc => p.id.startsWith(`${npc}-`)));
  const colliders = [...props, ...actors].flatMap(p => {
    const asset = assets[p.id === 'moka-basket-source' ? 'prop-moka-dropoff' : p.asset];
    if (!asset) throw new Error(`Missing asset: ${p.id} (${p.asset})`);
    const scale = asset.scale * (p.scale ?? 1), rot = p.rot ?? 0, c = Math.cos(rot), s = Math.sin(rot);
    return asset.collision.map(shape => {
      const x = p.x + (c * shape.x + s * shape.z) * scale, z = p.z + (-s * shape.x + c * shape.z) * scale;
      return shape.type === 'circle' ? { type: 'circle', x, z, radius: shape.radius * scale, owner: p.id } : { type: 'box', x, z, halfX: shape.halfX * scale, halfZ: shape.halfZ * scale, rot, owner: p.id };
    });
  });
  const boxes = colliders.filter(c => c.type === 'box').map(c => ({ ...c, edges: boxEdges(c) }));
  const circles = colliders.filter(c => c.type === 'circle');
  const safe = p => allowed(p, map.bounds) && edges.every(e => distanceToSegment(p, e) >= radius - eps)
    && circles.every(c => Math.hypot(p.x - c.x, p.z - c.z) >= radius + c.radius - eps)
    && boxes.every(b => !inside(p, b.edges.map(e => e.a)) && b.edges.every(e => distanceToSegment(p, e) >= radius - eps));
  const temporary = active ? [moved[active][0], ...(npcIds[active] ?? []), ...(active === 'or' && variant === 'report' ? ['D'] : [])] : variant === 'report' ? ['D'] : [];
  for (const id of temporary) {
    const own = circles.filter(c => c.owner === id);
    for (const actor of own) {
      const overlapping = circles.filter(c => c.owner !== id && Math.hypot(actor.x - c.x, actor.z - c.z) < actor.radius + c.radius - eps).map(c => c.owner);
      overlapping.push(...boxes.filter(b => inside(actor, b.edges.map(e => e.a)) || b.edges.some(e => distanceToSegment(actor, e) < actor.radius - eps)).map(b => b.owner));
      if (!allowed(actor, map.bounds) || edges.some(e => distanceToSegment(actor, e) < actor.radius - eps) || overlapping.length) throw new Error(`${active ?? 'completed'} ${variant}: ${id} overlaps ${overlapping.join(', ') || 'boundary'}`);
    }
  }
  const visible = (p, target) => colliders.every(c => {
    if (c.owner === target.id || actors.some(a => a.id === c.owner && a.x === target.x && a.z === target.z)) return true;
    if (c.type === 'circle') return distanceToSegment(c, { a: p, b: target }) >= c.radius;
    const box = boxes.find(b => b.owner === c.owner && b.x === c.x && b.z === c.z);
    return !inside(p, box.edges.map(e => e.a)) && !box.edges.some(e => intersects(p, target, e.a, e.b));
  });
  const canMove = (a, b) => safe(b) && edges.every(e => segmentDistance(a, b, e) >= radius - eps)
    && circles.every(c => distanceToSegment(c, { a, b }) >= radius + c.radius - eps)
    && boxes.every(box => box.edges.every(e => segmentDistance(a, b, e) >= radius - eps));
  const targetIds = new Set(['A', 'B', 'C', 'D', ...map.actors.map(a => a.id), ...['lake', 'plaza', 'gate']]);
  if (active === 'moka') {
    for (const phase of Object.values(quests.moka.phases)) for (const id of phase.targets ?? Object.values(phase.targetsByPick)) targetIds.add(id);
    for (const route of Object.values(quests.moka.routes)) for (const id of route.waypoints) targetIds.add(id);
    targetIds.add('moka-rest');
  } else if (active) {
    for (const phase of Object.values(quests[active].phases)) for (const id of phase) targetIds.add(id);
    for (const points of Object.values(quests[active].resumePoints)) for (const id of points) targetIds.add(id);
    targetIds.add(`${active}-rest`);
  }
  for (const p of props) if (/^(moka|lumi|echo|or)-/.test(p.id)) targetIds.add(p.id);
  const targets = [...targetIds].map(id => {
    const p = actors.find(a => a.id === id) ?? props.find(p => p.id === id) ?? map.zones[id];
    if (!p) throw new Error(`${active ?? 'restart'} ${variant}: missing target ${id}`);
    return { id, ...p, colliders: actors.some(a => a.id === id) ? [] : colliders.filter(c => c.owner === id) };
  });
  if (!safe(map.spawn)) throw new Error(`${active ?? 'restart'} ${variant}: unsafe spawn`);
  const queue = [[0, 0]], visited = new Set(['0,0']), found = new Set();
  for (let head = 0; head < queue.length && found.size < targets.length; head++) {
    const [x, z] = queue[head], p = { x: map.spawn.x + x * spacing, z: map.spawn.z + z * spacing };
    for (const target of targets) if (!found.has(target.id) && nearest(p, [target]) && visible(p, target)) found.add(target.id);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz, key = `${nx},${nz}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (canMove(p, { x: map.spawn.x + nx * spacing, z: map.spawn.z + nz * spacing })) queue.push([nx, nz]);
    }
  }
  const missing = targets.filter(t => !found.has(t.id)).map(t => t.id);
  if (missing.length) throw new Error(`${active ?? 'restart'} completed=${completed.join(',')} ${variant}: unreachable ${missing.join(', ')}`);
  console.log(`${active ?? 'restart'} completed=${completed.join(',') || '-'} ${variant}: ${found.size} targets reachable`);
}
check(null, []);
for (const npc of ['moka', 'lumi', 'echo', 'or']) {
  check(npc, []);
  check(npc, ['moka', 'lumi', 'echo', 'or'].filter(other => other !== npc));
  if (npc === 'or') { check(npc, [], 'review'); check(npc, [], 'report'); }
}
check(null, ['moka', 'lumi', 'echo', 'or'], 'report');

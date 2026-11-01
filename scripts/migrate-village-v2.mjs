import { readFileSync, writeFileSync } from 'node:fs';

const [input, output] = process.argv.slice(2);
if (!input || !output || process.argv.length !== 4) throw new Error('Usage: node scripts/migrate-village-v2.mjs <input> <output>');
const source = readFileSync(input, 'utf8');
const v1 = JSON.parse(source);
if (v1.version !== 2) {
  if (v1.version !== 1) throw new Error(`Unsupported version: ${v1.version}`);
  const assets = {
    'medieval/building_well_blue': 'well', 'medieval/building_stage_A': 'festival-stage',
    'city/bench': 'bench', 'city/streetlight': 'streetlight', 'medieval/barrel': 'barrel',
    'medieval/building_market_red': 'bakery', 'medieval/building_tavern_yellow': 'bakery',
    'restaurant/crate_buns': 'bread-crate', 'restaurant/crate_carrots': 'bread-crate',
    'restaurant/crate_tomatoes': 'bread-crate', 'medieval/sack': 'bread-crate',
    'medieval/building_windmill_yellow': 'library', 'medieval/building_church_blue': 'library',
    'furniture/shelf_B_small_decorated': 'book-stack', 'furniture/book_set': 'book-stack',
    'furniture/lamp_standing': 'streetlight', 'medieval/building_blacksmith_blue': 'smithy',
    'medieval/resource_lumber': 'log', 'medieval/wheelbarrow': 'tool-rack',
    'medieval/bucket_water': 'barrel', 'medieval/crate_A_small': 'bread-crate',
    'medieval/waterlily_A': 'water-flower', 'medieval/waterlily_B': 'water-flower',
    'medieval/waterplant_A': 'water-reed', 'medieval/building_watermill_red': 'lake-pavilion',
    'medieval/building_bridge_A': 'bridge', 'medieval/fence_wood_straight': 'fence',
    'medieval/tent': 'entrance-house', 'medieval/building_home_A_yellow': 'entrance-house',
    'medieval/wall_straight_gate': 'memory-gate', 'medieval/building_tower_base_blue': 'plaza-hall',
    'medieval/building_home_B_red': 'entrance-house', 'city/bush': 'bush',
    'medieval/trees_A_small': 'tree-young', 'medieval/trees_B_medium': 'tree-layered',
    'medieval/tree_single_A': 'tree-round', 'medieval/trees_A_medium': 'tree-round',
    'medieval/tree_single_B': 'tree-slender', 'medieval/trees_B_small': 'tree-young',
    'medieval/trees_A_large': 'tree-layered', 'medieval/rock_single_A': 'rock-small',
    'medieval/rock_single_B': 'rock-small', 'medieval/rock_single_C': 'rock-large',
    'medieval/mountain_A_grass_trees': 'rock-large', 'medieval/hills_A_trees': 'rock-large',
    'medieval/cloud_small': 'bush', 'medieval/cloud_big': 'bush',
    flowers_red: 'flower-cluster-red', flowers_yellow: 'flower-cluster-yellow', flowers_pink: 'flower-cluster-pink',
    flowers_white: 'flower-cluster-white', flowers_purple: 'flower-cluster-purple', grass_tuft: 'grass-small',
    pebbles: 'pebbles', log: 'log', mushroom: 'mushroom'
  };
  const point = ({ q, r, dx = 0, dz = 0 }) => ({ x: 2 * q + r + dx, z: Math.sqrt(3) * r + dz });
  const corners = [[0, 2], [1, 1], [1, -1], [0, -2], [-1, -1], [-1, 1]];
  const key = p => p.join(',');
  const polygons = tiles => {
    const edges = new Map();
    for (const { q, r } of tiles) {
      const vertices = corners.map(([x, z]) => [2 * q + r + x, 3 * r + z]);
      for (let i = 0; i < 6; i++) {
        const a = vertices[i], b = vertices[(i + 1) % 6];
        const forward = `${key(a)}|${key(b)}`, reverse = `${key(b)}|${key(a)}`;
        if (edges.has(reverse)) edges.delete(reverse); else edges.set(forward, [a, b]);
      }
    }
    const loops = [];
    while (edges.size) {
      const [firstKey, [start]] = edges.entries().next().value;
      let edgeKey = firstKey;
      const loop = [];
      do {
        const [a, b] = edges.get(edgeKey);
        edges.delete(edgeKey);
        loop.push({ x: a[0], z: a[1] * Math.sqrt(3) / 3 });
        if (key(b) === key(start)) break;
        edgeKey = [...edges.keys()].find(k => k.startsWith(`${key(b)}|`));
        if (!edgeKey) throw new Error('Unclosed tile boundary');
      } while (true);
      loops.push(loop);
    }
    const area = loop => Math.abs(loop.reduce((sum, p, i) => {
      const next = loop[(i + 1) % loop.length];
      return sum + p.x * next.z - next.x * p.z;
    }, 0));
    return loops.sort((a, b) => area(b) - area(a));
  };
  const zones = Object.fromEntries(Object.entries(v1.zones).map(([id, pos]) => [id, point(pos)]));
  let seed = 12345;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const protectedDecor = v1.decor.map((item, i) => ({ item, i })).filter(({ item }) => item.kind.startsWith('model:') || item.kind === 'log');
  const candidates = v1.decor.map((item, i) => ({ item, i })).filter(({ item }) => !item.kind.startsWith('model:') && item.kind !== 'log');
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const selected = new Set([...protectedDecor, ...candidates.slice(0, Math.max(0, Math.round(v1.decor.length * 0.6) - protectedDecor.length))].map(({ i }) => i));
  let flowerBeds = 0;
  const props = [...v1.props, ...v1.decor].flatMap((item, i) => {
    if (i >= v1.props.length && !selected.has(i - v1.props.length)) return [];
    const old = (item.model ?? item.kind).replace(/^model:/, '');
    if (!Object.hasOwn(assets, old)) throw new Error(`Unsupported asset: ${old}`);
    const pos = point(item);
    let asset = assets[old];
    if (old.startsWith('flowers_') && flowerBeds < 6 && Math.hypot(pos.x - zones.plaza.x, pos.z - zones.plaza.z) <= 3) {
      asset = 'flower-bed';
      flowerBeds++;
    } else if (old === 'grass_tuft' && random() < 0.25) asset = 'grass-tuft';
    return [{ id: `prop-${i + 1}`, asset, ...pos, rot: item.rot ?? 0, scale: 1 }];
  });
  const roads = v1.tiles.filter(t => t.model.startsWith('medieval/hex_road_'));
  const roadSet = new Set(roads.map(t => `${t.q},${t.r}`));
  const paths = roads.flatMap(t => [[1, 0], [0, 1], [1, -1]].filter(([q, r]) => roadSet.has(`${t.q + q},${t.r + r}`)).map(([q, r]) => ({ width: 0.9, points: [point(t), point({ q: t.q + q, r: t.r + r })] })));
  const outer = polygons(v1.tiles.filter(t => t.walk))[0];
  if (!outer) throw new Error('No walkable tile boundary');
  const holes = polygons(v1.tiles.filter(t => t.model === 'medieval/hex_water'));
  const bridges = props.filter(p => p.asset === 'bridge').map(p => ({
    propId: p.id,
    points: [[-0.43, -1], [0.43, -1], [0.43, 1], [-0.43, 1]].map(([x, z]) => ({
      x: p.x + x * Math.cos(p.rot) + z * Math.sin(p.rot),
      z: p.z - x * Math.sin(p.rot) + z * Math.cos(p.rot)
    }))
  }));
  const actors = v1.actors.map(({ id, zone, ...pos }) => {
    if (zone && !zones[zone]) throw new Error(`Unknown zone: ${zone}`);
    return { id, asset: /^[ABCD]$/.test(id) ? `char-${id.toLowerCase()}` : 'quest-npc', ...(zone ? { zone } : {}), ...(zone ? zones[zone] : point(pos)) };
  });
  const v2 = { version: 2, spawn: zones.entrance, terrain: { asset: 'terrain', x: 0, z: 0, rot: 0, scale: 1 }, bounds: { outer, holes, bridges }, zones, paths, actors, props };
  Object.assign(v1, v2);
}

organic(v1);
writeFileSync(output, v1.coast === 'organic-v1' && JSON.parse(source).coast === 'organic-v1' ? source : `${JSON.stringify(v1, null, 2)}\n`, 'utf8');

function organic(map) {
  if (map.coast === 'organic-v1') return;
  if (map.coast) throw new Error(`Unsupported coastline: ${map.coast}`);
  const manifest = JSON.parse(readFileSync(new URL('../content/assets/manifest.json', import.meta.url), 'utf8')).assets;
  const points = [map.spawn, ...Object.values(map.zones), ...map.actors,
    ...map.props.filter(p => {
      if (!manifest[p.asset]) throw new Error(`Missing asset: ${p.asset}`);
      return manifest[p.asset].collision.length;
    }), ...map.paths.flatMap(path => path.points)];
  const smooth = (polygon, rounds) => {
    for (let n = 0; n < rounds; n++) polygon = polygon.flatMap((a, i) => {
      const b = polygon[(i + 1) % polygon.length];
      return [0.25, 0.75].map(t => ({ x: a.x * (1 - t) + b.x * t, z: a.z * (1 - t) + b.z * t }));
    });
    return polygon;
  };
  const inside = (p, polygon) => {
    let result = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) result = !result;
    }
    return result;
  };
  const distance = (p, a, b) => {
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
  };
  const resample = (polygon, count) => {
    const lengths = polygon.map((p, i) => Math.hypot(p.x - polygon[(i + 1) % polygon.length].x, p.z - polygon[(i + 1) % polygon.length].z));
    const total = lengths.reduce((a, b) => a + b, 0);
    let edge = 0, start = 0;
    return Array.from({ length: count }, (_, i) => {
      const target = total * i / count;
      while (start + lengths[edge] < target) start += lengths[edge++];
      const a = polygon[edge], b = polygon[(edge + 1) % polygon.length], t = (target - start) / lengths[edge];
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    });
  };
  const cross = (a, b, c) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  const intersects = (a, b, c, d) => cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0
    && Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) <= Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x))
    && Math.max(Math.min(a.z, b.z), Math.min(c.z, d.z)) <= Math.min(Math.max(a.z, b.z), Math.max(c.z, d.z));
  const simple = polygon => polygon.every((a, i) => polygon.every((c, j) => {
    if (i === j || (i + 1) % polygon.length === j || (j + 1) % polygon.length === i) return true;
    return !intersects(a, polygon[(i + 1) % polygon.length], c, polygon[(j + 1) % polygon.length]);
  }));
  const base = resample(smooth(map.bounds.outer, 3), 160);
  const center = base.reduce((a, p) => ({ x: a.x + p.x / base.length, z: a.z + p.z / base.length }), { x: 0, z: 0 });
  const holes = map.bounds.holes.map(h => smooth(h, 2));
  if (holes.some(h => !simple(h))) throw new Error('A smoothed hole is not a simple polygon');
  if (points.some(p => holes.some(h => inside(p, h)))) throw new Error('A required point is inside a smoothed hole');
  for (const bridge of map.bounds.bridges) {
    const touches = holes.some(h => bridge.points.some((a, i) => h.some((c, j) => intersects(a, bridge.points[(i + 1) % bridge.points.length], c, h[(j + 1) % h.length]))));
    if (!touches) throw new Error(`Bridge ${bridge.propId} no longer meets a hole`);
  }
  const outer = base.map((p, i) => {
    const dx = p.x - center.x, dz = p.z - center.z, radius = Math.hypot(dx, dz);
    const noise = 0.6 * Math.sin(4 * 2 * Math.PI * i / base.length + 1.2345);
    return { x: p.x + dx / radius * noise, z: p.z + dz / radius * noise };
  });
  const clearance = (p, polygon) => (inside(p, polygon) ? 1 : -1) * Math.min(...polygon.map((a, i) => distance(p, a, polygon[(i + 1) % polygon.length])));
  const moved = new Set();
  let removed = 0;
  const cleanDecor = () => { map.props = map.props.filter(p => {
    if (manifest[p.asset].collision.length || clearance(p, outer) >= 0.8) return true;
    const original = { x: p.x, z: p.z };
    for (let step = 1; step <= 200; step++) {
      const fraction = step / 200;
      p.x = original.x + (center.x - original.x) * fraction;
      p.z = original.z + (center.z - original.z) * fraction;
      if (clearance(p, outer) >= 0.8 && !holes.some(h => inside(p, h))) { moved.add(p.id); return true; }
    }
    removed++;
    return false;
  }); };
  cleanDecor();
  const expanded = new Set();
  const area = outer.reduce((sum, p, i) => sum + p.x * outer[(i + 1) % outer.length].z - outer[(i + 1) % outer.length].x * p.z, 0);
  for (let iteration = 0; iteration < 2000; iteration++) {
    const p = points.find(point => clearance(point, outer) < 0.801);
    if (!p) break;
    let edge = 0;
    for (let i = 1; i < outer.length; i++) if (distance(p, outer[i], outer[(i + 1) % outer.length]) < distance(p, outer[edge], outer[(edge + 1) % outer.length])) edge = i;
    const a = outer[edge], b = outer[(edge + 1) % outer.length];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const nx = Math.sign(area) * (b.z - a.z) / length, nz = -Math.sign(area) * (b.x - a.x) / length;
    const amount = Math.min(1, 0.82 - clearance(p, outer));
    for (let i = 0; i < outer.length; i++) {
      const delta = Math.min((i - edge + outer.length) % outer.length, (edge + 1 - i + outer.length) % outer.length);
      if (delta > 8) continue;
      const weight = (1 + Math.cos(Math.PI * delta / 9)) / 2;
      outer[i].x += nx * amount * weight;
      outer[i].z += nz * amount * weight;
      expanded.add(i);
    }
  }
  if (!simple(outer) || points.some(p => clearance(p, outer) < 0.8)) throw new Error('Cannot preserve 0.8m clearance with the expanded coastline');
  cleanDecor();
  const minimum = Math.min(...[...points, ...map.props.filter(p => !manifest[p.asset].collision.length)].map(p => clearance(p, outer)));
  map.bounds.outer = outer;
  map.bounds.holes = holes;
  map.coast = 'organic-v1';
  console.log(`Coast: ${outer.length} vertices, expanded ${expanded.size} vertices, moved ${moved.size}, removed ${removed}, minimum clearance ${minimum.toFixed(3)}m`);
}

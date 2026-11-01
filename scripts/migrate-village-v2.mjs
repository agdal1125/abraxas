import { readFileSync, writeFileSync } from 'node:fs';

const [input, output] = process.argv.slice(2);
if (!input || !output || process.argv.length !== 4) throw new Error('Usage: node scripts/migrate-village-v2.mjs <input> <output>');
const source = readFileSync(input, 'utf8');
const v1 = JSON.parse(source);
if (v1.version === 2) {
  writeFileSync(output, source, 'utf8');
} else {
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
    flowers_red: 'flower-bed', flowers_yellow: 'flower-bed', flowers_pink: 'flower-bed',
    flowers_white: 'flower-bed', flowers_purple: 'flower-bed', grass_tuft: 'grass-tuft',
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
  const props = [...v1.props, ...v1.decor].map((item, i) => {
    const old = (item.model ?? item.kind).replace(/^model:/, '');
    if (!Object.hasOwn(assets, old)) throw new Error(`Unsupported asset: ${old}`);
    return { id: `prop-${i + 1}`, asset: assets[old], ...point(item), rot: item.rot ?? 0, scale: 1 };
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
  writeFileSync(output, `${JSON.stringify(v2, null, 2)}\n`, 'utf8');
}

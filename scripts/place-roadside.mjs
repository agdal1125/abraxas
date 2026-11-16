#!/usr/bin/env node
// Adds roadside rocks, pebbles, and the entrance fence to content/world/village.json as "nature-*" props.
// The seed is fixed, so the same map gives the same placement. Refuses to run twice on the same file.
// Usage: node scripts/place-roadside.mjs [--dry]
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const file = resolve(root, "content/world/village.json");
const text = readFileSync(file, "utf8");
const map = JSON.parse(text);
const assets = JSON.parse(readFileSync(resolve(root, "content/assets/manifest.json"), "utf8")).assets;
if (map.props.some(prop => prop.id.startsWith("nature-"))) throw new Error("nature-* props already exist; run git checkout content/world/village.json first");

function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const random = mulberry(1110);

const shapesOf = (p) => {
  const asset = assets[p.asset]; if (!asset) return [];
  const scale = asset.scale * (p.scale ?? 1), rot = p.rot ?? 0, c = Math.cos(rot), s = Math.sin(rot);
  return asset.collision.map(shape => {
    const x = p.x + (c * shape.x + s * shape.z) * scale, z = p.z + (-s * shape.x + c * shape.z) * scale;
    return shape.type === "circle" ? { type: "circle", x, z, radius: shape.radius * scale } : { type: "box", x, z, halfX: shape.halfX * scale, halfZ: shape.halfZ * scale, rot };
  });
};
const colliders = [...map.props, ...map.actors].filter(p => !/^(moka|lumi|echo|or)-/.test(p.id)).flatMap(shapesOf);
// Quest props appear later and move around; keep their spots clear as well.
for (const p of map.props.filter(p => /^(moka|lumi|echo|or)-/.test(p.id))) colliders.push({ type: "circle", x: p.x, z: p.z, radius: .5 });
for (const zone of Object.values(map.zones)) colliders.push({ type: "circle", x: zone.x, z: zone.z, radius: .7 });

const near = (x, z, margin) => colliders.some(shape => {
  const dx = x - shape.x, dz = z - shape.z;
  if (shape.type === "circle") return Math.hypot(dx, dz) < shape.radius + margin;
  const c = Math.cos(shape.rot), s = Math.sin(shape.rot);
  return Math.abs(c * dx - s * dz) < shape.halfX + margin && Math.abs(s * dx + c * dz) < shape.halfZ + margin;
});
const segmentDistance = (x, z, a, b) => {
  const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
};
const segments = map.paths.flatMap(path => path.points.slice(1).map((p, i) => [path.points[i], p]));
const pathDistance = (x, z) => Math.min(...segments.map(([a, b]) => segmentDistance(x, z, a, b)));
const ringDistance = (x, z, ring) => Math.min(...ring.map((a, i) => segmentDistance(x, z, a, ring[(i + 1) % ring.length])));
const inside = (x, z, ring) => { let result = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) result = !result; } return result; };
const onGrass = (x, z) => inside(x, z, map.bounds.outer) && ringDistance(x, z, map.bounds.outer) > 1.3 && !map.bounds.holes.some(hole => inside(x, z, hole) || ringDistance(x, z, hole) < 1.3);

const added = [];
const add = (kind, asset, x, z, rot, scale) => {
  const id = `nature-${kind}-${added.filter(p => p.id.startsWith(`nature-${kind}-`)).length + 1}`;
  const prop = { id, asset, x: +x.toFixed(2), z: +z.toFixed(2), rot: +rot.toFixed(3), scale };
  added.push(prop); colliders.push(...shapesOf(prop));
};

// Fence: post-and-rail runs on both sides of two roads, the entrance road and the avenue to the memory gate.
// On the avenue every sixth piece is left out, so the line reads as a fence with gaps, not a corridor.
const runs = [
  { gaps: 0, points: [[1, 1.7321], [2, 3.4641], [3, 5.1962], [4, 6.9282], [5, 8.6603], [6, 10.3923], [7, 12.1244]] },
  { gaps: 6, points: [[-8, -13.8564], [-7, -12.1244], [-6, -10.3923], [-5, -8.6603], [-4, -6.9282], [-3, -5.1962], [-2, -3.4641]] },
];
for (const run of runs) {
  const chain = run.points.map(([x, z]) => ({ x, z }));
  let n = 0;
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i], b = chain[i + 1], length = Math.hypot(b.x - a.x, b.z - a.z), dx = (b.x - a.x) / length, dz = (b.z - a.z) / length;
    for (let t = .5; t < length; t += 1, n++) for (const side of [-1, 1]) {
      const x = a.x + dx * t - dz * side * 1.15, z = a.z + dz * t + dx * side * 1.15;
      if ((run.gaps && n % run.gaps >= run.gaps - 1) || near(x, z, .55) || !onGrass(x, z) || pathDistance(x, z) < 1.0) continue;
      add("fence", "fence", x, z, Math.atan2(-dz, dx), 1);
    }
  }
}

// Rocks and pebbles along every path, alternating sides, in loose clusters.
for (const [a, b] of segments) {
  const length = Math.hypot(b.x - a.x, b.z - a.z), dx = (b.x - a.x) / length, dz = (b.z - a.z) / length;
  for (let t = random() * 1.6; t < length; t += 1.5 + random() * 2.2) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const side = random() < .5 ? -1 : 1, offset = .85 + random() * .75;
      const x = a.x + dx * t - dz * side * offset, z = a.z + dz * t + dx * side * offset;
      if (!onGrass(x, z) || pathDistance(x, z) < .75 || near(x, z, .3)) continue;
      const roll = random();
      if (roll < .5) add("rock", "rock-small", x, z, random() * 6.28, +(.95 + random() * .4).toFixed(2));
      else if (roll < .78) add("rock", "rock-large", x, z, random() * 6.28, +(.55 + random() * .3).toFixed(2));
      else add("pebbles", "pebbles", x, z, random() * 6.28, +(1 + random() * .5).toFixed(2));
      for (let i = 0; i < 2; i++) {
        const angle = random() * 6.28, px = x + Math.cos(angle) * (.35 + random() * .25), pz = z + Math.sin(angle) * (.35 + random() * .25);
        if (random() < .6 && onGrass(px, pz) && pathDistance(px, pz) > .6 && !near(px, pz, .2)) add("pebbles", "pebbles", px, pz, random() * 6.28, +(.8 + random() * .5).toFixed(2));
      }
      break;
    }
  }
}

const counts = Object.fromEntries([...new Set(added.map(p => p.asset))].map(asset => [asset, added.filter(p => p.asset === asset).length]));
console.log(JSON.stringify(counts));
if (!process.argv.includes("--dry")) {
  // Edit the text, not the parsed object, so the hand-formatted rest of the file stays byte for byte the same.
  const end = text.indexOf('\n  ],\n  "coast"');
  if (end < 0) throw new Error("props array end not found");
  const block = added.map(prop => JSON.stringify(prop, null, 2).split("\n").map(line => `    ${line}`).join("\n")).join(",\n");
  writeFileSync(file, `${text.slice(0, end)},\n${block}${text.slice(end)}`);
  console.log(`wrote ${added.length} props`);
}

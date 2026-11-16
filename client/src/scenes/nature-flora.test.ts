import { expect, it } from "vitest";
import * as THREE from "three";
import { GroundSampler, Obstacles, blocked } from "./nature-grass";
import { BiomeMap, type Biome } from "./nature-biome";

function quad(x0: number, x1: number, y: number, rgb: [number, number, number]): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([x0, y, -2, x0, y, 2, x1, y, -2, x1, y, 2], 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(Array(4).fill(rgb).flat(), 3));
  geometry.setIndex([0, 1, 2, 2, 1, 3]);
  return new THREE.Mesh(geometry);
}

it("measures distance to paths, water, and the terrain edge so tall grass can stay off walking routes", () => {
  const terrain = new THREE.Group();
  terrain.add(quad(-4, 0, 0, [.2, .36, .14]), quad(0, .6, 0, [.49, .27, .11]), quad(.6, 2, -.08, [.36, .67, .63]));
  const ground = new GroundSampler(terrain);
  expect(ground.pathDistance(-1, 0)).toBeCloseTo(1, 0);
  expect(ground.pathDistance(-3.5, 0)).toBeGreaterThan(3);
  expect(ground.waterDistance(-1, 0)).toBeCloseTo(1.6, 0);
  expect(ground.edgeDistance(-3.5, 0)).toBeLessThan(.7);
});

it("finds blockers through the spatial hash exactly as the plain scan does", () => {
  const colliders = [{ type: "circle" as const, x: 0, z: 0, radius: .3 }, { type: "box" as const, x: 4, z: 0, halfX: 1, halfZ: .1, rot: Math.PI / 2 }];
  const solids = new Obstacles(colliders);
  for (const [x, z, margin] of [[.35, 0, .1], [.5, 0, .1], [4, .9, .05], [4.9, 0, .05], [40, 40, .5], [0, .85, .6]] as const) {
    expect(solids.blocked(x, z, margin)).toBe(blocked(x, z, colliders, margin));
  }
});

it("blends zone biomes by distance, and fades the color shift far from every zone", () => {
  const biomes = new BiomeMap({ lake: { x: 0, z: 0 }, smithy: { x: 30, z: 0 } });
  const here: Biome = { tint: [0, 0, 0], flowers: 0, palette: [0, 0, 0, 0], clover: 0, litter: 0, tall: 0, shrub: 0, mushrooms: 0, dry: 0 };
  expect(biomes.at(0, 0, here).dry).toBeLessThan(.05);
  expect(biomes.at(30, 0, here).dry).toBeGreaterThan(.75);
  const lakeTall = biomes.at(0, 0, here).tall;
  expect(lakeTall).toBeGreaterThan(biomes.at(30, 0, here).tall);
  expect(Math.abs(biomes.at(500, 500, here).tint[1]!)).toBeLessThan(1e-6);
});

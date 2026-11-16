import { expect, it } from "vitest";
import * as THREE from "three";
import { GroundSampler, blocked } from "./nature-grass";
import { Birds } from "./nature-fauna";

function quad(x0: number, x1: number, y: number, rgb: [number, number, number]): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([x0, y, -2, x0, y, 2, x1, y, -2, x1, y, 2], 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(Array(4).fill(rgb).flat(), 3));
  geometry.setIndex([0, 1, 2, 2, 1, 3]);
  return new THREE.Mesh(geometry);
}

it("finds walkable grass in the terrain mesh and keeps off paths, water, and the edge of a patch", () => {
  const terrain = new THREE.Group();
  terrain.add(quad(-2, 0, 0, [.2, .36, .14]), quad(.5, 1.5, 0, [.49, .27, .11]), quad(2, 3, -.08, [.36, .67, .63]));
  const ground = new GroundSampler(terrain);
  expect(ground.grass(-1, 0)).toBe(true);
  expect(ground.grass(-.04, 0)).toBe(false); // one cell of margin at the patch edge
  expect(ground.grass(1, 0)).toBe(false); // path color
  expect(ground.grass(2.5, 0)).toBe(false); // water level
  expect(ground.grass(10, 0)).toBe(false); // outside the terrain
  expect(ground.height(2.5, 0)).toBeCloseTo(-.08);
});

it("treats rotated boxes and circles as blocked within the margin", () => {
  const colliders = [{ type: "circle" as const, x: 0, z: 0, radius: .3 }, { type: "box" as const, x: 4, z: 0, halfX: 1, halfZ: .1, rot: Math.PI / 2 }];
  expect(blocked(.35, 0, colliders, .1)).toBe(true);
  expect(blocked(.5, 0, colliders, .1)).toBe(false);
  // Rotated 90 degrees, the box is long along z: it blocks (4, .9) but not (4.9, 0).
  expect(blocked(4, .9, colliders, .05)).toBe(true);
  expect(blocked(4.9, 0, colliders, .05)).toBe(false);
});

it("startles perched birds by distance alone, and not at all under reduced motion", () => {
  const ground = { grass: () => true, height: () => 0 } as unknown as GroundSampler;
  const camera = new THREE.OrthographicCamera(-3, 3, 2, -2, .1, 100);
  camera.position.set(10, 10, 10); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const birds = new Birds(new THREE.Scene(), ground, [], [{ x: 0, z: 0 }]);
  expect(birds.perchedCount).toBe(1);
  const home = (birds as unknown as { resting: { home: THREE.Vector3 }[] }).resting[0]!.home;
  birds.update(.016, new THREE.Vector3(home.x + 5, 0, home.z), camera, true);
  expect(birds.perchedCount).toBe(1);
  birds.update(.016, new THREE.Vector3(home.x + 1, 0, home.z), camera, false);
  expect(birds.perchedCount).toBe(1);
  birds.update(.016, new THREE.Vector3(home.x + 1, 0, home.z), camera, true);
  expect(birds.perchedCount).toBe(0);
  expect(birds.flyingCount).toBe(1);
});

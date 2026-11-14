import { expect, it } from "vitest";
import * as THREE from "three";
import { ScatterLayer } from "./nature-layer";
import { seeded } from "./nature-grass";

// The village camera: orthographic, looking down at 35 degrees along (-1, -, -1) at a point on the ground.
function viewCamera(halfHeight: number, aspect: number, x = 0, z = 0): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(-halfHeight * aspect, halfHeight * aspect, halfHeight, -halfHeight, .1, 100);
  camera.position.set(x + 10, 10 * Math.tan(THREE.MathUtils.degToRad(35)) * Math.SQRT2, z + 10);
  camera.lookAt(x, 0, z); camera.updateMatrixWorld();
  return camera;
}

type Item = { x: number; z: number; key: string };

// An even field of about 44 items per square unit, much like the meadow at desktop density.
function field(capacity: number): { layer: ScatterLayer; items: Item[] } {
  const layer = new ScatterLayer(new THREE.Scene(), "test-field", new THREE.BufferGeometry(), new THREE.MeshBasicMaterial(), capacity);
  const random = seeded(3), color = new THREE.Color(), items: Item[] = [];
  for (let x = -25; x < 25; x += .15) for (let z = -25; z < 25; z += .15) {
    const px = Math.fround(x + random() * .1), pz = Math.fround(z + random() * .1);
    layer.add(px, 0, pz, 0, 1, random(), color);
    items.push({ x: px, z: pz, key: `${px},${pz}` });
  }
  layer.seal();
  return { layer, items };
}

function drawn(layer: ScatterLayer): Set<string> {
  const keys = new Set<string>(), e = layer.mesh.instanceMatrix.array;
  for (let i = 0; i < layer.mesh.count; i++) keys.add(`${e[i * 16 + 12]},${e[i * 16 + 14]}`);
  return keys;
}

function ndc(camera: THREE.Camera, x: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, 0, z).project(camera);
}

function onScreen(camera: THREE.Camera, item: Item): boolean {
  const p = ndc(camera, item.x, item.z);
  return Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1;
}

it("spreads a crowded view evenly over the screen instead of filling one side", () => {
  const { layer } = field(4000);
  const camera = viewCamera(5, 16 / 9);
  layer.update(camera);
  expect(layer.mesh.count).toBeLessThanOrEqual(4000);
  expect(layer.mesh.count).toBeGreaterThan(3800);
  const quadrants = [0, 0, 0, 0], e = layer.mesh.instanceMatrix.array;
  for (let i = 0; i < layer.mesh.count; i++) {
    const p = ndc(camera, e[i * 16 + 12]!, e[i * 16 + 14]!);
    if (Math.abs(p.x) > 1 || Math.abs(p.y) > 1) continue;
    const quadrant = (p.x > 0 ? 1 : 0) + (p.y > 0 ? 2 : 0);
    quadrants[quadrant] = quadrants[quadrant]! + 1;
  }
  const visible = quadrants.reduce((a, b) => a + b, 0);
  expect(visible / layer.mesh.count).toBeGreaterThan(.8);
  for (const count of quadrants) expect(count / visible).toBeGreaterThan(.2);
});

it("never switches part of the screen on or off while the camera walks", () => {
  const { layer, items } = field(4000);
  let camera = viewCamera(5, 16 / 9);
  layer.update(camera);
  let compared = 0, worst = 0;
  for (let step = 1; step <= 10; step++) {
    const before = drawn(layer), beforeCamera = camera;
    camera = viewCamera(5, 16 / 9, step * .4, step * .15);
    layer.update(camera);
    const after = drawn(layer);
    // The middle of the screen as a 4 x 4 grid: the share of each cell's drawn items that switched on or off.
    const shown = Array<number>(16).fill(0), switched = Array<number>(16).fill(0);
    for (const item of items) {
      const a = ndc(beforeCamera, item.x, item.z), b = ndc(camera, item.x, item.z);
      if (Math.max(Math.abs(a.x), Math.abs(a.y), Math.abs(b.x), Math.abs(b.y)) >= .8) continue;
      if (!before.has(item.key) && !after.has(item.key)) continue;
      const cell = Math.floor((b.x + .8) / .4) + 4 * Math.floor((b.y + .8) / .4);
      shown[cell] = shown[cell]! + 1;
      if (before.has(item.key) !== after.has(item.key)) switched[cell] = switched[cell]! + 1;
    }
    for (let cell = 0; cell < 16; cell++) if (shown[cell]! > 50) { compared += shown[cell]!; worst = Math.max(worst, switched[cell]! / shown[cell]!); }
  }
  expect(compared).toBeGreaterThan(3000);
  expect(worst).toBeLessThan(.04);
});

it("does not switch the same items back and forth when the camera walks out and back", () => {
  const { layer, items } = field(4000);
  const path = [...Array(16).keys(), ...Array.from({ length: 15 }, (_, i) => 14 - i)];
  const switches = new Map<string, number>();
  let camera = viewCamera(5, 16 / 9);
  layer.update(camera);
  let before = drawn(layer);
  for (const step of path.slice(1)) {
    const beforeCamera = camera;
    camera = viewCamera(5, 16 / 9, step * .35, step * .1);
    layer.update(camera);
    const after = drawn(layer);
    for (const item of items) {
      if (!onScreen(beforeCamera, item) || !onScreen(camera, item) || before.has(item.key) === after.has(item.key)) continue;
      switches.set(item.key, (switches.get(item.key) ?? 0) + 1);
    }
    before = after;
  }
  expect(switches.size).toBeGreaterThan(0);
  expect(Math.max(...switches.values())).toBe(1);
});

it("draws every item on screen when the view holds fewer than the capacity", () => {
  const { layer, items } = field(4000);
  const camera = viewCamera(1.9, 844 / 390);
  layer.update(camera);
  const keys = drawn(layer);
  let visible = 0;
  for (const item of items) {
    if (!onScreen(camera, item)) continue;
    visible++;
    expect(keys.has(item.key)).toBe(true);
  }
  expect(visible).toBeGreaterThan(1000);
});

it("fills the new view when the screen turns, even if width plus height stays the same", () => {
  const { layer, items } = field(100000);
  layer.update(viewCamera(.7 * 768 / 140, 1024 / 768));
  const turned = viewCamera(.7 * 1024 / 140, 768 / 1024);
  layer.update(turned);
  const keys = drawn(layer);
  const visible = items.filter(item => onScreen(turned, item));
  expect(visible.length).toBeGreaterThan(1000);
  expect(visible.filter(item => !keys.has(item.key))).toHaveLength(0);
});

import { expect, it } from "vitest";
import * as THREE from "three";
import { Demi, whitenPlayer } from "./demi";

it("keeps a stationary pose during sit and gate modes", () => {
  const dog = new Demi({ x: 0, z: 0 });
  dog.setMode("sit", { x: 0, z: 0 });
  const before = dog.object.rotation.y;
  dog.update({ x: 1, z: 0 }, 1);
  expect(dog.object.rotation.y).toBe(before);
  expect(dog.object.position.x).toBe(0);
  dog.setMode("gate", { x: 1, z: 0 });
  dog.update({ x: 2, z: 0 }, 1);
  expect(dog.object.position.x).toBe(0);
});

it("follows recorded corners and resets after a teleport", () => {
  const dog = new Demi({ x: 0, z: 0 });
  dog.setMode("follow", { x: 0, z: 0 });
  for (let i = 1; i <= 10; i++) dog.update({ x: i / 10, z: 0 }, .1);
  for (let i = 1; i <= 10; i++) dog.update({ x: 1, z: i / 10 }, .1);
  expect(dog.object.position.x).toBeLessThanOrEqual(1);
  dog.reset({ x: 10, z: 10 });
  expect(dog.object.position.x).toBe(10);
  expect(dog.object.position.z).toBe(10);
});

it("stays put while held and comes back to following when released", () => {
  const dog = new Demi({ x: 0, z: 0 });
  dog.setMode("follow", { x: 0, z: 0 });
  dog.hold("pet");
  for (let i = 1; i <= 10; i++) dog.update({ x: i / 10, z: 0 }, .1);
  expect(dog.object.position.x).toBe(0);
  dog.release({ x: 1, z: 0 });
  for (let i = 1; i <= 10; i++) dog.update({ x: 1 + i / 10, z: 0 }, .1);
  expect(dog.object.position.x).toBeGreaterThan(0);
});

it("whitens only the player geometry and keeps shared materials intact", () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("color", new THREE.Float32BufferAttribute([.2, .3, .4, .6, .7, .8], 3));
  const material = new THREE.MeshStandardMaterial({ vertexColors: true });
  const player = new THREE.Mesh(geometry, material), npc = new THREE.Mesh(geometry, material);
  whitenPlayer(player);
  expect(player.geometry).not.toBe(npc.geometry);
  const colors = player.geometry.getAttribute("color");
  expect(colors.getX(0)).toBeLessThan(colors.getX(1));
  expect(colors.getX(1)).toBeLessThan(1);
  expect(npc.geometry.getAttribute("color").getX(0)).toBeCloseTo(.2);
  expect(player.material).toBe(npc.material);
});

it("has no collar and stays a light mesh for phones", () => {
  const dog = new Demi({ x: 0, z: 0 });
  let triangles = 0;
  dog.object.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    expect(child.geometry).not.toBeInstanceOf(THREE.TorusGeometry);
    const geometry = child.geometry as THREE.BufferGeometry;
    triangles += (geometry.index?.count ?? geometry.getAttribute("position").count) / 3;
  });
  expect(triangles).toBeLessThan(3000);
});

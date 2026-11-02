import { expect, it } from "vitest";
import * as THREE from "three";
import { Village } from "./village";

it("projects targets into canvas CSS coordinates and detects off-screen targets", () => {
  const village = Object.create(Village.prototype) as any;
  village.camera = new THREE.OrthographicCamera(-2, 2, 1, -1, .1, 10);
  village.camera.position.set(0, 0, 5); village.camera.lookAt(0, 0, 0); village.camera.updateMatrixWorld(); village.camera.updateProjectionMatrix();
  village.renderer = { domElement: { getBoundingClientRect: () => ({ left: 10, top: 20, width: 800, height: 400 }) } };
  village.actors = new Map([["center", { object: { position: { x: 0, z: 0 } } }], ["outside", { object: { position: { x: 3, z: 0 } } }]]);
  village.props = new Map();
  expect(village.targetScreenPos("center")).toEqual({ x: 410, y: 220, onScreen: true });
  expect(village.targetScreenPos("outside")).toEqual({ x: 1010, y: 220, onScreen: false });
  expect(village.targetScreenPos("missing")).toBeNull();
});

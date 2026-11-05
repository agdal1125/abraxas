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

it("hides the current speaker marker during dialogue and restores available markers afterward", () => {
  const village = Object.create(Village.prototype) as any;
  const first = { object: new THREE.Group(), marker: new THREE.Sprite() };
  const second = { object: new THREE.Group(), marker: new THREE.Sprite() };
  village.actors = new Map([["first", first], ["second", second]]);
  village.props = new Map();
  village.available = new Set();
  village.onNearbyChange = () => {};
  village.setAvailable(["first", "second"]);
  village.setEnabled(false);
  village.focusSpeaker("first");
  expect(first.marker.visible).toBe(false);
  expect(second.marker.visible).toBe(true);
  village.focusSpeaker("second");
  expect(first.marker.visible).toBe(true);
  expect(second.marker.visible).toBe(false);
  village.setAvailable(["second"]);
  expect(second.marker.visible).toBe(false);
  village.setEnabled(true);
  expect(first.marker.visible).toBe(false);
  expect(second.marker.visible).toBe(true);
});

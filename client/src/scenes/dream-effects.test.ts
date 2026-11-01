import { afterEach, expect, it, vi } from "vitest";
import * as THREE from "three";
import { DreamEffects } from "./dream-effects";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("keeps particles in world space when the camera and player move", async () => {
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
  vi.spyOn(THREE.TextureLoader.prototype, "loadAsync").mockResolvedValue(new THREE.Texture());
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-5, 5, 3, -3, .1, 100);
  camera.position.set(0, 5, 10); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  const effects = new DreamEffects(scene, []); await effects.whenReady;
  effects.update(0, new THREE.Vector3(), camera);
  const points = scene.children[0] as THREE.Points;
  const positions = points.geometry.getAttribute("position") as THREE.BufferAttribute;
  const before = new THREE.Vector3().fromBufferAttribute(positions, 1), screenBefore = before.clone().project(camera);
  camera.position.x += 1; camera.updateMatrixWorld();
  effects.update(0, new THREE.Vector3(1, 0, 0), camera);
  const after = new THREE.Vector3().fromBufferAttribute(positions, 1);
  expect(after.toArray()).toEqual(before.toArray());
  expect(after.project(camera).x).not.toBeCloseTo(screenBefore.x);
});

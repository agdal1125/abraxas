import { expect, it } from "vitest";
import * as THREE from "three";
import { dialogueFocus } from "./feedback";

it("frames nearby characters above the dialogue without changing their scale", () => {
  const player = new THREE.Vector3(0, 0, 0), speaker = new THREE.Vector3(.8, 0, 0);
  const halfHeight = 1.55, target = dialogueFocus(player, speaker, halfHeight);
  const camera = new THREE.OrthographicCamera(-halfHeight * 2, halfHeight * 2, halfHeight, -halfHeight, .1, 100);
  camera.position.copy(target).add(new THREE.Vector3(10, 10 * Math.tan(THREE.MathUtils.degToRad(35)) * Math.SQRT2, 10));
  camera.lookAt(target); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  for (const point of [player, speaker]) for (const y of [0, .7]) {
    const projected = point.clone().setY(y).project(camera);
    expect(projected.y).toBeGreaterThan(-1 / 3);
    expect(projected.y).toBeLessThan(1);
    expect(Math.abs(projected.x)).toBeLessThan(1);
  }
});

function feetTopPx(width: number, height: number, halfHeight: number, choicesTop?: number): number {
  const player = new THREE.Vector3(0, 0, 0), speaker = new THREE.Vector3(.8, 0, 0);
  const target = dialogueFocus(player, speaker, halfHeight, choicesTop === undefined ? undefined : { top: choicesTop, viewportHeight: height });
  const aspect = width / height;
  const camera = new THREE.OrthographicCamera(-halfHeight * aspect, halfHeight * aspect, halfHeight, -halfHeight, .1, 100);
  camera.position.copy(target).add(new THREE.Vector3(10, 10 * Math.tan(THREE.MathUtils.degToRad(35)) * Math.SQRT2, 10));
  camera.lookAt(target); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  const feet = new THREE.Vector3(.4, 0, 0).project(camera);
  return (1 - feet.y) / 2 * height;
}

it.each([[740, 360, 111], [844, 390, 131]])("puts the pair's feet 8px above the choices at %ix%i", (width, height, choicesTop) => {
  const halfHeight = height * 1.8 / 140; // a 1.8 unit character is 70px tall
  expect(feetTopPx(width, height, halfHeight, choicesTop)).toBeCloseTo(choicesTop - 8, 3);
});

it("keeps the head line 12px below the top when the choices start too high", () => {
  const halfHeight = 360 * 1.8 / 140;
  expect(feetTopPx(740, 360, halfHeight, 40)).toBeCloseTo(70 + 12, 3);
});

it("matches the base framing when there are no choices", () => {
  const halfHeight = 360 * 1.8 / 140;
  expect(feetTopPx(740, 360, halfHeight)).toBeCloseTo(360 / 2 - (halfHeight / 3 - .35 * Math.cos(THREE.MathUtils.degToRad(35))) * 360 / (2 * halfHeight), 1);
});

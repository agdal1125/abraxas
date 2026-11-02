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

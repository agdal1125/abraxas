import { afterEach, expect, it, vi } from "vitest";
import * as THREE from "three";
import { LightRig } from "./light-rig";

afterEach(() => { vi.unstubAllGlobals(); });

// The village camera: orthographic, looking down at 35 degrees along (-1, -, -1) at a point on the ground.
function viewCamera(halfHeight: number, aspect: number, x: number, z: number): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(-halfHeight * aspect, halfHeight * aspect, halfHeight, -halfHeight, .1, 100);
  camera.position.set(x + 10, 10 * Math.tan(THREE.MathUtils.degToRad(35)) * Math.SQRT2, z + 10);
  camera.lookAt(x, 0, z); camera.updateMatrixWorld();
  return camera;
}

it("puts every point on screen up to character height, and casters as tall as a tree, inside the sun's shadow box", () => {
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
  const edges = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]] as const;
  for (const [width, height] of [[740, 360], [844, 390], [1280, 720], [1366, 768], [1440, 1080], [1920, 1080], [2560, 1080], [2560, 1440]] as const) {
    // The player is about .7 units tall and always drawn about 70 px tall.
    const halfHeight = .7 * height / 140, aspect = width / height;
    const rig = new LightRig(new THREE.Scene());
    rig.resize(halfHeight, aspect, 2048);
    rig.update(0, { x: 3, z: -2 });
    rig.sun.updateMatrixWorld(); rig.sun.target.updateMatrixWorld(); rig.sun.shadow.updateMatrices(rig.sun);
    const sun = rig.sun.position.clone().sub(rig.sun.target.position).normalize();
    const view = viewCamera(halfHeight, aspect, 3, -2), look = view.getWorldDirection(new THREE.Vector3());
    for (const [sx, sy] of edges) {
      const ground = new THREE.Vector3(sx, sy, 0).unproject(view);
      ground.addScaledVector(look, -ground.y / look.y);
      // A receiver .7 high drawn at this edge pixel sits along the view ray, toward the camera.
      const points = { ground, receiver: ground.clone().addScaledVector(look, .7 / look.y), caster: ground.clone().addScaledVector(sun, 3 / sun.y) };
      for (const [name, point] of Object.entries(points)) {
        const p = point.clone().project(rig.sun.shadow.camera), label = `${width}x${height} ${name} at ${sx},${sy}`;
        if (name !== "caster") expect(Math.max(Math.abs(p.x), Math.abs(p.y)), label).toBeLessThanOrEqual(1);
        expect(Math.abs(p.z), label).toBeLessThanOrEqual(1);
      }
    }
  }
});

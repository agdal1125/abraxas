import { expect, it } from "vitest";
import * as THREE from "three";
import { SpringBones } from "./spring-bones";

function rig(name: string) {
  const body = new THREE.Group(), bone = new THREE.Bone(); bone.name = name; body.add(bone);
  const lean = () => new THREE.Vector3(0, 1, 0).applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()));
  return { body, bone, lean, springs: new SpringBones(body, false) };
}
const walk = (target: ReturnType<typeof rig>, seconds: number, speed: number) => { for (let t = 0; t < seconds; t += 1 / 60) { target.body.position.x += speed / 60; target.springs.update(1 / 60); } };

it("trails cloth behind a walking body and lets it settle when the body stops", () => {
  const scarf = rig("sec_cloth_scarf_090");
  walk(scarf, 1, 1.4);
  expect(scarf.lean().x).toBeLessThan(-.3);
  walk(scarf, 4, 0);
  expect(scarf.lean().x).toBeCloseTo(0, 2);
});

it("moves a heavy tool far less than cloth on the same walk", () => {
  const scarf = rig("sec_cloth_scarf_090"), hammer = rig("sec_heavy_hammer_090");
  let cloth = 0, tool = 0;
  for (let i = 0; i < 60; i++) { walk(scarf, 1 / 60, 1.4); walk(hammer, 1 / 60, 1.4); cloth = Math.max(cloth, Math.abs(scarf.lean().x)); tool = Math.max(tool, Math.abs(hammer.lean().x)); }
  expect(tool).toBeLessThan(cloth / 2);
});

it("never swings past the limit of its material", () => {
  const cap = rig("sec_shell_cap_110");
  cap.springs.update(1 / 60); cap.body.position.x += .3; cap.springs.update(1 / 60);
  expect(Math.acos(cap.lean().y)).toBeLessThanOrEqual(.1 + 1e-6);
});

it("leaves ordinary bones alone", () => {
  const arm = rig("arm_l");
  walk(arm, 1, 1.4);
  expect(arm.bone.quaternion.equals(new THREE.Quaternion())).toBe(true);
});

it("keeps a skinned mesh in step with its skeleton away from the origin", () => {
  const home = new THREE.Group(), root = new THREE.Bone(), cap = new THREE.Bone(); cap.name = "sec_shell_cap_110"; root.add(cap);
  const geometry = new THREE.BoxGeometry(.2, .2, .2), count = geometry.getAttribute("position").count;
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(new Array(count * 4).fill(0), 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(new Array(count * 4).fill(0).map((_, i) => i % 4 ? 0 : 1), 4));
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial()); mesh.add(root); mesh.bind(new THREE.Skeleton([root, cap]));
  home.add(mesh); home.position.set(6, 0, 10);
  new SpringBones(home, false).update(1 / 60);
  mesh.skeleton.update(); mesh.computeBoundingBox();
  expect(mesh.boundingBox!.max.x).toBeLessThan(1);
});

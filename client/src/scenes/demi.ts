import * as THREE from "three";
import type { Vec2 } from "../core/world/types";

export type DemiMode = "hidden" | "follow" | "lead" | "sit" | "gate" | "ending";

export function whitenPlayer(object: THREE.Object3D): void {
  object.traverse(child => {
    if (!(child instanceof THREE.Mesh) || !child.geometry.getAttribute("color")) return;
    child.geometry = child.geometry.clone();
    const colors = child.geometry.getAttribute("color");
    for (let i = 0; i < colors.count; i++) {
      const shade = .72 + .27 * (colors.getX(i) * .2126 + colors.getY(i) * .7152 + colors.getZ(i) * .0722);
      colors.setXYZ(i, shade, shade * .985, shade * .99);
    }
    colors.needsUpdate = true;
  });
}

export class Demi {
  readonly object = new THREE.Group();
  private mode: DemiMode = "hidden";
  private trail: Vec2[] = [];
  private last: Vec2;
  private legs: THREE.Mesh[] = [];
  private time = 0;

  constructor(position: Vec2) {
    const white = new THREE.MeshStandardMaterial({ color: "#fff8f2", roughness: 1 });
    const dark = new THREE.MeshStandardMaterial({ color: "#302a29", roughness: 1 });
    const collar = new THREE.MeshStandardMaterial({ color: "#f4a7b9", roughness: 1 });
    const ball = (material: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), material);
      mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.castShadow = true; this.object.add(mesh); return mesh;
    };
    ball(white, 0, .105, -.025, .085, .075, .12);
    ball(white, 0, .16, .085, .08, .075, .075);
    for (const x of [-.075, .075]) ball(white, x, .145, .075, .035, .06, .035);
    for (const x of [-.032, .032]) ball(dark, x, .175, .151, .009, .01, .007);
    ball(dark, 0, .145, .161, .014, .01, .009);
    for (const x of [-.052, .052]) for (const z of [-.095, .065]) this.legs.push(ball(white, x, .037, z, .025, .037, .028));
    ball(white, 0, .16, -.14, .026, .045, .035).rotation.x = -.6;
    const band = new THREE.Mesh(new THREE.TorusGeometry(.067, .009, 8, 16), collar);
    band.rotation.x = Math.PI / 2; band.position.set(0, .105, .055); this.object.add(band);
    this.last = { ...position }; this.reset(position); this.object.visible = false;
  }

  reset(position: Vec2): void {
    this.object.position.set(position.x, 0, position.z); this.last = { ...position }; this.trail = [];
  }

  setMode(mode: DemiMode, position: Vec2): void {
    if (mode === this.mode) return;
    this.mode = mode; this.object.visible = mode !== "hidden";
    this.trail = []; this.last = { ...position };
    this.object.scale.y = mode === "sit" || mode === "gate" ? .82 : 1;
    for (const leg of this.legs) leg.rotation.x = 0;
  }

  update(position: Vec2, dt: number): void {
    if (this.mode !== "follow") return;
    const distance = Math.hypot(position.x - this.last.x, position.z - this.last.z);
    if (distance > 2) { this.reset(position); return; }
    if (distance > .025) { this.trail.push({ ...position }); this.last = { ...position }; }
    if (this.trail.length < 2 || Math.hypot(position.x - this.object.position.x, position.z - this.object.position.z) < .45) return;
    let remaining = dt * 1.4;
    while (remaining > 0 && this.trail.length > 1) {
      const next = this.trail[0]!;
      const dx = next.x - this.object.position.x, dz = next.z - this.object.position.z, length = Math.hypot(dx, dz);
      if (length < 1e-5) { this.trail.shift(); continue; }
      const step = Math.min(length, remaining);
      this.object.position.x += dx / length * step; this.object.position.z += dz / length * step;
      this.object.rotation.y = Math.atan2(dx, dz); remaining -= step;
      if (step === length) this.trail.shift();
    }
    this.time += dt * 12;
    this.legs.forEach((leg, index) => { leg.rotation.x = Math.sin(this.time + (index % 3 ? Math.PI : 0)) * .35; });
  }
}

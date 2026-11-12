import * as THREE from "three";
import type { Collider } from "../core/world/types";
import { applyWind, liteMaterial } from "./nature-wind";

export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Top-down raster of the terrain mesh: where is walkable grass, how high is it, what color. Replaces per-point raycasts. */
export class GroundSampler {
  private readonly minX: number;
  private readonly minZ: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly kind: Uint8Array; // 0 none, 1 grass, 2 other
  private readonly top: Float32Array;
  private readonly rgb: Uint8Array;

  constructor(terrain: THREE.Object3D, readonly cell = .1) {
    terrain.updateMatrixWorld(true);
    const meshes: THREE.Mesh[] = [];
    terrain.traverse(child => { if (child instanceof THREE.Mesh) meshes.push(child); });
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    const point = new THREE.Vector3();
    for (const mesh of meshes) {
      const position = mesh.geometry.getAttribute("position");
      for (let i = 0; i < position.count; i++) {
        point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
        minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x); minZ = Math.min(minZ, point.z); maxZ = Math.max(maxZ, point.z);
      }
    }
    this.minX = minX; this.minZ = minZ;
    this.cols = Math.max(1, Math.ceil((maxX - minX) / cell)); this.rows = Math.max(1, Math.ceil((maxZ - minZ) / cell));
    this.kind = new Uint8Array(this.cols * this.rows); this.top = new Float32Array(this.cols * this.rows).fill(-9); this.rgb = new Uint8Array(this.cols * this.rows * 3);
    for (const mesh of meshes) this.rasterize(mesh);
    this.erode();
  }

  private rasterize(mesh: THREE.Mesh): void {
    const geometry = mesh.geometry, position = geometry.getAttribute("position"), color = geometry.getAttribute("color"), index = geometry.getIndex();
    const count = index ? index.count : position.count;
    const p = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const c = [[0, 0, 0], [0, 0, 0], [0, 0, 0]] as number[][];
    for (let t = 0; t < count; t += 3) {
      for (let k = 0; k < 3; k++) {
        const vertex = index ? index.getX(t + k) : t + k;
        p[k]!.fromBufferAttribute(position, vertex).applyMatrix4(mesh.matrixWorld);
        c[k] = color ? [color.getX(vertex), color.getY(vertex), color.getZ(vertex)] : [.2, .36, .14];
      }
      const [a, b, d] = p as [THREE.Vector3, THREE.Vector3, THREE.Vector3];
      const det = (b.z - d.z) * (a.x - d.x) + (d.x - b.x) * (a.z - d.z);
      if (Math.abs(det) < 1e-9) continue;
      const x0 = Math.max(0, Math.floor((Math.min(a.x, b.x, d.x) - this.minX) / this.cell)), x1 = Math.min(this.cols - 1, Math.floor((Math.max(a.x, b.x, d.x) - this.minX) / this.cell));
      const z0 = Math.max(0, Math.floor((Math.min(a.z, b.z, d.z) - this.minZ) / this.cell)), z1 = Math.min(this.rows - 1, Math.floor((Math.max(a.z, b.z, d.z) - this.minZ) / this.cell));
      for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) {
        const x = this.minX + (ix + .5) * this.cell, z = this.minZ + (iz + .5) * this.cell;
        const w0 = ((b.z - d.z) * (x - d.x) + (d.x - b.x) * (z - d.z)) / det, w1 = ((d.z - a.z) * (x - d.x) + (a.x - d.x) * (z - d.z)) / det, w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const y = w0 * a.y + w1 * b.y + w2 * d.y, cell = iz * this.cols + ix;
        if (y <= this.top[cell]!) continue;
        const r = w0 * c[0]![0]! + w1 * c[1]![0]! + w2 * c[2]![0]!, g = w0 * c[0]![1]! + w1 * c[1]![1]! + w2 * c[2]![1]!, bl = w0 * c[0]![2]! + w1 * c[1]![2]! + w2 * c[2]![2]!;
        this.top[cell] = y;
        this.kind[cell] = y > -.012 && g > r * 1.15 && g > bl * 1.3 ? 1 : 2;
        this.rgb[cell * 3] = Math.min(255, r * 255); this.rgb[cell * 3 + 1] = Math.min(255, g * 255); this.rgb[cell * 3 + 2] = Math.min(255, bl * 255);
      }
    }
  }

  // Keep one cell of margin around paths, water, and the coast so blades do not hang over them.
  private erode(): void {
    const next = this.kind.slice();
    for (let iz = 1; iz < this.rows - 1; iz++) for (let ix = 1; ix < this.cols - 1; ix++) {
      const i = iz * this.cols + ix;
      if (this.kind[i] === 1 && (this.kind[i - 1] !== 1 || this.kind[i + 1] !== 1 || this.kind[i - this.cols] !== 1 || this.kind[i + this.cols] !== 1)) next[i] = 2;
    }
    this.kind.set(next);
  }

  private at(x: number, z: number): number {
    const ix = Math.floor((x - this.minX) / this.cell), iz = Math.floor((z - this.minZ) / this.cell);
    return ix < 0 || iz < 0 || ix >= this.cols || iz >= this.rows ? -1 : iz * this.cols + ix;
  }
  grass(x: number, z: number): boolean { const i = this.at(x, z); return i >= 0 && this.kind[i] === 1; }
  height(x: number, z: number): number { const i = this.at(x, z); return i >= 0 ? this.top[i]! : 0; }
  color(x: number, z: number, into: THREE.Color): THREE.Color { const i = this.at(x, z); return i < 0 ? into.setRGB(.2, .36, .14) : into.setRGB(this.rgb[i * 3]! / 255, this.rgb[i * 3 + 1]! / 255, this.rgb[i * 3 + 2]! / 255); }
  get bounds(): { minX: number; minZ: number; maxX: number; maxZ: number } { return { minX: this.minX, minZ: this.minZ, maxX: this.minX + this.cols * this.cell, maxZ: this.minZ + this.rows * this.cell }; }
}

/** True when a point is inside (or within `margin` of) any collision shape. Used to keep grass out of walls and props. */
export function blocked(x: number, z: number, colliders: Collider[], margin: number): boolean {
  for (const shape of colliders) {
    const dx = x - shape.x, dz = z - shape.z;
    if (shape.type === "circle") { const r = shape.radius + margin; if (dx * dx + dz * dz < r * r) return true; continue; }
    const reach = Math.hypot(shape.halfX, shape.halfZ) + margin;
    if (Math.abs(dx) > reach || Math.abs(dz) > reach) continue;
    const c = Math.cos(shape.rot), s = Math.sin(shape.rot);
    if (Math.abs(c * dx - s * dz) < shape.halfX + margin && Math.abs(s * dx + c * dz) < shape.halfZ + margin) return true;
  }
  return false;
}

type Tuft = { x: number; y: number; z: number; yaw: number; size: number; rank: number; tint: number };

const CELL = 3;
const CAPACITY = 2600;
const BLADES = 6;
const TINTS = ["#4a9a40", "#58a84a", "#66b252", "#4f9e5a", "#74b955"].map(hex => new THREE.Color(hex));

// One flat triangle per blade: dark at the root, bright at the tip. Wind bends the tips in the vertex shader.
// Blades stay ankle-high (a character is about .6 tall) so feet remain visible on the ground.
function tuftGeometry(): THREE.BufferGeometry {
  const random = seeded(7), positions: number[] = [], colors: number[] = [], normals: number[] = [];
  const push = (x: number, y: number, z: number, shade: number) => { positions.push(x, y, z); colors.push(shade, shade, shade * .92); normals.push(0, 1, 0); };
  for (let blade = 0; blade < BLADES; blade++) {
    const angle = random() * Math.PI * 2, spread = .045 * Math.sqrt(random()), ox = Math.cos(angle) * spread, oz = Math.sin(angle) * spread;
    const yaw = random() * Math.PI, c = Math.cos(yaw), s = Math.sin(yaw);
    const h = .05 + random() * .04, w = .024 + random() * .012, lean = (random() - .5) * .1;
    const at = (x: number, y: number, bend: number): [number, number, number] => [ox + c * x - s * bend, y, oz + s * x + c * bend];
    const [l, r, tip] = [at(-w, 0, 0), at(w, 0, 0), at(0, h, lean)];
    push(...l, .5); push(...r, .5); push(...tip, 1.4);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

/**
 * Low-poly grass on every walkable cell. All tufts live in one InstancedMesh (one draw call); only the tufts near the
 * view are written into it, so triangle cost follows the screen, not the map.
 */
export class GrassField {
  readonly mesh: THREE.InstancedMesh;
  private cells = new Map<number, Tuft[]>();
  private density = 1;
  private lastX = Infinity;
  private lastZ = Infinity;
  private lastExtent = 0;
  private lastDensity = -1;
  private readonly matrix = new THREE.Matrix4();
  private readonly quaternion = new THREE.Quaternion();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly scale = new THREE.Vector3();
  private readonly point = new THREE.Vector3();
  private readonly color = new THREE.Color();
  total = 0;

  constructor(scene: THREE.Scene, ground: GroundSampler, colliders: Collider[], perUnit = 44) {
    const material = liteMaterial();
    material.vertexColors = true;
    applyWind(material, { amp: .026, height: .1, grass: true });
    this.mesh = new THREE.InstancedMesh(tuftGeometry(), material, CAPACITY);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.name = "grass-field";
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 3), 3); this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
    this.scatter(ground, colliders, perUnit);
  }

  private scatter(ground: GroundSampler, colliders: Collider[], perUnit: number): void {
    const random = seeded(20261110), step = 1 / Math.sqrt(perUnit), b = ground.bounds;
    for (let z = b.minZ; z < b.maxZ; z += step) for (let x = b.minX; x < b.maxX; x += step) {
      const px = x + (random() - .5) * step * 1.7, pz = z + (random() - .5) * step * 1.7, roll = random(), size = random(), yaw = random(), rank = random(), tint = random();
      if (!ground.grass(px, pz)) continue;
      // Slow patchiness: some meadows are lush, some thin.
      const patch = .5 + .5 * Math.sin(px * .31 + Math.sin(pz * .23) * 2) * Math.cos(pz * .27 - px * .11);
      if (roll > .5 + .5 * patch || blocked(px, pz, colliders, .08)) continue;
      const key = Math.floor(px / CELL) * 4099 + Math.floor(pz / CELL);
      const list = this.cells.get(key) ?? []; this.cells.set(key, list);
      list.push({ x: px, y: ground.height(px, pz), z: pz, yaw: yaw * Math.PI * 2, size: .75 + size * .7 * (.6 + .4 * patch), rank, tint: Math.min(TINTS.length - 1, Math.floor(tint * TINTS.length)) });
      this.total++;
    }
  }

  /** `density` 1 on desktop; less on phones, where fill rate matters more than detail. */
  setDensity(value: number): void { this.density = value; }

  update(camera: THREE.OrthographicCamera): void {
    const extent = camera.right - camera.left + camera.top - camera.bottom;
    const moved = Math.hypot(camera.position.x - this.lastX, camera.position.z - this.lastZ);
    if (moved < .18 && Math.abs(extent - this.lastExtent) < .01 && this.density === this.lastDensity) return;
    this.lastX = camera.position.x; this.lastZ = camera.position.z; this.lastExtent = extent; this.lastDensity = this.density;
    // Ground footprint of the view, to know which hash cells to scan.
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    const direction = camera.getWorldDirection(new THREE.Vector3());
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      this.point.set(sx * 1.2, sy * 1.2, 0).unproject(camera);
      const t = -this.point.y / direction.y;
      minX = Math.min(minX, this.point.x + direction.x * t); maxX = Math.max(maxX, this.point.x + direction.x * t);
      minZ = Math.min(minZ, this.point.z + direction.z * t); maxZ = Math.max(maxZ, this.point.z + direction.z * t);
    }
    let n = 0;
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL) && n < CAPACITY; cx++) for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
      const list = this.cells.get(cx * 4099 + cz); if (!list) continue;
      for (const tuft of list) {
        if (tuft.rank > this.density || n >= CAPACITY) continue;
        this.point.set(tuft.x, tuft.y + .1, tuft.z).project(camera);
        if (Math.abs(this.point.x) > 1.12 || Math.abs(this.point.y) > 1.2) continue;
        this.quaternion.setFromAxisAngle(this.up, tuft.yaw);
        this.mesh.setMatrixAt(n, this.matrix.compose(this.point.set(tuft.x, tuft.y, tuft.z), this.quaternion, this.scale.setScalar(tuft.size)));
        this.mesh.setColorAt(n, this.color.copy(TINTS[tuft.tint]!));
        n++;
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

import * as THREE from "three";
import type { Collider } from "../core/world/types";

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
  private readonly kind: Uint8Array; // 0 none, 1 grass, 2 path or stone, 3 water
  private readonly top: Float32Array;
  private readonly rgb: Uint8Array;
  private readonly toPath: Float32Array; // distance in world units to the nearest path or stone cell
  private readonly toWater: Float32Array;
  private readonly toEdge: Float32Array; // distance to the nearest cell with no terrain, or to the edge of the raster

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
    this.toPath = this.distance(i => this.kind[i] === 2); this.toWater = this.distance(i => this.kind[i] === 3); this.toEdge = this.distance((i, ix, iz) => this.kind[i] === 0 || ix === 0 || iz === 0 || ix === this.cols - 1 || iz === this.rows - 1);
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
        this.kind[cell] = y <= -.012 ? 3 : g > r * 1.15 && g > bl * 1.3 ? 1 : 2;
        this.rgb[cell * 3] = Math.min(255, r * 255); this.rgb[cell * 3 + 1] = Math.min(255, g * 255); this.rgb[cell * 3 + 2] = Math.min(255, bl * 255);
      }
    }
  }

  /** Two-pass chamfer distance transform (in world units) from every cell the predicate accepts. */
  private distance(source: (i: number, ix: number, iz: number) => boolean): Float32Array {
    const { cols, rows, cell } = this, d = new Float32Array(cols * rows).fill(1e3);
    for (let iz = 0; iz < rows; iz++) for (let ix = 0; ix < cols; ix++) if (source(iz * cols + ix, ix, iz)) d[iz * cols + ix] = 0;
    const D = 1.4142;
    const relax = (ix: number, iz: number, dx: number, dz: number, w: number) => {
      const x = ix + dx, z = iz + dz;
      if (x < 0 || z < 0 || x >= cols || z >= rows) return;
      const i = iz * cols + ix, v = d[z * cols + x]! + w;
      if (v < d[i]!) d[i] = v;
    };
    for (let iz = 0; iz < rows; iz++) for (let ix = 0; ix < cols; ix++) { relax(ix, iz, -1, 0, 1); relax(ix, iz, 0, -1, 1); relax(ix, iz, -1, -1, D); relax(ix, iz, 1, -1, D); }
    for (let iz = rows - 1; iz >= 0; iz--) for (let ix = cols - 1; ix >= 0; ix--) { relax(ix, iz, 1, 0, 1); relax(ix, iz, 0, 1, 1); relax(ix, iz, 1, 1, D); relax(ix, iz, -1, 1, D); }
    for (let i = 0; i < d.length; i++) d[i] = Math.min(d[i]!, 1e3) * cell;
    return d;
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
  /** Distance in world units to the nearest path or stone surface (large when none is near). */
  pathDistance(x: number, z: number): number { const i = this.at(x, z); return i < 0 ? 0 : this.toPath[i]!; }
  waterDistance(x: number, z: number): number { const i = this.at(x, z); return i < 0 ? 0 : this.toWater[i]!; }
  edgeDistance(x: number, z: number): number { const i = this.at(x, z); return i < 0 ? 0 : this.toEdge[i]!; }
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

/** `blocked` with a spatial hash: each query tests only the shapes near the point. Margins up to `MAX_MARGIN` are exact. */
export class Obstacles {
  static readonly MAX_MARGIN = 1;
  private readonly cells = new Map<number, Collider[]>();
  constructor(colliders: Collider[], private readonly size = 2) {
    for (const shape of colliders) {
      const reach = (shape.type === "circle" ? shape.radius : Math.hypot(shape.halfX, shape.halfZ)) + Obstacles.MAX_MARGIN;
      for (let cx = Math.floor((shape.x - reach) / size); cx <= Math.floor((shape.x + reach) / size); cx++) for (let cz = Math.floor((shape.z - reach) / size); cz <= Math.floor((shape.z + reach) / size); cz++) {
        const key = cx * 4099 + cz, list = this.cells.get(key);
        if (list) list.push(shape); else this.cells.set(key, [shape]);
      }
    }
  }
  blocked(x: number, z: number, margin: number): boolean {
    const list = this.cells.get(Math.floor(x / this.size) * 4099 + Math.floor(z / this.size));
    return !!list && blocked(x, z, list, margin);
  }
}

const BLADES = 6;
export const TINTS = ["#4a9a40", "#58a84a", "#66b252", "#4f9e5a", "#74b955"].map(hex => new THREE.Color(hex));

// One flat triangle per blade: dark at the root, bright at the tip. Wind bends the tips in the vertex shader.
// Blades stay ankle-high (a character is about .6 tall) so feet remain visible on the ground.
export function tuftGeometry(): THREE.BufferGeometry {
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


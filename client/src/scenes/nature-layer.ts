import * as THREE from "three";

// Scatter cells are CELL x CELL world units. Each item is nine floats: x, y, z, yaw, size, rank, r, g, b.
export const CELL = 3;
const STRIDE = 9;
const hash = (cx: number, cz: number) => cx * 4099 + cz;

/** Ground footprint of the camera view (with margin), to know which hash cells to scan. */
export function viewCells(camera: THREE.OrthographicCamera, point: THREE.Vector3): { minX: number; maxX: number; minZ: number; maxZ: number } {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  const direction = camera.getWorldDirection(new THREE.Vector3());
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    point.set(sx * 1.2, sy * 1.2, 0).unproject(camera);
    const t = -point.y / direction.y;
    minX = Math.min(minX, point.x + direction.x * t); maxX = Math.max(maxX, point.x + direction.x * t);
    minZ = Math.min(minZ, point.z + direction.z * t); maxZ = Math.max(maxZ, point.z + direction.z * t);
  }
  return { minX, maxX, minZ, maxZ };
}

/**
 * One InstancedMesh (one draw call) for thousands of static ground details. Items live in a coarse spatial hash;
 * each refresh writes only the ones near the view into the instance buffers, so the triangle count follows the
 * screen rather than the map. Nothing here casts a shadow.
 */
export class ScatterLayer {
  readonly mesh: THREE.InstancedMesh;
  total = 0;
  private pending = new Map<number, number[]>();
  private cells = new Map<number, Float32Array>();
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

  constructor(scene: THREE.Scene, name: string, geometry: THREE.BufferGeometry, material: THREE.Material, readonly capacity: number, private readonly lift = .1) {
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.name = name;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3); this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
  }

  add(x: number, y: number, z: number, yaw: number, size: number, rank: number, color: THREE.Color): void {
    const key = hash(Math.floor(x / CELL), Math.floor(z / CELL));
    let list = this.pending.get(key); if (!list) this.pending.set(key, list = []);
    list.push(x, y, z, yaw, size, rank, color.r, color.g, color.b); this.total++;
  }

  /** Packs the build lists into typed arrays. Call once after the last `add`. */
  seal(): void {
    for (const [key, list] of this.pending) this.cells.set(key, Float32Array.from(list));
    this.pending.clear(); this.lastDensity = -1;
  }

  /** Items carry a random rank in [0, 1]; only those at or under `value` are drawn. */
  setDensity(value: number): void { this.density = value; }

  update(camera: THREE.OrthographicCamera): void {
    const extent = camera.right - camera.left + camera.top - camera.bottom;
    // The view margin is about half a unit, so a refresh every .3 units of camera travel never shows an edge.
    if (Math.hypot(camera.position.x - this.lastX, camera.position.z - this.lastZ) < .3 && Math.abs(extent - this.lastExtent) < .01 && this.density === this.lastDensity) return;
    this.lastX = camera.position.x; this.lastZ = camera.position.z; this.lastExtent = extent; this.lastDensity = this.density;
    const { minX, maxX, minZ, maxZ } = viewCells(camera, this.point);
    const cap = this.capacity;
    let n = 0;
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL) && n < cap; cx++) for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
      const list = this.cells.get(hash(cx, cz)); if (!list) continue;
      for (let i = 0; i < list.length && n < cap; i += STRIDE) {
        if (list[i + 5]! > this.density) continue;
        const x = list[i]!, y = list[i + 1]!, z = list[i + 2]!;
        this.point.set(x, y + this.lift, z).project(camera);
        if (Math.abs(this.point.x) > 1.12 || Math.abs(this.point.y) > 1.2) continue;
        this.quaternion.setFromAxisAngle(this.up, list[i + 3]!);
        this.mesh.setMatrixAt(n, this.matrix.compose(this.point.set(x, y, z), this.quaternion, this.scale.setScalar(list[i + 4]!)));
        this.mesh.setColorAt(n, this.color.setRGB(list[i + 6]!, list[i + 7]!, list[i + 8]!));
        n++;
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

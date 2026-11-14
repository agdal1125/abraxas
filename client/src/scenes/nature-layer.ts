import * as THREE from "three";

// Scatter cells are CELL x CELL world units. Each item is nine floats: x, y, z, yaw, size, rank, r, g, b.
export const CELL = 3;
const STRIDE = 9;
// Ranks are cut into this many equal steps. A view that holds more items than the capacity drops the highest steps,
// so what stays on screen is an even sample of the field, not whichever cells were scanned first. Steps are fine, so
// dropping or adding one changes only a small share of what is drawn.
const STEPS = 256;
// A dropped step comes back only while the view stays under this share of the capacity, a few steps per refresh, so a
// count that rises and falls a little as the camera walks does not switch the same items back and forth.
const REGROW = .9;
const REGROW_STEPS = 4;
// The view margin a phone screen gets, in view units. Larger screens keep the same margin instead of the same share of
// the view, so a layer at its capacity spends it on screen rather than on a wide band around it. Items are tested at
// their lifted point, which sits higher on screen than their base by lift * cos(35deg), so the margin up and down
// adds that much.
const MARGIN_ACROSS = .51;
const MARGIN_UP = .39;
const HEIGHT_ON_SCREEN = Math.cos(THREE.MathUtils.degToRad(35));
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
 * screen rather than the map. A large screen can see more items than the capacity; the view is then thinned evenly
 * by rank. Nothing here casts a shadow.
 */
export class ScatterLayer {
  readonly mesh: THREE.InstancedMesh;
  total = 0;
  private pending = new Map<number, number[]>();
  private cells = new Map<number, Float32Array>();
  private density = 1;
  private lastX = Infinity;
  private lastZ = Infinity;
  private lastWidth = 0;
  private lastHeight = 0;
  private lastDensity = -1;
  private steps = STEPS;
  private readonly counts = new Uint32Array(STEPS);
  private seenCells: Float32Array[] = [];
  private seenAt = new Int32Array(0);
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
    this.seenCells = new Array<Float32Array>(this.total); this.seenAt = new Int32Array(this.total);
  }

  /** Items carry a random rank in [0, 1]; only those under `value` are drawn. */
  setDensity(value: number): void { this.density = value; }

  update(camera: THREE.OrthographicCamera): void {
    const width = camera.right - camera.left, height = camera.top - camera.bottom;
    const resized = Math.abs(width - this.lastWidth) >= .01 || Math.abs(height - this.lastHeight) >= .01 || this.density !== this.lastDensity;
    // Between refreshes the camera travels under .3 units, less than the view margin for items near the ground.
    if (!resized && Math.hypot(camera.position.x - this.lastX, camera.position.z - this.lastZ) < .3) return;
    if (resized) this.steps = STEPS;
    this.lastX = camera.position.x; this.lastZ = camera.position.z; this.lastWidth = width; this.lastHeight = height; this.lastDensity = this.density;
    const { minX, maxX, minZ, maxZ } = viewCells(camera, this.point);
    const limitX = 1 + Math.min(.12, 2 * MARGIN_ACROSS / width), limitY = 1 + Math.min(.2, 2 * (MARGIN_UP + this.lift * HEIGHT_ON_SCREEN) / height);
    // First pass: the items in view, up to a few rank steps past those drawn now, counted per step.
    const counts = this.counts.fill(0), scan = Math.min(STEPS, this.steps + REGROW_STEPS), perStep = STEPS / this.density;
    let seen = 0;
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++) for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
      const list = this.cells.get(hash(cx, cz)); if (!list) continue;
      for (let i = 0; i < list.length; i += STRIDE) {
        const step = Math.floor(list[i + 5]! * perStep);
        if (step >= scan) continue;
        this.point.set(list[i]!, list[i + 1]! + this.lift, list[i + 2]!).project(camera);
        if (Math.abs(this.point.x) > limitX || Math.abs(this.point.y) > limitY) continue;
        counts[step] = counts[step]! + 1;
        this.seenCells[seen] = list; this.seenAt[seen++] = i;
      }
    }
    let kept = 0;
    for (let k = 0; k < this.steps; k++) kept += counts[k]!;
    while (kept > this.capacity) kept -= counts[--this.steps]!;
    while (this.steps < scan && kept + counts[this.steps]! <= this.capacity * REGROW) kept += counts[this.steps++]!;
    // Second pass: write the kept items.
    let n = 0;
    for (let j = 0; j < seen; j++) {
      const list = this.seenCells[j]!, i = this.seenAt[j]!;
      if (Math.floor(list[i + 5]! * perStep) >= this.steps) continue;
      this.quaternion.setFromAxisAngle(this.up, list[i + 3]!);
      this.mesh.setMatrixAt(n, this.matrix.compose(this.point.set(list[i]!, list[i + 1]!, list[i + 2]!), this.quaternion, this.scale.setScalar(list[i + 4]!)));
      this.mesh.setColorAt(n, this.color.setRGB(list[i + 6]!, list[i + 7]!, list[i + 8]!));
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

import * as THREE from "three";

type Loaded = { scene: THREE.Object3D; scale: number };
type Item = { x: number; z: number; start: number; count: number };
type Placed = { asset: string; x: number; z: number; rot?: number; scale?: number };

const MARGIN = 1.2;

/**
 * Static roadside rocks, pebbles, and fence pieces. Every piece is pre-transformed once; each refresh copies only the
 * pieces near the view into one shared buffer. So the whole set costs one draw call (plus one in the shadow pass)
 * and the triangle count follows the screen, however many pieces the map holds.
 */
export class SceneryField {
  readonly mesh: THREE.Mesh;
  private readonly items: Item[] = [];
  private readonly source: { position: Float32Array; normal: Float32Array; color: Float32Array };
  private readonly live: { position: THREE.BufferAttribute; normal: THREE.BufferAttribute; color: THREE.BufferAttribute };
  private readonly point = new THREE.Vector3();
  private lastX = Infinity;
  private lastZ = Infinity;
  private lastExtent = 0;
  vertices = 0;

  private constructor(scene: THREE.Scene, pieces: { x: number; z: number; position: number[]; normal: number[]; color: number[] }[], material: THREE.Material) {
    const total = pieces.reduce((sum, piece) => sum + piece.position.length / 3, 0);
    this.source = { position: new Float32Array(total * 3), normal: new Float32Array(total * 3), color: new Float32Array(total * 3) };
    let at = 0;
    for (const piece of pieces) {
      const count = piece.position.length / 3;
      this.source.position.set(piece.position, at * 3); this.source.normal.set(piece.normal, at * 3); this.source.color.set(piece.color, at * 3);
      this.items.push({ x: piece.x, z: piece.z, start: at, count }); at += count;
    }
    const geometry = new THREE.BufferGeometry();
    const attribute = (size: number) => new THREE.BufferAttribute(new Float32Array(total * size), size).setUsage(THREE.DynamicDrawUsage);
    this.live = { position: attribute(3), normal: attribute(3), color: attribute(3) };
    geometry.setAttribute("position", this.live.position); geometry.setAttribute("normal", this.live.normal); geometry.setAttribute("color", this.live.color);
    geometry.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false; this.mesh.castShadow = true; this.mesh.receiveShadow = true; this.mesh.name = "scenery";
    scene.add(this.mesh);
  }

  static async build(scene: THREE.Scene, props: Placed[], load: (asset: string) => Promise<Loaded>): Promise<SceneryField | undefined> {
    const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), normals = new THREE.Matrix3();
    const pieces: { x: number; z: number; position: number[]; normal: number[]; color: number[] }[] = [];
    let material: THREE.Material | undefined;
    for (const prop of props) {
      const { scene: model, scale } = await load(prop.asset);
      model.updateMatrixWorld(true);
      const placement = new THREE.Matrix4().compose(new THREE.Vector3(prop.x, 0, prop.z), quaternion.setFromAxisAngle(up, prop.rot ?? 0), new THREE.Vector3().setScalar(scale * (prop.scale ?? 1)));
      const piece = { x: prop.x, z: prop.z, position: [] as number[], normal: [] as number[], color: [] as number[] };
      model.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        material ??= child.material as THREE.Material;
        const flat = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
        if (!flat.getAttribute("normal")) flat.computeVertexNormals();
        matrix.multiplyMatrices(placement, child.matrixWorld); normals.getNormalMatrix(matrix);
        const position = flat.getAttribute("position"), normal = flat.getAttribute("normal"), color = flat.getAttribute("color"), v = new THREE.Vector3();
        for (let i = 0; i < position.count; i++) {
          v.fromBufferAttribute(position, i).applyMatrix4(matrix); piece.position.push(v.x, v.y, v.z);
          v.fromBufferAttribute(normal, i).applyMatrix3(normals).normalize(); piece.normal.push(v.x, v.y, v.z);
          if (color) piece.color.push(color.getX(i), color.getY(i), color.getZ(i)); else piece.color.push(1, 1, 1);
        }
      });
      if (piece.position.length) pieces.push(piece);
    }
    return material && pieces.length ? new SceneryField(scene, pieces, material) : undefined;
  }

  update(camera: THREE.OrthographicCamera): void {
    const extent = camera.right - camera.left + camera.top - camera.bottom;
    if (Math.hypot(camera.position.x - this.lastX, camera.position.z - this.lastZ) < .18 && Math.abs(extent - this.lastExtent) < .01) return;
    this.lastX = camera.position.x; this.lastZ = camera.position.z; this.lastExtent = extent;
    let at = 0;
    for (const item of this.items) {
      this.point.set(item.x, .2, item.z).project(camera);
      if (Math.abs(this.point.x) > MARGIN || Math.abs(this.point.y) > MARGIN) continue;
      for (const [key, attribute] of Object.entries(this.live) as [keyof typeof this.live, THREE.BufferAttribute][]) {
        (attribute.array as Float32Array).set(this.source[key].subarray(item.start * 3, (item.start + item.count) * 3), at * 3);
      }
      at += item.count;
    }
    this.vertices = at;
    this.mesh.geometry.setDrawRange(0, at);
    for (const attribute of Object.values(this.live)) attribute.needsUpdate = true;
  }
}

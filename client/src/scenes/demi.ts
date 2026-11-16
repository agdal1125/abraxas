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

const MODEL_SCALE = .31;
const hash = (a: number, b: number, seed: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7 + seed * 53.3) * 43758.5453;
  return s - Math.floor(s);
};

// [centre x, y, z, radius along `side`, the other radius]
type Ring = readonly [number, number, number, number, number];
interface LoftOptions { sides: number; side?: readonly [number, number, number]; jitter?: number; seed: number }

// Inserts a smoothed ring between each pair, so forms stay rounded while the facets get smaller.
function refine(rings: readonly Ring[]): Ring[] {
  const at = (i: number) => rings[Math.max(0, Math.min(rings.length - 1, i))]!;
  const out: Ring[] = [];
  rings.forEach((ring, i) => {
    out.push(ring);
    if (i === rings.length - 1) return;
    const a = at(i - 1), b = ring, c = at(i + 1), d = at(i + 2);
    const mid = (k: number) => (-a[k]! + 9 * b[k]! + 9 * c[k]! - d[k]!) / 16;
    out.push([mid(0), mid(1), mid(2), Math.max(.004, mid(3)), Math.max(.004, mid(4))]);
  });
  return out;
}

// Keeps the facets readable but blends each normal toward its neighbours, so the fold lines read soft.
function softenNormals(geometry: THREE.BufferGeometry, softness: number): void {
  geometry.computeVertexNormals();
  const position = geometry.getAttribute("position"), normal = geometry.getAttribute("normal");
  const sums = new Map<string, THREE.Vector3>();
  const key = (i: number) => `${position.getX(i).toFixed(4)},${position.getY(i).toFixed(4)},${position.getZ(i).toFixed(4)}`;
  const face = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    face.fromBufferAttribute(normal, i);
    const k = key(i);
    if (!sums.has(k)) sums.set(k, new THREE.Vector3());
    sums.get(k)!.add(face);
  }
  const blended = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    blended.fromBufferAttribute(normal, i).lerp(sums.get(key(i))!.clone().normalize(), softness).normalize();
    normal.setXYZ(i, blended.x, blended.y, blended.z);
  }
  normal.needsUpdate = true;
}

// Skins n-sided rings into small flat facets. Rings twist half a step so quads fold like paper.
function loft(rawRings: readonly Ring[], { sides, side = [0, 0, 1], jitter = .035, seed }: LoftOptions): THREE.BufferGeometry {
  const rings = refine(rawRings);
  const centres = rings.map(r => new THREE.Vector3(r[0], r[1], r[2]));
  const axis = new THREE.Vector3(...side);
  const grid = rings.map((ring, i) => {
    const tangent = centres[Math.min(i + 1, rings.length - 1)]!.clone().sub(centres[Math.max(i - 1, 0)]!).normalize();
    const u = axis.clone().addScaledVector(tangent, -axis.dot(tangent)).normalize();
    const v = new THREE.Vector3().crossVectors(tangent, u);
    return Array.from({ length: sides }, (_, k) => {
      const angle = ((k + (i % 2) * .5) / sides) * Math.PI * 2;
      const grow = 1 + (hash(i, k, seed) - .5) * 2 * jitter;
      return centres[i]!.clone().addScaledVector(u, Math.cos(angle) * ring[3] * grow).addScaledVector(v, Math.sin(angle) * ring[4] * grow);
    });
  });
  const positions: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => positions.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
  for (let i = 0; i < grid.length - 1; i++) {
    for (let k = 0; k < sides; k++) {
      const next = (k + 1) % sides, a = grid[i]![k]!, b = grid[i]![next]!, c = grid[i + 1]![k]!, d = grid[i + 1]![next]!;
      if (i % 2 === 0) { tri(a, c, b); tri(b, c, d); } else { tri(a, c, d); tri(a, d, b); }
    }
  }
  const first = grid[0]!, last = grid[grid.length - 1]!, start = centres[0]!, end = centres[centres.length - 1]!;
  for (let k = 0; k < sides; k++) {
    tri(start, first[k]!, first[(k + 1) % sides]!);
    tri(end, last[(k + 1) % sides]!, last[k]!);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  softenNormals(geometry, .55);
  return geometry;
}

interface DemiRig {
  root: THREE.Group; body: THREE.Group; head: THREE.Group; jaw: THREE.Group; tail: THREE.Group;
  legs: THREE.Group[]; ears: { pivot: THREE.Group; side: number }[];
}

// The white puppy of the opening film. The model faces +x and stands on y = 0.
function buildModel(): DemiRig {
  const fur = new THREE.MeshStandardMaterial({ color: "#fff8f2", roughness: 1, emissive: "#fff4ea", emissiveIntensity: .16 });
  const black = new THREE.MeshBasicMaterial({ color: "#1a1618" });
  const tongueColor = new THREE.MeshStandardMaterial({ color: "#f08aa2", roughness: .8 });
  const mouthColor = new THREE.MeshStandardMaterial({ color: "#5a2a36", roughness: 1 });
  let seed = 1;
  const group = (parent: THREE.Object3D, x: number, y: number, z: number) => {
    const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g;
  };
  const part = (parent: THREE.Object3D, rings: readonly Ring[], options: Omit<LoftOptions, "seed">, material: THREE.Material = fur) => {
    const mesh = new THREE.Mesh(loft(rings, { ...options, seed: seed++ }), material);
    mesh.castShadow = true; parent.add(mesh); return mesh;
  };

  const root = new THREE.Group();
  const body = group(root, 0, .335, 0);
  part(body, [[-.36, .03, 0, .06, .07], [-.29, .02, 0, .18, .19], [-.1, .02, 0, .205, .205], [.09, .035, 0, .21, .225], [.235, .05, 0, .165, .2], [.3, .06, 0, .05, .08]], { sides: 9 });
  part(body, [[.12, .08, 0, .11, .11], [.2, .2, 0, .145, .125], [.26, .29, 0, .1, .09]], { sides: 8, jitter: .025 });

  const leg = (x: number, z: number, hind: boolean) => {
    const hip = group(body, x, -.03, z), top = hind ? .135 : .1;
    part(hip, [[0, .09, 0, top * .7, top * .8], [0, 0, 0, top, top * 1.15], [0, -.14, 0, .082, .085], [0, -.25, 0, .074, .078], [0, -.3, 0, .03, .03]], { sides: 7, side: [1, 0, 0] });
    part(hip, [[-.06, -.272, 0, .055, .03], [0, -.272, 0, .09, .04], [.08, -.282, 0, .074, .028], [.12, -.288, 0, .022, .012]], { sides: 6, jitter: .02 });
    return hip;
  };
  const legs = [leg(.18, .1, false), leg(.18, -.1, false), leg(-.24, .115, true), leg(-.24, -.115, true)];

  const tail = group(body, -.32, .12, 0);
  part(tail, [[.02, -.03, 0, .04, .04], [-.05, .08, 0, .075, .08], [-.04, .22, 0, .1, .1], [.06, .28, 0, .075, .08], [.14, .22, 0, .03, .03]], { sides: 7 });

  const head = group(body, .27, .235, 0);
  const skull = part(head, [[-.2, .13, 0, .09, .09], [-.14, .13, 0, .19, .185], [0, .14, 0, .245, .225], [.13, .12, 0, .225, .2], [.2, .065, 0, .125, .105], [.28, .05, 0, .09, .07], [.325, .05, 0, .04, .034]], { sides: 11, jitter: .025 });

  // Eyes are flat polygons laid on the skull's actual surface, so they never bulge out of it.
  const ray = new THREE.Raycaster();
  const inward = new THREE.Vector3(), from = new THREE.Vector3(), up = new THREE.Vector3(0, 0, 1);
  for (const sign of [1, -1]) {
    inward.set(.86, .17, .4 * sign).normalize();
    from.set(0, .1, 0).addScaledVector(inward, 2);
    ray.set(from, inward.clone().negate());
    const hit = ray.intersectObject(skull)[0]!;
    const shape = new THREE.CircleGeometry(.03, 8); shape.scale(.92, 1.12, 1);
    const eye = new THREE.Mesh(shape, black);
    eye.position.copy(hit.point).addScaledVector(hit.face!.normal, .004);
    eye.quaternion.setFromUnitVectors(up, hit.face!.normal);
    eye.rotateZ(sign * .28);
    head.add(eye);
  }
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(.04, .024, .036, 7), black);
  nose.position.set(.312, .074, 0); nose.rotation.z = -1.25; head.add(nose);

  const jaw = group(head, .2, 0, 0);
  part(jaw, [[-.03, 0, 0, .09, .03], [.05, -.005, 0, .082, .035], [.11, -.005, 0, .05, .02]], { sides: 7, jitter: .015 });
  part(jaw, [[.02, .022, 0, .066, .016], [.095, .018, 0, .042, .012]], { sides: 6, jitter: 0 }, mouthColor);
  part(jaw, [[.05, .03, 0, .042, .014], [.1, .024, 0, .05, .016], [.135, 0, 0, .034, .012]], { sides: 6, jitter: 0 }, tongueColor);

  const ears = [1, -1].map(sign => {
    const pivot = group(head, -.01, .275, .165 * sign);
    pivot.rotation.x = -.06 * sign;
    part(pivot, [[0, .015, .01 * sign, .05, .03], [0, -.05, .055 * sign, .115, .055], [.005, -.17, .075 * sign, .12, .055], [.015, -.27, .07 * sign, .065, .03]], { sides: 7, side: [1, 0, 0], jitter: .04 });
    return { pivot, side: sign };
  });

  root.rotation.y = -Math.PI / 2; // the game faces actors along +z
  root.scale.setScalar(MODEL_SCALE);
  return { root, body, head, jaw, tail, legs, ears };
}

const SIT_ANGLE = .72;

export class Demi {
  readonly object = new THREE.Group();
  private mode: DemiMode = "hidden";
  private trail: Vec2[] = [];
  private last: Vec2;
  private rig = buildModel();
  private time = 0;

  constructor(position: Vec2) {
    this.object.add(this.rig.root);
    this.last = { ...position }; this.reset(position); this.object.visible = false;
  }

  reset(position: Vec2): void {
    this.object.position.set(position.x, 0, position.z); this.last = { ...position }; this.trail = [];
  }

  setMode(mode: DemiMode, position: Vec2): void {
    if (mode === this.mode) return;
    this.mode = mode; this.object.visible = mode !== "hidden";
    this.trail = []; this.last = { ...position };
    this.pose(mode === "sit" || mode === "gate");
  }

  private pose(sitting: boolean): void {
    const { body, head, tail, legs, jaw } = this.rig, up = sitting ? SIT_ANGLE : 0;
    body.rotation.z = up;
    body.position.set(sitting ? -.02 : 0, sitting ? .29 : .335, 0);
    head.rotation.z = -up + (sitting ? .05 : 0);
    tail.rotation.z = sitting ? -1 : 0;
    jaw.rotation.z = 0;
    legs.forEach((leg, index) => { leg.rotation.z = index < 2 ? -up : -up - (sitting ? .72 : 0); });
  }

  update(position: Vec2, dt: number): void {
    this.time += dt;
    this.idle();
    if (this.mode !== "follow") return;
    const distance = Math.hypot(position.x - this.last.x, position.z - this.last.z);
    if (distance > 2) { this.reset(position); return; }
    if (distance > .025) { this.trail.push({ ...position }); this.last = { ...position }; }
    if (this.trail.length < 2 || Math.hypot(position.x - this.object.position.x, position.z - this.object.position.z) < .45) { this.rest(); return; }
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
    const stride = this.time * 12;
    this.rig.legs.forEach((leg, index) => { leg.rotation.z = Math.sin(stride + (index === 0 || index === 3 ? 0 : Math.PI)) * .5; });
    this.rig.root.position.y = Math.abs(Math.sin(stride)) * .012;
    this.rig.head.rotation.z = Math.sin(stride * 2) * .035;
    for (const { pivot } of this.rig.ears) pivot.rotation.z = Math.sin(stride - .6) * .14;
  }

  // Tail and breath keep going in every visible mode.
  private idle(): void {
    if (this.mode === "hidden") return;
    this.rig.tail.rotation.x = Math.sin(this.time * 9) * .35;
    this.rig.jaw.rotation.z = -.04 - Math.max(0, Math.sin(this.time * 4)) * .05;
  }

  private rest(): void {
    this.rig.legs.forEach(leg => { leg.rotation.z *= .8; });
    this.rig.root.position.y = 0;
    this.rig.head.rotation.z *= .8;
    for (const { pivot } of this.rig.ears) pivot.rotation.z *= .8;
  }
}

import * as THREE from "three";
import type { Vec2 } from "../core/world/types";
import { seeded } from "./nature-grass";

const WATER_Y = -.072; // the baked lake surface is at -0.08; this film sits a hair above it
const MAX_RINGS = 8;

const vertexShader = /* glsl */`
varying vec2 vXZ;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.);
  vXZ = world.xz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

// Thin bright ripple lines, twinkling glints, soft light and dark swell, and rings spreading from the lily pads and reeds.
const fragmentShader = /* glsl */`
precision highp float;
varying vec2 vXZ;
uniform float uTime;
uniform vec3 uRings[${MAX_RINGS}];
uniform vec3 uLight;
uniform vec3 uDark;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 p = vXZ;
  float swell = (sin(p.x * 2.3 + p.y * 1.7 + uTime * .7) + sin(p.x * -1.9 + p.y * 3.1 - uTime * .9) + sin((p.x + p.y) * 4.1 + uTime * 1.3)) / 3.;
  float lines = sin(p.y * 11. + sin(p.x * 1.7 + uTime * .5) * 1.5 + uTime * .9) * (.5 + .5 * sin(p.x * 2.3 + sin(p.y * 1.3) * 2. + uTime * .35));
  float line = smoothstep(.78, .95, lines);
  vec2 grid = p * 13.;
  vec2 id = floor(grid);
  float h = hash(id);
  float twinkle = step(.955, h) * (sin(uTime * (2. + h * 4.) + h * 60.) * .5 + .5);
  float glint = smoothstep(.34, .02, length(fract(grid) - .5)) * twinkle;
  float ring = 0.;
  for (int i = 0; i < ${MAX_RINGS}; i++) {
    vec3 r = uRings[i];
    float age = fract(uTime * .24 + r.z);
    float d = length(p - r.xy);
    ring += smoothstep(.04, .0, abs(d - age * .6)) * (1. - age) * (1. - age);
  }
  float lightA = clamp(line * .55 + glint * 1.1 + ring * .85 + max(swell, 0.) * .16, 0., .95);
  float darkA = max(-swell, 0.) * .2;
  float a = lightA + darkA;
  gl_FragColor = vec4((uLight * lightA + uDark * darkA) / max(a, 1e-3), min(a, .95));
  #include <colorspace_fragment>
}`;

function padGeometry(): THREE.BufferGeometry {
  // A flat 7-sided lily pad with a notch cut out.
  const positions: number[] = [], colors: number[] = [], normals: number[] = [];
  const sides = 7;
  for (let i = 0; i < sides; i++) {
    const a0 = (i + .45) / sides * Math.PI * 2, a1 = (i + 1.45) / sides * Math.PI * 2, shade = i % 2 ? .9 : 1.08;
    for (const [x, z, s] of [[0, 0, 1.15], [Math.cos(a0) * .1, Math.sin(a0) * .1, shade], [Math.cos(a1) * .1, Math.sin(a1) * .1, shade]] as const) { positions.push(x, 0, z); colors.push(.42 * s, .78 * s, .3 * s); normals.push(0, 1, 0); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

type Drifter = { object: THREE.Object3D; x: number; y: number; z: number; yaw: number; phase: number; reach: number };
type Pad = { x: number; z: number; yaw: number; size: number; phase: number };

/** The lake: a shimmering film over the baked water, drifting pads, and bobbing lilies and reeds. */
export class LakeWater {
  private readonly uniforms = { uTime: { value: 0 }, uRings: { value: Array.from({ length: MAX_RINGS }, () => new THREE.Vector3(1e4, 1e4, 0)) }, uLight: { value: new THREE.Color("#e9fff8") }, uDark: { value: new THREE.Color("#2f7f86") } };
  private readonly floaters: Drifter[] = [];
  private readonly pads: Pad[] = [];
  private readonly padMesh: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly ringSources: Vec2[] = [];
  private time = 0;

  constructor(scene: THREE.Scene, shore: Vec2[], center: Vec2) {
    const shape = new THREE.Shape(shore.map(point => new THREE.Vector2(point.x, -point.z)));
    const film = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
    film.rotation.x = -Math.PI / 2; film.position.y = WATER_Y; film.renderOrder = 1; film.name = "lake-film";
    scene.add(film);
    // Loose pads and leaves scattered on the open water, away from the shore.
    const random = seeded(31), inside = (x: number, z: number) => pointInside(shore, x, z) && distanceToEdge(shore, x, z) > .55;
    for (let tries = 0; tries < 400 && this.pads.length < 9; tries++) {
      const x = center.x + (random() - .5) * 8.4, z = center.z + (random() - .5) * 5.8;
      if (inside(x, z)) this.pads.push({ x, z, yaw: random() * 6.28, size: .55 + random() * .6, phase: random() * 6.28 });
    }
    this.padMesh = new THREE.InstancedMesh(padGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), Math.max(1, this.pads.length));
    this.padMesh.name = "lake-pads";
    this.padMesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(center.x, WATER_Y, center.z), 6); scene.add(this.padMesh);
  }

  /** Lily and reed props placed from the map: they bob in place and each one sheds ripple rings. */
  adopt(object: THREE.Object3D, asset: "water-flower" | "water-reed"): void {
    const lily = asset === "water-flower";
    this.floaters.push({ object, x: object.position.x, y: object.position.y, z: object.position.z, yaw: object.rotation.y, phase: object.position.x * 1.7 + object.position.z * 2.3, reach: lily ? .05 : 0 });
    if (this.ringSources.length < MAX_RINGS) this.ringSources.push({ x: object.position.x, z: object.position.z });
    this.ringSources.forEach((source, i) => this.uniforms.uRings.value[i]!.set(source.x, source.z, i * .37 + (i % 3) * .11));
  }

  update(dt: number, animate: boolean): void {
    if (animate) this.time += dt;
    const t = this.time;
    this.uniforms.uTime.value = t;
    for (const f of this.floaters) {
      f.object.position.set(f.x + Math.sin(t * .17 + f.phase) * f.reach, f.y + Math.sin(t * 1.3 + f.phase) * .006, f.z + Math.cos(t * .13 + f.phase * 1.7) * f.reach);
      f.object.rotation.set(Math.sin(t * 1.1 + f.phase) * .035, f.yaw + (f.reach ? Math.sin(t * .21 + f.phase) * .16 : Math.sin(t * .6 + f.phase) * .02), Math.cos(t * .9 + f.phase) * .035);
    }
    this.pads.forEach((pad, i) => {
      this.dummy.position.set(pad.x + Math.sin(t * .11 + pad.phase) * .28, WATER_Y + .012 + Math.sin(t * 1.2 + pad.phase) * .004, pad.z + Math.cos(t * .09 + pad.phase * 1.3) * .2);
      this.dummy.rotation.set(Math.sin(t + pad.phase) * .03, pad.yaw + Math.sin(t * .17 + pad.phase) * .25, 0);
      this.dummy.scale.setScalar(pad.size); this.dummy.updateMatrix();
      this.padMesh.setMatrixAt(i, this.dummy.matrix);
    });
    this.padMesh.instanceMatrix.needsUpdate = true;
  }
}

function pointInside(poly: Vec2[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!, b = poly[j]!;
    if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

function distanceToEdge(poly: Vec2[], x: number, z: number): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!, b = poly[j]!, dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
  }
  return best;
}

import * as THREE from "three";
import type { Collider, Vec2 } from "../core/world/types";
import { blocked, seeded, type GroundSampler } from "./nature-grass";

type Vertex = [number, number, number];

/** Collects flat-shaded triangles with a per-vertex color and wing weight. */
class Mesher {
  positions: number[] = []; colors: number[] = []; wings: number[] = [];
  tri(a: Vertex, b: Vertex, c: Vertex, color: Vertex, wing: [number, number, number] = [0, 0, 0]): this {
    [a, b, c].forEach((v, i) => { this.positions.push(...v); this.colors.push(...color); this.wings.push(wing[i]!); });
    return this;
  }
  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setAttribute("aWing", new THREE.Float32BufferAttribute(this.wings, 1));
    geometry.computeVertexNormals();
    return geometry;
  }
}

// Linear-space colors (vertex colors are not converted by three).
const BROWN: Vertex = [.2, .09, .04], CREAM: Vertex = [.62, .5, .36], DARK: Vertex = [.07, .04, .03], BEAK: Vertex = [.85, .38, .05];

function birdGeometry(): THREE.BufferGeometry {
  const m = new Mesher();
  const F: Vertex = [0, .034, .075], B: Vertex = [0, .04, -.07], T: Vertex = [0, .09, .005], D: Vertex = [0, .004, 0], L: Vertex = [-.048, .04, 0], R: Vertex = [.048, .04, 0];
  for (const [a, b] of [[F, R], [R, B], [B, L], [L, F]] as const) m.tri(T, a, b, BROWN).tri(D, b, a, CREAM);
  const h: Vertex = [0, .08, .068], r = .03;
  const ring: Vertex[] = [[h[0] + r, h[1], h[2]], [h[0], h[1], h[2] + r], [h[0] - r, h[1], h[2]], [h[0], h[1], h[2] - r]];
  for (let i = 0; i < 4; i++) m.tri([h[0], h[1] + r, h[2]], ring[i]!, ring[(i + 1) % 4]!, BROWN).tri([h[0], h[1] - r * .8, h[2]], ring[(i + 1) % 4]!, ring[i]!, CREAM);
  m.tri([0, .078, .126], [-.011, .086, .1], [.011, .086, .1], BEAK).tri([0, .078, .126], [-.011, .086, .1], [0, .07, .1], BEAK).tri([0, .078, .126], [.011, .086, .1], [0, .07, .1], BEAK);
  m.tri([0, .046, -.06], [-.026, .04, -.135], [.026, .04, -.135], DARK);
  for (const s of [-1, 1]) {
    const rootF: Vertex = [s * .045, .06, .035], rootB: Vertex = [s * .045, .055, -.035], tipF: Vertex = [s * .15, .062, .02], tipB: Vertex = [s * .12, .058, -.075];
    m.tri(rootF, tipF, tipB, DARK, [0, 1, .85]).tri(rootF, tipB, rootB, BROWN, [0, .85, 0]);
  }
  return m.build();
}

function butterflyGeometry(): THREE.BufferGeometry {
  const m = new Mesher(), body: Vertex = [.12, .1, .1];
  m.tri([0, .007, .045], [0, .007, -.04], [-.007, 0, -.035], body).tri([0, .007, .045], [0, .007, -.04], [.007, 0, -.035], body);
  for (const s of [-1, 1]) {
    m.tri([s * .008, 0, .02], [s * .09, 0, .045], [s * .075, 0, -.01], [1, 1, 1], [1, 1, 1]).tri([s * .008, 0, .02], [s * .075, 0, -.01], [s * .008, 0, -.01], [.8, .8, .8], [1, 1, 1]);
    m.tri([s * .008, 0, -.005], [s * .07, 0, -.012], [s * .045, 0, -.065], [.9, .9, .9], [1, 1, 1]).tri([s * .008, 0, -.005], [s * .045, 0, -.065], [s * .008, 0, -.04], [.7, .7, .7], [1, 1, 1]);
  }
  return m.build();
}

// Wings fold in and flap in the vertex shader, driven by one per-instance vec2: (flap phase, wing spread 0..1).
function faunaMaterial(kind: "bird" | "butterfly"): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true });
  material.customProgramCacheKey = () => `nature-${kind}`;
  material.onBeforeCompile = shader => {
    const motion = kind === "bird"
      ? `if (aWing > .01) { float s = sign(position.x); transformed.x = s * mix(.054, abs(position.x), aFlap.y); transformed.y += aWing * sin(aFlap.x) * .1 * aFlap.y; transformed.z += aWing * (1. - aFlap.y) * -.03; }`
      : `float a = sin(aFlap.x) * .95; float ax = abs(position.x); transformed.x = sign(position.x) * ax * cos(a); transformed.y += ax * sin(a);`;
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nattribute float aWing;\nattribute vec2 aFlap;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${motion}`);
  };
  return material;
}

function flyerMesh(scene: THREE.Scene, kind: "bird" | "butterfly", capacity: number, name: string): THREE.InstancedMesh {
  const geometry = kind === "bird" ? birdGeometry() : butterflyGeometry();
  geometry.setAttribute("aFlap", new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2).setUsage(THREE.DynamicDrawUsage));
  const mesh = new THREE.InstancedMesh(geometry, faunaMaterial(kind), capacity);
  mesh.frustumCulled = false; mesh.name = name; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
  scene.add(mesh);
  return mesh;
}

type Rest = { home: THREE.Vector3; yaw: number; state: "perched" | "flying" | "gone"; time: number; velocity: THREE.Vector3; peck: number; nextPeck: number; turnAt: number; phase: number; position: THREE.Vector3; heading: number };
type Flock = { start: THREE.Vector3; end: THREE.Vector3; time: number; duration: number; offsets: THREE.Vector3[] };

const FLOCK_SLOTS = 5;
const SCARE_RADIUS = 1.7;
// The models are modeled at sparrow size; at game zoom that is a handful of pixels, so draw them larger.
const BIRD_SCALE = 2;

/**
 * Small birds that sit in the grass and burst into flight when the player walks up to them, plus the odd flock crossing the sky.
 * Nothing here looks at dialogue, choices, or results: the only trigger is how close the player is.
 */
export class Birds {
  private readonly mesh: THREE.InstancedMesh;
  private readonly resting: Rest[] = [];
  private flock?: Flock;
  private nextFlock = 9;
  private readonly random = seeded(4242);
  private readonly dummy = new THREE.Object3D();
  private readonly color = new THREE.Color();
  private readonly tmp = new THREE.Vector3();
  private time = 0;

  constructor(scene: THREE.Scene, ground: GroundSampler, colliders: Collider[], anchors: Vec2[]) {
    const random = seeded(99), taken: Vec2[] = [];
    const spot = (anchor: Vec2): Vec2 | undefined => {
      for (let tries = 0; tries < 80; tries++) {
        const angle = random() * Math.PI * 2, distance = 2.1 + random() * 1.8, x = anchor.x + Math.cos(angle) * distance, z = anchor.z + Math.sin(angle) * distance;
        if (ground.grass(x, z) && !blocked(x, z, colliders, .25) && taken.every(t => Math.hypot(t.x - x, t.z - z) > 3)) return { x, z };
      }
      return undefined;
    };
    for (const anchor of anchors) { const p = spot(anchor); if (p) taken.push(p); }
    this.mesh = flyerMesh(scene, "bird", taken.length + FLOCK_SLOTS, "birds");
    taken.forEach((p, i) => {
      const home = new THREE.Vector3(p.x, ground.height(p.x, p.z), p.z), yaw = random() * Math.PI * 2;
      this.resting.push({ home, yaw, state: "perched", time: 0, velocity: new THREE.Vector3(), peck: -1, nextPeck: 1 + random() * 3, turnAt: 2 + random() * 5, phase: random() * 6, position: home.clone(), heading: yaw });
      this.mesh.setColorAt(i, this.color.setRGB(.9 + random() * .25, .9 + random() * .15, .9 + random() * .2));
    });
    for (let i = 0; i < FLOCK_SLOTS; i++) this.mesh.setColorAt(taken.length + i, this.color.setRGB(.5, .52, .62));
    this.mesh.instanceColor!.needsUpdate = true;
    this.hideAll();
  }

  private hideAll(): void {
    this.dummy.scale.setScalar(0); this.dummy.updateMatrix();
    for (let i = 0; i < this.mesh.count; i++) this.mesh.setMatrixAt(i, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  get perchedCount(): number { return this.resting.filter(b => b.state === "perched").length; }
  get flyingCount(): number { return this.resting.filter(b => b.state === "flying").length + (this.flock ? this.flock.offsets.length : 0); }
  /** Makes a flock cross the view right away (development and capture hook). */
  summonFlock(camera: THREE.OrthographicCamera): void { this.spawnFlock(camera); }

  private spawnFlock(camera: THREE.OrthographicCamera): void {
    const direction = camera.getWorldDirection(new THREE.Vector3()), height = 1.7 + this.random() * .9, ny = .15 + this.random() * .5;
    const ends = [-1.35, 1.35].map(nx => {
      const p = new THREE.Vector3(nx, ny, 0).unproject(camera);
      return p.addScaledVector(direction, (height - p.y) / direction.y);
    });
    const [a, b] = this.random() < .5 ? ends as [THREE.Vector3, THREE.Vector3] : [ends[1]!, ends[0]!];
    const count = 3 + Math.floor(this.random() * 3);
    this.flock = { start: a, end: b, time: 0, duration: a.distanceTo(b) / 3.1, offsets: Array.from({ length: count }, (_, i) => new THREE.Vector3((this.random() - .5) * .5 - i * .2, (this.random() - .5) * .3, (this.random() - .5) * .6 + (i % 2 ? .25 : -.25))) };
  }

  private onScreen(point: THREE.Vector3, camera: THREE.OrthographicCamera): boolean {
    this.tmp.copy(point).project(camera);
    return Math.abs(this.tmp.x) < 1.15 && Math.abs(this.tmp.y) < 1.25;
  }

  update(dt: number, player: THREE.Vector3, camera: THREE.OrthographicCamera, animate: boolean): void {
    const calm = !animate; if (calm) dt = 0;
    this.time += dt;
    const flap = this.mesh.geometry.getAttribute("aFlap") as THREE.InstancedBufferAttribute;
    let shown = false;
    this.resting.forEach((bird, i) => {
      const d = this.dummy;
      if (bird.state === "perched") {
        if (!calm && Math.hypot(player.x - bird.home.x, player.z - bird.home.z) < SCARE_RADIUS) {
          const away = Math.atan2(bird.home.x - player.x, bird.home.z - player.z) + (this.random() - .5) * 1.1;
          bird.state = "flying"; bird.time = 0; bird.heading = away; bird.position.copy(bird.home); bird.velocity.set(Math.sin(away) * 2.1, 1.1, Math.cos(away) * 2.1);
        } else {
          bird.nextPeck -= dt; bird.turnAt -= dt;
          if (bird.peck < 0 && bird.nextPeck < 0) { bird.peck = 0; bird.nextPeck = 1.6 + this.random() * 3.5; }
          if (bird.turnAt < 0) { bird.yaw += (this.random() - .5) * 1.8; bird.turnAt = 2.5 + this.random() * 5; }
          let pitch = 0;
          if (bird.peck >= 0) { bird.peck += dt / .5; pitch = Math.sin(Math.min(bird.peck, 1) * Math.PI) * .6; if (bird.peck >= 1) bird.peck = -1; }
          d.position.copy(bird.home); d.rotation.set(pitch, bird.yaw, 0); d.scale.setScalar(BIRD_SCALE);
          flap.setXY(i, 0, 0);
        }
      }
      if (bird.state === "flying") {
        bird.time += dt; bird.phase += dt * 24;
        bird.velocity.y = Math.max(.3, 1.1 - bird.time * .15);
        bird.position.addScaledVector(bird.velocity, dt);
        d.position.copy(bird.position); d.rotation.set(-.3, bird.heading, 0); d.scale.setScalar(BIRD_SCALE); flap.setXY(i, bird.phase, 1);
        if (bird.time > 7 && (!this.onScreen(bird.position, camera) || bird.time > 20)) { bird.state = "gone"; bird.time = 0; }
      } else if (bird.state === "gone") {
        bird.time += dt; d.scale.setScalar(0);
        // Settle back at the same spot only after the player is away and it is out of view, so nothing visibly pops.
        if (bird.time > 12 && Math.hypot(player.x - bird.home.x, player.z - bird.home.z) > SCARE_RADIUS * 3 && !this.onScreen(bird.home, camera)) { bird.state = "perched"; bird.position.copy(bird.home); bird.peck = -1; }
      }
      d.updateMatrix(); this.mesh.setMatrixAt(i, d.matrix); if (bird.state !== "gone" && this.onScreen(d.position, camera)) shown = true;
    });
    this.updateFlock(dt, camera, flap);
    this.mesh.instanceMatrix.needsUpdate = true; flap.needsUpdate = true; this.mesh.visible = shown || !!this.flock;
  }

  private updateFlock(dt: number, camera: THREE.OrthographicCamera, flap: THREE.InstancedBufferAttribute): void {
    const base = this.resting.length, d = this.dummy;
    if (!this.flock) {
      this.nextFlock -= dt; if (this.nextFlock <= 0 && dt > 0) { this.spawnFlock(camera); this.nextFlock = 24 + this.random() * 26; }
    }
    const flock = this.flock;
    for (let i = 0; i < FLOCK_SLOTS; i++) {
      const offset = flock?.offsets[i];
      if (!flock || !offset) { d.scale.setScalar(0); d.updateMatrix(); this.mesh.setMatrixAt(base + i, d.matrix); continue; }
      if (i === 0) flock.time += dt;
      const t = flock.time / flock.duration;
      d.position.lerpVectors(flock.start, flock.end, t).add(offset);
      d.position.y += Math.sin(this.time * 2 + i) * .04;
      const dx = flock.end.x - flock.start.x, dz = flock.end.z - flock.start.z;
      d.rotation.set(0, Math.atan2(dx, dz), Math.sin(this.time * 3 + i) * .12); d.scale.setScalar(BIRD_SCALE * 1.1);
      d.updateMatrix(); this.mesh.setMatrixAt(base + i, d.matrix);
      flap.setXY(base + i, this.time * (17 + i) + i, 1);
    }
    if (flock && flock.time > flock.duration) this.flock = undefined;
  }

  set visible(value: boolean) { this.mesh.visible = value; }
}

type Flutter = { cx: number; cy: number; cz: number; rx: number; rz: number; wx: number; wz: number; px: number; pz: number; rate: number; phase: number };

/** Butterflies loop lazily around flower patches. */
export class Butterflies {
  private readonly mesh: THREE.InstancedMesh;
  private readonly flutters: Flutter[] = [];
  private readonly dummy = new THREE.Object3D();
  private readonly ahead = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private time = 0;

  constructor(scene: THREE.Scene, flowers: Vec2[], avoid: (x: number, z: number) => boolean) {
    const random = seeded(77), spots: Vec2[] = [];
    for (const f of flowers.map(f => ({ f, k: random() })).sort((a, b) => a.k - b.k).map(entry => entry.f)) {
      if (spots.length < 9 && !avoid(f.x, f.z) && spots.every(s => Math.hypot(s.x - f.x, s.z - f.z) > 3.2)) spots.push(f);
    }
    const palette = ["#ffd6e8", "#fff2a8", "#ffffff", "#bfe3ff", "#ffc48a"].map(hex => new THREE.Color(hex));
    this.mesh = flyerMesh(scene, "butterfly", Math.max(1, spots.length), "butterflies");
    spots.forEach((s, i) => {
      this.flutters.push({ cx: s.x, cy: .3 + random() * .25, cz: s.z, rx: .5 + random() * .55, rz: .4 + random() * .5, wx: .35 + random() * .3, wz: .3 + random() * .3, px: random() * 6.28, pz: random() * 6.28, rate: 13 + random() * 5, phase: random() * 6 });
      this.mesh.setColorAt(i, palette[i % palette.length]!);
    });
    this.mesh.instanceColor!.needsUpdate = true;
  }

  get count(): number { return this.flutters.length; }

  private place(f: Flutter, t: number, into: THREE.Vector3): THREE.Vector3 {
    return into.set(f.cx + f.rx * Math.sin(f.wx * t + f.px) + f.rx * .3 * Math.sin(f.wx * 2.7 * t), f.cy + .1 * Math.sin(f.wx * 1.9 * t + f.pz), f.cz + f.rz * Math.cos(f.wz * t + f.pz));
  }

  update(dt: number, animate: boolean, camera: THREE.OrthographicCamera): void {
    if (!animate) dt = 0;
    this.time += dt;
    const flap = this.mesh.geometry.getAttribute("aFlap") as THREE.InstancedBufferAttribute, d = this.dummy;
    let shown = false;
    this.flutters.forEach((f, i) => {
      this.place(f, this.time, d.position); this.place(f, this.time + .15, this.ahead);
      d.rotation.set(0, Math.atan2(this.ahead.x - d.position.x, this.ahead.z - d.position.z), Math.sin(this.time * f.wx * 3 + f.px) * .25);
      d.scale.setScalar(1.8); d.updateMatrix(); this.mesh.setMatrixAt(i, d.matrix); this.tmp.copy(d.position).project(camera); if (Math.abs(this.tmp.x) < 1.1 && Math.abs(this.tmp.y) < 1.2) shown = true;
      // Wings beat in short bursts with a glide in between.
      const burst = Math.sin(this.time * .9 + f.pz * 3) > -.55 ? 1 : .15;
      f.phase += dt * f.rate * burst;
      flap.setXY(i, f.phase, 1);
    });
    this.mesh.instanceMatrix.needsUpdate = true; flap.needsUpdate = true; this.mesh.visible = shown;
  }

  set visible(value: boolean) { this.mesh.visible = value; }
}

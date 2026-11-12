import * as THREE from "three";
import type { Collider, Vec2 } from "../core/world/types";
import { BiomeMap, patchNoise, type Biome } from "./nature-biome";
import { GroundSampler, Obstacles, TINTS, flatIcosahedron, seeded, tuftGeometry } from "./nature-grass";
import { ScatterLayer } from "./nature-layer";
import { applyWind, liteMaterial } from "./nature-wind";

type V3 = [number, number, number];

/** Builds flat-shaded triangle soups. A negative vertex color means "keep this color, ignore the per-instance tint". */
class Soup {
  readonly position: number[] = [];
  readonly color: number[] = [];
  readonly normal: number[] = [];
  tri(a: V3, b: V3, c: V3, ca: number | V3, cb: number | V3 = ca, cc: number | V3 = ca, up = true): this {
    const n: V3 = up ? [0, 1, 0] : (() => {
      const u = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)), v = new THREE.Vector3(...c).sub(new THREE.Vector3(...a));
      const out = u.cross(v).normalize(); return [out.x, out.y, out.z];
    })();
    for (const [p, col] of [[a, ca], [b, cb], [c, cc]] as [V3, number | V3][]) {
      this.position.push(...p); this.normal.push(...n);
      if (typeof col === "number") this.color.push(col, col, col * .93); else this.color.push(-col[0], -col[1], -col[2]);
    }
    return this;
  }
  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.position, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(this.color, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(this.normal, 3));
    return geometry;
  }
}

const STEM: V3 = [.3, .55, .2];

/** A five-petal blossom, ankle high, on a hair-thin stem with one leaf. */
function flowerGeometry(): THREE.BufferGeometry {
  const soup = new Soup(), h = .085, r = .042;
  const rim = (k: number): V3 => [Math.cos(k * Math.PI * .4) * r, h - .012, Math.sin(k * Math.PI * .4) * r];
  for (let k = 0; k < 5; k++) soup.tri([0, h, 0], rim(k), rim(k + 1), 1, .84, .9);
  for (let k = 0; k < 3; k++) soup.tri([0, h + .003, 0], [Math.cos(k * 2.09) * .014, h + .001, Math.sin(k * 2.09) * .014], [Math.cos((k + 1) * 2.09) * .014, h + .001, Math.sin((k + 1) * 2.09) * .014], [.95, .78, .25]);
  soup.tri([-.004, 0, 0], [.004, 0, 0], [0, h - .006, 0], STEM, STEM, [.45, .7, .3], false);
  soup.tri([0, .024, 0], [.036, .05, .014], [0, .04, .004], STEM, [.4, .65, .26], STEM, false);
  return soup.build();
}

/** A clump of nine long blades, knee high at most. Meant for corners away from where anyone walks. */
function tallGeometry(): THREE.BufferGeometry {
  const random = seeded(31), soup = new Soup();
  for (let blade = 0; blade < 9; blade++) {
    const angle = random() * Math.PI * 2, spread = .09 * Math.sqrt(random()), ox = Math.cos(angle) * spread, oz = Math.sin(angle) * spread;
    const yaw = random() * Math.PI, c = Math.cos(yaw), s = Math.sin(yaw);
    const h = .2 + random() * .2, w = .026 + random() * .018, lean = (random() - .5) * .2;
    const at = (x: number, y: number, bend: number): V3 => [ox + c * x - s * bend, y, oz + s * x + c * bend];
    soup.tri(at(-w, 0, 0), at(w, 0, 0), at(0, h, lean), .45, .5, 1.35);
  }
  return soup.build();
}

/** Three small leaflets lying on the ground. Tinted green they read as clover; tinted russet, as a few fallen leaves. */
function coverGeometry(): THREE.BufferGeometry {
  const soup = new Soup();
  for (let k = 0; k < 3; k++) {
    const a = k * 2.094 + .4, c = Math.cos(a), s = Math.sin(a), y = .012 + k * .001;
    const at = (along: number, across: number): V3 => [c * along - s * across, y, s * along + c * across];
    soup.tri(at(.012, 0), at(.045, -.034), at(.082, 0), .78, .95, 1).tri(at(.012, 0), at(.082, 0), at(.045, .034), .78, 1, .95);
  }
  return soup.build();
}

/** Two flattened lumps, ankle to shin high: a low bush. */
function shrubGeometry(): THREE.BufferGeometry {
  const random = seeded(53), soup = new Soup();
  for (const [ox, oz, rx, ry] of [[0, 0, .17, .11], [.1, .06, .1, .075]] as const) {
    const ico = flatIcosahedron(), p = ico.getAttribute("position");
    const jitter = new Map<string, V3>();
    const vertex = (i: number): V3 => {
      const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
      if (!jitter.has(key)) jitter.set(key, [(random() - .5) * .25, (random() - .5) * .25, (random() - .5) * .25]);
      const j = jitter.get(key)!;
      return [ox + (p.getX(i) + j[0]) * rx, Math.max(0, (p.getY(i) + j[1]) * ry + ry * .45), oz + (p.getZ(i) + j[2]) * rx];
    };
    for (let i = 0; i < p.count; i += 3) {
      const a = vertex(i), b = vertex(i + 1), c = vertex(i + 2);
      soup.tri(a, b, c, .55 + .6 * a[1] / ry, .55 + .6 * b[1] / ry, .55 + .6 * c[1] / ry, false);
    }
  }
  return soup.build();
}

const CREAM: V3 = [.93, .88, .76];

/** Three mushrooms of different sizes: cream stems, caps that take the instance tint. */
function mushroomGeometry(): THREE.BufferGeometry {
  const soup = new Soup();
  for (const [ox, oz, h, r] of [[0, 0, .07, .05], [.07, .03, .045, .032], [-.04, .06, .035, .026]] as const) {
    const stem = (k: number, top: number): V3 => [ox + Math.cos(k * 1.5708) * r * .32 * top, top === 1 ? h : 0, oz + Math.sin(k * 1.5708) * r * .32 * top];
    for (let k = 0; k < 4; k++) soup.tri(stem(k, 0), stem(k + 1, 0), stem(k, 1), CREAM, CREAM, CREAM, false).tri(stem(k + 1, 0), stem(k + 1, 1), stem(k, 1), CREAM, CREAM, CREAM, false);
    const rim = (k: number): V3 => [ox + Math.cos(k * 1.0472) * r, h - r * .18, oz + Math.sin(k * 1.0472) * r];
    for (let k = 0; k < 6; k++) soup.tri([ox, h + r * .35, oz], rim(k), rim(k + 1), 1, .78, .84, false);
  }
  return soup.build();
}

/** Lite material that also honors the negative vertex colors from `Soup`, optionally with wind. */
function floraMaterial(key: string, wind?: { amp: number; height: number }, flat = false): THREE.MeshLambertMaterial {
  const material = liteMaterial({ flat });
  if (wind) applyWind(material, { ...wind, grass: true });
  const base = material.onBeforeCompile;
  material.customProgramCacheKey = () => key;
  material.onBeforeCompile = (shader, renderer) => {
    base(shader, renderer);
    shader.vertexShader = shader.vertexShader.replace("#include <color_vertex>", "#include <color_vertex>\nif (color.r < 0.) vColor.rgb = -color.rgb;");
  };
  material.needsUpdate = true;
  return material;
}

const hex = (value: string) => new THREE.Color(value);
const FLOWERS = ["#f3f0e6", "#e895b6", "#a98cd8", "#f1d664"].map(hex);
const CLOVER = ["#3f8f3c", "#4f9d45", "#6db553", "#357f3d"].map(hex);
const LEAVES = ["#c68a3b", "#a8672f", "#d6b04a", "#8f5a2a"].map(hex);
const SHRUBS = ["#2f7a3a", "#3b8a42", "#4a9a4a", "#2a6f45"].map(hex);
const CAPS = ["#b98a5a", "#d9c7a0", "#a8765f", "#c9a06a"].map(hex);
const STRAW = hex("#b9ad5c");

const PER_UNIT = 96; // candidate points per square unit; every layer thins this by its own rate
const GRASS_CAPACITY = 5600;

/**
 * The whole ground cover: grass, wildflowers, clover and leaf litter, low bushes, mushrooms, and tall grass in the
 * corners. Everything is scattered once, from the position alone, and drawn as six instanced meshes.
 */
export class Meadow {
  readonly grass: ScatterLayer;
  readonly flowers: ScatterLayer;
  readonly cover: ScatterLayer;
  readonly tall: ScatterLayer;
  readonly shrubs: ScatterLayer;
  readonly mushrooms: ScatterLayer;

  constructor(scene: THREE.Scene, ground: GroundSampler, colliders: Collider[], biomes: BiomeMap, keepClear: Vec2[], bridges: Vec2[][] = []) {
    const grassMaterial = liteMaterial(); grassMaterial.vertexColors = true; applyWind(grassMaterial, { amp: .026, height: .1, grass: true });
    this.grass = new ScatterLayer(scene, "grass-field", tuftGeometry(), grassMaterial, GRASS_CAPACITY);
    this.flowers = new ScatterLayer(scene, "flower-field", flowerGeometry(), floraMaterial("nature-flower", { amp: .02, height: .1 }), 1500, .12);
    this.cover = new ScatterLayer(scene, "clover-field", coverGeometry(), floraMaterial("nature-cover"), 2200, .02);
    this.tall = new ScatterLayer(scene, "tall-grass", tallGeometry(), floraMaterial("nature-tall", { amp: .07, height: .4 }), 900, .3);
    this.shrubs = new ScatterLayer(scene, "low-bushes", shrubGeometry(), floraMaterial("nature-shrub", undefined, true), 120, .12);
    this.mushrooms = new ScatterLayer(scene, "mushrooms", mushroomGeometry(), floraMaterial("nature-mushroom", undefined, true), 120, .08);
    this.scatter(ground, colliders, biomes, keepClear, bridges.map(points => ({ minX: Math.min(...points.map(p => p.x)) - .5, maxX: Math.max(...points.map(p => p.x)) + .5, minZ: Math.min(...points.map(p => p.z)) - .5, maxZ: Math.max(...points.map(p => p.z)) + .5 })));
    for (const layer of this.layers) layer.seal();
  }

  get layers(): ScatterLayer[] { return [this.grass, this.flowers, this.cover, this.tall, this.shrubs, this.mushrooms]; }

  private scatter(ground: GroundSampler, colliders: Collider[], biomes: BiomeMap, keepClear: Vec2[], decks: { minX: number; maxX: number; minZ: number; maxZ: number }[]): void {
    const solids = new Obstacles(colliders), random = seeded(20261112), step = 1 / Math.sqrt(PER_UNIT), b = ground.bounds;
    const biome: Biome = { tint: [0, 0, 0], flowers: 0, palette: [0, 0, 0, 0], clover: 0, litter: 0, tall: 0, shrub: 0, mushrooms: 0, dry: 0 };
    const color = new THREE.Color(), r: [number, number, number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0, 0, 0];
    let lastCell = NaN; // the biome blend changes slowly, so it is recomputed per half-unit cell, not per point
    const clearOf = (x: number, z: number, radius: number) => keepClear.every(p => (p.x - x) ** 2 + (p.z - z) ** 2 > radius * radius);
    const rate = (perUnit: number) => perUnit / PER_UNIT;
    // Tints a base color with the zone's shift, a slow light/dark variation, and its dryness.
    const tinted = (base: THREE.Color, x: number, z: number, dryRoll: number, variance: number) => {
      const lift = 1 + patchNoise(x, z, .4) * .07 + (variance - .5) * .08;
      color.setRGB(base.r * (1 + biome.tint[0]) * lift, base.g * (1 + biome.tint[1]) * lift, base.b * (1 + biome.tint[2]) * lift);
      if (dryRoll < biome.dry) color.lerp(STRAW, .55);
      return color;
    };
    for (let z = b.minZ; z < b.maxZ; z += step) for (let x = b.minX; x < b.maxX; x += step) {
      const px = x + (random() - .5) * step * 1.7, pz = z + (random() - .5) * step * 1.7;
      for (let i = 0; i < 8; i++) r[i] = random();
      if (!ground.grass(px, pz) || solids.blocked(px, pz, .08) || decks.some(d => px > d.minX && px < d.maxX && pz > d.minZ && pz < d.maxZ)) continue;
      const y = ground.height(px, pz), yaw = random() * Math.PI * 2, rank = random();
      const cellKey = Math.floor(px * 2) * 4099 + Math.floor(pz * 2);
      if (cellKey !== lastCell) { biomes.at(px, pz, biome); lastCell = cellKey; }
      // Slow patchiness: some meadows are lush, some thinner. Thin patches still keep most of their blades.
      const patch = .5 + .5 * Math.sin(px * .31 + Math.sin(pz * .23) * 2) * Math.cos(pz * .27 - px * .11);
      if (r[0] < .58 + .34 * patch) this.grass.add(px, y, pz, yaw, .75 + r[1] * .7 * (.6 + .4 * patch), rank, tinted(TINTS[Math.floor(r[2] * TINTS.length)]!, px, pz, r[3], r[4]));
      const near = (margin: number) => solids.blocked(px, pz, margin);
      // Wildflowers: patches where they bloom thickly, a few strays elsewhere.
      const bloom = Math.max(0, patchNoise(px + 17, pz - 9, .5) * .5 + .5 - .3) / .7;
      if (r[5] < rate(biome.flowers * (.4 + 4.4 * bloom * bloom))) {
        let pick = r[6] * biome.palette.reduce((a, c) => a + c, 0), kind = 0;
        while (kind < 3 && pick > biome.palette[kind]!) { pick -= biome.palette[kind]!; kind++; }
        this.flowers.add(px, y, pz, yaw, .8 + r[7] * .7, rank, color.copy(FLOWERS[kind]!).multiplyScalar(.94 + r[4] * .1));
      }
      // Clover everywhere, with a thicker mat in some places; russet leaf litter mostly under trees and walls.
      const mat = .35 + .65 * (patchNoise(px - 5, pz + 3, 1.05) * .5 + .5);
      if (r[3] < rate(biome.clover * 2.5 * mat)) this.cover.add(px, y, pz, yaw, .8 + r[4] * .8, rank, color.copy(CLOVER[Math.floor(r[6] * CLOVER.length)]!).multiplyScalar(.92 + r[7] * .16));
      else if (r[3] > 1 - rate(biome.litter * .45) && (r[4] < .3 || near(.8))) this.cover.add(px, y, pz, yaw, .9 + r[7] * .7, rank, color.copy(LEAVES[Math.floor(r[6] * LEAVES.length)]!));
      // Tall grass and reeds only where nobody walks: beside trees, rocks and walls, along the shore, at the island's rim.
      if (r[5] > 1 - rate(biome.tall * 2.4) && ground.pathDistance(px, pz) > 1.1 && clearOf(px, pz, 1.7)) {
        const nook = near(.9) ? 1 : ground.waterDistance(px, pz) < 1.3 ? .9 : ground.edgeDistance(px, pz) < 1.6 ? .7 : .12;
        if (r[6] < nook) this.tall.add(px, y, pz, yaw, .8 + r[7] * .5, rank, tinted(TINTS[Math.floor(r[2] * TINTS.length)]!, px, pz, r[3], r[4]).multiplyScalar(1.02));
      }
      if (r[1] < rate(biome.shrub * 1.6) && (r[2] < .35 || near(.9)) && ground.pathDistance(px, pz) > .9 && clearOf(px, pz, 1.4)) this.shrubs.add(px, y, pz, yaw, .55 + r[7] * .45, rank, color.copy(SHRUBS[Math.floor(r[6] * SHRUBS.length)]!));
      if (r[7] < rate(biome.mushrooms * 1.5) && (near(.7) || ground.waterDistance(px, pz) < 1.2) && ground.pathDistance(px, pz) > .5 && clearOf(px, pz, 1)) this.mushrooms.add(px, y, pz, yaw, .9 + r[0] * .6, rank, color.copy(CAPS[Math.floor(r[6] * CAPS.length)]!));
    }
  }

  /** Phones draw fewer of the finer details; the bigger shapes keep most of their numbers. */
  setDensity(value: number): void {
    this.grass.setDensity(value); this.cover.setDensity(value);
    this.flowers.setDensity(Math.min(1, value + .2)); this.tall.setDensity(Math.min(1, value + .2));
    this.shrubs.setDensity(1); this.mushrooms.setDensity(1);
  }

  update(camera: THREE.OrthographicCamera): void { for (const layer of this.layers) layer.update(camera); }
}

import * as THREE from "three";
import type { Collider, Vec2 } from "../core/world/types";
import { GrassField, GroundSampler, blocked } from "./nature-grass";
import { Birds, Butterflies } from "./nature-fauna";
import { LakeWater } from "./nature-water";
import { SceneryField } from "./nature-scenery";
import { applyWind, windDepthMaterial, wind } from "./nature-wind";

type Spot = Vec2 & { asset: string };
export type NatureMap = { props: Spot[]; zones: Record<string, Vec2>; lake?: Vec2[] };

// Sway amplitude in world units at the very top of each asset. Roots stay planted because the weight grows with height squared.
const SWAY: [RegExp, number][] = [[/^tree-/, .09], [/^bush$/, .05], [/^flower-cluster-/, .05], [/^grass-/, .06], [/^water-reed$/, .07]];

/**
 * The living layer of the village: wind, grass, water, birds, and butterflies.
 * It reacts to time and to how close the player is, never to dialogue, choices, or results.
 */
export class Nature {
  private grass?: GrassField;
  private birds?: Birds;
  private butterflies?: Butterflies;
  private stones?: SceneryField;
  private readonly lake?: LakeWater;
  private time = 0;
  private mobile = false;
  private readonly reduced = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : undefined;

  constructor(private readonly scene: THREE.Scene, private readonly map: NatureMap) {
    const shore = map.lake, center = map.zones.lake;
    if (shore && center) this.lake = new LakeWater(scene, shore, center);
  }

  /** Called for every placed prop: gives plants their sway and hands lake plants to the water. */
  dress(object: THREE.Object3D, asset: string): void {
    if (asset === "water-flower" || asset === "water-reed") this.lake?.adopt(object, asset);
    const amp = SWAY.find(([pattern]) => pattern.test(asset))?.[1];
    if (!amp) return;
    object.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      child.geometry.computeBoundingBox();
      const height = Math.max(.05, child.geometry.boundingBox!.max.y);
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
        const shared = material.userData.wind as { uHeight: { value: number } } | undefined;
        if (shared) shared.uHeight.value = Math.max(shared.uHeight.value, height); else applyWind(material, { amp, height });
        if (child.castShadow) child.customDepthMaterial = windDepthMaterial(material);
      }
    });
  }

  /** Called once the terrain mesh is in the scene: everything that needs to know where the grass is. */
  build(terrain: THREE.Object3D, colliders: Collider[]): void {
    const ground = new GroundSampler(terrain);
    this.grass = new GrassField(this.scene, ground, colliders);
    this.grass.setDensity(this.mobile ? .7 : 1);
    const anchors = ["entrance", "plaza", "bakery", "library", "smithy", "lake", "gate"].map(id => this.map.zones[id]).filter((zone): zone is Vec2 => !!zone);
    this.birds = new Birds(this.scene, ground, colliders, anchors);
    const flowers = this.map.props.filter(prop => /^flower-(cluster-|bed)/.test(prop.asset));
    this.butterflies = new Butterflies(this.scene, flowers, (x, z) => blocked(x, z, colliders, .1) || !ground.grass(x, z));
  }

  /** Roadside rocks, pebbles, and fence pieces from the map, drawn as one shared mesh that holds only what is near the view. */
  async scenery(props: (Spot & { rot?: number; scale?: number })[], load: (asset: string) => Promise<{ scene: THREE.Object3D; scale: number }>): Promise<void> {
    this.stones = await SceneryField.build(this.scene, props, load);
  }

  resize(mobile: boolean): void { this.mobile = mobile; this.grass?.setDensity(mobile ? .7 : 1); }

  update(dt: number, player: THREE.Vector3, camera: THREE.OrthographicCamera): void {
    const animate = !this.reduced?.matches;
    if (animate) this.time += dt;
    wind.uTime.value = this.time; wind.uStrength.value = animate ? 1 : 0;
    const angle = .6 + .35 * Math.sin(this.time * .045);
    wind.uDir.value.set(Math.cos(angle), Math.sin(angle)); wind.uPlayer.value.copy(player);
    this.grass?.update(camera);
    this.stones?.update(camera);
    this.lake?.update(dt, animate);
    this.birds?.update(dt, player, camera, animate);
    this.butterflies?.update(dt, animate, camera);
  }

  /** Development and capture hook: counts and a way to trigger a flock on demand. */
  get debug() {
    return { grass: this.grass?.mesh.count ?? 0, grassTotal: this.grass?.total ?? 0, stoneVertices: this.stones?.vertices ?? 0, perched: this.birds?.perchedCount ?? 0, flying: this.birds?.flyingCount ?? 0, butterflies: this.butterflies?.count ?? 0, summonFlock: (camera: THREE.OrthographicCamera) => this.birds?.summonFlock(camera) };
  }
}

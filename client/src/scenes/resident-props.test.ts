import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import type { lumiView } from "../core/lumi-errand";
import { ResidentProps } from "./resident-props";
import map from "../../../content/world/village.json";
import manifest from "../../../content/assets/manifest.json";
import { walkable } from "../core/world/move";
import type { Bounds, Collider } from "../core/world/types";

const view = (patch: Partial<ReturnType<typeof lumiView>> = {}): ReturnType<typeof lumiView> => ({
  phase: "choose_03", objectiveKey: "", activeTargetIds: ["A"], resumePointId: "A", carriedObjectId: null,
  objects: { notice: "source", material: "source", score: "source" }, placements: {}, choices: ["a", "a", "a", "a", "a", "a"], ...patch
});
const model = async (key: string): Promise<GLTF> => { const scene = new THREE.Group(); scene.name = key; return { scene } as GLTF; };

describe("resident props", () => {
  it("restores Lumi notice from the authoritative player and rest positions", async () => {
    const scene = new THREE.Scene(), player = new THREE.Group(); scene.add(player);
    const props = await ResidentProps.load("lumi", scene, player, map.props.filter(p => p.id.startsWith("lumi-")), model);
    props.setView(view());
    // The horn is handed over with the lumi_03 choice, so it never waits at its source as a target.
    expect(props.objects.get("lumi-horn")?.visible).toBe(false);
    props.setView(view({ phase: "notice_first", activeTargetIds: ["lumi-neighbor-1", "lumi-rest"], carriedObjectId: "notice", objects: { notice: "player", material: "source", score: "source" } }));
    expect(props.objects.get("lumi-horn")?.visible).toBe(false);
    expect(player.children.some(o => o.name === "prop-lumi-horn" && o.visible)).toBe(true);
    props.setView(view({ phase: "notice_first", activeTargetIds: ["lumi-rest"], objects: { notice: "lumi-rest", material: "source", score: "source" } }));
    expect(player.children.some(o => o.name === "prop-lumi-horn" && o.visible)).toBe(false);
    expect(props.objects.get("lumi-rest")?.children.some(o => o.name === "prop-lumi-horn" && o.visible)).toBe(true);
    props.setView(null);
    expect(player.children.some(o => o.visible)).toBe(false);
  });
});

it("restores Echo books and preserves completed placements without recreating models", async () => {
  const scene = new THREE.Scene(), player = new THREE.Group(); scene.add(player);
  let loads = 0;
  const props = await ResidentProps.load("echo", scene, player, map.props.filter(p => p.id.startsWith("echo-")), async key => { loads++; return model(key); });
  const snapshot = { phase: "record_delivery", objectiveKey: "", activeTargetIds: ["echo-rest", "echo-reading-desk"], resumePointId: "echo-reading-desk", carriedObjectId: "record", objects: { book: "delivered", record: "player", notebook: "source", legend: "source" }, placements: { "plant-1": "plant-1" }, choices: ["a", "a", "b", "a", "a", "b"] } as const;
  props.setView(snapshot as unknown as ReturnType<typeof import("../core/echo-errand").echoView>);
  expect(player.children.some(o => o.name === "prop-echo-book" && o.visible)).toBe(true);
  expect(props.objects.get("echo-bookshelf")?.getObjectByName("piece:plant-1")?.visible).toBe(true);
  const newLayout = props.objects.get("echo-bookshelf")!.getObjectByName("piece:plant-2")!.position.clone();
  const count = loads;
  props.setView({ ...snapshot, phase: "completed", carriedObjectId: null, activeTargetIds: [], choices: ["a", "a", "b", "b", "a", "b"], objects: { book: "delivered", record: "delivered", notebook: "delivered", legend: "delivered" } } as unknown as ReturnType<typeof import("../core/echo-errand").echoView>);
  expect(props.objects.get("echo-bookshelf")?.visible).toBe(true);
  expect(props.objects.get("echo-bookshelf")!.getObjectByName("piece:plant-2")!.position.equals(newLayout)).toBe(false);
  expect(props.objects.get("echo-open-display")?.children.some(o => o.name === "prop-echo-book" && o.visible)).toBe(true);
  expect(loads).toBe(count);
});

it("restores Or's empty and filled bucket and delivered bell", async () => {
  const scene = new THREE.Scene(), player = new THREE.Group(); scene.add(player);
  const loaded: string[] = [];
  const props = await ResidentProps.load("or", scene, player, map.props, async key => { loaded.push(key); return model(key); });
  const v = { phase: "find_sand", objectiveKey: "", activeTargetIds: ["or-map", "or-rest"], resumePointId: "or-map", carriedObjectId: "bucket", objects: { bucket: "player", bell: "source" }, placements: {}, choices: ["a", "a", "a", "a", "a", "b"] } as unknown as ReturnType<typeof import("../core/or-errand").orView>;
  props.setView(v);
  expect(player.children.some(o => o.name === "prop-or-bucket-empty" && o.visible)).toBe(true);
  props.setView({ ...v, phase: "sand_delivery", activeTargetIds: ["or-rest"], carriedObjectId: null, objects: { bucket: "or-rest", bell: "source" } });
  expect(player.children.some(o => o.name === "prop-or-bucket-empty")).toBe(false);
  expect(props.objects.get("or-rest")?.children.some(o => o.name === "prop-or-bucket-sand" && o.visible)).toBe(true);
  props.setView({ ...v, phase: "completed", activeTargetIds: [], carriedObjectId: null, objects: { bucket: "delivered", bell: "delivered" }, placements: { "axle-circle": "gear-circle" } });
  expect(props.objects.get("or-plaza-stand")?.children.some(o => o.name === "prop-or-bell" && o.visible)).toBe(true);
  expect(props.objects.get("or-clock-board")?.getObjectByName("piece:axle-circle")?.visible).toBe(true);
  expect(props.objects.get("or-lantern-link")?.getObjectByName("lantern-link")?.visible).toBe(true);
  expect(loaded.some(key => key.startsWith("prop-lumi-") || key.startsWith("prop-echo-"))).toBe(false);
});

it("covers every non-actor quest target and has distinct NPC positions", async () => {
  const actorIds = new Set(["A", "C", "D", "s1j2", "t1p2", "s2j2", "lumi-neighbor-1", "lumi-neighbor-2", "echo-borrower", "or-fisher", "or-merchant"]);
  const ids = new Set(map.props.map(p => p.id));
  for (const npc of ["lumi", "echo", "or"] as const) {
    const quest = await import(`../../../content/quests/${npc}-errand.json`);
    const targets = [...Object.values(quest.default.phases).flat(), ...Object.values(quest.default.resumePoints).flat(), `${npc}-rest`];
    for (const target of targets) if (!actorIds.has(target as string)) expect(ids.has(target as string), String(target)).toBe(true);
  }
  const zones = map.zones as Record<string, { x: number; z: number }>;
  for (const id of ["lumi-stagekeeper", "lumi-neighbor-1", "lumi-neighbor-2", "echo-organizer", "echo-borrower", "or-assistant", "or-fisher", "or-merchant", "or-review-fisher", "or-review-merchant", "or-report"]) expect(zones[id], id).toBeDefined();
  const history = map.props.find(p => p.id === "echo-history-shelf")!, attic = map.props.find(p => p.id === "echo-attic-door")!;
  expect(Math.hypot(history.x - attic.x, history.z - attic.z)).toBeGreaterThan(1);
});

it("keeps a completed Lumi board when another resident updates", async () => {
  const scene = new THREE.Scene(), player = new THREE.Group(); scene.add(player);
  const lumi = await ResidentProps.load("lumi", scene, player, map.props, model);
  const or = await ResidentProps.load("or", scene, player, map.props, model);
  lumi.setView(view({ phase: "completed", activeTargetIds: [], objects: { notice: "delivered", material: "delivered", score: "delivered" }, placements: { "circle-1": "circle-1", "circle-2": "circle-2" } }));
  or.setView({ phase: "find_sand", objectiveKey: "", activeTargetIds: ["or-map"], resumePointId: "or-map", carriedObjectId: "bucket", objects: { bucket: "player", bell: "source" }, placements: {}, choices: ["a", "a", "a", "a", "a", "b"] });
  expect(lumi.objects.get("lumi-decoration-board")?.visible).toBe(true);
  expect(lumi.objects.get("lumi-decoration-board")?.getObjectByName("piece:circle-2")?.visible).toBe(true);
  lumi.setView(null);
  expect(lumi.objects.get("lumi-decoration-board")?.parent?.visible).toBe(false);
  expect(player.children.some(o => o.name === "prop-or-bucket-empty" && o.visible)).toBe(true);
});

it("places each resident prop outside the other physical colliders", () => {
  const assets = manifest.assets as unknown as Record<string, { scale: number; collision: Collider[] }>;
  const entries: { id: string; asset: string; x: number; z: number; scale?: number; rot?: number }[] = [...map.props, ...map.actors];
  const shapes = entries.flatMap(p => {
    const asset = assets[p.id === "moka-basket-source" ? "prop-moka-dropoff" : p.asset]!;
    const scale = asset.scale * (p.scale ?? 1), rot = p.rot ?? 0, c = Math.cos(rot), s = Math.sin(rot);
    return asset.collision.map(shape => {
      const x = p.x + (c * shape.x + s * shape.z) * scale, z = p.z + (-s * shape.x + c * shape.z) * scale;
      const collider: Collider = shape.type === "circle" ? { type: "circle", x, z, radius: shape.radius * scale } : { type: "box", x, z, halfX: shape.halfX * scale, halfZ: shape.halfZ * scale, rot };
      return { owner: p.id, collider };
    });
  });
  for (const prop of map.props.filter(p => /^(lumi|echo|or)-/.test(p.id))) {
    const valid = walkable(shapes.filter(s => s.owner !== prop.id).map(s => s.collider), map.bounds as Bounds, .01);
    expect(valid(prop, prop), prop.id).toBe(true);
  }
}, 30000);

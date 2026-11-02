import { describe, expect, it } from "vitest";
import map from "../../../../content/world/village.json";
import lumi from "../../../../content/quests/lumi-errand.json";
import echo from "../../../../content/quests/echo-errand.json";
import or from "../../../../content/quests/or-errand.json";

describe("resident world placements", () => {
  it("provides every quest target, resume point and temporary actor zone", () => {
    const ids = new Set([...map.actors, ...map.props].map(p => p.id));
    const zones = map.zones as Record<string, { x: number; z: number }>;
    for (const id of ["lumi-neighbor-1", "lumi-neighbor-2", "echo-borrower", "or-fisher", "or-merchant"]) ids.add(id);
    for (const quest of [lumi, echo, or]) for (const id of [...Object.values(quest.phases).flat(), ...Object.values(quest.resumePoints).flat(), `${quest === lumi ? "lumi" : quest === echo ? "echo" : "or"}-rest`]) expect(ids.has(id), id).toBe(true);
    for (const id of ["lumi-stagekeeper", "lumi-neighbor-1", "lumi-neighbor-2", "echo-organizer", "echo-borrower", "or-assistant", "or-fisher", "or-merchant", "or-review-fisher", "or-review-merchant", "or-report"]) expect(zones[id], id).toBeDefined();
  });
});

import * as THREE from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { vi } from "vitest";
import { Village } from "../../scenes/village";
import { ResidentProps } from "../../scenes/resident-props";
import { initialLumi, lumiView } from "../lumi-errand";
import { initialEcho, echoView } from "../echo-errand";
import { initialOr, orView } from "../or-errand";
import type { PlaySnapshot } from "../play";
import manifest from "../../../../content/assets/manifest.json";
import moka from "../../../../content/quests/moka-errand.json";
import { findPath, findPathVia } from "./autowalk";
import type { Bounds, Collider } from "./types";

function world() {
  const village = Object.create(Village.prototype) as Village;
  const actors = new Map(map.actors.map(p => {
    const object = new THREE.Group(); object.position.set(p.x, 0, p.z);
    return [p.id, { object, marker: new THREE.Sprite() }] as const;
  }));
  Object.assign(village, { actors, props: new Map(), propObjects: new Map(), scene: new THREE.Scene(), player: new THREE.Group(), cameraTarget: new THREE.Vector3(), colliders: [], colliderOwners: [], available: new Set(), residentProps: {}, residentLoading: {}, mokaView: null, lumiView: null, echoView: null, orView: null, whenReady: Promise.resolve(), label: () => new THREE.Sprite(), character: async () => ({}), load: async () => ({}), onPathBlocked: vi.fn() });
  return village;
}
function snapshot() {
  return { lumi: initialLumi(), echo: initialEcho(), or: initialOr(), answers: [], completedEpisodes: [], segment: "hub" } as unknown as PlaySnapshot;
}
function fakeProps(): ResidentProps {
  const objects = new Map(map.props.map(prop => [prop.id, new THREE.Group()]));
  return { objects, setView: (view: { activeTargetIds: string[] } | null) => { for (const [id, object] of objects) object.visible = !!view?.activeTargetIds.includes(id); } } as unknown as ResidentProps;
}

describe("resident village integration", () => {
  it.each(["lumi", "echo", "or"] as const)("keeps %s colliders synchronized with visible props", async npc => {
    const village = world(), state = snapshot();
    const internals = village as unknown as { scene: THREE.Scene; player: THREE.Group; residentProps: Record<string, ResidentProps>; colliders: Collider[]; colliderOwners: string[]; actors: Map<string, { object: THREE.Group; marker: THREE.Sprite }> };
    const props = await ResidentProps.load(npc, internals.scene, internals.player, map.props.filter(p => p.id.startsWith(`${npc}-`)), async () => ({ scene: new THREE.Group() }) as GLTF);
    internals.residentProps[npc] = props;
    const actorId = npc === "lumi" ? "lumi-neighbor-1" : npc === "echo" ? "echo-borrower" : "or-fisher";
    internals.actors.set(actorId, { object: new THREE.Group(), marker: new THREE.Sprite() });
    const id = npc === "lumi" ? "lumi-table-alone" : npc === "echo" ? "echo-history-shelf" : "or-fire-strong";
    const decoration = npc === "lumi" ? "lumi-stage-workbench" : npc === "echo" ? "echo-reading-desk" : "or-grinding-bench";
    const view = npc === "lumi" ? { ...lumiView(state), phase: "table", activeTargetIds: [id], choices: ["a", "a", "a", "a", "a", "a"] } : npc === "echo" ? { ...echoView(state), phase: "search", activeTargetIds: [id], choices: ["a", "a", "a", "a", "a", "a"] } : { ...orView(state), phase: "fire", activeTargetIds: [id], choices: ["a", "a", "a", "a", "a", "a"] };
    const set = (value: typeof view | null) => npc === "lumi" ? village.setLumiView(value as ReturnType<typeof lumiView> | null) : npc === "echo" ? village.setEchoView(value as ReturnType<typeof echoView> | null) : village.setOrView(value as ReturnType<typeof orView> | null);
    set(view);
    expect(props.objects.get(id)?.visible).toBe(true);
    expect(internals.colliderOwners.filter(owner => owner === id)).toHaveLength(1);
    expect(internals.colliderOwners).toContain(actorId);
    set(view);
    expect(internals.colliderOwners.filter(owner => owner === id)).toHaveLength(1);
    set({ ...view, phase: "choose_02", activeTargetIds: [npc === "lumi" ? "A" : npc === "echo" ? "C" : "D"] } as typeof view);
    expect(props.objects.get(id)?.visible).toBe(false);
    expect(internals.colliderOwners).not.toContain(id);
    expect(internals.colliderOwners.filter(owner => owner === actorId)).toHaveLength(1);
    const completed = npc === "lumi" ? { ...view, phase: "completed", activeTargetIds: [], objects: { notice: "delivered", material: "delivered", score: "delivered" } } : npc === "echo" ? { ...view, phase: "completed", activeTargetIds: [], objects: { book: "delivered", record: "delivered", notebook: "delivered", legend: "delivered" } } : { ...view, phase: "completed", activeTargetIds: [], objects: { bucket: "delivered", bell: "delivered" } };
    set(completed as typeof view);
    expect(props.objects.get(id)?.visible).toBe(false);
    expect(internals.colliderOwners).not.toContain(id);
    expect(props.objects.get(decoration)?.visible).toBe(true);
    expect(internals.colliderOwners.filter(owner => owner === decoration)).toHaveLength(1);
    set(null);
    expect(props.objects.get(decoration)?.parent?.visible).toBe(false);
    expect(internals.colliderOwners.filter(owner => owner?.startsWith(`${npc}-`))).toHaveLength(0);
  });
  it("keeps the latest view after an asynchronous load and restores actors on restart", async () => {
    const village = world(), views: unknown[] = [], objects = new Map<string, THREE.Object3D>();
    let finish!: (value: ResidentProps) => void;
    const pending = new Promise<ResidentProps>(resolve => { finish = resolve; });
    const load = vi.spyOn(ResidentProps, "load").mockReturnValueOnce(pending);
    const state = snapshot(); state.lumi.phase = "notice_first"; state.answers.push({ id: "lumi_03", pick: "a" });
    village.setLumiView(lumiView(state));
    const loading = (village as unknown as { residentLoading: { lumi: Promise<void> } }).residentLoading.lumi;
    const actors = (village as unknown as { actors: Map<string, { object: THREE.Group }> }).actors;
    expect(actors.get("s1j2")!.object.position.x).toBe((map.zones as Record<string, { x: number }>)["lumi-stagekeeper"]!.x);
    village.setLumiView(null);
    finish({ objects, setView: (view: unknown) => views.push(view) } as unknown as ResidentProps);
    await loading;
    expect(views.at(-1)).toBeNull();
    const original = map.actors.find(a => a.id === "s1j2")!;
    expect([actors.get("s1j2")!.object.position.x, actors.get("s1j2")!.object.position.z]).toEqual([original.x, original.z]);
    const { colliders, colliderOwners } = village as unknown as { colliders: Collider[]; colliderOwners: string[] };
    expect(colliders[colliderOwners.indexOf("s1j2")]).toMatchObject({ x: original.x, z: original.z });
    expect(actors.get("lumi-neighbor-1")!.object.visible).toBe(false);
    load.mockRestore();
  });
  it("moves the same Or helpers for a group review and restores Or when another episode starts", async () => {
    const village = world();
    const load = vi.spyOn(ResidentProps, "load").mockImplementation(async () => fakeProps());
    const state = snapshot(); state.or.phase = "review"; state.answers.push({ id: "or_04", pick: "a" }, { id: "or_06", pick: "b" });
    village.setOrView(orView(state)); await (village as unknown as { residentLoading: { or: Promise<void> } }).residentLoading.or;
    const actors = (village as unknown as { actors: Map<string, { object: THREE.Group }> }).actors;
    const fisher = actors.get("or-fisher")!, merchant = actors.get("or-merchant")!;
    expect(fisher.object.position.x).toBe((map.zones as Record<string, { x: number }>)["or-review-fisher"]!.x);
    expect(merchant.object.position.x).toBe((map.zones as Record<string, { x: number }>)["or-review-merchant"]!.x);
    state.or.phase = "completed"; village.setOrView(orView(state));
    expect(actors.get("D")!.object.position.x).toBe((map.zones as Record<string, { x: number }>)["or-report"]!.x);
    state.lumi.phase = "choose_01"; village.setLumiView(lumiView(state));
    expect(actors.get("D")!.object.position.x).toBe(map.actors.find(a => a.id === "D")!.x);
    expect(actors.get("or-fisher")).toBe(fisher);
    expect(fisher.object.visible).toBe(false);
    expect((village as unknown as { colliderOwners: string[] }).colliderOwners).not.toContain("or-fisher");
    load.mockRestore();
  });
  it("requires availability for an active prop and sends its id instead of examine", () => {
    const village = world(), state = snapshot(); state.lumi.phase = "table"; state.answers.push({ id: "lumi_01", pick: "a" });
    Object.assign(village, { enabled: true, ready: true, portrait: false, tapMarker: new THREE.Group(), visible: () => true, onInteract: vi.fn() });
    (village as unknown as { residentProps: Record<string, unknown> }).residentProps.lumi = fakeProps();
    village.setLumiView(lumiView(state));
    const prop = map.props.find(p => p.id === "lumi-table-alone")!;
    (village as unknown as { player: THREE.Group }).player.position.set(prop.x + .5, 0, prop.z);
    village.interactTarget(prop.id);
    expect(village.onInteract).not.toHaveBeenCalled();
    village.setAvailable([prop.id]); village.interactTarget(prop.id);
    expect(village.onInteract).toHaveBeenCalledWith(prop.id);
  });
  it("rejects an active prop hidden by its parent", () => {
    const village = world(), state = snapshot(); state.lumi.phase = "table"; state.answers.push({ id: "lumi_01", pick: "a" });
    const group = new THREE.Group(), object = new THREE.Group(); group.visible = false; group.add(object);
    (village as unknown as { residentProps: Record<string, unknown> }).residentProps.lumi = { objects: new Map([["lumi-table-alone", object]]), setView: () => {} };
    village.setLumiView({ ...lumiView(state), phase: "choose_01", activeTargetIds: ["A"] });
    expect((village as unknown as { colliderOwners: string[] }).colliderOwners).not.toContain("lumi-table-alone");
    expect(() => village.setLumiView(lumiView(state))).toThrow("Active resident prop is not visible: lumi-table-alone");
  });
  it("does not resume to an obsolete view while assets are loading", async () => {
    const village = world(), state = snapshot(); state.lumi.phase = "choose_01";
    let finish!: (value: ResidentProps) => void;
    const pending = new Promise<ResidentProps>(resolve => { finish = resolve; });
    const load = vi.spyOn(ResidentProps, "load").mockReturnValueOnce(pending);
    village.setLumiView(lumiView(state));
    const resume = village.resumeLumi(); await Promise.resolve();
    village.setLumiView(null);
    finish({ objects: new Map(), setView: () => {} } as unknown as ResidentProps);
    await resume;
    expect((village as unknown as { player: THREE.Group }).player.position.toArray()).toEqual([0, 0, 0]);
    load.mockRestore();
  });
  it("surfaces a load failure and retries on resume", async () => {
    const village = world(), state = snapshot(); state.lumi.phase = "choose_01";
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const load = vi.spyOn(ResidentProps, "load").mockRejectedValueOnce(new Error("asset failed")).mockResolvedValueOnce({ objects: new Map(), setView: () => {} } as unknown as ResidentProps);
    village.setLumiView(lumiView(state));
    await expect((village as unknown as { residentLoading: { lumi: Promise<void> } }).residentLoading.lumi).rejects.toThrow("asset failed");
    expect(village.onPathBlocked).toHaveBeenCalled();
    await village.resumeLumi();
    expect(load).toHaveBeenCalledTimes(2);
    error.mockRestore(); load.mockRestore();
  });
});

it("preserves both Moka delivery routes and rest access after other residents complete", () => {
  const assets = manifest.assets as unknown as Record<string, { scale: number; collision: Collider[] }>;
  const guide = (map.zones as Record<string, { x: number; z: number }>)["moka-guide"]!;
  const placements: { id: string; asset: string; x: number; z: number; scale?: number; rot?: number }[] = [...map.props, ...map.actors.map(p => p.id === "v1j2" ? { ...p, ...guide } : p)];
  const colliders = placements.flatMap(p => {
    const asset = assets[p.id === "moka-basket-source" ? "prop-moka-dropoff" : p.asset]!;
    const scale = asset.scale * (p.scale ?? 1), rot = p.rot ?? 0, c = Math.cos(rot), s = Math.sin(rot);
    return asset.collision.map(shape => {
      const x = p.x + (c * shape.x + s * shape.z) * scale, z = p.z + (-s * shape.x + c * shape.z) * scale;
      return shape.type === "circle" ? { type: "circle" as const, x, z, radius: shape.radius * scale } : { type: "box" as const, x, z, halfX: shape.halfX * scale, halfZ: shape.halfZ * scale, rot };
    });
  });
  const props = new Map(map.props.map(p => [p.id, p]));
  const source = props.get("moka-basket-source")!, dropoff = props.get("moka-workshop-dropoff")!, rest = props.get("moka-rest")!;
  const bounds = map.bounds as Bounds;
  const pickup = findPath(map.spawn, source, colliders, bounds);
  expect(pickup).not.toBeNull();
  for (const route of Object.values(moka.routes)) {
    const path = findPathVia(pickup!.at(-1) ?? map.spawn, route.waypoints.map(id => (map.zones as Record<string, { x: number; z: number }>)[id]!), dropoff, colliders, bounds);
    expect(path, route.name).not.toBeNull();
    expect(findPath(path!.at(-1) ?? dropoff, rest, colliders, bounds), route.name).not.toBeNull();
  }
}, 120000);

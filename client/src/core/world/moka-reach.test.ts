import { describe, expect, it } from "vitest";
import map from "../../../../content/world/village.json";
import manifest from "../../../../content/assets/manifest.json";
import quest from "../../../../content/quests/moka-errand.json";
import { findPath, findPathVia } from "./autowalk";
import type { Bounds, Collider, Vec2 } from "./types";

describe("moka world", () => {
  it("connects both routes and all interaction targets", () => {
    type Shape = Omit<Extract<Collider, { type: "box" }>, "rot"> | Extract<Collider, { type: "circle" }>;
    const assets = manifest.assets as unknown as Record<string, { scale: number; collision: Shape[] }>;
    const placements: (Vec2 & { id: string; asset: string; rot?: number; scale?: number })[] = [...map.props, ...map.actors];
    const colliders = placements.flatMap(p => assets[p.asset]!.collision.map(shape => {
      const rot = p.rot ?? 0, scale = assets[p.asset]!.scale * (p.scale ?? 1);
      const c = Math.cos(rot), s = Math.sin(rot);
      const x = p.x + (c * shape.x + s * shape.z) * scale, z = p.z + (-s * shape.x + c * shape.z) * scale;
      return shape.type === "circle" ? { type: "circle" as const, x, z, radius: shape.radius * scale } : { type: "box" as const, x, z, halfX: shape.halfX * scale, halfZ: shape.halfZ * scale, rot };
    }));
    const points = new Map<string, Vec2>([...map.props, ...map.actors].map(p => [p.id, p]));
    for (const [id, point] of Object.entries(map.zones)) points.set(id, point);
    const ids = new Set<string>(["B", "v1j2", ...Object.values(quest.phases).flatMap(phase => "targets" in phase ? phase.targets : Object.values(phase.targetsByPick))]);
    for (const route of Object.values(quest.routes)) for (const id of route.waypoints) ids.add(id);
    for (const id of ids) {
      const point = points.get(id);
      expect(point, id).toBeDefined();
      if (point) expect(findPath(map.spawn, point, colliders, map.bounds as Bounds), id).not.toBeNull();
    }
    for (const route of Object.values(quest.routes)) {
      const path = findPathVia(points.get("moka-basket-source")!, route.waypoints.map(id => points.get(id)!), points.get("moka-workshop-dropoff")!, colliders, map.bounds as Bounds);
      expect(path, route.name).not.toBeNull();
    }
  }, 60000);
});

import { describe, expect, it } from "vitest";
import { findPath, followPath } from "./autowalk";
import type { Bounds, Collider } from "./types";

const bounds: Bounds = { outer: [{ x: -5, z: -5 }, { x: 5, z: -5 }, { x: 5, z: 5 }, { x: -5, z: 5 }], holes: [], bridges: [] };

describe("autowalk", () => {
  it("finds a route around an obstacle to interaction range", () => {
    const wall: Collider[] = [{ type: "box", x: 1.5, z: 0, halfX: .3, halfZ: 1.5, rot: 0 }];
    const path = findPath({ x: 0, z: 0 }, { x: 3, z: 0 }, wall, bounds);
    expect(path).not.toBeNull();
    expect(path!.some(p => Math.abs(p.z) > 1.5)).toBe(true);
    expect(Math.hypot(path!.at(-1)!.x - 3, path!.at(-1)!.z)).toBeLessThanOrEqual(.85);
  });

  it("returns null when the target is enclosed", () => {
    const wall: Collider[] = [{ type: "circle", x: 3, z: 0, radius: 1 }];
    expect(findPath({ x: 0, z: 0 }, { x: 3, z: 0 }, wall, bounds)).toBeNull();
  });
  it("follows the route around an obstacle until arrival", () => {
    const wall: Collider[] = [{ type: "box", x: 1.5, z: 0, halfX: .3, halfZ: 1.5, rot: 0 }];
    const target = { x: 3, z: 0 }, path = findPath({ x: 0, z: 0 }, target, wall, bounds)!;
    let state = { position: { x: 0, z: 0 }, path, best: Infinity, stalled: 0, status: "walking" as "walking" | "arrived" | "blocked" };
    for (let i = 0; i < 300 && state.status === "walking"; i++) state = followPath(state, target, wall, bounds, .05);
    expect(state.status).toBe("arrived");
  });
  it("cancels after 1.2 seconds without progress", () => {
    const wall: Collider[] = [{ type: "circle", x: 1, z: 0, radius: .5 }];
    let state = { position: { x: 0, z: 0 }, path: [{ x: 1, z: 0 }], best: Infinity, stalled: 0, status: "walking" as "walking" | "arrived" | "blocked" };
    for (let i = 0; i < 100 && state.status === "walking"; i++) state = followPath(state, { x: 3, z: 0 }, wall, bounds, .05);
    expect(state.status).toBe("blocked");
  });
});

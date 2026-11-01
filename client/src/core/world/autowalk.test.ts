import { describe, expect, it } from "vitest";
import { autowalk } from "./autowalk";
import type { Bounds, Collider } from "./types";

const bounds: Bounds = { outer: [{ x: -5, z: -5 }, { x: 5, z: -5 }, { x: 5, z: 5 }, { x: -5, z: 5 }], holes: [], bridges: [] };

describe("autowalk", () => {
  it("reaches the interaction range", () => {
    let state = { position: { x: 0, z: 0 }, best: 3, stalled: 0, status: "walking" as "walking" | "arrived" | "blocked" };
    for (let i = 0; i < 100 && state.status === "walking"; i++) state = autowalk(state, { x: 3, z: 0 }, [], bounds, .05);
    expect(state.status).toBe("arrived");
  });

  it("cancels after 1.2 seconds without progress", () => {
    const wall: Collider[] = [{ type: "circle", x: 1, z: 0, radius: .5 }];
    let state = { position: { x: 0, z: 0 }, best: 3, stalled: 0, status: "walking" as "walking" | "arrived" | "blocked" };
    for (let i = 0; i < 100 && state.status === "walking"; i++) state = autowalk(state, { x: 3, z: 0 }, wall, bounds, .05);
    expect(state.status).toBe("blocked");
  });
});

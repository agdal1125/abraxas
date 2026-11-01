import { describe, expect, it } from "vitest";
import { Movement } from "./movement";

describe("movement input", () => {
  it("combines keys and touch and clears them on release", () => {
    const movement = new Movement();
    movement.keys.add("KeyW"); movement.keys.add("ArrowRight");
    expect(movement.value()).toEqual([1, 1]);
    movement.pad = [-1, 0];
    expect(movement.value()).toEqual([0, 1]);
    movement.clear();
    expect(movement.value()).toEqual([0, 0]);
  });
});

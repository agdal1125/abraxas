import { expect, it } from "vitest";
import { aligned, gauge, inZone, nextPlacements, roundPlan, scrambled, seeded, sequence, shelfHint, shuffledOrder, sorted, swap, turn } from "./minigames";

const shapes = { "circle-1": "circle", "circle-2": "circle", "square-1": "square" };

it("pairs unused pieces with empty slots of the same shape", () => {
  expect(nextPlacements(shapes, shapes, {}, 2)).toEqual([["circle-1", "circle-1"], ["circle-2", "circle-2"]]);
  expect(nextPlacements(shapes, shapes, { "circle-1": "circle-2" }, 3)).toEqual([["circle-1", "circle-2"], ["square-1", "square-1"]]);
});

it("spreads placements so the last round finishes the board", () => {
  expect(roundPlan(6, 0, 3)).toEqual({ round: 0, size: 2 });
  expect(roundPlan(6, 4, 3)).toEqual({ round: 2, size: 2 });
  expect(roundPlan(3, 2, 3)).toEqual({ round: 2, size: 1 });
  expect(roundPlan(6, 5, 3)).toEqual({ round: 2, size: 1 });
  // A reload mid-round finishes only what that round still owes.
  expect(roundPlan(6, 1, 3)).toEqual({ round: 0, size: 1 });
});

it("repeats a round's sequence for the same seed", () => {
  expect(sequence(["a", "b", "c"], 4, seeded(7))).toEqual(sequence(["a", "b", "c"], 4, seeded(7)));
});

it("sweeps the oven gauge up and back down once per period", () => {
  expect(gauge(0, 2)).toBe(0);
  expect(gauge(.5, 2)).toBeCloseTo(.5);
  expect(gauge(1, 2)).toBeCloseTo(1);
  expect(gauge(1.5, 2)).toBeCloseTo(.5);
  expect(inZone(.6, [.55, .75])).toBe(true);
  expect(inZone(.8, [.55, .75])).toBe(false);
});

it("never deals a shelf that is already sorted, and the hint always makes progress", () => {
  const random = seeded(3);
  let order = shuffledOrder(5, random);
  expect(sorted(order)).toBe(false);
  for (let i = 0; i < 5 && !sorted(order); i++) { const [a, b] = shelfHint(order)!; order = swap(order, a, b); }
  expect(sorted(order)).toBe(true);
  expect(shelfHint(order)).toBeNull();
});

it("turns gears a quarter at a time until all point up", () => {
  let gears = scrambled(3, seeded(5));
  expect(aligned(gears)).toBe(false);
  for (let i = 0; i < gears.length; i++) while (gears[i] !== 0) gears = turn(gears, i);
  expect(aligned(gears)).toBe(true);
});

import { expect, it } from "vitest";
import { DEMI_FOLLOW, pickDemiSpot, stepDemiPlay, tapDemi, type DemiPlay } from "./demi-play";

const tick = { dt: 1, playerMoving: false, distance: 1, arrived: false, roll: 0 };

it("pets the dog nearby and calls it from afar", () => {
  expect(tapDemi(1).kind).toBe("pet");
  expect(tapDemi(4)).toEqual({ kind: "come", thenPet: true });
});

it("wanders only after the player has stood still for a while", () => {
  let play: DemiPlay = DEMI_FOLLOW;
  for (let i = 0; i < 4; i++) play = stepDemiPlay(play, tick);
  expect(play.kind).toBe("follow");
  expect(stepDemiPlay(play, { ...tick, playerMoving: true })).toEqual(DEMI_FOLLOW);
  expect(stepDemiPlay(play, tick).kind).toBe("wander");
});

it("runs back when the player walks out of range", () => {
  const away = { ...tick, playerMoving: true, distance: 4 };
  expect(stepDemiPlay({ kind: "wander" }, away)).toEqual({ kind: "come", thenPet: false });
  expect(stepDemiPlay({ kind: "gesture", gesture: "sniff", left: 2 }, away)).toEqual({ kind: "come", thenPet: false });
});

it("gets petted on arrival only when it was called", () => {
  expect(stepDemiPlay({ kind: "come", thenPet: true }, { ...tick, arrived: true }).kind).toBe("pet");
  const back = stepDemiPlay({ kind: "come", thenPet: false }, { ...tick, arrived: true });
  expect(back.kind).toBe("follow");
  expect(back.kind === "follow" && back.still).toBeLessThan(0);
});

it("stops petting as soon as the player walks on", () => {
  expect(stepDemiPlay({ kind: "pet", left: 1 }, { ...tick, dt: .1, playerMoving: true }).kind).toBe("follow");
});

it("picks a stop beside a spot in reach and skips blocked or far ones", () => {
  const dog = { x: 0, z: 0 }, player = { x: 0, z: 0 };
  const near = { x: 2, z: 0, extent: .2 }, far = { x: 9, z: 0, extent: .2 };
  const stop = pickDemiSpot([near, far], dog, player, () => true, 0)!;
  expect(stop.x).toBeCloseTo(1.56);
  expect(stop.z).toBeCloseTo(0);
  expect(pickDemiSpot([near], dog, player, () => false, 0)).toBeNull();
  expect(pickDemiSpot([far], dog, player, () => true, 0)).toBeNull();
});

import type { Vec2 } from "./types";

export type DemiGesture = "pet" | "sniff" | "tilt";
export type DemiPlay =
  | { kind: "follow"; still: number }
  | { kind: "wander" }
  | { kind: "gesture"; gesture: "sniff" | "tilt"; left: number }
  | { kind: "come"; thenPet: boolean }
  | { kind: "pet"; left: number };
export type DemiTick = { dt: number; playerMoving: boolean; distance: number; arrived: boolean; roll: number };
export type DemiSpot = Vec2 & { extent: number };

const PET_REACH = 1.2;
const IDLE_WAIT = 5;
const REST_AFTER_RETURN = -6;
const LEASH = 3;
const GESTURE_TIME = 2.4;
const PET_TIME = 1.6;
const SPOT_RANGE = 2.6;
const SPOT_CLEARANCE = .24;

export const DEMI_FOLLOW: DemiPlay = { kind: "follow", still: 0 };
export const DEMI_RESTED: DemiPlay = { kind: "follow", still: REST_AFTER_RETURN };

export function tapDemi(distance: number): DemiPlay {
  return distance <= PET_REACH ? { kind: "pet", left: PET_TIME } : { kind: "come", thenPet: true };
}

export function stepDemiPlay(play: DemiPlay, { dt, playerMoving, distance, arrived, roll }: DemiTick): DemiPlay {
  const leftBehind = playerMoving && distance > LEASH;
  switch (play.kind) {
    case "follow": {
      const still = playerMoving ? Math.min(play.still, 0) : play.still + dt;
      return still >= IDLE_WAIT ? { kind: "wander" } : { kind: "follow", still };
    }
    case "wander":
      if (leftBehind) return { kind: "come", thenPet: false };
      return arrived ? { kind: "gesture", gesture: roll < .6 ? "sniff" : "tilt", left: GESTURE_TIME } : play;
    case "gesture":
      if (leftBehind || play.left <= dt) return { kind: "come", thenPet: false };
      return { ...play, left: play.left - dt };
    case "come":
      if (!arrived) return play;
      return play.thenPet ? { kind: "pet", left: PET_TIME } : DEMI_RESTED;
    case "pet":
      return playerMoving || play.left <= dt ? DEMI_RESTED : { ...play, left: play.left - dt };
  }
}

// A spot is only worth trotting to when it stays near the player and the way there is a clear straight line.
export function pickDemiSpot(spots: DemiSpot[], dog: Vec2, player: Vec2, canWalk: (from: Vec2, to: Vec2) => boolean, roll: number): Vec2 | null {
  const stops = spots.flatMap(spot => {
    const dx = dog.x - spot.x, dz = dog.z - spot.z, length = Math.hypot(dx, dz);
    if (length < 1e-6) return [];
    const reach = spot.extent + SPOT_CLEARANCE;
    if (length <= reach) return [];
    const stop = { x: spot.x + dx / length * reach, z: spot.z + dz / length * reach };
    return Math.hypot(stop.x - player.x, stop.z - player.z) <= SPOT_RANGE && canWalk(dog, stop) ? [stop] : [];
  });
  return stops[Math.floor(roll * stops.length)] ?? null;
}

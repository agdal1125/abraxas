import { step } from "./move";
import { nearest } from "./nearby";
import type { Bounds, Collider, Vec2 } from "./types";

type State = { position: Vec2; best: number; stalled: number; status: "walking" | "arrived" | "blocked" };
type Target = Vec2 & { colliders?: Collider[] };

export function autowalk(state: State, target: Target, colliders: Collider[], bounds: Bounds, dt: number): State {
  const reached = (position: Vec2) => nearest(position, [{ id: "target", ...target }]) !== null;
  if (reached(state.position)) return { ...state, status: "arrived" };
  const dx = target.x - state.position.x, dz = target.z - state.position.z, length = Math.hypot(dx, dz);
  const position = step(state.position, { x: dx / length, z: dz / length }, dt, colliders, bounds);
  const distance = Math.hypot(target.x - position.x, target.z - position.z);
  const progress = distance < state.best - .01;
  const stalled = progress ? 0 : state.stalled + dt;
  return { position, best: progress ? distance : state.best, stalled, status: reached(position) ? "arrived" : stalled >= 1.2 ? "blocked" : "walking" };
}

import { step, walkable } from "./move";
import { nearest } from "./nearby";
import type { Bounds, Collider, Vec2 } from "./types";

type State = { position: Vec2; best: number; stalled: number; status: "walking" | "arrived" | "blocked" };
type Target = Vec2 & { colliders?: Collider[] };

export function findPath(start: Vec2, target: Target, colliders: Collider[], bounds: Bounds, visible: (position: Vec2) => boolean = () => true): Vec2[] | null {
  const spacing = .25, canMove = walkable(colliders, bounds);
  const point = (x: number, z: number): Vec2 => ({ x: start.x + x * spacing, z: start.z + z * spacing });
  const key = (x: number, z: number) => `${x},${z}`;
  type Node = { x: number; z: number; cost: number; score: number; parent?: Node };
  const heuristic = (p: Vec2) => target.colliders?.length ? 0 : Math.max(0, Math.hypot(p.x - target.x, p.z - target.z) - .85);
  const open: Node[] = [{ x: 0, z: 0, cost: 0, score: heuristic(start) }], best = new Map([[key(0, 0), 0]]);
  while (open.length) {
    open.sort((a, b) => b.score - a.score);
    const current = open.pop()!, p = point(current.x, current.z);
    if (current.cost !== best.get(key(current.x, current.z))) continue;
    if (nearest(p, [{ id: "target", ...target }]) && visible(p)) {
      const path: Vec2[] = [];
      for (let node: Node | undefined = current; node?.parent; node = node.parent) path.push(point(node.x, node.z));
      return path.reverse();
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = current.x + dx, z = current.z + dz, next = point(x, z), cost = current.cost + spacing, id = key(x, z);
      if (cost >= (best.get(id) ?? Infinity) || !canMove(p, next)) continue;
      best.set(id, cost); open.push({ x, z, cost, score: cost + heuristic(next), parent: current });
    }
  }
  return null;
}

export function followPath(state: State & { path: Vec2[] }, target: Target, colliders: Collider[], bounds: Bounds, dt: number): State & { path: Vec2[] } {
  const waypoint = state.path[0];
  if (!waypoint) return { ...state, status: nearest(state.position, [{ id: "target", ...target }]) ? "arrived" : "blocked" };
  const dx = waypoint.x - state.position.x, dz = waypoint.z - state.position.z, distance = Math.hypot(dx, dz);
  const position = distance < 1e-6 ? state.position : step(state.position, { x: dx / distance, z: dz / distance }, Math.min(dt, distance / 1.4), colliders, bounds);
  const remaining = Math.hypot(waypoint.x - position.x, waypoint.z - position.z);
  if (remaining < 1e-5) {
    const path = state.path.slice(1);
    return { position, path, best: Infinity, stalled: 0, status: path.length ? "walking" : "arrived" };
  }
  const progress = remaining < state.best - .01, stalled = progress ? 0 : state.stalled + dt;
  return { position, path: state.path, best: progress ? remaining : state.best, stalled, status: stalled >= 1.2 ? "blocked" : "walking" };
}

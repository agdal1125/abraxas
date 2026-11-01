export type Vec2 = { x: number; z: number };
export type Collider =
  | { type: 'circle'; x: number; z: number; radius: number }
  | { type: 'box'; x: number; z: number; halfX: number; halfZ: number; rot: number };
export type Bounds = { outer: Vec2[]; holes: Vec2[][]; bridges: { points: Vec2[] }[] };

// Pure rules for the errand minigames. Results are never measured: a round only decides
// how many already-valid placements the client sends to the server.

export type Pair = [piece: string, slot: string];

// The next `count` unused pieces matched to empty slots of the same shape, in a stable order.
export function nextPlacements(pieces: Record<string, string>, slots: Record<string, string>, placements: Record<string, string | undefined>, count: number): Pair[] {
  const used = new Set(Object.values(placements).filter(Boolean));
  const pairs: Pair[] = [];
  for (const slot of Object.keys(slots).sort()) {
    if (pairs.length >= count) break;
    if (placements[slot]) continue;
    const piece = Object.keys(pieces).sort().find(id => !used.has(id) && pieces[id] === slots[slot]);
    if (piece) { used.add(piece); pairs.push([piece, slot]); }
  }
  return pairs;
}

// Splits the placements still to make over the rounds still to play, so the last round finishes the board.
export function roundPlan(total: number, placed: number, rounds: number): { round: number; size: number } {
  const per = Math.ceil(total / rounds);
  const round = Math.min(rounds - 1, Math.floor(placed / per));
  return { round, size: Math.min(per * (round + 1), total) - placed };
}

// Mulberry32: a tiny seeded generator so a round looks the same after a reload.
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function sequence<T>(options: readonly T[], length: number, random: () => number): T[] {
  return Array.from({ length }, () => options[Math.floor(random() * options.length)]!);
}

// Oven gauge: the needle sweeps 0 → 1 → 0 once per period.
export function gauge(seconds: number, period: number): number {
  const phase = (seconds / period) % 1;
  return phase < .5 ? phase * 2 : 2 - phase * 2;
}
export const inZone = (value: number, zone: readonly [number, number]): boolean => value >= zone[0] && value <= zone[1];

// Shelf: books must stand in ascending mark order. A tap on two books swaps them.
export function shuffledOrder(size: number, random: () => number): number[] {
  const order = Array.from({ length: size }, (_, i) => i);
  do for (let i = size - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j]!, order[i]!]; }
  while (order.every((value, index) => value === index));
  return order;
}
export function swap(order: readonly number[], i: number, j: number): number[] { const next = [...order]; [next[i], next[j]] = [next[j]!, next[i]!]; return next; }
export const sorted = (order: readonly number[]): boolean => order.every((value, index) => value === index);
// The book that belongs at the first misplaced spot, and that spot: one swap that always makes progress.
export function shelfHint(order: readonly number[]): [number, number] | null {
  const spot = order.findIndex((value, index) => value !== index);
  return spot < 0 ? null : [spot, order.indexOf(spot)];
}

// Gears: each gear turns a quarter per tap; the train runs when every gear points up (0).
export const turn = (rotations: readonly number[], index: number): number[] => rotations.map((value, i) => i === index ? (value + 1) % 4 : value);
export const aligned = (rotations: readonly number[]): boolean => rotations.every(value => value === 0);
export function scrambled(size: number, random: () => number): number[] {
  const rotations = Array.from({ length: size }, () => Math.floor(random() * 4));
  if (aligned(rotations)) rotations[0] = 1 + Math.floor(random() * 3);
  return rotations;
}

import { progress, type Data, type Input } from "./scoring";

const mainAxes = ["A", "B", "C", "D"] as const;
export type MainAxis = typeof mainAxes[number];
export type NpcShift = "deepened" | "steady" | "wavering" | "turned";
export type NpcChange = { axis: MainAxis; shift: NpcShift };
export type Moment = { axis: MainAxis; itemId: string; pick: string; boundary: boolean };
export type Reflection = { npcChanges: Record<string, NpcChange[]>; moments: Moment[]; topValues: string[] };

const shiftPriority: NpcShift[] = ["turned", "wavering", "deepened", "steady"];

function shiftOf(start: number, current: number, step: number): NpcShift {
  const net = (current * Math.sign(start) - Math.abs(start)) / step;
  return net >= 2 ? "deepened" : net >= 0 ? "steady" : net > -2 ? "wavering" : "turned";
}

function momentFor(axis: MainAxis, pole: number, boundary: boolean, input: Input, data: Data): Moment {
  const gate = data.tiebreakers.find(item => item.axis === axis)!;
  const fromGate: Moment = { axis, itemId: gate.id, pick: input.log.find(entry => entry.id === gate.id)!.pick, boundary };
  if (boundary) return fromGate;
  let best: Moment | null = null, bestWeight = 0;
  for (const entry of input.log) {
    const item = data.items.find(candidate => candidate.id === entry.id);
    if (item?.axis !== axis) continue;
    const weight = (item.picks[entry.pick]?.w[axis] ?? 0) * pole;
    if (weight > 0 && weight >= bestWeight) { best = { axis, itemId: item.id, pick: entry.pick, boundary }; bestWeight = weight; }
  }
  return best ?? fromGate;
}

function topValues(input: Input, data: Data): string[] {
  const counts = new Map<string, { count: number; last: number }>();
  input.log.forEach((entry, index) => {
    const item = data.items.find(candidate => candidate.id === entry.id);
    for (const value of item?.picks[entry.pick]?.values ?? []) counts.set(value, { count: (counts.get(value)?.count ?? 0) + 1, last: index });
  });
  return [...counts].sort(([, a], [, b]) => b.count - a.count || b.last - a.last).slice(0, 3).map(([value]) => value);
}

export function reflection(input: Input, type: string, data: Data): Reflection {
  const { npcs, s } = progress(input, data);
  const npcChanges = Object.fromEntries(data.npcs.map(npc => [npc.id, npc.themeAxes.map(axis => ({ axis, shift: shiftOf(npc.start[axis], npcs[npc.id]!.s[axis], data.rules.npcStep) }))]));
  const moments = mainAxes.map((axis, index) => momentFor(axis, type[index] === "OHVG"[index] ? 1 : -1, Math.abs(s[axis]) < data.rules.tieThreshold, input, data));
  return { npcChanges, moments, topValues: topValues(input, data) };
}

export function walkKnot(npcId: string, changes: NpcChange[]): string {
  const change = [...changes].sort((a, b) => shiftPriority.indexOf(a.shift) - shiftPriority.indexOf(b.shift))[0]!;
  return `walk_${npcId}_${change.axis}_${change.shift}`;
}

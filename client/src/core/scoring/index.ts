import { clamp } from "../clamp";

const axes = ["A", "B", "C", "D", "E"] as const;
type Axis = typeof axes[number];
type Scores = Record<Axis, number>;
type Item = { id: string; axis: Axis; npc?: string | null; picks: Record<string, { w: Partial<Scores> }> };
type Rules = { scoreLimit: number; tieThreshold: number; npcStep: number; affinityStart: number; affinityGain: number; affinityMin: number; affinityMax: number };
export type Data = { items: Item[]; tiebreakers: Item[]; npcs: { id: string; start: Scores }[]; rules: Rules };
export type Input = { playId: string; log: { id: string; pick: string }[] };

export function score(input: Input, data: Data) {
  if (typeof input?.playId !== "string" || !Array.isArray(input.log)) throw new Error("Invalid input");
  const { rules } = data;
  const s: Scores = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  const npcs: Record<string, { s: Scores; affinity: number }> = Object.fromEntries(data.npcs.map((npc) => [npc.id, { s: { ...npc.start }, affinity: rules.affinityStart }]));
  const items = new Map([...data.items, ...data.tiebreakers].map((item) => [item.id, item]));
  const gates = new Map<string, { item: Item; weights: Partial<Scores> }>();
  const seen = new Set<string>();
  const limit = (value: number) => clamp(value, -rules.scoreLimit, rules.scoreLimit);
  for (const entry of input.log) {
    const item = items.get(entry?.id);
    const pick = item && Object.hasOwn(item.picks, entry.pick) ? item.picks[entry.pick] : undefined;
    if (!item || !pick || seen.has(item.id)) throw new Error("Unknown or duplicate answer");
    seen.add(item.id);
    if (data.tiebreakers.includes(item)) { gates.set(item.axis, { item, weights: pick.w }); continue; }
    for (const axis of axes) s[axis] = limit(s[axis] + (pick.w[axis] ?? 0));
    if (item.npc) {
      const npc = npcs[item.npc];
      if (!npc) throw new Error("Unknown NPC");
      const current = npc.s[item.axis];
      let hash = 2166136261;
      if (current === 0) for (const byte of new TextEncoder().encode(`${input.playId}:${item.id}`)) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
      const expected = current === 0 ? (hash % 2 === 0 ? 1 : -1) : Math.sign(current);
      const chosen = Math.sign(pick.w[item.axis] ?? 0);
      npc.s[item.axis] = limit(current + chosen * rules.npcStep);
      if (expected === chosen) npc.affinity = clamp(npc.affinity + rules.affinityGain, rules.affinityMin, rules.affinityMax);
    }
  }
  if (seen.size !== items.size) throw new Error("Incomplete answers");
  const letters = ["OI", "HL", "VK", "GC"];
  let type = "";
  for (const [index, axis] of axes.slice(0, 4).entries()) {
    const gate = gates.get(axis);
    if (!gate) throw new Error("Missing tiebreaker");
    const weight = gate.weights[axis] ?? 0;
    const direction = Math.abs(s[axis]) < rules.tieThreshold ? weight : s[axis];
    type += letters[index]![direction >= 0 ? 0 : 1];
    s[axis] = limit(s[axis] + weight);
  }
  const modifier = s.E >= rules.tieThreshold ? "today" : s.E <= -rules.tieThreshold ? "tomorrow" : "between";
  return { s, type, modifier, npcs };
}

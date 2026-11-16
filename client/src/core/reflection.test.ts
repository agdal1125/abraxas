import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { reflection, walkKnot, type NpcChange } from "./reflection";
import { score, type Data, type Input } from "./scoring";

const read = (name: string) => JSON.parse(readFileSync(resolve(process.cwd(), "../content/scoring", name), "utf8"));
const data: Data = { ...read("items.json"), ...read("npcs.json"), rules: read("rules.json") };
const all = [...data.items, ...data.tiebreakers];

const randomLog = (seed: number): Input => {
  let state = seed;
  const next = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  return { playId: `play-${seed}`, log: all.map(item => ({ id: item.id, pick: next() < 0.5 ? "a" : "b" })) };
};

describe("reflection", () => {
  it("names every NPC theme-axis outcome and turns only when the final letter flips", () => {
    const base = randomLog(1);
    for (const npc of data.npcs) for (const axis of npc.themeAxes) {
      const items = data.items.filter(item => item.npc === npc.id && item.axis === axis);
      expect(items).toHaveLength(3);
      for (let mask = 0; mask < 8; mask++) {
        const opposite = items.map((_, index) => Math.floor(mask / 2 ** index) % 2 === 1);
        const log = base.log.map(entry => {
          const index = items.findIndex(item => item.id === entry.id);
          if (index < 0) return entry;
          const wanted = opposite[index] ? -Math.sign(npc.start[axis]) : Math.sign(npc.start[axis]);
          return { id: entry.id, pick: Object.keys(items[index]!.picks).find(key => Math.sign(items[index]!.picks[key]!.w[axis] ?? 0) === wanted)! };
        });
        const input = { ...base, log };
        const result = score(input, data);
        const { shift } = reflection(input, result.type, data).npcChanges[npc.id]!.find(change => change.axis === axis)!;
        expect(shift).toBe((["deepened", "steady", "wavering", "turned"] as const)[opposite.filter(Boolean).length]);
        expect(shift === "turned").toBe(Math.sign(result.npcs[npc.id]!.s[axis]) !== Math.sign(npc.start[axis]));
      }
    }
  });

  it("explains each main axis with an answer the player actually gave", () => {
    let boundaries = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const input = randomLog(seed), { type } = score(input, data), { moments } = reflection(input, type, data);
      expect(moments.map(moment => moment.axis)).toEqual(["A", "B", "C", "D"]);
      moments.forEach((moment, index) => {
        expect(input.log).toContainEqual({ id: moment.itemId, pick: moment.pick });
        const item = all.find(candidate => candidate.id === moment.itemId)!;
        expect(item.axis).toBe(moment.axis);
        if (moment.boundary) { boundaries++; expect(data.tiebreakers).toContain(item); }
        else if (data.items.includes(item)) expect(Math.sign(item.picks[moment.pick]!.w[moment.axis] ?? 0)).toBe(type[index] === "OHVG"[index] ? 1 : -1);
      });
    }
    expect(boundaries).toBeGreaterThan(0);
  });

  it("ranks values by count and breaks ties with the most recent choice", () => {
    const dilemma = (id: string, values: string[]) => ({ id, axis: "E" as const, picks: { a: { w: { E: 8 }, values } } });
    const gates = (["A", "B", "C", "D"] as const).map(axis => ({ id: `gate_${axis}`, axis, picks: { a: { w: { [axis]: 3 } } } }));
    const small: Data = { ...data, npcs: [], items: [dilemma("x", ["성취"]), dilemma("y", ["전통", "성취"]), dilemma("z", ["안전"]), dilemma("w", ["조화"])], tiebreakers: gates };
    const log = [...small.items, ...gates].map(item => ({ id: item.id, pick: "a" }));
    expect(reflection({ playId: "p", log }, "OHVG", small).topValues).toEqual(["성취", "조화", "안전"]);
  });

  it("walks to the strongest change and keeps theme-axis order on ties", () => {
    const pair = (a: NpcChange["shift"], b: NpcChange["shift"]): NpcChange[] => [{ axis: "A", shift: a }, { axis: "C", shift: b }];
    expect(walkKnot("lumi", pair("steady", "turned"))).toBe("walk_lumi_C_turned");
    expect(walkKnot("lumi", pair("deepened", "wavering"))).toBe("walk_lumi_C_wavering");
    expect(walkKnot("lumi", pair("deepened", "steady"))).toBe("walk_lumi_A_deepened");
    expect(walkKnot("lumi", pair("steady", "steady"))).toBe("walk_lumi_A_steady");
  });
});

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { progress, score, type Data, type Input } from "./index";

const dir = resolve(process.cwd(), "../content/scoring");
const read = (name: string) => JSON.parse(readFileSync(resolve(dir, name), "utf8"));
const data: Data = { ...read("items.json"), ...read("npcs.json"), rules: read("rules.json") };
const cases = readdirSync(resolve(dir, "golden")).filter((name) => name.endsWith(".json")).map((name) => read(`golden/${name}`) as Input & { name: string; expect: unknown });
describe("scoring", () => {
  it.each(cases)("$name", (example) => expect(score(example, data)).toEqual(example.expect));
  it("rejects missing answers", () => expect(() => score({ playId: "test", log: [] }, data)).toThrow());
  it("rejects duplicate answers", () => expect(() => score({ ...cases[0]!, log: [...cases[0]!.log, cases[0]!.log[0]!] }, data)).toThrow());
  it("calculates reactions in answer order and applies a completion only once", () => {
    const input = { playId: "test", log: [{ id: "moka_01", pick: "a" }, { id: "moka_03", pick: "a" }] };
    const before = progress(input, data);
    expect(before.reactions).toEqual({ moka_01: "thinking", moka_03: "empathy" });
    const after = progress({ ...input, completedErrands: ["moka", "moka"] }, data);
    expect(after.npcs.moka!.affinity).toBe(before.npcs.moka!.affinity + 8);
    expect(after.npcs.moka!.s).toEqual(before.npcs.moka!.s);
    expect(() => score(input, data)).toThrow("Incomplete answers");
  });
  it("clamps completion rewards and rejects unknown completions", () => {
    const high = { ...data, rules: { ...data.rules, affinityStart: 99 } };
    expect(progress({ playId: "test", log: [], completedErrands: ["moka"] }, high).npcs.moka!.affinity).toBe(100);
    expect(() => progress({ playId: "test", log: [], completedErrands: ["invalid"] }, data)).toThrow();
  });
  it("uses the deterministic expectation at zero", () => {
    const zero = { ...data, npcs: data.npcs.map((npc) => npc.id === "moka" ? { ...npc, start: { ...npc.start, D: 0 } } : npc) };
    expect(progress({ playId: "test", log: [{ id: "moka_01", pick: "a" }] }, zero).reactions.moka_01).toBe("thinking");
  });
  it("calculates each reaction from preceding answers", () => {
    const log = [{ id: "moka_01", pick: "a" }, { id: "moka_03", pick: "b" }, { id: "moka_05", pick: "a" }];
    expect(progress({ playId: "test", log }, data).reactions.moka_05).toBe("empathy");
    expect(progress({ playId: "test", log: [...log].reverse() }, data).reactions.moka_05).toBe("thinking");
  });
  it("preserves personality for every set of moka answers with completion", () => {
    for (let mask = 0; mask < 64; mask++) {
      const log = cases[0]!.log.map((entry) => {
        const match = /^moka_0([1-6])$/.exec(entry.id);
        return match ? { ...entry, pick: mask & (1 << (Number(match[1]) - 1)) ? "a" : "b" } : entry;
      });
      const base = score({ playId: "test", log }, data);
      const completed = score({ playId: "test", log, completedErrands: ["moka"] }, data);
      expect({ s: completed.s, type: completed.type, modifier: completed.modifier }).toEqual({ s: base.s, type: base.type, modifier: base.modifier });
      expect(completed.npcs.moka!.affinity).toBe(Math.min(base.npcs.moka!.affinity + 8, 100));
    }
  });
});

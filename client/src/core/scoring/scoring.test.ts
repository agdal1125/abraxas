import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { score, type Data, type Input } from "./index";

const dir = resolve(process.cwd(), "../content/scoring");
const read = (name: string) => JSON.parse(readFileSync(resolve(dir, name), "utf8"));
const data: Data = { ...read("items.json"), ...read("npcs.json"), rules: read("rules.json") };
const cases = readdirSync(resolve(dir, "golden")).filter((name) => name.endsWith(".json")).map((name) => read(`golden/${name}`) as Input & { name: string; expect: unknown });
describe("scoring", () => {
  it.each(cases)("$name", (example) => expect(score(example, data)).toEqual(example.expect));
  it("rejects missing answers", () => expect(() => score({ playId: "test", log: [] }, data)).toThrow());
  it("rejects duplicate answers", () => expect(() => score({ ...cases[0]!, log: [...cases[0]!.log, cases[0]!.log[0]!] }, data)).toThrow());
});

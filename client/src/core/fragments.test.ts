import { describe, expect, it } from "vitest";
import { fragmentCount, MAX_FRAGMENTS, type FragmentGroups } from "./fragments";

const groups: FragmentGroups = { prologue: ["p1", "p2", "p3"], festival: ["f1", "f2", "f3", "f4", "f5"], tiebreakers: ["t1", "t2", "t3", "t4"] };

describe("fragmentCount", () => {
  it("counts a group only when every question is answered", () => {
    expect(fragmentCount([], [], groups)).toBe(0);
    expect(fragmentCount(["p1", "p2"], [], groups)).toBe(0);
    expect(fragmentCount(["p1", "p2", "p3"], [], groups)).toBe(1);
    expect(fragmentCount(["f1", "f2", "f3", "f4"], [], groups)).toBe(0);
    expect(fragmentCount(["f1", "f2", "f3", "f4", "f5"], [], groups)).toBe(2);
    expect(fragmentCount(["t1", "t2", "t3", "t4"], [], groups)).toBe(1);
  });
  it("gives two per completed episode, capped at four, ignoring repeats", () => {
    expect(fragmentCount([], ["lumi"], groups)).toBe(2);
    expect(fragmentCount([], ["lumi", "lumi", "moka"], groups)).toBe(4);
    expect(fragmentCount([], ["lumi", "moka", "echo", "or", "extra"], groups)).toBe(8);
  });
  it("totals twelve when everything is done", () => {
    const all = [...groups.prologue, ...groups.festival, ...groups.tiebreakers];
    expect(fragmentCount(all, ["lumi", "moka", "echo", "or"], groups)).toBe(MAX_FRAGMENTS);
  });
});

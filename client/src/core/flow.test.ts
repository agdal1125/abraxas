import { expect, it } from "vitest";
import { nextSegment } from "./flow";

it("places interludes between chosen episodes and festival after the fourth", () => {
  expect([1, 2, 3, 4].map((count) => nextSegment("ep_lumi", count))).toEqual(["interlude_1", "interlude_2", "interlude_3", "festival"]);
  expect(["title", "prologue", "interlude_1", "festival", "gate"].map((segment) => nextSegment(segment, 0))).toEqual(["prologue", "hub", "hub", "gate", "result"]);
});

import { describe, expect, it } from "vitest";
import { QualityGovernor, QUALITY_STEPS, WINDOW_FRAMES } from "./quality";

const feed = (governor: QualityGovernor, seconds: number, frames: number): number[] => {
  const changes: number[] = [];
  for (let i = 0; i < frames; i++) { const next = governor.sample(seconds); if (next !== null) changes.push(next); }
  return changes;
};

describe("quality governor", () => {
  it("never leaves step 0 on a device that holds 60 fps", () => {
    expect(feed(new QualityGovernor(), 1 / 60, WINDOW_FRAMES * 20)).toEqual([]);
  });

  it("steps down once per two slow windows and stops at the last step", () => {
    const governor = new QualityGovernor();
    expect(feed(governor, 1 / 20, WINDOW_FRAMES)).toEqual([]);
    expect(feed(governor, 1 / 20, WINDOW_FRAMES)).toEqual([1]);
    expect(feed(governor, 1 / 20, WINDOW_FRAMES * 20)).toEqual([2, 3]);
    expect(governor.step).toBe(QUALITY_STEPS.length - 1);
  });

  it("does not react to a single slow window or to stalls", () => {
    const governor = new QualityGovernor();
    feed(governor, 1 / 20, WINDOW_FRAMES);
    feed(governor, 1 / 60, WINDOW_FRAMES);
    feed(governor, 1 / 20, WINDOW_FRAMES);
    expect(governor.step).toBe(0);
    feed(governor, 2, WINDOW_FRAMES * 4);
    feed(governor, 0, WINDOW_FRAMES * 4);
    expect(governor.step).toBe(0);
  });

  it("can be pinned below the last step", () => {
    const governor = new QualityGovernor(0);
    expect(feed(governor, 1 / 10, WINDOW_FRAMES * 10)).toEqual([]);
  });
});

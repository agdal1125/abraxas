import { describe, expect, it } from "vitest";
import { clamp } from "./clamp";

describe("clamp", () => {
  it("returns the value when within [min, max]", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it("clamps values below min to min", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  it("clamps values above max to max", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("throws RangeError when min is greater than max", () => {
    expect(() => clamp(5, 10, 0)).toThrow(RangeError);
  });
});

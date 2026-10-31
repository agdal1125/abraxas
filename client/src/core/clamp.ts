/**
 * Clamps a numeric value within the inclusive [min, max] range.
 */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    throw new RangeError(`min (${min}) must be less than or equal to max (${max})`);
  }
  return Math.min(Math.max(value, min), max);
}

/**
 * Automatic render quality steps for slow phones.
 *
 * Quality only ever goes down, one step at a time, and only after the average frame time stays high for two
 * windows in a row. Devices that keep up never leave step 0, so their picture is unchanged.
 */
export type QualityStep = {
  /** Upper bound for the renderer pixel ratio. */
  pixelRatio: number;
  /** The shadow map is redrawn every Nth frame. */
  shadowEvery: number;
};

export const QUALITY_STEPS: readonly QualityStep[] = [
  { pixelRatio: Infinity, shadowEvery: 1 },
  { pixelRatio: Infinity, shadowEvery: 2 },
  { pixelRatio: 1.25, shadowEvery: 2 },
  { pixelRatio: 1, shadowEvery: 2 },
];

/** Mean frame time above this (about 36 fps) counts as too slow. */
export const SLOW_FRAME_SECONDS = 0.028;
export const WINDOW_FRAMES = 120;

export class QualityGovernor {
  private sum = 0;
  private count = 0;
  private slowWindows = 0;
  private current = 0;

  constructor(private readonly maxStep = QUALITY_STEPS.length - 1) {}

  get step(): number { return this.current; }

  /** Feed the seconds since the previous frame. Returns the new step when it changes, otherwise null. */
  sample(elapsed: number): number | null {
    // Stalls (tab switches, a long garbage collection, the first frame) say nothing about steady rendering.
    if (!(elapsed > 0) || elapsed > 0.25 || this.current >= this.maxStep) return null;
    this.sum += elapsed; this.count++;
    if (this.count < WINDOW_FRAMES) return null;
    const slow = this.sum / this.count > SLOW_FRAME_SECONDS;
    this.sum = 0; this.count = 0;
    this.slowWindows = slow ? this.slowWindows + 1 : 0;
    if (this.slowWindows < 2) return null;
    this.slowWindows = 0;
    return ++this.current;
  }

  /** Drop the partial window, for example when the page comes back from the background. */
  resetWindow(): void { this.sum = 0; this.count = 0; this.slowWindows = 0; }
}

export interface VillageInput {
  setMoveInput?(x: number, y: number): void;
  interactNearby?(): void;
  hitTargetAt?(clientX: number, clientY: number): string | null;
  interactTarget?(id: string): void;
  onNearbyChange?: (target: { id: string; available: boolean; examine?: boolean } | null) => void;
}

export class Movement {
  keys = new Set<string>();
  pad: [number, number] = [0, 0];
  clear(): void { this.keys.clear(); this.pad = [0, 0]; }
  value(): [number, number] {
    const has = (...keys: string[]) => keys.some(key => this.keys.has(key)) ? 1 : 0;
    return [Math.sign(has("ArrowRight", "KeyD") - has("ArrowLeft", "KeyA") + this.pad[0]), Math.sign(has("ArrowUp", "KeyW") - has("ArrowDown", "KeyS") + this.pad[1])];
  }
}

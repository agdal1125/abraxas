import { afterEach, expect, it, vi } from "vitest";
import { playPrelude } from "./cinematic";

class Element extends EventTarget {
  children: Element[] = [];
  className = "";
  textContent = "";
  type = "";
  src = "";
  muted = false;
  paused = true;
  playsInline = false;
  preload = "";
  play = vi.fn(() => Promise.reject(new Error("blocked")));
  pause = vi.fn();
  append(...children: Element[]) { this.children.push(...children); }
  remove() { this.removed = true; }
  removeAttribute(name: string) { if (name === "src") this.src = ""; }
  removed = false;
  click() { this.dispatchEvent(new Event("click")); }
}

const copy = { play: "Play", pause: "Pause", skip: "Skip", mute: "Mute", unmute: "Unmute", fallback: "Awake" };
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("offers a fallback after a missing video and cleans up on continue", async () => {
  vi.stubGlobal("document", { createElement: () => new Element() });
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  const host = new Element();
  const done = playPrelude(host as unknown as HTMLElement, "en", copy);
  const overlay = host.children[0]!;
  const video = overlay.children[0]!;
  video.dispatchEvent(new Event("error"));
  expect(overlay.children.some(child => child.textContent === "Awake")).toBe(true);
  overlay.children.find(child => child.textContent === "Continue")!.click();
  await done;
  expect(video.pause).toHaveBeenCalled();
  expect(video.src).toBe("");
  expect(overlay.removed).toBe(true);
});

it("offers replay after autoplay rejection and falls back after ten seconds", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("document", { createElement: () => new Element() });
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  const host = new Element();
  const done = playPrelude(host as unknown as HTMLElement, "en", copy);
  const overlay = host.children[0]!;
  const video = overlay.children[0]!;
  await Promise.resolve();
  overlay.children.find(child => child.textContent === "Play")!.click();
  expect(video.play).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(10_000);
  expect(overlay.children.some(child => child.textContent === "Awake")).toBe(true);
  overlay.children.find(child => child.textContent === "Skip")!.click();
  await done;
});

it("allows skipping while waiting and reduced motion avoids loading video", async () => {
  vi.stubGlobal("document", { createElement: () => new Element() });
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const host = new Element();
  const done = playPrelude(host as unknown as HTMLElement, "ko", copy);
  const overlay = host.children[0]!;
  expect(overlay.children.some(child => child.src !== "")).toBe(false);
  overlay.children.find(child => child.textContent === "Skip")!.click();
  await done;
  expect(overlay.removed).toBe(true);
});

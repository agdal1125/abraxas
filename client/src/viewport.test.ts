import { afterEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ ready: undefined as Promise<void> | undefined, games: 0 }));
vi.mock("./scenes/village", () => ({ Village: class { whenReady = state.ready; } }));
vi.mock("./ui/game", () => ({ Game: class { constructor() { state.games++; } } }));

class Element extends EventTarget {
  className = ""; textContent = ""; hidden = false; inert = false;
  style = {}; children: Element[] = [];
  classList = { add: vi.fn() };
  append(...children: Element[]) { this.children.push(...children); }
  remove() { this.removed = true; }
  removed = false;
  setAttribute() {}
}

async function start(ready: Promise<void> | undefined) {
  vi.resetModules(); state.ready = ready; state.games = 0;
  const app = new Element(), body = new Element(), root = new Element();
  const doc = Object.assign(new EventTarget(), { body, documentElement: root, querySelector: () => app, createElement: () => new Element(), fullscreenEnabled: false });
  const win = Object.assign(new EventTarget(), { innerWidth: 390, innerHeight: 844, visualViewport: null, matchMedia: () => ({ matches: true }), localStorage: { getItem: () => "1", setItem: () => {} } });
  vi.stubGlobal("document", doc); vi.stubGlobal("window", win);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
  await import("./main");
  return { app, body, win };
}

afterEach(() => vi.unstubAllGlobals());

it("waits for village readiness before opening the game and sends the current viewport", async () => {
  let resolve!: () => void;
  const ready = new Promise<void>(done => { resolve = done; });
  const { app, win } = await start(ready);
  const events: unknown[] = [];
  win.addEventListener("abraxas:viewport", event => events.push((event as CustomEvent).detail));
  expect(state.games).toBe(0);
  resolve(); await ready; await Promise.resolve();
  expect(state.games).toBe(1);
  expect(app.inert).toBe(true);
  expect(events).toContainEqual({ portrait: true, width: 390, height: 844 });
});

it("does not open the game when village readiness fails", async () => {
  let reject!: (error: Error) => void;
  const ready = new Promise<void>((_, fail) => { reject = fail; });
  const { app } = await start(ready);
  reject(new Error("load failed")); await ready.catch(() => {}); await Promise.resolve();
  expect(state.games).toBe(0);
  expect(app.children.some(child => child.removed)).toBe(true);
});

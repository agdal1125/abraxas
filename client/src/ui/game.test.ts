import { expect, test, vi } from "vitest";
import { Game } from "./game";
import { configurePlayTransport } from "../net/plays";

test("an invalid command response shows one error without a retry action", async () => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) });
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ receipt: {} })));
  vi.stubGlobal("fetch", fetcher);
  configurePlayTransport({ auth: { getIdToken: async () => "token" }, baseUrl: "/v1" });
  const panel = vi.fn();
  const game = Object.assign(Object.create(Game.prototype), { state: { lang: "ko" }, snapshot: { playId: "play", revision: 1 }, panel });
  await game.command({ kind: "open_episode", npcId: "echo" }, vi.fn());
  expect(fetcher).toHaveBeenCalledOnce();
  expect(panel).toHaveBeenCalledTimes(2);
  expect(panel.mock.calls[1]![1]).toEqual([]);
});

test("dialogue focuses the actor named by the speaker", () => {
  const element = () => ({ className: "", textContent: "", style: {}, classList: { add: vi.fn() }, append: vi.fn(), replaceChildren: vi.fn(), setAttribute: vi.fn(), addEventListener: vi.fn() });
  vi.stubGlobal("document", { createElement: element });
  const focusSpeaker = vi.fn();
  const game = Object.assign(Object.create(Game.prototype), { state: { lang: "ko" }, overlay: element(), controls: { setActive: vi.fn() }, village: { setEnabled: vi.fn(), focusSpeaker }, updateHud: vi.fn(), token: 0 });
  game.panel("B: 안녕", []);
  game.panel("v1j2: 안녕", []);
  expect(focusSpeaker.mock.calls).toEqual([["B"], ["v1j2"]]);
});

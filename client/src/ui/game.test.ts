import { expect, test, vi } from "vitest";
import { Game } from "./game";
import { configurePlayTransport } from "../net/plays";
import { Compiler } from "inkjs/full";

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
  const elements: { className: string; textContent: string }[] = [];
  const element = () => { const node = { className: "", textContent: "", style: {}, classList: { add: vi.fn() }, append: vi.fn(), replaceChildren: vi.fn(), setAttribute: vi.fn(), addEventListener: vi.fn() }; elements.push(node); return node; };
  vi.stubGlobal("document", { createElement: element });
  const focusSpeaker = vi.fn();
  const game = Object.assign(Object.create(Game.prototype), { state: { lang: "ko" }, overlay: element(), controls: { setActive: vi.fn() }, village: { setEnabled: vi.fn(), focusSpeaker }, updateHud: vi.fn(), token: 0 });
  game.panel("모카: 안녕", []);
  game.panel("시식 안내인: 안녕", []);
  game.panel("안녕", [], "dialogue", "s1j2");
  game.panel("안녕", [], "dialogue", "B");
  expect(focusSpeaker.mock.calls).toEqual([["B"], ["v1j2"], ["s1j2"], ["B"]]);
  expect(elements.filter(node => node.className === "speaker").map(node => node.textContent)).toEqual(["모카", "시식 안내인", "무대지기", "모카"]);
});

test("dialogue parser load failure offers a retry", async () => {
  vi.doMock("inkjs", () => { throw new Error("module unavailable"); });
  const ink = new Compiler("Hello.\n-> END").Compile().ToJson() || "";
  vi.stubGlobal("fetch", vi.fn(async () => new Response(ink)));
  const panel = vi.fn(), advance = vi.fn();
  const game = Object.assign(Object.create(Game.prototype), { state: { lang: "ko", segment: "title", log: [] }, story: null, resumed: false, token: 0, controls: { setActive: vi.fn() }, village: { setEnabled: vi.fn() }, save: vi.fn(), answered: () => 0, panel, advance });
  try {
    await game.open("prologue");
    expect(panel).toHaveBeenCalledOnce();
    expect(advance).not.toHaveBeenCalled();
    vi.doUnmock("inkjs");
    panel.mock.calls[0]![1][0][1]();
    await vi.waitFor(() => expect(advance).toHaveBeenCalledOnce());
  } finally {
    vi.doUnmock("inkjs");
    vi.unstubAllGlobals();
  }
});

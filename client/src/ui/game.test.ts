import { expect, test, vi } from "vitest";
import { Game } from "./game";
import { configurePlayTransport } from "../net/plays";
import fixture from "../../../content/quests/fixtures/lumi-errand.json";
import type { PlaySnapshot } from "../core/play";
declare const __CONTENT_VERSION__: string;

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

test("resident interaction uses the confirmed branch and rejects inactive targets", () => {
  const snapshot = structuredClone(fixture.initial) as PlaySnapshot;
  snapshot.segment = "ep_lumi";
  snapshot.lumi.phase = "notice_first";
  snapshot.lumi.objects.notice = "player";
  snapshot.answers = [{ id: "lumi_03", pick: "a" }];
  const command = vi.fn(), world = vi.fn();
  const game = Object.assign(Object.create(Game.prototype), { snapshot, command, world, residentNarrative: (_npc: string, _knot: string, after: () => void) => after() });
  game.interactResident("lumi", "lumi-board");
  expect(command).not.toHaveBeenCalled();
  game.interactResident("lumi", "lumi-neighbor-1");
  expect(command.mock.calls[0]![0]).toEqual({ kind: "talk", targetId: "lumi-neighbor-1" });
});

test("snapshot sends completed and locked resident views to the world", () => {
  const snapshot = structuredClone(fixture.initial) as PlaySnapshot;
  snapshot.contentVersion = __CONTENT_VERSION__; snapshot.segment = "ep_echo";
  snapshot.lumi.phase = "completed"; snapshot.lumi.completedAt = "2026-11-02T00:00:00Z";
  const village = { setMokaView: vi.fn(), setLumiView: vi.fn(), setEchoView: vi.fn(), setOrView: vi.fn() };
  const game = Object.assign(Object.create(Game.prototype), { state: { lang: "ko" }, village });
  expect(game.applySnapshot(snapshot)).toBe(true);
  expect(village.setMokaView.mock.calls[0]![0].phase).toBe("locked");
  expect(village.setLumiView.mock.calls[0]![0].phase).toBe("completed");
  expect(village.setEchoView.mock.calls[0]![0].phase).toBe("locked");
  expect(village.setOrView.mock.calls[0]![0].phase).toBe("locked");
});

import { expect, test, vi } from "vitest";
import { Game } from "./game";
import { configurePlayTransport } from "../net/plays";
import fixture from "../../../content/quests/fixtures/lumi-errand.json";
import type { PlaySnapshot } from "../core/play";
declare const __CONTENT_VERSION__: string;
import { Compiler } from "inkjs/full";
import { data, translations } from "../content";

test.each(["pending", "failed"])("dialogue continues when font loading is %s", async status => {
  const ink = new Compiler("-> END\n=== scene ===\n바구니 밑도 살펴뒀어.\n-> END").Compile().ToJson() || "";
  const load = vi.fn(() => status === "pending" ? new Promise(() => {}) : Promise.reject(new Error("font unavailable")));
  vi.stubGlobal("document", { fonts: { load } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(ink)));
  const panel = vi.fn();
  const game = Object.assign(Object.create(Game.prototype), { state: { lang: "ko" }, token: 0, panel });
  try {
    void game.narrative("test", "scene");
    await vi.waitFor(() => expect(panel).toHaveBeenCalled(), { timeout: 1500 });
    expect(panel.mock.calls[0]![0]).toContain("살펴뒀어");
    expect(load).toHaveBeenCalledWith("400 17px 'Pretendard Variable'", ink);
  } finally { vi.unstubAllGlobals(); }
});

test("interlude resumes at each unanswered knot with Demi seated", async () => {
  const events: string[] = [];
  const game = Object.assign(Object.create(Game.prototype), { state: { segment: "interlude_1", log: [{ id: "interlude_1_01", pick: "a" }] }, village: { setStoryScene: (x: string) => events.push(x), setDemiMode: (x: string) => events.push(x) }, narrative: async (_file: string, knot: string, choice: boolean) => { events.push(knot); if (choice) game.state.log.push({ id: knot, pick: "a" }); }, finish: () => events.push("finish") });
  await game.lateScene();
  expect(events).toEqual(["interlude", "sit", "interlude_1_intro", "interlude_1_02", "interlude_1_outro", "follow", "finish"]);
});

test("gate asks all unanswered questions in order while Demi waits", async () => {
  const events: string[] = [];
  const game = Object.assign(Object.create(Game.prototype), { state: { segment: "gate", log: [] }, village: { setStoryScene: (x: string) => events.push(x), setDemiMode: (x: string) => events.push(x) }, narrative: async (_file: string, knot: string, choice: boolean) => { events.push(knot); if (choice) game.state.log.push({ id: knot, pick: "a" }); }, finish: () => events.push("finish") });
  await game.lateScene();
  expect(events).toEqual(["gate", "gate", "gate_intro", "gate_a", "gate_b", "gate_c", "gate_d", "gate_outro", "follow", "finish"]);
});

test("festival skips a companion command already confirmed by the server", async () => {
  const events: string[] = [];
  const game = Object.assign(Object.create(Game.prototype), { state: { segment: "festival", log: data.items.filter(x => x.segment === "festival").map(x => ({ id: x.id, pick: "a" })) }, snapshot: { festivalCompanion: "echo" }, village: { setStoryScene: vi.fn(), setDemiMode: vi.fn() }, narrative: async (_file: string, knot: string) => { events.push(knot); }, companion: vi.fn(), finish: vi.fn() });
  await game.lateScene();
  expect(game.companion).not.toHaveBeenCalled();
  expect(events).toContain("festival_companion_echo");
});

test("a double click sends the festival companion command once", async () => {
  const nodes: { textContent: string; dataset: Record<string, string>; listeners: Record<string, () => void> }[] = [];
  const element = () => { const node = { textContent: "", className: "", dataset: {} as Record<string, string>, listeners: {} as Record<string, () => void>, style: {}, classList: { add: vi.fn() }, append: vi.fn(), replaceChildren: vi.fn(), setAttribute: vi.fn(), addEventListener: (name: string, action: () => void) => { node.listeners[name] = action; }, querySelectorAll: () => nodes.filter(value => value.dataset.itemId?.startsWith("companion-")) }; nodes.push(node); return node; };
  vi.stubGlobal("document", { createElement: element });
  const command = vi.fn((_command: unknown, after: () => void) => after());
  const game = Object.assign(Object.create(Game.prototype), { state: { lang: "ko" }, snapshot: {}, token: 0, overlay: element(), controls: { setActive: vi.fn() }, village: { setEnabled: vi.fn() }, updateHud: vi.fn(), command });
  try {
    const result = game.companion();
    const button = nodes.find(node => node.dataset.action === "companion-lumi")!;
    button.listeners.click!(); button.listeners.click!();
    await expect(result).resolves.toBe("lumi");
    expect(command).toHaveBeenCalledOnce();
    expect(command.mock.calls[0]![0]).toEqual({ kind: "festival_companion", npcId: "lumi" });
  } finally { vi.unstubAllGlobals(); }
});

test("a confirmed non-NPC choice shows its thinking reaction", () => {
  const item = data.items.find(candidate => candidate.id === "prologue_01")!;
  const panel = vi.fn();
  const game = Object.assign(Object.create(Game.prototype), { state: { lang: "ko", segment: "prologue", log: [] }, snapshot: {}, panel, command: (_command: unknown, after: (result: unknown) => void) => after({ receipt: { reaction: null } }) });
  game.choose(item, "a");
  expect(panel.mock.calls[0]![0]).toContain(translations("ko").dialogue.reactions.prologue_01!.thinking);
});

test("result cards use the server result without displaying its codes or numbers", () => {
  const panel = vi.fn();
  const game = Object.assign(Object.create(Game.prototype), { state: { lang: "ko", log: [] }, snapshot: { confession: { npcId: "lumi", reason: "both", outcome: "waiting" }, result: { type: "OHVG", modifier: "today", npcTypes: { lumi: "ILKC", moka: "OHKC", echo: "ILVC", or: "ILKG" } }, festivalCompanion: "moka" }, panel, overlay: { querySelectorAll: () => [] } });
  for (let card = 0; card < 3; card++) game.result(card);
  for (const call of panel.mock.calls) expect(call[0]).not.toMatch(/OHVG|ILKC|\d/);
  expect(panel.mock.calls[0]![0]).toContain(translations("ko").ui.result.first);
  expect(panel.mock.calls[1]![0]).toContain(translations("ko").ui.result.reflection.both);
});

test("resuming before the name was saved asks for it again", async () => {
  const nameInput = vi.fn(async () => { throw new Error("name requested"); });
  const game = Object.assign(Object.create(Game.prototype), { resumed: true, display: () => ({}), loadDisplay: vi.fn(), nameInput });
  await expect(game.opening()).rejects.toThrow("name requested");
  expect(nameInput).toHaveBeenCalledOnce();
});

test.each(["accepted", "waiting"])("confession follows the server outcome %s", async outcome => {
  const events: string[] = [];
  const command = vi.fn((_command: unknown, after: (result: unknown) => void) => after({ snapshot: { confession: { npcId: "echo", reason: "both", outcome } } }));
  const game = Object.assign(Object.create(Game.prototype), { state: { lang: "ko" }, snapshot: {}, demiRevealed: true, village: { setStoryScene: vi.fn(), setDemiMode: vi.fn() }, selectEnding: vi.fn().mockResolvedValueOnce("echo").mockResolvedValueOnce("both"), command, narrative: async (_file: string, knot: string) => { events.push(knot); if (knot.startsWith("confession_echo_")) throw new Error("stop"); } });
  await expect(game.ending()).rejects.toThrow("stop");
  expect(command).toHaveBeenCalledOnce();
  expect(command.mock.calls[0]![0]).toEqual({ kind: "confess", npcId: "echo", reason: "both" });
  expect(events.at(-1)).toBe(`confession_echo_${outcome}`);
});

test("a local choice is not confirmed when storage fails", () => {
  vi.stubGlobal("localStorage", { setItem: () => { throw new Error("storage unavailable"); } });
  const item = data.items.find(candidate => candidate.id === "prologue_01")!;
  const panel = vi.fn(), proceed = vi.fn();
  const game = Object.assign(Object.create(Game.prototype), { state: { lang: "ko", segment: "prologue", log: [] }, snapshot: null, panel });
  try { game.choose(item, "a", proceed); expect(game.state.log).toEqual([]); expect(proceed).not.toHaveBeenCalled(); expect(panel).toHaveBeenCalledOnce(); } finally { vi.unstubAllGlobals(); }
});

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

test("Demi's displayed name changes only after the reveal", () => {
  const elements: { className: string; textContent: string }[] = [];
  const element = () => { const node = { className: "", textContent: "", dataset: {}, style: {}, classList: { add: vi.fn() }, append: vi.fn(), replaceChildren: vi.fn(), setAttribute: vi.fn(), addEventListener: vi.fn() }; elements.push(node); return node; };
  vi.stubGlobal("document", { createElement: element });
  const game = Object.assign(Object.create(Game.prototype), { state: { lang: "ko" }, overlay: element(), controls: { setActive: vi.fn() }, village: { setEnabled: vi.fn() }, updateHud: vi.fn(), token: 0, demiRevealed: false });
  try {
    game.panel("데미: ...", []); game.demiRevealed = true; game.panel("데미: ...", []);
    expect(elements.filter(node => node.className === "speaker").map(node => node.textContent)).toEqual(["???", "데미"]);
  } finally { vi.unstubAllGlobals(); }
});

test("settings opens credits and returns to settings", () => {
  const nodes: { tag: string; textContent: string; href: string; target: string; rel: string; listeners: Record<string, () => void> }[] = [];
  const element = (tag = "div") => { const node = { tag, textContent: "", href: "", target: "", rel: "", listeners: {} as Record<string, () => void>, append: vi.fn(), replaceChildren: vi.fn(), setAttribute: vi.fn(), querySelector: () => null, addEventListener: (name: string, action: () => void) => { node.listeners[name] = action; } }; nodes.push(node); return node; };
  vi.stubGlobal("document", { createElement: element });
  const game = Object.assign(Object.create(Game.prototype), { state: { lang: "ko" }, controls: { setActive: vi.fn() }, village: { setEnabled: vi.fn() }, overlay: element(), settingsMenu: element(), settingsButton: element() });
  try {
    game.settings(); nodes.find(node => node.tag === "button" && node.textContent === "만든 자료")!.listeners.click!();
    expect(nodes.some(node => node.textContent.includes("The Day We Smiled (60s Edit)"))).toBe(true);
    expect(nodes.find(node => node.textContent === "CC BY 3.0")).toMatchObject({ href: "http://creativecommons.org/licenses/by/3.0/", target: "_blank", rel: "noopener noreferrer" });
    nodes.find(node => node.tag === "button" && node.textContent === "뒤로")!.listeners.click!();
    expect(nodes.filter(node => node.tag === "button" && node.textContent === "만든 자료")).toHaveLength(2);
  } finally { vi.unstubAllGlobals(); }
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

test("title does not request ink content", () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  const game = Object.assign(Object.create(Game.prototype), { state: { lang: "ko" }, localSave: null, village: {}, panel: vi.fn() });
  try { game.title(); expect(fetcher).not.toHaveBeenCalled(); } finally { vi.unstubAllGlobals(); }
});

test("resident dialogue parser failure offers a retry and resumes the selected knot", async () => {
  vi.doMock("inkjs", () => { throw new Error("module unavailable"); });
  const ink = new Compiler("-> END\n=== lumi_choose_01 ===\nHello.\n-> END").Compile().ToJson() || "";
  const fetcher = vi.fn(async () => new Response(ink)); vi.stubGlobal("fetch", fetcher);
  const panel = vi.fn(), advance = vi.fn();
  const game = Object.assign(Object.create(Game.prototype), { state: { lang: "ko" }, token: 0, panel, advance, village: { setDemiMode: vi.fn() } });
  try {
    await game.residentNarrative("lumi", "lumi_choose_01", vi.fn(), true);
    expect(panel).toHaveBeenCalledOnce(); expect(advance).not.toHaveBeenCalled();
    vi.doUnmock("inkjs");
    panel.mock.calls[0]![1][0][1]();
    await vi.waitFor(() => expect(advance).toHaveBeenCalledOnce());
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(game.story).not.toBeNull();
  } finally { vi.doUnmock("inkjs"); vi.unstubAllGlobals(); }
});

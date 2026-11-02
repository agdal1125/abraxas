import { beforeEach, expect, test, vi } from "vitest";
import { configurePlayTransport, createPlay, loadCurrentPlay, recoverPending, sendCommand, PlayApiError } from "./plays";
import { loadPending, savePending } from "./pending";
import { DevAuthTokenSource } from "./auth";
import { initialLumi } from "../core/lumi-errand";
import { initialEcho } from "../core/echo-errand";
import { initialOr } from "../core/or-errand";
import { transitionLumi } from "../core/lumi-errand";
import type { Command, PlaySnapshot } from "../core/play";
import lumiFixture from "../../../content/quests/fixtures/lumi-errand.json";
import mokaFixture from "../../../content/quests/fixtures/moka-errand.json";
import { transitionMoka } from "../core/moka-errand";
import echoFixture from "../../../content/quests/fixtures/echo-errand.json";
import orFixture from "../../../content/quests/fixtures/or-errand.json";
import { transitionEcho } from "../core/echo-errand";
import { transitionOr } from "../core/or-errand";

const pending = { key: "3dbd7b9c-9c94-4acb-9e3b-7b37c3d6df81", expectedRevision: 0, command: { kind: "choice" as const, itemId: "moka_01", pick: "a" as const } };
const snapshot = { playId: "play", contentVersion: "hash", revision: 1, segment: "ep_moka", completedEpisodes: [], answers: [{ id: "moka_01", pick: "a" }], moka: { phase: "pick_up", basket: "source", placements: {}, completedAt: null }, lumi: initialLumi(), echo: initialEcho(), or: initialOr() };
const receipt = { key: pending.key, appliedRevision: 1, reaction: "empathy" };
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => data.has(key) ? data.get(key)! : null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) });
  configurePlayTransport({ auth: { getIdToken: async () => "token" }, baseUrl: "/v1" });
});

test("lost response keeps the same key and body for retry", async () => {
  const fetcher = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(response({ receipt, snapshot }));
  vi.stubGlobal("fetch", fetcher);
  await expect(sendCommand("play", pending)).rejects.toThrow();
  expect(loadPending()).toEqual({ playId: "play", pending });
  expect((await sendCommand("play", loadPending()!.pending)).snapshot).toEqual(snapshot);
  expect(fetcher.mock.calls[0]![1].body).toBe(fetcher.mock.calls[1]![1].body);
  expect(fetcher.mock.calls[0]![1].headers["Idempotency-Key"]).toBe(fetcher.mock.calls[1]![1].headers["Idempotency-Key"]);
  expect(loadPending()).toBeNull();
});

test("refreshes an expired token once", async () => {
  const getIdToken = vi.fn().mockResolvedValueOnce("old").mockResolvedValueOnce("new");
  configurePlayTransport({ auth: { getIdToken }, baseUrl: "/v1" });
  const fetcher = vi.fn().mockResolvedValueOnce(response({ error: "unauthenticated" }, 401)).mockResolvedValueOnce(response(snapshot));
  vi.stubGlobal("fetch", fetcher);
  expect(await loadCurrentPlay()).toEqual(snapshot);
  expect(getIdToken.mock.calls).toEqual([[], [true]]);
  expect(fetcher.mock.calls[1]![1].headers.Authorization).toBe("Bearer new");
});

test("conflict reloads the owned play and retains the pending command", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(response({ error: "choice_locked" }, 409)).mockResolvedValueOnce(response(snapshot));
  vi.stubGlobal("fetch", fetcher);
  const error = await sendCommand("play", pending).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(PlayApiError);
  expect(error).toMatchObject({ status: 409, code: "choice_locked", snapshot });
  expect(fetcher.mock.calls[1]![0]).toBe("/v1/plays/play");
  expect(loadPending()).toEqual({ playId: "play", pending });
});

test("rejects missing fields and unknown phases", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(response({ ...snapshot, moka: { ...snapshot.moka, phase: "unknown" } })).mockResolvedValueOnce(response({ ...snapshot, answers: undefined })).mockResolvedValueOnce(response({ ...snapshot, segment: "unknown" }));
  vi.stubGlobal("fetch", fetcher);
  await expect(loadCurrentPlay()).rejects.toThrow();
  await expect(loadCurrentPlay()).rejects.toThrow();
  await expect(loadCurrentPlay()).rejects.toThrow();
});

test("rejects an invalid receipt without discarding the saved command", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ receipt: { ...receipt, key: "other" }, snapshot: { ...snapshot, answers: [] } })));
  await expect(sendCommand("play", pending)).rejects.toThrow();
  expect(loadPending()).toEqual({ playId: "play", pending });
});

test("accepts completed moka with or without the optional episode end, but validates it when present", async () => {
  let state = { ...structuredClone(mokaFixture.initial), lumi: initialLumi(), echo: initialEcho(), or: initialOr() } as PlaySnapshot;
  for (const command of mokaFixture.success[0]!.commands) state = transitionMoka(state, command as Command, mokaFixture.completedAt);
  const completed = { ...state, playId: "play", segment: "ep_echo" };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response(completed)).mockResolvedValueOnce(response({ ...completed, episodeEnd: { npcId: "moka", hearts: 4 } })).mockResolvedValueOnce(response({ ...completed, episodeEnd: { npcId: "moka", hearts: 6 } })));
  expect(await loadCurrentPlay()).toEqual(completed);
  expect((await loadCurrentPlay()).episodeEnd?.hearts).toBe(4);
  await expect(loadCurrentPlay()).rejects.toThrow("invalid_response");
});

test("validates resident state, puzzle, timestamps and one carried object", async () => {
  const invalid = [
    { ...snapshot, lumi: undefined },
    { ...snapshot, lumi: { ...snapshot.lumi, phase: "unknown" } },
    { ...snapshot, lumi: { ...snapshot.lumi, objects: { ...snapshot.lumi.objects, notice: "echo-rest" } } },
    { ...snapshot, echo: { ...snapshot.echo, objects: { ...snapshot.echo.objects, extra: "source" } } },
    { ...snapshot, or: { ...snapshot.or, placements: { "axle-circle": "gear-square" } } },
    { ...snapshot, lumi: { ...snapshot.lumi, placements: { "circle-1": "circle-1", "circle-2": "circle-1" } } },
    { ...snapshot, lumi: { ...snapshot.lumi, completedAt: "" } },
    { ...snapshot, lumi: { ...snapshot.lumi, phase: "choose_01", completedAt: "2026-02-30T00:00:00Z" } },
    { ...snapshot, lumi: { ...snapshot.lumi, phase: "completed", completedAt: "2026-11-02T00:00:00Z" } },
    { ...snapshot, moka: { ...snapshot.moka, basket: "player" }, lumi: { ...snapshot.lumi, objects: { ...snapshot.lumi.objects, notice: "player" } } },
  ];
  for (const value of invalid) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(value)));
    await expect(loadCurrentPlay()).rejects.toThrow("invalid_response");
  }
});

test("accepts all resident fixture states during transitions", async () => {
  for (const [fixture, transition] of [[lumiFixture, transitionLumi], [echoFixture, transitionEcho], [orFixture, transitionOr]] as const) {
    for (const scenario of fixture.success) {
      let state = structuredClone(fixture.initial) as PlaySnapshot;
      for (const command of scenario.commands) {
        state = transition(state, command as Command, fixture.completedAt);
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(state)));
        expect(await loadCurrentPlay()).toEqual(state);
      }
    }
  }
});

test("rejects stale command response against the previously confirmed revision", async () => {
  const current = { ...snapshot, revision: 5 };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response(current)).mockResolvedValueOnce(response({ receipt, snapshot })));
  await loadCurrentPlay();
  await expect(sendCommand("play", pending)).rejects.toThrow("invalid_response");
  expect(loadPending()?.pending).toEqual(pending);
});

test("rejects an incorrect reaction for the same request key", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ receipt: { ...receipt, reaction: null }, snapshot })));
  await expect(sendCommand("play", pending)).rejects.toThrow("invalid_response");
  expect(loadPending()?.pending).toEqual(pending);
});

test("rejects a same-key receipt that predates the command revision", async () => {
  const retry = { ...pending, expectedRevision: 3 };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ receipt, snapshot: { ...snapshot, revision: 5 } })));
  await expect(sendCommand("play", retry)).rejects.toThrow("invalid_response");
  expect(loadPending()?.pending).toEqual(retry);
});

test("accepts resident episode end only for the completed resident", async () => {
  let state = structuredClone(lumiFixture.initial) as PlaySnapshot;
  for (const command of lumiFixture.success[0]!.commands) state = transitionLumi(state, command as Command, lumiFixture.completedAt);
  const completed = { ...state, playId: "play", revision: 8, episodeEnd: { npcId: "lumi", hearts: 4 } };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response(completed)).mockResolvedValueOnce(response({ ...completed, episodeEnd: { npcId: "echo", hearts: 4 } })).mockResolvedValueOnce(response({ ...completed, answers: snapshot.answers })).mockResolvedValueOnce(response({ ...completed, lumi: { ...completed.lumi, completedAt: "2026-02-30T00:00:00Z" } })));
  expect(await loadCurrentPlay()).toEqual(completed);
  await expect(loadCurrentPlay()).rejects.toThrow("invalid_response");
  await expect(loadCurrentPlay()).rejects.toThrow("invalid_response");
  await expect(loadCurrentPlay()).rejects.toThrow("invalid_response");
});

test("recovers a semantic duplicate using the request key for cleanup", async () => {
  const retry = { ...pending, expectedRevision: 2 };
  const current = { ...snapshot, revision: 5 };
  savePending("play", retry);
  const original = { ...receipt, key: "original" };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response(current)).mockResolvedValueOnce(response({ receipt: original, snapshot: current })));
  expect(await recoverPending()).toMatchObject({ receipt: original, snapshot: current, pendingCleared: true });
  expect(loadPending()).toBeNull();
});

test("accepts a duplicate monologue with null reaction", async () => {
  const choice = { ...pending, command: { kind: "choice" as const, itemId: "prologue_01", pick: "a" as const } };
  const current = { ...snapshot, revision: 3, answers: [{ id: "prologue_01", pick: "a" }] };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ receipt: { key: "original", appliedRevision: 1, reaction: null }, snapshot: current })));
  expect((await sendCommand("play", choice)).pendingCleared).toBe(true);
});

test("accepts a completed resident duplicate but rejects wrong receipt kinds", async () => {
  let state = structuredClone(lumiFixture.initial) as PlaySnapshot;
  for (const command of lumiFixture.success[0]!.commands) state = transitionLumi(state, command as Command, lumiFixture.completedAt);
  const current = { ...state, playId: "play", revision: 50 };
  const complete = { ...pending, expectedRevision: 48, command: { kind: "complete" as const, targetId: "A" } };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response({ receipt: { key: "original", appliedRevision: 40, reaction: "empathy" }, snapshot: current })).mockResolvedValueOnce(response({ receipt: { key: "original", appliedRevision: 40, reaction: null }, snapshot: current })));
  await expect(sendCommand("play", complete)).rejects.toThrow("invalid_response");
  expect((await sendCommand("play", complete)).pendingCleared).toBe(true);
});

test("rejects unrelated or stale semantic duplicate receipts and keeps pending", async () => {
  const original = { ...receipt, key: "original" };
  for (const result of [
    { receipt: original, snapshot: { ...snapshot, answers: [{ id: "moka_01", pick: "b" }] } },
    { receipt: { ...original, reaction: null }, snapshot },
    { receipt: original, snapshot: { ...snapshot, revision: 0 } },
  ]) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(result)));
    await expect(sendCommand("play", pending)).rejects.toThrow("invalid_response");
    expect(loadPending()?.pending).toEqual(pending);
  }
});

test("does not regress to an older confirmed revision", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response(snapshot)).mockResolvedValueOnce(response({ ...snapshot, revision: 0, answers: [] })));
  await loadCurrentPlay();
  expect(await loadCurrentPlay()).toEqual(snapshot);
});

test("recovery loads the server state before resending the saved command", async () => {
  savePending("play", pending);
  const fetcher = vi.fn().mockResolvedValueOnce(response(snapshot)).mockResolvedValueOnce(response({ receipt, snapshot }));
  vi.stubGlobal("fetch", fetcher);
  expect((await recoverPending())?.snapshot).toEqual(snapshot);
  expect(fetcher.mock.calls[0]![0]).toBe("/v1/plays/play");
  expect(fetcher.mock.calls[1]![1].headers["Idempotency-Key"]).toBe(pending.key);
});

test("reports a successful receipt even if clearing local storage fails", async () => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => data.has(key) ? data.get(key)! : null, setItem: (key: string, value: string) => data.set(key, value), removeItem: () => { throw new Error("disabled"); } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ receipt, snapshot })));
  expect(await sendCommand("play", pending)).toMatchObject({ receipt, snapshot, pendingCleared: false });
  expect(loadPending()).toEqual({ playId: "play", pending });
});

test("creates a play with the supplied key and optional App Check token", async () => {
  configurePlayTransport({ auth: { getIdToken: async () => "token" }, appCheck: { getToken: async () => "app-token" }, baseUrl: "/v1" });
  const fetcher = vi.fn().mockResolvedValue(response(snapshot, 201));
  vi.stubGlobal("fetch", fetcher);
  expect(await createPlay(pending.key)).toEqual(snapshot);
  expect(fetcher.mock.calls[0]![1]).toMatchObject({ body: "{}", headers: { "Idempotency-Key": pending.key, "X-Firebase-AppCheck": "app-token" } });
});

test("fake authentication is development only and preserves the generated identity", async () => {
  try {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_ABRAXAS_DEV_FAKE_AUTH", "1");
    const source = new DevAuthTokenSource();
    const token = await source.getIdToken();
    expect(token).toMatch(/^dev-[0-9a-f-]+$/);
    expect(await source.getIdToken()).toBe(token);
    vi.stubEnv("DEV", false);
    await expect(source.getIdToken()).rejects.toThrow("dev_auth_disabled");
  } finally { vi.unstubAllEnvs(); }
});

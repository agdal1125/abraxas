import { describe, expect, it, vi } from "vitest";
import { confirmedCommand } from "./moka-errand";
import type { PlaySnapshot } from "../core/play";
import { initialLumi } from "../core/lumi-errand";
import { initialEcho } from "../core/echo-errand";
import { initialOr } from "../core/or-errand";

const snapshot = { playId: "play", contentVersion: "v", revision: 1, segment: "ep_moka", completedEpisodes: [], answers: [], moka: { phase: "choose_route", basket: "source", placements: {}, completedAt: null }, lumi: initialLumi(), echo: initialEcho(), or: initialOr() } as PlaySnapshot;

describe("confirmed command", () => {
  it("does not expose progress or a reaction before the server confirms it", async () => {
    let resolve!: (value: never) => void;
    const send = vi.fn(() => new Promise<never>(done => { resolve = done; }));
    const apply = vi.fn();
    const pending = confirmedCommand(snapshot, { kind: "choice", itemId: "moka_01", pick: "a" }, send, apply);
    expect(apply).not.toHaveBeenCalled();
    resolve({ snapshot, receipt: { reaction: "empathy" } } as never);
    await pending;
    expect(apply).toHaveBeenCalledOnce();
  });
  it("does not advance on a failed save", async () => {
    const apply = vi.fn();
    await expect(confirmedCommand(snapshot, { kind: "auto_arrange" }, async () => { throw new Error("offline"); }, apply)).rejects.toThrow("offline");
    expect(apply).not.toHaveBeenCalled();
  });
});

import { beforeEach, expect, test, vi } from "vitest";
import { clearPending, loadPending, savePending } from "./pending";

const pending = { key: "3dbd7b9c-9c94-4acb-9e3b-7b37c3d6df81", expectedRevision: 2, command: { kind: "choice" as const, itemId: "moka_01", pick: "a" as const } };

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => data.has(key) ? data.get(key)! : null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) });
});

test("recovers the original command and refuses to replace it", () => {
  const input = structuredClone(pending);
  savePending("play", input);
  input.command.itemId = "different";
  expect(loadPending()).toEqual({ playId: "play", pending });
  expect(() => savePending("play", { ...pending, command: { ...pending.command, pick: "b" } })).toThrow();
  expect(loadPending()?.pending.command).toEqual(pending.command);
  clearPending("play", pending.key);
  expect(loadPending()).toBeNull();
});

test("storage failure prevents treating a command as saved", () => {
  vi.stubGlobal("localStorage", { getItem: () => { throw new Error("disabled"); } });
  expect(() => savePending("play", pending)).toThrow();
});

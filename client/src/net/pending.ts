import type { Command, PendingCommand } from "../core/moka-errand";
import content from "../../../content/quests/moka-errand.json";

const storageKey = "abraxas:pending-command";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

function validCommand(value: unknown): value is Command {
  if (!object(value)) return false;
  if (value.kind === "open_episode") return exact(value, ["kind", "npcId"]) && nonempty(value.npcId);
  if (value.kind === "choice") return exact(value, ["kind", "itemId", "pick"]) && nonempty(value.itemId) && (value.pick === "a" || value.pick === "b");
  if (["pickup", "set_down", "deliver", "act", "talk", "complete"].includes(String(value.kind))) return exact(value, ["kind", "targetId"]) && nonempty(value.targetId);
  if (value.kind === "place") return exact(value, ["kind", "breadId", "slotId"]) && nonempty(value.breadId) && Object.hasOwn(content.bread, value.breadId) && nonempty(value.slotId) && Object.hasOwn(content.slots, value.slotId);
  return (value.kind === "auto_arrange" || value.kind === "finish_segment") && exact(value, ["kind"]);
}

function validRecord(value: unknown): value is { playId: string; pending: PendingCommand } {
  if (!object(value) || !exact(value, ["playId", "pending"]) || !nonempty(value.playId) || !object(value.pending)) return false;
  const p = value.pending;
  return exact(p, ["key", "expectedRevision", "command"]) && typeof p.key === "string" && uuid.test(p.key) && Number.isSafeInteger(p.expectedRevision) && (p.expectedRevision as number) >= 0 && validCommand(p.command);
}

export function loadPending(): { playId: string; pending: PendingCommand } | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!validRecord(parsed)) throw new Error("invalid_pending");
    return parsed;
  } catch {
    throw new Error("pending_unavailable");
  }
}

export function savePending(playId: string, pending: PendingCommand): void {
  const record = { playId, pending };
  if (!validRecord(record)) throw new Error("invalid_pending");
  const existing = loadPending();
  const raw = JSON.stringify(record);
  if (existing && JSON.stringify(existing) !== raw) throw new Error("pending_already_exists");
  try {
    localStorage.setItem(storageKey, raw);
    if (localStorage.getItem(storageKey) !== raw) throw new Error("storage_unavailable");
  } catch {
    throw new Error("pending_unavailable");
  }
}

export function clearPending(playId: string, key: string): void {
  const existing = loadPending();
  if (!existing || existing.playId !== playId || existing.pending.key !== key) throw new Error("pending_mismatch");
  try {
    localStorage.removeItem(storageKey);
    if (localStorage.getItem(storageKey) !== null) throw new Error("storage_unavailable");
  } catch {
    throw new Error("pending_unavailable");
  }
}

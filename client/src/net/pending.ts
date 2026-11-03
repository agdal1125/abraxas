import type { Command, PendingCommand } from "../core/play";
import content from "../../../content/quests/moka-errand.json";
import lumi from "../../../content/quests/lumi-errand.json";
import echo from "../../../content/quests/echo-errand.json";
import or from "../../../content/quests/or-errand.json";

const storageKey = "abraxas:pending-command";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

function validCommand(value: unknown): value is Command {
  if (!object(value)) return false;
  if (value.kind === "open_episode") return exact(value, ["kind", "npcId"]) && nonempty(value.npcId);
  const npcs = ["lumi", "moka", "echo", "or"];
  if (value.kind === "festival_companion") return exact(value, ["kind", "npcId"]) && npcs.includes(String(value.npcId));
  if (value.kind === "confess") return exact(value, ["kind", "npcId", "reason"]) && npcs.includes(String(value.npcId)) && ["similar", "drawn", "both", "unsure"].includes(String(value.reason));
  if (value.kind === "choice") return exact(value, ["kind", "itemId", "pick"]) && nonempty(value.itemId) && (value.pick === "a" || value.pick === "b");
  if (["pickup", "set_down", "deliver", "act", "talk", "complete"].includes(String(value.kind))) return exact(value, ["kind", "targetId"]) && nonempty(value.targetId);
  if (value.kind === "place") return exact(value, ["kind", "breadId", "slotId"]) && nonempty(value.breadId) && Object.hasOwn(content.bread, value.breadId) && nonempty(value.slotId) && Object.hasOwn(content.slots, value.slotId);
  if (value.kind === "place_piece") return exact(value, ["kind", "pieceId", "slotId"]) && nonempty(value.pieceId) && nonempty(value.slotId) && [lumi, echo, or].some((quest) => Object.hasOwn(quest.pieces, value.pieceId as string) && Object.hasOwn(quest.slots, value.slotId as string) && (quest.pieces as Record<string, string>)[value.pieceId as string] === (quest.slots as Record<string, string>)[value.slotId as string]);
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
  if (!existing) return;
  if (existing.playId !== playId || existing.pending.key !== key) throw new Error("pending_mismatch");
  try {
    localStorage.removeItem(storageKey);
    if (localStorage.getItem(storageKey) !== null) throw new Error("storage_unavailable");
  } catch {
    throw new Error("pending_unavailable");
  }
}

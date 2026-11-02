import content from "../../../content/quests/moka-errand.json";
import lumi from "../../../content/quests/lumi-errand.json";
import echo from "../../../content/quests/echo-errand.json";
import or from "../../../content/quests/or-errand.json";
import scoring from "../../../content/scoring/items.json";
import type { PendingCommand, PlaySnapshot } from "../core/play";
import { DevAuthTokenSource, type AppCheckTokenSource, type AuthTokenSource } from "./auth";
import { clearPending, loadPending, savePending } from "./pending";

export type CommandReceipt = { key: string; appliedRevision: number; reaction: "empathy" | "thinking" | null };
export type CommandResult = { receipt: CommandReceipt; snapshot: PlaySnapshot; pendingCleared: boolean };

export class PlayApiError extends Error {
  constructor(public status: number, public code: string, public snapshot?: PlaySnapshot) { super(code); }
}
export class ResponseValidationError extends Error {
  constructor() { super("invalid_response"); }
}

let options: { auth: AuthTokenSource; appCheck?: AppCheckTokenSource; baseUrl: string } = {
  auth: new DevAuthTokenSource(), baseUrl: import.meta.env.VITE_ABRAXAS_API_BASE || "/v1"
};
const latest = new Map<string, PlaySnapshot>();

export function configurePlayTransport(config: { auth: AuthTokenSource; appCheck?: AppCheckTokenSource; baseUrl?: string }): void {
  options = { ...config, baseUrl: config.baseUrl === undefined ? (import.meta.env.VITE_ABRAXAS_API_BASE || "/v1") : config.baseUrl };
  latest.clear();
}

const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const segments = new Set(["title", "prologue", "hub", "ep_lumi", "ep_moka", "ep_echo", "ep_or", "interlude_1", "interlude_2", "interlude_3", "festival", "gate", "result"]);
const residents = { lumi, echo, or };
const timestamp = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19);

function parseSnapshot(value: unknown): PlaySnapshot {
  if (!object(value) || !nonempty(value.playId) || !nonempty(value.contentVersion) || !integer(value.revision) || !nonempty(value.segment) || !segments.has(value.segment) || !Array.isArray(value.completedEpisodes) || !value.completedEpisodes.every(nonempty) || !Array.isArray(value.answers) || !value.answers.every((a: unknown) => object(a) && nonempty(a.id) && (a.pick === "a" || a.pick === "b")) || !object(value.moka)) throw new ResponseValidationError();
  if (new Set(value.answers.map((a: { id: string }) => a.id)).size !== value.answers.length || new Set(value.completedEpisodes).size !== value.completedEpisodes.length || value.completedEpisodes.some((id: string) => !["lumi", "moka", "echo", "or"].includes(id))) throw new ResponseValidationError();
  const m = value.moka;
  if (!nonempty(m.phase) || !Object.hasOwn(content.phases, m.phase) || !["source", "player", "moka-rest", "delivered"].includes(String(m.basket)) || !object(m.placements) || !(m.completedAt === null || timestamp(m.completedAt))) throw new ResponseValidationError();
  const placements = Object.entries(m.placements);
  if (placements.some(([slot, bread]) => !Object.hasOwn(content.slots, slot) || typeof bread !== "string" || !Object.hasOwn(content.bread, bread) || content.slots[slot as keyof typeof content.slots] !== content.bread[bread as keyof typeof content.bread]) || new Set(placements.map(([, bread]) => bread)).size !== placements.length) throw new ResponseValidationError();
  if ((m.phase === "completed") !== (m.completedAt !== null)) throw new ResponseValidationError();
  if ((m.phase === "completed") !== value.completedEpisodes.includes("moka")) throw new ResponseValidationError();
  if (m.phase === "completed") {
    const answers = value.answers.filter((a: { id: string }) => a.id.startsWith("moka_"));
    if (m.basket !== "delivered" || placements.length !== Object.keys(content.slots).length || answers.length !== content.items.length || answers.some((a: { id: string }, i: number) => a.id !== content.items[i])) throw new ResponseValidationError();
  }
  let carried = m.basket === "player" ? 1 : 0;
  for (const [id, quest] of Object.entries(residents)) {
    const state = value[id];
    if (!object(state) || Object.keys(state).length !== 4 || !nonempty(state.phase) || !Object.hasOwn(quest.phases, state.phase) || !object(state.objects) || !object(state.placements)) throw new ResponseValidationError();
    const objects = state.objects;
    const allowedObjects = quest.objects as Record<string, string[]>;
    if (Object.keys(objects).length !== Object.keys(allowedObjects).length || Object.entries(objects).some(([key, location]) => !Object.hasOwn(allowedObjects, key) || typeof location !== "string" || !allowedObjects[key]!.includes(location))) throw new ResponseValidationError();
    carried += Object.values(objects).filter((location) => location === "player").length;
    const pieces = quest.pieces as Record<string, string>, slots = quest.slots as Record<string, string>;
    const entries = Object.entries(state.placements);
    if (entries.some(([slot, piece]) => !Object.hasOwn(slots, slot) || typeof piece !== "string" || !Object.hasOwn(pieces, piece) || slots[slot] !== pieces[piece]) || new Set(entries.map(([, piece]) => piece)).size !== entries.length) throw new ResponseValidationError();
    const completed = state.phase === "completed";
    if (completed ? !timestamp(state.completedAt) : state.completedAt !== null) throw new ResponseValidationError();
    if (completed !== value.completedEpisodes.includes(id)) throw new ResponseValidationError();
    const answers = value.answers.filter((a: { id: string }) => a.id.startsWith(`${id}_`));
    const phaseIndex = Object.keys(quest.phases).indexOf(state.phase);
    const count = Object.keys(quest.phases).slice(0, phaseIndex).filter((phase) => phase.startsWith("choose_")).length;
    if (answers.length !== count || answers.some((answer: { id: string }, index: number) => answer.id !== quest.items[index])) throw new ResponseValidationError();
    if (completed && (entries.length !== Object.keys(slots).length || (id === "or" ? objects.bucket !== "delivered" || objects.bell !== (answers[5].pick === "a" ? "source" : "delivered") : Object.values(objects).some((location) => location !== "delivered")))) throw new ResponseValidationError();
    if (state.phase === "locked" && (entries.length !== 0 || Object.values(objects).some((location) => location !== "source"))) throw new ResponseValidationError();
  }
  if (carried > 1) throw new ResponseValidationError();
  if (value.episodeEnd !== undefined) {
    const end = value.episodeEnd;
    if (!object(end) || !nonempty(end.npcId) || !["lumi", "moka", "echo", "or"].includes(end.npcId) || !integer(end.hearts) || end.hearts > 5) throw new ResponseValidationError();
    const state = value[end.npcId];
    if (!object(state) || state.phase !== "completed" || !value.completedEpisodes.includes(end.npcId)) throw new ResponseValidationError();
  }
  return value as PlaySnapshot;
}

function remember(snapshot: PlaySnapshot): PlaySnapshot {
  const previous = latest.get(snapshot.playId);
  if (previous && previous.revision > snapshot.revision) return previous;
  latest.set(snapshot.playId, snapshot);
  return snapshot;
}

async function request(path: string, init: { method: "GET" | "POST"; body?: string; key?: string }): Promise<unknown> {
  const send = async (refresh: boolean) => {
    const token = await (refresh ? options.auth.getIdToken(true) : options.auth.getIdToken());
    if (!token) throw new Error("unauthenticated");
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (options.appCheck) headers["X-Firebase-AppCheck"] = await options.appCheck.getToken();
    if (init.key) headers["Idempotency-Key"] = init.key;
    if (init.body !== undefined) headers["Content-Type"] = "application/json";
    return fetch(`${options.baseUrl.replace(/\/$/, "")}${path}`, { method: init.method, headers, body: init.body, signal: AbortSignal.timeout(15000) });
  };
  let response = await send(false);
  if (response.status === 401) response = await send(true);
  let body: unknown;
  try { body = await response.json(); } catch { throw new ResponseValidationError(); }
  if (!response.ok) throw new PlayApiError(response.status, object(body) && nonempty(body.error) ? body.error : "invalid_response");
  return body;
}

async function loadPlay(playId: string): Promise<PlaySnapshot> {
  const snapshot = parseSnapshot(await request(`/plays/${encodeURIComponent(playId)}`, { method: "GET" }));
  if (snapshot.playId !== playId) throw new ResponseValidationError();
  return remember(snapshot);
}

export async function loadCurrentPlay(): Promise<PlaySnapshot> {
  return remember(parseSnapshot(await request("/plays/current", { method: "GET" })));
}

export async function recoverPending(): Promise<CommandResult | null> {
  const record = loadPending();
  if (!record) return null;
  await loadPlay(record.playId);
  return sendCommand(record.playId, record.pending);
}

export async function createPlay(key: string): Promise<PlaySnapshot> {
  try {
    return remember(parseSnapshot(await request("/plays", { method: "POST", body: "{}", key })));
  } catch (error) {
    if (error instanceof PlayApiError && error.status === 409) error.snapshot = await loadCurrentPlay();
    throw error;
  }
}

export async function sendCommand(playId: string, pending: PendingCommand): Promise<CommandResult> {
  savePending(playId, pending);
  const body = JSON.stringify({ expectedRevision: pending.expectedRevision, command: pending.command });
  const key = pending.key;
  try {
    const result = await request(`/plays/${encodeURIComponent(playId)}/commands`, { method: "POST", body, key });
    if (!object(result) || !object(result.receipt) || !nonempty(result.receipt.key) || !integer(result.receipt.appliedRevision) || result.receipt.appliedRevision === 0 || !["empathy", "thinking", null].includes(result.receipt.reaction as string | null)) throw new ResponseValidationError();
    const snapshot = parseSnapshot(result.snapshot);
    if (snapshot.playId !== playId || result.receipt.appliedRevision > snapshot.revision || snapshot.revision < pending.expectedRevision || snapshot.revision < (latest.get(playId)?.revision ?? 0)) throw new ResponseValidationError();
    if (result.receipt.key === key && result.receipt.appliedRevision !== pending.expectedRevision + 1) throw new ResponseValidationError();
    if (pending.command.kind === "choice") {
      const item = [...scoring.items, ...scoring.tiebreakers].find((entry) => entry.id === (pending.command as { itemId: string }).itemId);
      if (!item || ("npc" in item && item.npc !== null ? result.receipt.reaction === null : result.receipt.reaction !== null)) throw new ResponseValidationError();
    } else if (result.receipt.reaction !== null) throw new ResponseValidationError();
    if (result.receipt.key !== key) {
      const command = pending.command;
      const completed = { A: "lumi", B: "moka", C: "echo", D: "or" } as Record<string, string>;
      const validChoice = command.kind === "choice" && snapshot.answers.some((answer) => answer.id === command.itemId && answer.pick === command.pick);
      const npc = command.kind === "complete" ? completed[command.targetId] : undefined;
      const validComplete = npc !== undefined && result.receipt.reaction === null && snapshot.completedEpisodes.includes(npc) && snapshot[npc as "lumi" | "moka" | "echo" | "or"].phase === "completed";
      if (!validChoice && !validComplete) throw new ResponseValidationError();
    }
    let pendingCleared = true;
    try { clearPending(playId, key); } catch { pendingCleared = false; }
    return { receipt: result.receipt as CommandReceipt, snapshot: remember(snapshot), pendingCleared };
  } catch (error) {
    if (error instanceof PlayApiError && error.status === 409) error.snapshot = await loadPlay(playId);
    throw error;
  }
}

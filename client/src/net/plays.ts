import content from "../../../content/quests/moka-errand.json";
import type { PendingCommand, PlaySnapshot } from "../core/moka-errand";
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

function parseSnapshot(value: unknown): PlaySnapshot {
  if (!object(value) || !nonempty(value.playId) || !nonempty(value.contentVersion) || !integer(value.revision) || !nonempty(value.segment) || !segments.has(value.segment) || !Array.isArray(value.completedEpisodes) || !value.completedEpisodes.every(nonempty) || !Array.isArray(value.answers) || !value.answers.every((a: unknown) => object(a) && nonempty(a.id) && (a.pick === "a" || a.pick === "b")) || !object(value.moka)) throw new ResponseValidationError();
  const m = value.moka;
  if (!nonempty(m.phase) || !Object.hasOwn(content.phases, m.phase) || !["source", "player", "moka-rest", "delivered"].includes(String(m.basket)) || !object(m.placements) || !(m.completedAt === null || (typeof m.completedAt === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(m.completedAt) && !Number.isNaN(Date.parse(m.completedAt))))) throw new ResponseValidationError();
  const placements = Object.entries(m.placements);
  if (placements.some(([slot, bread]) => !Object.hasOwn(content.slots, slot) || typeof bread !== "string" || !Object.hasOwn(content.bread, bread) || content.slots[slot as keyof typeof content.slots] !== content.bread[bread as keyof typeof content.bread]) || new Set(placements.map(([, bread]) => bread)).size !== placements.length) throw new ResponseValidationError();
  if (m.phase === "completed") {
    if (m.completedAt === null || (value.episodeEnd !== undefined && (!object(value.episodeEnd) || value.episodeEnd.npcId !== "moka" || !integer(value.episodeEnd.hearts) || value.episodeEnd.hearts > 5))) throw new ResponseValidationError();
  } else if (m.completedAt !== null || value.episodeEnd !== undefined) throw new ResponseValidationError();
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
    if (!object(result) || !object(result.receipt) || result.receipt.key !== key || !integer(result.receipt.appliedRevision) || !["empathy", "thinking", null].includes(result.receipt.reaction as string | null)) throw new ResponseValidationError();
    const snapshot = parseSnapshot(result.snapshot);
    if (snapshot.playId !== playId || result.receipt.appliedRevision > snapshot.revision) throw new ResponseValidationError();
    let pendingCleared = true;
    try { clearPending(playId, key); } catch { pendingCleared = false; }
    return { receipt: result.receipt as CommandReceipt, snapshot: remember(snapshot), pendingCleared };
  } catch (error) {
    if (error instanceof PlayApiError && error.status === 409) error.snapshot = await loadPlay(playId);
    throw error;
  }
}

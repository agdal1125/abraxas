import type { BreadId, MokaState, SlotId } from "./moka-errand";
import type { LumiState } from "./lumi-errand";
import type { EchoState } from "./echo-errand";
import type { OrState } from "./or-errand";

export type Pick = "a" | "b";
export type Choice = { id: string; pick: Pick };
export type Command =
  | { kind: "open_episode"; npcId: string }
  | { kind: "choice"; itemId: string; pick: Pick }
  | { kind: "pickup" | "set_down" | "deliver" | "act" | "talk" | "complete"; targetId: string }
  | { kind: "place"; breadId: BreadId; slotId: SlotId }
  | { kind: "place_piece"; pieceId: string; slotId: string }
  | { kind: "auto_arrange" | "finish_segment" };
export type PlaySnapshot = { playId: string; contentVersion: string; revision: number; segment: string; completedEpisodes: string[]; answers: Choice[]; moka: MokaState; lumi: LumiState; echo: EchoState; or: OrState; episodeEnd?: { npcId: string; hearts: number } };
export type PendingCommand = { key: string; expectedRevision: number; command: Command };
export type LocalSync = { status: "ready" } | { status: "saving" | "retry"; pending: PendingCommand };

export function contentVersionMatches(snapshot: PlaySnapshot, buildVersion: string): boolean {
  return buildVersion.length > 0 && snapshot.contentVersion === buildVersion;
}

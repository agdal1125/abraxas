import type { Command, PlaySnapshot } from "../core/play";
import { lumiView } from "../core/lumi-errand";
import { echoView } from "../core/echo-errand";
import { orView } from "../core/or-errand";
import lumi from "../../../content/quests/lumi-errand.json";
import echo from "../../../content/quests/echo-errand.json";
import or from "../../../content/quests/or-errand.json";
import "./residents-errands.css";
import { nextPlacements, roundPlan } from "../core/minigames";
import { MINIGAME_ROUNDS, minigameBoard, type MinigameCopy, type MinigameKind } from "./minigames";

export type Resident = "lumi" | "echo" | "or";
const quests = { lumi, echo, or };

export function residentCommand(snapshot: PlaySnapshot, npc: Resident, targetId: string): Command | null {
  const view = npc === "lumi" ? lumiView(snapshot) : npc === "echo" ? echoView(snapshot) : orView(snapshot);
  if (!view.activeTargetIds.includes(targetId)) return null;
  const phase = snapshot[npc].phase;
  if (targetId === `${npc}-rest`) return { kind: view.carriedObjectId ? "set_down" : "pickup", targetId };
  if (phase === "report") return { kind: "complete", targetId };
  if ((npc === "or" && phase === "finish" && snapshot.answers.find(a => a.id === "or_06")?.pick === "b")) return { kind: "pickup", targetId };
  if (phase.endsWith("_delivery")) return { kind: "deliver", targetId };
  if (["stagekeeper", "organizer", "assistant"].includes(phase) || (npc === "lumi" && ["notice_first", "notice_second"].includes(phase) && snapshot.answers.find(a => a.id === "lumi_03")?.pick === "a") || (npc === "or" && phase === "find_sand" && snapshot.answers.find(a => a.id === "or_02")?.pick === "b")) return { kind: "talk", targetId };
  if (["table", "card", "notice_first", "notice_second", "welcome", "enclose", "search", "reading", "bookmark", "fire", "find_sand", "sand", "weight", "review", "lantern_link", "hook", "finish"].includes(phase)) return { kind: "act", targetId };
  return null;
}

type Copy = { puzzle: { auto: string; close: string }; game: MinigameCopy };
const KINDS: Record<Resident, MinigameKind> = { lumi: "ribbons", echo: "shelf", or: "gears" };

// One round of the resident's minigame. Winning sends the round's share of matching placements;
// the server still checks every placement, so the minigame only decides when they are sent.
export function residentBoard(npc: Resident, placements: Record<string, string | undefined>, copy: Copy, send: (commands: Command[]) => void, close: () => void): HTMLElement {
  const quest = quests[npc], pieces: Record<string, string> = quest.pieces, slots: Record<string, string> = quest.slots;
  const total = Object.keys(slots).length, placed = Object.values(placements).filter(Boolean).length;
  const { round, size } = roundPlan(total, placed, MINIGAME_ROUNDS);
  const place = () => send(nextPlacements(pieces, slots, placements, size).map(([pieceId, slotId]) => ({ kind: "place_piece", pieceId, slotId })));
  return minigameBoard({ kind: KINDS[npc], index: round, rounds: MINIGAME_ROUNDS }, copy.game, { auto: copy.puzzle.auto, close: copy.puzzle.close, onAuto: () => send([{ kind: "auto_arrange" }]), onClose: close }, place);
}

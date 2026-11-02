import type { Command, PlaySnapshot } from "../core/play";
import { lumiView } from "../core/lumi-errand";
import { echoView } from "../core/echo-errand";
import { orView } from "../core/or-errand";
import lumi from "../../../content/quests/lumi-errand.json";
import echo from "../../../content/quests/echo-errand.json";
import or from "../../../content/quests/or-errand.json";
import "./residents-errands.css";

export type Resident = "lumi" | "echo" | "or";
const quests = { lumi, echo, or };

export function residentCommand(snapshot: PlaySnapshot, npc: Resident, targetId: string): Command | null {
  const view = npc === "lumi" ? lumiView(snapshot) : npc === "echo" ? echoView(snapshot) : orView(snapshot);
  if (!view.activeTargetIds.includes(targetId)) return null;
  const phase = snapshot[npc].phase;
  if (targetId === `${npc}-rest`) return { kind: view.carriedObjectId ? "set_down" : "pickup", targetId };
  if (phase === "report") return { kind: "complete", targetId };
  if (phase.endsWith("_pickup") || (npc === "or" && phase === "finish" && snapshot.answers.find(a => a.id === "or_06")?.pick === "b")) return { kind: "pickup", targetId };
  if (phase.endsWith("_delivery") || phase === "notice_return") return { kind: "deliver", targetId };
  if (["stagekeeper", "organizer", "assistant", "return", "merchant"].includes(phase) || (npc === "lumi" && ["notice_first", "notice_second"].includes(phase) && snapshot.answers.find(a => a.id === "lumi_03")?.pick === "a") || (npc === "or" && phase === "find_sand" && snapshot.answers.find(a => a.id === "or_02")?.pick === "b")) return { kind: "talk", targetId };
  if (["table", "card", "notice_first", "notice_second", "welcome", "enclose", "search", "reading", "bookmark", "fire", "find_sand", "sand", "weight", "review", "lantern_link", "hook", "finish"].includes(phase)) return { kind: "act", targetId };
  return null;
}

type Copy = { objective: Record<string, string>; items: Record<string, string>; puzzle: typeof import("../../../content/i18n/ko/lumi-errand.json")["puzzle"] };
export function residentBoard(npc: Resident, placements: Record<string, string | undefined>, copy: Copy, send: (command: Command) => void, close: () => void, lang: "ko" | "en" = "ko"): HTMLElement {
  const quest = quests[npc], pieces: Record<string, string> = quest.pieces, slots: Record<string, string> = quest.slots;
  const board = document.createElement("div"); board.className = "panel resident-board"; board.setAttribute("role", "dialog"); board.setAttribute("aria-label", copy.objective[npc === "or" ? "gears" : "arrange"] ?? "");
  const message = document.createElement("p"); message.setAttribute("role", "status"); message.textContent = copy.puzzle.select; board.append(message);
  const pieceGrid = document.createElement("div"), slotGrid = document.createElement("div"); pieceGrid.className = slotGrid.className = "resident-grid";
  let selected: string | null = null, busy = false;
  const buttons = new Map<string, HTMLButtonElement>();
  const ordinals = lang === "ko" ? ["첫째", "둘째", "셋째", "넷째", "다섯째", "여섯째"] : ["first", "second", "third", "fourth", "fifth", "sixth"];
  for (const [index, [id, shape]] of Object.entries(pieces).entries()) {
    const button = document.createElement("button"); button.textContent = `${ordinals[index]} ${copy.items[shape] ?? ""}`; button.disabled = Object.values(placements).includes(id); button.setAttribute("aria-pressed", "false");
    button.onclick = () => { if (busy) return; selected = id; for (const [key, element] of buttons) element.setAttribute("aria-pressed", String(key === id)); }; buttons.set(id, button); pieceGrid.append(button);
  }
  for (const [index, [id, shape]] of Object.entries(slots).entries()) {
    const button = document.createElement("button"); button.textContent = `${ordinals[index]} ${copy.items[shape] ?? ""} · ${placements[id] ? copy.puzzle.placed : copy.puzzle.empty}`; button.disabled = !!placements[id];
    button.onclick = () => { if (busy || !selected) return; if (pieces[selected] !== shape) { message.textContent = copy.puzzle.wrong; return; } busy = true; send({ kind: "place_piece", pieceId: selected, slotId: id }); }; slotGrid.append(button);
  }
  board.append(pieceGrid, slotGrid);
  const hint = document.createElement("button"); hint.textContent = copy.puzzle.hint; hint.onclick = () => { if (busy) return; const slot = Object.keys(slots).find(id => !placements[id]); const piece = Object.keys(pieces).find(id => slot && pieces[id] === slots[slot] && !Object.values(placements).includes(id)); if (piece && slot) { selected = piece; for (const [key, element] of buttons) element.setAttribute("aria-pressed", String(key === piece)); message.textContent = `${ordinals[Object.keys(pieces).indexOf(piece)]} ${copy.items[pieces[piece]!] ?? ""} → ${ordinals[Object.keys(slots).indexOf(slot)]} ${copy.items[slots[slot]!] ?? ""}`; } };
  const auto = document.createElement("button"); auto.textContent = copy.puzzle.auto; auto.onclick = () => { if (!busy) { busy = true; send({ kind: "auto_arrange" }); } };
  const closeButton = document.createElement("button"); closeButton.textContent = copy.puzzle.close; closeButton.onclick = () => { if (!busy) close(); }; board.append(hint, auto, closeButton);
  return board;
}

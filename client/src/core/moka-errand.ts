import content from "../../../content/quests/moka-errand.json";
import type { Command, PlaySnapshot } from "./play";

export type MokaPhase = keyof typeof content.phases;
export type BasketLocation = "source" | "player" | "moka-rest" | "delivered";
export type BreadId = keyof typeof content.bread;
export type SlotId = keyof typeof content.slots;
export type MokaState = { phase: MokaPhase; basket: BasketLocation; placements: Partial<Record<SlotId, BreadId>>; completedAt: string | null };
export type MokaView = { phase: MokaPhase; basket: BasketLocation; placements: MokaState["placements"]; objectiveKey: string; activeTargetIds: string[]; resumePointId: string | null; route: "shortcut" | "gentle" | null; display: "low" | "high" | null };

export function mokaView(snapshot: PlaySnapshot): MokaView {
  const { phase, basket, placements } = snapshot.moka;
  const phaseData = content.phases[phase];
  const pick = (id: string) => snapshot.answers.find((answer) => answer.id === id)?.pick;
  let activeTargetIds: string[] = "targets" in phaseData ? [...phaseData.targets] : [];
  if ("targetsByPick" in phaseData) {
    const id = phase === "reservation_action" ? "moka_02" : phase === "share_action" ? "moka_04" : "moka_05";
    const answer = pick(id);
    activeTargetIds = answer ? [phaseData.targetsByPick[answer]] : [];
  }
  if (phase === "deliver" && basket === "moka-rest") activeTargetIds = ["moka-rest"];
  const routePick = pick("moka_01");
  const displayPick = pick("moka_03");
  return { phase, basket, placements: { ...placements }, objectiveKey: phase === "deliver" && basket === "moka-rest" ? "moka.objective.pick_up_rest" : phaseData.objectiveKey, activeTargetIds, resumePointId: phaseData.resumePointId, route: routePick ? content.routes[routePick].name as MokaView["route"] : null, display: displayPick ? content.displays[displayPick] as MokaView["display"] : null };
}

// Server persistence, revisions and idempotency are handled outside this pure transition.
export function transitionMoka(snapshot: PlaySnapshot, command: Command, completedAt?: string): PlaySnapshot {
  const next: PlaySnapshot = { ...snapshot, answers: [...snapshot.answers], completedEpisodes: [...snapshot.completedEpisodes], moka: { ...snapshot.moka, placements: { ...snapshot.moka.placements } } };
  const state = next.moka;
  const phase = state.phase;
  const reject = (): never => { throw new Error("invalid_moka_transition"); };
  if (phase === "locked" && command.kind === "open_episode" && command.npcId === "moka" && snapshot.segment === "hub" && !snapshot.completedEpisodes.includes("moka")) {
    state.phase = "choose_route"; state.basket = "source"; next.segment = "ep_moka";
  } else if (command.kind === "choice") {
    const choices: Partial<Record<MokaPhase, [string, MokaPhase]>> = { choose_route: ["moka_01", "deliver"], reservation: ["moka_02", "reservation_action"], choose_display: ["moka_03", "arrange"], share: ["moka_04", "share_action"], order: ["moka_05", "order_action"], feedback: ["moka_06", "report"] };
    const rule = choices[phase];
    if (!rule || command.itemId !== rule[0] || (command.pick !== "a" && command.pick !== "b") || next.answers.some((a) => a.id === command.itemId)) return reject();
    next.answers.push({ id: command.itemId, pick: command.pick }); state.phase = rule[1];
    if (phase === "choose_route") state.basket = "player"; // Moka hands over the basket with the request.
  } else if (phase === "deliver" && command.kind === "set_down" && command.targetId === "moka-rest" && state.basket === "player") {
    state.basket = "moka-rest";
  } else if (phase === "deliver" && command.kind === "pickup" && command.targetId === "moka-rest" && state.basket === "moka-rest") {
    state.basket = "player";
  } else if (phase === "deliver" && command.kind === "deliver" && command.targetId === "moka-workshop-dropoff" && state.basket === "player") {
    state.basket = "delivered"; state.phase = "reservation";
  } else if ((phase === "reservation_action" || phase === "share_action" || phase === "order_action") && command.kind === "act" && mokaView(snapshot).activeTargetIds.includes(command.targetId)) {
    state.phase = phase === "reservation_action" ? "choose_display" : phase === "share_action" ? "order" : "feedback";
  } else if (phase === "arrange" && command.kind === "place") {
    const breadShape = content.bread[command.breadId]; const slotShape = content.slots[command.slotId];
    if (!Object.hasOwn(content.bread, command.breadId) || !Object.hasOwn(content.slots, command.slotId) || breadShape !== slotShape || state.placements[command.slotId] || Object.values(state.placements).includes(command.breadId)) return reject();
    state.placements[command.slotId] = command.breadId;
    if (Object.keys(state.placements).length === Object.keys(content.slots).length) state.phase = "share";
  } else if (phase === "arrange" && command.kind === "auto_arrange") {
    for (const slot of Object.keys(content.slots) as SlotId[]) {
      if (!state.placements[slot]) {
        const bread = (Object.keys(content.bread) as BreadId[]).find((id) => content.bread[id] === content.slots[slot] && !Object.values(state.placements).includes(id));
        if (!bread) return reject();
        state.placements[slot] = bread;
      }
    }
    state.phase = "share";
  } else if (phase === "report" && command.kind === "complete" && command.targetId === "B" && completedAt && state.basket === "delivered" && !next.completedEpisodes.includes("moka") && Object.keys(state.placements).length === 6 && new Set(Object.values(state.placements)).size === 6 && (Object.entries(state.placements) as [SlotId, BreadId][]).every(([slot, bread]) => Object.hasOwn(content.slots, slot) && Object.hasOwn(content.bread, bread) && content.bread[bread] === content.slots[slot]) && content.items.every((id, index) => next.answers.filter((a) => a.id.startsWith("moka_"))[index]?.id === id) && next.answers.filter((a) => a.id.startsWith("moka_")).length === 6) {
    state.phase = "completed"; state.completedAt = completedAt; next.completedEpisodes.push("moka");
  } else return reject();
  return next;
}

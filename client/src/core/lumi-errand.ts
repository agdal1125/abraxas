import content from "../../../content/quests/lumi-errand.json";
import type { Command, Pick, PlaySnapshot } from "./play";

export type LumiPhase = keyof typeof content.phases;
export type LumiObjectLocation = "source" | "player" | "lumi-rest" | "delivered";
export type LumiState = { phase: LumiPhase; objects: { notice: LumiObjectLocation; material: LumiObjectLocation; score: LumiObjectLocation }; placements: Partial<Record<keyof typeof content.slots, keyof typeof content.pieces>>; completedAt: string | null };
export const initialLumi = (): LumiState => ({ phase: "locked", objects: { notice: "source", material: "source", score: "source" }, placements: {}, completedAt: null });

export function lumiView(snapshot: PlaySnapshot) {
  const state = snapshot.lumi;
  const choice = (id: string) => snapshot.answers.find(a => a.id === id)?.pick;
  const branch: Partial<Record<LumiPhase, string>> = { table: "lumi_01", card: "lumi_02", notice_first: "lumi_03", notice_second: "lumi_03", welcome: "lumi_05" };
  const pick = branch[state.phase] ? choice(branch[state.phase]!) : undefined;
  let targets: string[] = [...content.phases[state.phase]];
  if (branch[state.phase]) targets = pick ? [targets[pick === "a" ? 0 : 1]!] : [];
  const held = Object.entries(state.objects).find(([, location]) => location === "player" || location === "lumi-rest");
  if (held?.[1] === "lumi-rest") targets = ["lumi-rest"];
  else if (held?.[1] === "player") targets.push("lumi-rest");
  const points: string[] = [...content.resumePoints[state.phase]];
  const resumePointId = held?.[1] === "lumi-rest" ? "lumi-rest" : branch[state.phase] ? (pick ? points[pick === "a" ? 0 : 1] ?? null : null) : points[0] ?? null;
  return { phase: state.phase, objectiveKey: held?.[1] === "lumi-rest" ? content.restObjectiveKey : content.objectiveKeys[state.phase], activeTargetIds: targets, resumePointId, carriedObjectId: held?.[1] === "player" ? held[0] : null, objects: { ...state.objects }, placements: { ...state.placements }, choices: content.items.map(choice) };
}

export function transitionLumi(snapshot: PlaySnapshot, command: Command, completedAt?: string): PlaySnapshot {
  const next = { ...snapshot, answers: [...snapshot.answers], completedEpisodes: [...snapshot.completedEpisodes], lumi: { ...snapshot.lumi, objects: { ...snapshot.lumi.objects }, placements: { ...snapshot.lumi.placements } } };
  const state = next.lumi; const phase = state.phase;
  const reject = (): never => { throw new Error("invalid_lumi_transition"); };
  const carried = Object.entries(state.objects).filter(([, location]) => location === "player");
  if (carried.length > 1) return reject();
  if (snapshot.moka.basket === "player" || Object.values(snapshot.echo.objects).includes("player") || Object.values(snapshot.or.objects).includes("player")) return reject();
  const targets = lumiView(snapshot).activeTargetIds;
  const validPlacements = () => {
    const entries = Object.entries(state.placements);
    return entries.length === Object.keys(content.slots).length && new Set(entries.map(([, piece]) => piece)).size === entries.length && entries.every(([slot, piece]) => Object.hasOwn(content.slots, slot) && typeof piece === "string" && Object.hasOwn(content.pieces, piece) && content.slots[slot as keyof typeof content.slots] === content.pieces[piece as keyof typeof content.pieces]);
  };
  const selected = (kind: string) => command.kind === kind && "targetId" in command && targets.includes(command.targetId) && command.targetId !== "lumi-rest";
  const choiceRules: Partial<Record<LumiPhase, [string, LumiPhase]>> = { choose_01: ["lumi_01", "table"], choose_02: ["lumi_02", "card"], choose_03: ["lumi_03", "notice_first"], choose_04: ["lumi_04", "material_delivery"], choose_05: ["lumi_05", "welcome"], choose_06: ["lumi_06", "score_delivery"] };
  // A choice that starts a carry hands the object over at once; there is no separate pickup step.
  const carry: Partial<Record<LumiPhase, keyof LumiState["objects"]>> = { choose_03: "notice", choose_04: "material", choose_06: "score" };
  const transport: Partial<Record<LumiPhase, keyof LumiState["objects"]>> = { notice_first: "notice", notice_second: "notice", material_delivery: "material", score_delivery: "score" };
  const object = transport[phase];
  if (phase === "locked" && command.kind === "open_episode" && command.npcId === "lumi" && snapshot.segment === "hub" && !snapshot.completedEpisodes.includes("lumi")) { state.phase = "choose_01"; next.segment = "ep_lumi"; }
  else if (command.kind === "choice") { const rule = choiceRules[phase]; if (!rule || command.itemId !== rule[0] || !(["a", "b"] as Pick[]).includes(command.pick) || next.answers.some(a => a.id === command.itemId)) return reject(); next.answers.push({ id: command.itemId, pick: command.pick }); state.phase = rule[1]; const held = carry[phase]; if (held) state.objects[held] = "player"; }
  else if (object && command.kind === "set_down" && command.targetId === "lumi-rest" && state.objects[object] === "player") state.objects[object] = "lumi-rest";
  else if (object && command.kind === "pickup" && command.targetId === "lumi-rest" && state.objects[object] === "lumi-rest" && carried.length === 0) state.objects[object] = "player";
  else if ((phase === "notice_first" || phase === "notice_second") && state.objects.notice === "player" && selected(snapshot.answers.find(a => a.id === "lumi_03")?.pick === "a" ? "talk" : "act")) { if (phase === "notice_first") state.phase = "notice_second"; else { state.objects.notice = "delivered"; state.phase = "stagekeeper"; } }
  else if ((phase === "material_delivery" || phase === "score_delivery") && object && state.objects[object] === "player" && selected("deliver")) { state.objects[object] = "delivered"; state.phase = phase === "material_delivery" ? "arrange" : "report"; }
  else if ((phase === "table" || phase === "card" || phase === "welcome") && selected("act")) state.phase = phase === "table" ? "choose_02" : phase === "card" ? "choose_03" : "choose_06";
  else if (phase === "stagekeeper" && selected("talk")) state.phase = "choose_04";
  else if (phase === "arrange" && command.kind === "place_piece") { const piece = command.pieceId as keyof typeof content.pieces; const slot = command.slotId as keyof typeof content.slots; if (!Object.hasOwn(content.pieces, piece) || !Object.hasOwn(content.slots, slot) || content.pieces[piece] !== content.slots[slot] || state.placements[slot] || Object.values(state.placements).includes(piece)) return reject(); state.placements[slot] = piece; if (Object.keys(state.placements).length === 6) state.phase = "choose_05"; }
  else if (phase === "arrange" && command.kind === "auto_arrange") { for (const slot of Object.keys(content.slots) as (keyof typeof content.slots)[]) if (!state.placements[slot]) { const piece = (Object.keys(content.pieces) as (keyof typeof content.pieces)[]).find(id => content.pieces[id] === content.slots[slot] && !Object.values(state.placements).includes(id)); if (!piece) return reject(); state.placements[slot] = piece; } state.phase = "choose_05"; }
  else if (phase === "report" && command.kind === "complete" && command.targetId === "A" && completedAt && !next.completedEpisodes.includes("lumi") && Object.values(state.objects).every(v => v === "delivered") && Object.keys(state.placements).length === 6 && content.items.every((id, i) => next.answers.filter(a => a.id.startsWith("lumi_"))[i]?.id === id) && next.answers.filter(a => a.id.startsWith("lumi_")).length === 6) { state.phase = "completed"; state.completedAt = completedAt; next.completedEpisodes.push("lumi"); }
  else return reject();
  if (state.phase === "completed" && !validPlacements()) return reject();
  return next;
}

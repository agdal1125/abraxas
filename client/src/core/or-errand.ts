import content from "../../../content/quests/or-errand.json";
import type { Command, PlaySnapshot } from "./play";

export type OrPhase = keyof typeof content.phases;
export type OrObjectLocation = "source" | "player" | "or-rest" | "delivered";
export type OrState = { phase: OrPhase; objects: { bucket: OrObjectLocation; bell: OrObjectLocation }; placements: Partial<Record<keyof typeof content.slots, keyof typeof content.pieces>>; completedAt: string | null };
export const initialOr = (): OrState => ({ phase: "locked", objects: { bucket: "source", bell: "source" }, placements: {}, completedAt: null });

export function orView(snapshot: PlaySnapshot) {
  const state = snapshot.or;
  const choice = (id: string) => snapshot.answers.find(a => a.id === id)?.pick;
  const branch: Partial<Record<OrPhase, string>> = { fire: "or_01", find_sand: "or_02", weight: "or_03", review: "or_04", hook: "or_05", finish: "or_06" };
  const pick = branch[state.phase] ? choice(branch[state.phase]!) : undefined;
  let targets: string[] = [...content.phases[state.phase]];
  if (branch[state.phase]) targets = pick ? [targets[pick === "a" ? 0 : 1]!] : [];
  const held = Object.entries(state.objects).find(([, location]) => location === "player" || location === "or-rest");
  if (held?.[1] === "or-rest") targets = ["or-rest"];
  else if (held?.[1] === "player") targets.push("or-rest");
  const points: string[] = [...content.resumePoints[state.phase]];
  const resumePointId = held?.[1] === "or-rest" ? "or-rest" : state.phase === "report" && choice("or_06") === "b" ? "or-plaza-stand" : branch[state.phase] ? (pick ? points[pick === "a" ? 0 : 1] ?? null : null) : points[0] ?? null;
  return { phase: state.phase, objectiveKey: held?.[1] === "or-rest" ? content.restObjectiveKey : content.objectiveKeys[state.phase], activeTargetIds: targets, resumePointId, carriedObjectId: held?.[1] === "player" ? held[0] : null, objects: { ...state.objects }, placements: { ...state.placements }, choices: content.items.map(choice) };
}

export function transitionOr(snapshot: PlaySnapshot, command: Command, completedAt?: string): PlaySnapshot {
  const next = { ...snapshot, answers: [...snapshot.answers], completedEpisodes: [...snapshot.completedEpisodes], or: { ...snapshot.or, objects: { ...snapshot.or.objects }, placements: { ...snapshot.or.placements } } };
  const state = next.or; const phase = state.phase;
  const reject = (): never => { throw new Error("invalid_or_transition"); };
  const carried = Object.entries(state.objects).filter(([, location]) => location === "player");
  if (carried.length > 1) return reject();
  if (snapshot.moka.basket === "player" || Object.values(snapshot.lumi.objects).includes("player") || Object.values(snapshot.echo.objects).includes("player")) return reject();
  const targets = orView(snapshot).activeTargetIds;
  const validPlacements = () => {
    const entries = Object.entries(state.placements);
    return entries.length === Object.keys(content.slots).length && new Set(entries.map(([, piece]) => piece)).size === entries.length && entries.every(([slot, piece]) => Object.hasOwn(content.slots, slot) && typeof piece === "string" && Object.hasOwn(content.pieces, piece) && content.slots[slot as keyof typeof content.slots] === content.pieces[piece as keyof typeof content.pieces]);
  };
  const selected = (kind: string) => command.kind === kind && "targetId" in command && targets.includes(command.targetId) && command.targetId !== "or-rest";
  const choices: Partial<Record<OrPhase, [string, OrPhase]>> = { choose_01: ["or_01", "fire"], choose_02: ["or_02", "find_sand"], choose_03: ["or_03", "weight"], choose_04: ["or_04", "review"], choose_05: ["or_05", "hook"], choose_06: ["or_06", "finish"] };
  // Choosing how to find sand hands over the bucket at once; there is no separate pickup step.
  const carry: Partial<Record<OrPhase, keyof OrState["objects"]>> = { choose_02: "bucket" };
  const transport: Partial<Record<OrPhase, keyof OrState["objects"]>> = { find_sand: "bucket", sand: "bucket", sand_delivery: "bucket", finish: "bell", bell_delivery: "bell" };
  const object = transport[phase];
  if (phase === "locked" && command.kind === "open_episode" && command.npcId === "or" && snapshot.segment === "hub" && !snapshot.completedEpisodes.includes("or")) { state.phase = "choose_01"; next.segment = "ep_or"; }
  else if (command.kind === "choice") { const rule = choices[phase]; if (!rule || command.itemId !== rule[0] || (command.pick !== "a" && command.pick !== "b") || next.answers.some(a => a.id === command.itemId)) return reject(); next.answers.push({ id: command.itemId, pick: command.pick }); state.phase = rule[1]; const held = carry[phase]; if (held) state.objects[held] = "player"; }
  else if (object && command.kind === "set_down" && command.targetId === "or-rest" && state.objects[object] === "player") state.objects[object] = "or-rest";
  else if (object && command.kind === "pickup" && command.targetId === "or-rest" && state.objects[object] === "or-rest" && carried.length === 0) state.objects[object] = "player";
  else if (phase === "find_sand" && state.objects.bucket === "player" && selected(snapshot.answers.find(a => a.id === "or_02")?.pick === "a" ? "act" : "talk")) state.phase = "sand";
  else if (phase === "sand" && state.objects.bucket === "player" && selected("act")) state.phase = "sand_delivery";
  else if (phase === "sand_delivery" && state.objects.bucket === "player" && selected("deliver")) { state.objects.bucket = "delivered"; state.phase = "gears"; }
  else if ((phase === "fire" || phase === "weight" || phase === "review" || phase === "lantern_link" || phase === "hook") && selected("act")) state.phase = phase === "fire" ? "choose_02" : phase === "weight" ? "assistant" : phase === "review" ? "lantern_link" : phase === "lantern_link" ? "choose_05" : "choose_06";
  else if (phase === "assistant" && selected("talk")) state.phase = "choose_04";
  else if (phase === "finish" && snapshot.answers.find(a => a.id === "or_06")?.pick === "a" && selected("act")) state.phase = "report";
  else if (phase === "finish" && snapshot.answers.find(a => a.id === "or_06")?.pick === "b" && selected("pickup") && state.objects.bell === "source" && carried.length === 0) { state.objects.bell = "player"; state.phase = "bell_delivery"; }
  else if (phase === "bell_delivery" && selected("deliver") && state.objects.bell === "player") { state.objects.bell = "delivered"; state.phase = "report"; }
  else if (phase === "gears" && command.kind === "place_piece") { const piece = command.pieceId as keyof typeof content.pieces; const slot = command.slotId as keyof typeof content.slots; if (!Object.hasOwn(content.pieces, piece) || !Object.hasOwn(content.slots, slot) || content.pieces[piece] !== content.slots[slot] || state.placements[slot] || Object.values(state.placements).includes(piece)) return reject(); state.placements[slot] = piece; if (Object.keys(state.placements).length === 3) state.phase = "choose_03"; }
  else if (phase === "gears" && command.kind === "auto_arrange") { for (const slot of Object.keys(content.slots) as (keyof typeof content.slots)[]) if (!state.placements[slot]) { const piece = (Object.keys(content.pieces) as (keyof typeof content.pieces)[]).find(id => content.pieces[id] === content.slots[slot] && !Object.values(state.placements).includes(id)); if (!piece) return reject(); state.placements[slot] = piece; } state.phase = "choose_03"; }
  else if (phase === "report" && command.kind === "complete" && command.targetId === "D" && completedAt && !next.completedEpisodes.includes("or") && state.objects.bucket === "delivered" && (snapshot.answers.find(a => a.id === "or_06")?.pick === "a" ? state.objects.bell === "source" : state.objects.bell === "delivered") && Object.keys(state.placements).length === 3 && content.items.every((id, i) => next.answers.filter(a => a.id.startsWith("or_"))[i]?.id === id) && next.answers.filter(a => a.id.startsWith("or_")).length === 6) { state.phase = "completed"; state.completedAt = completedAt; next.completedEpisodes.push("or"); }
  else return reject();
  if (state.phase === "completed" && !validPlacements()) return reject();
  return next;
}

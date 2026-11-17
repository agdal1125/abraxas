import content from "../../../content/quests/echo-errand.json";
import type { Command, PlaySnapshot } from "./play";

export type EchoPhase = keyof typeof content.phases;
export type EchoObjectLocation = "source" | "player" | "echo-rest" | "delivered";
export type EchoState = { phase: EchoPhase; objects: { book: EchoObjectLocation; record: EchoObjectLocation; notebook: EchoObjectLocation; legend: EchoObjectLocation }; placements: Partial<Record<keyof typeof content.slots, keyof typeof content.pieces>>; completedAt: string | null };
export const initialEcho = (): EchoState => ({ phase: "locked", objects: { book: "source", record: "source", notebook: "source", legend: "source" }, placements: {}, completedAt: null });

export function echoView(snapshot: PlaySnapshot) {
  const state = snapshot.echo;
  const choice = (id: string) => snapshot.answers.find(a => a.id === id)?.pick;
  const branch: Partial<Record<EchoPhase, string>> = { enclose: "echo_01", search: "echo_02", notebook_delivery: "echo_03", bookmark: "echo_05", legend_delivery: "echo_06" };
  const pick = branch[state.phase] ? choice(branch[state.phase]!) : undefined;
  let targets: string[] = [...content.phases[state.phase]];
  if (branch[state.phase]) targets = pick ? [targets[pick === "a" ? 0 : 1]!] : [];
  const held = Object.entries(state.objects).find(([, location]) => location === "player" || location === "echo-rest");
  if (held?.[1] === "echo-rest") targets = ["echo-rest"];
  else if (held?.[1] === "player") targets.push("echo-rest");
  const points: string[] = [...content.resumePoints[state.phase]];
  const resumePointId = held?.[1] === "echo-rest" ? "echo-rest" : branch[state.phase] ? (pick ? points[pick === "a" ? 0 : 1] ?? null : null) : points[0] ?? null;
  return { phase: state.phase, objectiveKey: held?.[1] === "echo-rest" ? content.restObjectiveKey : content.objectiveKeys[state.phase], activeTargetIds: targets, resumePointId, carriedObjectId: held?.[1] === "player" ? held[0] : null, objects: { ...state.objects }, placements: { ...state.placements }, choices: content.items.map(choice) };
}

export function transitionEcho(snapshot: PlaySnapshot, command: Command, completedAt?: string): PlaySnapshot {
  const next = { ...snapshot, answers: [...snapshot.answers], completedEpisodes: [...snapshot.completedEpisodes], echo: { ...snapshot.echo, objects: { ...snapshot.echo.objects }, placements: { ...snapshot.echo.placements } } };
  const state = next.echo; const phase = state.phase;
  const reject = (): never => { throw new Error("invalid_echo_transition"); };
  const carried = Object.entries(state.objects).filter(([, location]) => location === "player");
  if (carried.length > 1) return reject();
  if (snapshot.moka.basket === "player" || Object.values(snapshot.lumi.objects).includes("player") || Object.values(snapshot.or.objects).includes("player")) return reject();
  const targets = echoView(snapshot).activeTargetIds;
  const validPlacements = () => {
    const entries = Object.entries(state.placements);
    return entries.length === Object.keys(content.slots).length && new Set(entries.map(([, piece]) => piece)).size === entries.length && entries.every(([slot, piece]) => Object.hasOwn(content.slots, slot) && typeof piece === "string" && Object.hasOwn(content.pieces, piece) && content.slots[slot as keyof typeof content.slots] === content.pieces[piece as keyof typeof content.pieces]);
  };
  const selected = (kind: string) => command.kind === kind && "targetId" in command && targets.includes(command.targetId) && command.targetId !== "echo-rest";
  const choices: Partial<Record<EchoPhase, [string, EchoPhase]>> = { choose_01: ["echo_01", "enclose"], choose_02: ["echo_02", "search"], choose_03: ["echo_03", "notebook_delivery"], choose_04: ["echo_04", "arrange"], choose_05: ["echo_05", "bookmark"], choose_06: ["echo_06", "legend_delivery"] };
  // A choice or action that starts a carry hands the object over at once; there is no separate pickup step.
  const carry: Partial<Record<EchoPhase, keyof EchoState["objects"]>> = { choose_03: "notebook", choose_06: "legend" };
  const transport: Partial<Record<EchoPhase, keyof EchoState["objects"]>> = { book_delivery: "book", record_delivery: "record", notebook_delivery: "notebook", legend_delivery: "legend" };
  const object = transport[phase];
  if (phase === "locked" && command.kind === "open_episode" && command.npcId === "echo" && snapshot.segment === "hub" && !snapshot.completedEpisodes.includes("echo")) { state.phase = "choose_01"; next.segment = "ep_echo"; }
  else if (command.kind === "choice") { const rule = choices[phase]; if (!rule || command.itemId !== rule[0] || (command.pick !== "a" && command.pick !== "b") || next.answers.some(a => a.id === command.itemId)) return reject(); next.answers.push({ id: command.itemId, pick: command.pick }); state.phase = rule[1]; const held = carry[phase]; if (held) state.objects[held] = "player"; }
  else if (object && command.kind === "set_down" && command.targetId === "echo-rest" && state.objects[object] === "player") state.objects[object] = "echo-rest";
  else if (object && command.kind === "pickup" && command.targetId === "echo-rest" && state.objects[object] === "echo-rest" && carried.length === 0) state.objects[object] = "player";
  else if ((phase === "book_delivery" || phase === "record_delivery" || phase === "notebook_delivery" || phase === "legend_delivery") && object && state.objects[object] === "player" && selected("deliver")) { state.objects[object] = "delivered"; state.phase = phase === "book_delivery" ? "choose_02" : phase === "record_delivery" ? "choose_03" : phase === "notebook_delivery" ? "organizer" : "report"; }
  else if ((phase === "enclose" || phase === "search") && selected("act") && carried.length === 0) { const held = phase === "enclose" ? "book" : "record"; state.objects[held] = "player"; state.phase = phase === "enclose" ? "book_delivery" : "record_delivery"; }
  else if ((phase === "reading" || phase === "bookmark") && selected("act")) state.phase = phase === "reading" ? "choose_05" : "choose_06";
  else if (phase === "organizer" && selected("talk")) state.phase = "choose_04";
  else if (phase === "arrange" && command.kind === "place_piece") { const piece = command.pieceId as keyof typeof content.pieces; const slot = command.slotId as keyof typeof content.slots; if (!Object.hasOwn(content.pieces, piece) || !Object.hasOwn(content.slots, slot) || content.pieces[piece] !== content.slots[slot] || state.placements[slot] || Object.values(state.placements).includes(piece)) return reject(); state.placements[slot] = piece; if (Object.keys(state.placements).length === 6) state.phase = "reading"; }
  else if (phase === "arrange" && command.kind === "auto_arrange") { for (const slot of Object.keys(content.slots) as (keyof typeof content.slots)[]) if (!state.placements[slot]) { const piece = (Object.keys(content.pieces) as (keyof typeof content.pieces)[]).find(id => content.pieces[id] === content.slots[slot] && !Object.values(state.placements).includes(id)); if (!piece) return reject(); state.placements[slot] = piece; } state.phase = "reading"; }
  else if (phase === "report" && command.kind === "complete" && command.targetId === "C" && completedAt && !next.completedEpisodes.includes("echo") && Object.values(state.objects).every(v => v === "delivered") && Object.keys(state.placements).length === 6 && content.items.every((id, i) => next.answers.filter(a => a.id.startsWith("echo_"))[i]?.id === id) && next.answers.filter(a => a.id.startsWith("echo_")).length === 6) { state.phase = "completed"; state.completedAt = completedAt; next.completedEpisodes.push("echo"); }
  else return reject();
  if (state.phase === "completed" && !validPlacements()) return reject();
  return next;
}

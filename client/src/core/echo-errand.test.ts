import { describe, expect, it } from "vitest";
import fixture from "../../../content/quests/fixtures/echo-errand.json";
import content from "../../../content/quests/echo-errand.json";
import { echoView, transitionEcho } from "./echo-errand";
import type { Command, PlaySnapshot } from "./play";

describe("Echo errand", () => {
  it("runs shared manual and automatic fixtures through the final action", () => {
    for (const scenario of fixture.success) {
      let snapshot = structuredClone(fixture.initial) as PlaySnapshot;
      for (const command of scenario.commands) snapshot = transitionEcho(snapshot, command as Command, fixture.completedAt);
      expect(snapshot.echo.phase, scenario.name).toBe("completed");
      expect(snapshot.echo.completedAt, scenario.name).toBe(fixture.completedAt);
      expect(snapshot.answers.map(a => a.id), scenario.name).toEqual(scenario.expected.answerIds);
      expect(snapshot.completedEpisodes, scenario.name).toEqual(scenario.expected.completedEpisodes);
      expect(() => transitionEcho(snapshot, { kind: "complete", targetId: "C" }, fixture.completedAt)).toThrow();
    }
  });
  it("rejects fixture commands without mutating the snapshot", () => {
    for (const scenario of fixture.rejections) {
      let snapshot = structuredClone(fixture.initial) as PlaySnapshot;
      for (const command of fixture.success[0]!.commands.slice(0, scenario.after)) snapshot = transitionEcho(snapshot, command as Command, fixture.completedAt);
      const before = structuredClone(snapshot);
      expect(() => transitionEcho(snapshot, scenario.command as Command, fixture.completedAt), scenario.name).toThrow("invalid_echo_transition");
      expect(snapshot).toEqual(before);
    }
  });
  it("requires the carried object to be recovered from the rest", () => {
    let snapshot = structuredClone(fixture.initial) as PlaySnapshot;
    const commands = fixture.success[0]!.commands;
    const pickup = commands.findIndex(c => c.kind === "act" && "targetId" in c && c.targetId === "echo-kind-note"); // enclosing the note hands over the book
    for (const command of commands.slice(0, pickup + 1)) snapshot = transitionEcho(snapshot, command as Command, fixture.completedAt);
    snapshot = transitionEcho(snapshot, { kind: "set_down", targetId: "echo-rest" });
    expect(echoView(snapshot).activeTargetIds).toEqual(["echo-rest"]);
    expect(() => transitionEcho(snapshot, commands[pickup + 1] as Command, fixture.completedAt)).toThrow();
    snapshot = transitionEcho(snapshot, { kind: "pickup", targetId: "echo-rest" });
    expect(snapshot.echo.objects.book).toBe("player");
  });
  it("rejects a corrupted puzzle at report and carrying another resident's object", () => {
    let snapshot = structuredClone(fixture.initial) as PlaySnapshot;
    for (const command of fixture.success[0]!.commands.slice(0, -1)) snapshot = transitionEcho(snapshot, command as Command, fixture.completedAt);
    const corrupted = structuredClone(snapshot);
    const slots = Object.keys(corrupted.echo.placements) as (keyof typeof corrupted.echo.placements)[];
    corrupted.echo.placements[slots[0]!] = corrupted.echo.placements[slots[1]!];
    expect(() => transitionEcho(corrupted, fixture.success[0]!.commands.at(-1) as Command, fixture.completedAt)).toThrow("invalid_echo_transition");
    const occupied = structuredClone(fixture.initial) as PlaySnapshot;
    occupied.moka.basket = "player";
    expect(() => transitionEcho(occupied, { kind: "open_episode", npcId: "echo" })).toThrow("invalid_echo_transition");
  });
  it("rejects mismatched, reused and occupied puzzle pieces", () => {
    let snapshot = structuredClone(fixture.initial) as PlaySnapshot;
    const commands = fixture.success[0]!.commands;
    const index = commands.findIndex(c => c.kind === "place_piece");
    for (const command of commands.slice(0, index)) snapshot = transitionEcho(snapshot, command as Command, fixture.completedAt);
    const first = commands[index] as { kind: "place_piece"; pieceId: string; slotId: string };
    const wrongSlot = Object.keys(content.slots).find(slot => content.slots[slot as keyof typeof content.slots] !== content.pieces[first.pieceId as keyof typeof content.pieces])!;
    expect(() => transitionEcho(snapshot, { ...first, slotId: wrongSlot })).toThrow("invalid_echo_transition");
    snapshot = transitionEcho(snapshot, first);
    expect(() => transitionEcho(snapshot, first)).toThrow("invalid_echo_transition");
    const otherPiece = Object.keys(content.pieces).find(piece => piece !== first.pieceId)!;
    expect(() => transitionEcho(snapshot, { kind: "place_piece", pieceId: otherPiece, slotId: first.slotId })).toThrow("invalid_echo_transition");
  });
  it("activates only the selected branch at each action", () => {
    const branches: Partial<Record<keyof typeof content.phases, string>> = {"enclose":"echo_01","search":"echo_02","notebook_delivery":"echo_03","bookmark":"echo_05","legend_delivery":"echo_06"};
    let snapshot = structuredClone(fixture.initial) as PlaySnapshot;
    let checked = 0;
    for (const command of fixture.success[0]!.commands) {
      const phase = snapshot.echo.phase;
      const itemId = branches[phase];
      if (itemId && "targetId" in command) {
        const targets: string[] = [...content.phases[phase]];
        expect(echoView(snapshot).activeTargetIds).toContain(targets[0]);
        expect(() => transitionEcho(snapshot, { ...command, targetId: targets[1]! } as Command)).toThrow("invalid_echo_transition");
        const alternate = structuredClone(snapshot);
        alternate.answers.find(a => a.id === itemId)!.pick = "b";
        expect(echoView(alternate).activeTargetIds).toContain(targets[1]);
        const kind = command.kind;
        expect(() => transitionEcho(alternate, { kind, targetId: targets[1]! } as Command)).not.toThrow();
        checked++;
      }
      snapshot = transitionEcho(snapshot, command as Command, fixture.completedAt);
    }
    expect(checked).toBe(Object.keys(branches).length);
  });
});

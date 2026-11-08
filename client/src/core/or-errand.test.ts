import { describe, expect, it } from "vitest";
import fixture from "../../../content/quests/fixtures/or-errand.json";
import content from "../../../content/quests/or-errand.json";
import { orView, transitionOr } from "./or-errand";
import type { Command, PlaySnapshot } from "./play";

describe("Or errand", () => {
  it("runs shared manual and automatic fixtures through the final action", () => {
    for (const scenario of fixture.success) {
      let snapshot = structuredClone(fixture.initial) as PlaySnapshot;
      for (const command of scenario.commands) snapshot = transitionOr(snapshot, command as Command, fixture.completedAt);
      expect(snapshot.or.phase, scenario.name).toBe("completed");
      expect(snapshot.or.completedAt, scenario.name).toBe(fixture.completedAt);
      expect(snapshot.answers.map(a => a.id), scenario.name).toEqual(scenario.expected.answerIds);
      expect(snapshot.completedEpisodes, scenario.name).toEqual(scenario.expected.completedEpisodes);
      expect(() => transitionOr(snapshot, { kind: "complete", targetId: "D" }, fixture.completedAt)).toThrow();
    }
  });
  it("rejects fixture commands without mutating the snapshot", () => {
    for (const scenario of fixture.rejections) {
      let snapshot = structuredClone(fixture.initial) as PlaySnapshot;
      for (const command of fixture.success[0]!.commands.slice(0, scenario.after)) snapshot = transitionOr(snapshot, command as Command, fixture.completedAt);
      const before = structuredClone(snapshot);
      expect(() => transitionOr(snapshot, scenario.command as Command, fixture.completedAt), scenario.name).toThrow("invalid_or_transition");
      expect(snapshot).toEqual(before);
    }
  });
  it("requires the carried object to be recovered from the rest", () => {
    let snapshot = structuredClone(fixture.initial) as PlaySnapshot;
    const commands = fixture.success[0]!.commands;
    const pickup = commands.findIndex(c => c.kind === "choice" && "itemId" in c && c.itemId === "or_02"); // the bucket is handed over with this choice
    for (const command of commands.slice(0, pickup + 1)) snapshot = transitionOr(snapshot, command as Command, fixture.completedAt);
    snapshot = transitionOr(snapshot, { kind: "set_down", targetId: "or-rest" });
    expect(orView(snapshot).activeTargetIds).toEqual(["or-rest"]);
    expect(() => transitionOr(snapshot, commands[pickup + 1] as Command, fixture.completedAt)).toThrow();
    snapshot = transitionOr(snapshot, { kind: "pickup", targetId: "or-rest" });
    expect(snapshot.or.objects.bucket).toBe("player");
  });
  it("rejects a corrupted puzzle at report and carrying another resident's object", () => {
    let snapshot = structuredClone(fixture.initial) as PlaySnapshot;
    for (const command of fixture.success[0]!.commands.slice(0, -1)) snapshot = transitionOr(snapshot, command as Command, fixture.completedAt);
    const corrupted = structuredClone(snapshot);
    const slots = Object.keys(corrupted.or.placements) as (keyof typeof corrupted.or.placements)[];
    corrupted.or.placements[slots[0]!] = corrupted.or.placements[slots[1]!];
    expect(() => transitionOr(corrupted, fixture.success[0]!.commands.at(-1) as Command, fixture.completedAt)).toThrow("invalid_or_transition");
    const occupied = structuredClone(fixture.initial) as PlaySnapshot;
    occupied.moka.basket = "player";
    expect(() => transitionOr(occupied, { kind: "open_episode", npcId: "or" })).toThrow("invalid_or_transition");
  });
  it("rejects mismatched, reused and occupied puzzle pieces", () => {
    let snapshot = structuredClone(fixture.initial) as PlaySnapshot;
    const commands = fixture.success[0]!.commands;
    const index = commands.findIndex(c => c.kind === "place_piece");
    for (const command of commands.slice(0, index)) snapshot = transitionOr(snapshot, command as Command, fixture.completedAt);
    const first = commands[index] as { kind: "place_piece"; pieceId: string; slotId: string };
    const wrongSlot = Object.keys(content.slots).find(slot => content.slots[slot as keyof typeof content.slots] !== content.pieces[first.pieceId as keyof typeof content.pieces])!;
    expect(() => transitionOr(snapshot, { ...first, slotId: wrongSlot })).toThrow("invalid_or_transition");
    snapshot = transitionOr(snapshot, first);
    expect(() => transitionOr(snapshot, first)).toThrow("invalid_or_transition");
    const otherPiece = Object.keys(content.pieces).find(piece => piece !== first.pieceId)!;
    expect(() => transitionOr(snapshot, { kind: "place_piece", pieceId: otherPiece, slotId: first.slotId })).toThrow("invalid_or_transition");
  });
  it("activates only the selected branch at each action", () => {
    const branches: Partial<Record<keyof typeof content.phases, string>> = {"fire":"or_01","find_sand":"or_02","weight":"or_03","review":"or_04","hook":"or_05","finish":"or_06"};
    let snapshot = structuredClone(fixture.initial) as PlaySnapshot;
    let checked = 0;
    for (const command of fixture.success[0]!.commands) {
      const phase = snapshot.or.phase;
      const itemId = branches[phase];
      if (itemId && "targetId" in command) {
        const targets: string[] = [...content.phases[phase]];
        expect(orView(snapshot).activeTargetIds).toContain(targets[0]);
        expect(() => transitionOr(snapshot, { ...command, targetId: targets[1]! } as Command)).toThrow("invalid_or_transition");
        const alternate = structuredClone(snapshot);
        alternate.answers.find(a => a.id === itemId)!.pick = "b";
        expect(orView(alternate).activeTargetIds).toContain(targets[1]);
        const kind = phase === "find_sand" ? "talk" : phase === "finish" ? "pickup" : command.kind;
        expect(() => transitionOr(alternate, { kind, targetId: targets[1]! } as Command)).not.toThrow();
        checked++;
      }
      snapshot = transitionOr(snapshot, command as Command, fixture.completedAt);
    }
    expect(checked).toBe(Object.keys(branches).length);
  });
});

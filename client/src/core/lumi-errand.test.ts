import { describe, expect, it } from "vitest";
import fixture from "../../../content/quests/fixtures/lumi-errand.json";
import content from "../../../content/quests/lumi-errand.json";
import { lumiView, transitionLumi } from "./lumi-errand";
import type { Command, PlaySnapshot } from "./play";
import mokaFixture from "../../../content/quests/fixtures/moka-errand.json";
import echoFixture from "../../../content/quests/fixtures/echo-errand.json";
import orFixture from "../../../content/quests/fixtures/or-errand.json";
import { transitionMoka } from "./moka-errand";
import { transitionEcho } from "./echo-errand";
import { transitionOr } from "./or-errand";
import scoring from "../../../content/scoring/items.json";

describe("Lumi errand", () => {
  it("runs shared manual and automatic fixtures through the final action", () => {
    for (const scenario of fixture.success) {
      let snapshot = structuredClone(fixture.initial) as PlaySnapshot;
      for (const command of scenario.commands) snapshot = transitionLumi(snapshot, command as Command, fixture.completedAt);
      expect(snapshot.lumi.phase, scenario.name).toBe("completed");
      expect(snapshot.lumi.completedAt, scenario.name).toBe(fixture.completedAt);
      expect(snapshot.answers.map(a => a.id), scenario.name).toEqual(scenario.expected.answerIds);
      expect(snapshot.completedEpisodes, scenario.name).toEqual(scenario.expected.completedEpisodes);
      expect(() => transitionLumi(snapshot, { kind: "complete", targetId: "A" }, fixture.completedAt)).toThrow();
    }
  });
  it("rejects fixture commands without mutating the snapshot", () => {
    for (const scenario of fixture.rejections) {
      let snapshot = structuredClone(fixture.initial) as PlaySnapshot;
      for (const command of fixture.success[0]!.commands.slice(0, scenario.after)) snapshot = transitionLumi(snapshot, command as Command, fixture.completedAt);
      const before = structuredClone(snapshot);
      expect(() => transitionLumi(snapshot, scenario.command as Command, fixture.completedAt), scenario.name).toThrow("invalid_lumi_transition");
      expect(snapshot).toEqual(before);
    }
  });
  it("requires the carried object to be recovered from the rest", () => {
    let snapshot = structuredClone(fixture.initial) as PlaySnapshot;
    const commands = fixture.success[0]!.commands;
    const pickup = commands.findIndex(c => c.kind === "pickup" && "targetId" in c && c.targetId === "lumi-horn");
    for (const command of commands.slice(0, pickup + 1)) snapshot = transitionLumi(snapshot, command as Command, fixture.completedAt);
    snapshot = transitionLumi(snapshot, { kind: "set_down", targetId: "lumi-rest" });
    expect(lumiView(snapshot).activeTargetIds).toEqual(["lumi-rest"]);
    expect(() => transitionLumi(snapshot, commands[pickup + 1] as Command, fixture.completedAt)).toThrow();
    snapshot = transitionLumi(snapshot, { kind: "pickup", targetId: "lumi-rest" });
    expect(snapshot.lumi.objects.notice).toBe("player");
  });
  it("rejects a corrupted puzzle at report and carrying another resident's object", () => {
    let snapshot = structuredClone(fixture.initial) as PlaySnapshot;
    for (const command of fixture.success[0]!.commands.slice(0, -1)) snapshot = transitionLumi(snapshot, command as Command, fixture.completedAt);
    const corrupted = structuredClone(snapshot);
    const slots = Object.keys(corrupted.lumi.placements) as (keyof typeof corrupted.lumi.placements)[];
    corrupted.lumi.placements[slots[0]!] = corrupted.lumi.placements[slots[1]!];
    expect(() => transitionLumi(corrupted, fixture.success[0]!.commands.at(-1) as Command, fixture.completedAt)).toThrow("invalid_lumi_transition");
    const occupied = structuredClone(fixture.initial) as PlaySnapshot;
    occupied.moka.basket = "player";
    expect(() => transitionLumi(occupied, { kind: "open_episode", npcId: "lumi" })).toThrow("invalid_lumi_transition");
  });
  it("rejects mismatched, reused and occupied puzzle pieces", () => {
    let snapshot = structuredClone(fixture.initial) as PlaySnapshot;
    const commands = fixture.success[0]!.commands;
    const index = commands.findIndex(c => c.kind === "place_piece");
    for (const command of commands.slice(0, index)) snapshot = transitionLumi(snapshot, command as Command, fixture.completedAt);
    const first = commands[index] as { kind: "place_piece"; pieceId: string; slotId: string };
    const wrongSlot = Object.keys(content.slots).find(slot => content.slots[slot as keyof typeof content.slots] !== content.pieces[first.pieceId as keyof typeof content.pieces])!;
    expect(() => transitionLumi(snapshot, { ...first, slotId: wrongSlot })).toThrow("invalid_lumi_transition");
    snapshot = transitionLumi(snapshot, first);
    expect(() => transitionLumi(snapshot, first)).toThrow("invalid_lumi_transition");
    const otherPiece = Object.keys(content.pieces).find(piece => piece !== first.pieceId)!;
    expect(() => transitionLumi(snapshot, { kind: "place_piece", pieceId: otherPiece, slotId: first.slotId })).toThrow("invalid_lumi_transition");
  });
  it("activates only the selected branch at each action", () => {
    const branches: Partial<Record<keyof typeof content.phases, string>> = {"table":"lumi_01","card":"lumi_02","notice_pickup":"lumi_03","notice_first":"lumi_03","notice_second":"lumi_03","material_pickup":"lumi_04","welcome":"lumi_05","score_pickup":"lumi_06"};
    let snapshot = structuredClone(fixture.initial) as PlaySnapshot;
    let checked = 0;
    for (const command of fixture.success[0]!.commands) {
      const phase = snapshot.lumi.phase;
      const itemId = branches[phase];
      if (itemId && "targetId" in command) {
        const targets: string[] = [...content.phases[phase]];
        expect(lumiView(snapshot).activeTargetIds).toContain(targets[0]);
        expect(() => transitionLumi(snapshot, { ...command, targetId: targets[1]! } as Command)).toThrow("invalid_lumi_transition");
        const alternate = structuredClone(snapshot);
        alternate.answers.find(a => a.id === itemId)!.pick = "b";
        expect(lumiView(alternate).activeTargetIds).toContain(targets[1]);
        const kind = (phase === "notice_first" || phase === "notice_second") ? "act" : command.kind;
        expect(() => transitionLumi(alternate, { kind, targetId: targets[1]! } as Command)).not.toThrow();
        checked++;
      }
      snapshot = transitionLumi(snapshot, command as Command, fixture.completedAt);
    }
    expect(checked).toBe(Object.keys(branches).length);
  });
});

it("preserves all four episodes in every completion order", () => {
  const episodes = {
    lumi: { commands: fixture.success[0]!.commands, transition: transitionLumi },
    moka: { commands: mokaFixture.success[0]!.commands, transition: transitionMoka },
    echo: { commands: echoFixture.success[0]!.commands, transition: transitionEcho },
    or: { commands: orFixture.success[0]!.commands, transition: transitionOr },
  };
  type Id = keyof typeof episodes;
  const permutations = (ids: Id[]): Id[][] => ids.length === 0 ? [[]] : ids.flatMap((id, index) => permutations(ids.filter((_, i) => i !== index)).map(rest => [id, ...rest]));
  for (const order of permutations(["lumi", "moka", "echo", "or"])) {
    let snapshot = structuredClone(fixture.initial) as PlaySnapshot;
    for (const id of order) {
      snapshot.segment = "hub";
      for (const command of episodes[id].commands) snapshot = episodes[id].transition(snapshot, command as Command, fixture.completedAt);
    }
    expect(snapshot.completedEpisodes).toEqual(order);
    expect([snapshot.lumi.phase, snapshot.moka.phase, snapshot.echo.phase, snapshot.or.phase]).toEqual(["completed", "completed", "completed", "completed"]);
    expect(snapshot.answers).toHaveLength(24);
  }
});

it("uses the original eighteen items in their original order and kind", () => {
  const expected = {
    lumi: ["dialogue", "dilemma", "errand", "errand", "dialogue", "dilemma"],
    echo: ["dilemma", "errand", "dialogue", "puzzle_pre", "puzzle_post", "dilemma"],
    or: ["dilemma", "errand", "puzzle_post", "puzzle_pre", "errand", "dialogue"],
  };
  for (const [id, kinds] of Object.entries(expected)) {
    const items = scoring.items.filter(item => item.id.startsWith(`${id}_`));
    expect(items.map(item => item.id)).toEqual(kinds.map((_, i) => `${id}_0${i + 1}`));
    expect(items.map(item => item.kind)).toEqual(kinds);
    expect(items.every(item => item.picks.a.text && item.picks.b.text)).toBe(true);
  }
});

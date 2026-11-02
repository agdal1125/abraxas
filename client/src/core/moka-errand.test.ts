import { describe, expect, it } from "vitest";
import fixture from "../../../content/quests/fixtures/moka-errand.json";
import { mokaView, transitionMoka } from "./moka-errand";
import { contentVersionMatches, type Command, type PlaySnapshot } from "./play";
import { initialLumi } from "./lumi-errand";
import { initialEcho } from "./echo-errand";
import { initialOr } from "./or-errand";

const residents = () => ({ lumi: initialLumi(), echo: initialEcho(), or: initialOr() });
const fixtureStart = () => ({ ...structuredClone(fixture.initial), ...residents() }) as PlaySnapshot;

const start = (): PlaySnapshot => ({
  playId: "play", contentVersion: "hash", revision: 0, segment: "hub", completedEpisodes: [], answers: [],
  moka: { phase: "locked", basket: "source", placements: {}, completedAt: null },
  ...residents(),
});

describe("Moka errand", () => {
  it("derives route, display and the action target from confirmed answers", () => {
    const snapshot = start();
    snapshot.moka.phase = "share_action";
    snapshot.answers = [{ id: "moka_01", pick: "b" }, { id: "moka_03", pick: "a" }, { id: "moka_04", pick: "b" }];
    expect(mokaView(snapshot)).toMatchObject({ route: "gentle", display: "low", activeTargetIds: ["moka-tasting-plate"] });
    expect(contentVersionMatches(snapshot, "hash")).toBe(true);
    expect(contentVersionMatches(snapshot, "other")).toBe(false);
    expect(contentVersionMatches(snapshot, "")).toBe(false);
  });

  it("rejects out-of-order actions and carries the basket only after pickup", () => {
    let snapshot = transitionMoka(start(), { kind: "open_episode", npcId: "moka" });
    expect(() => transitionMoka(snapshot, { kind: "deliver", targetId: "moka-workshop-dropoff" })).toThrow();
    snapshot = transitionMoka(snapshot, { kind: "choice", itemId: "moka_01", pick: "a" });
    snapshot = transitionMoka(snapshot, { kind: "pickup", targetId: "moka-basket-source" });
    snapshot = transitionMoka(snapshot, { kind: "set_down", targetId: "moka-rest" });
    expect(() => transitionMoka(snapshot, { kind: "deliver", targetId: "moka-workshop-dropoff" })).toThrow();
    snapshot = transitionMoka(snapshot, { kind: "pickup", targetId: "moka-rest" });
    snapshot = transitionMoka(snapshot, { kind: "deliver", targetId: "moka-workshop-dropoff" });
    expect(snapshot.moka).toMatchObject({ phase: "reservation", basket: "delivered" });
  });

  it("rejects invalid placements and completes remaining slots automatically", () => {
    const snapshot = start();
    snapshot.moka = { phase: "arrange", basket: "delivered", placements: {}, completedAt: null };
    expect(() => transitionMoka(snapshot, { kind: "place", breadId: "roll-1", slotId: "walnut-left" })).toThrow();
    const placed = transitionMoka(snapshot, { kind: "place", breadId: "walnut-1", slotId: "walnut-right" });
    expect(() => transitionMoka(placed, { kind: "place", breadId: "walnut-1", slotId: "walnut-left" })).toThrow();
    const done = transitionMoka(placed, { kind: "auto_arrange" });
    expect(done.moka.phase).toBe("share");
    expect(done.moka.placements).toEqual({ "walnut-right": "walnut-1", "walnut-left": "walnut-2", "roll-left": "roll-1", "roll-right": "roll-2", "flower-left": "flower-1", "flower-right": "flower-2" });
  });

  it("runs the shared successful and rejected command sequences", () => {
    for (const scenario of fixture.success) {
      let snapshot = fixtureStart();
      for (const command of scenario.commands) snapshot = transitionMoka(snapshot, command as Command, fixture.completedAt);
      expect(snapshot.moka.phase, scenario.name).toBe(scenario.expected.phase);
      expect(snapshot.moka.basket, scenario.name).toBe(scenario.expected.basket);
      expect(snapshot.answers.map((answer) => answer.id), scenario.name).toEqual(scenario.expected.answerIds);
      expect(Object.keys(snapshot.moka.placements), scenario.name).toHaveLength(scenario.expected.placementCount);
      expect(snapshot.completedEpisodes, scenario.name).toEqual(scenario.expected.completedEpisodes);
      expect(snapshot.moka.completedAt, scenario.name).toBe(fixture.completedAt);
    }
    for (const scenario of fixture.rejections) {
      let snapshot = fixtureStart();
      for (const command of fixture.success[0]!.commands.slice(0, scenario.after)) snapshot = transitionMoka(snapshot, command as Command, fixture.completedAt);
      const before = structuredClone(snapshot);
      expect(() => transitionMoka(snapshot, scenario.command as Command, fixture.completedAt), scenario.name).toThrow("invalid_moka_transition");
      expect(snapshot, scenario.name).toEqual(before);
    }
  });

  it("does not complete a report with missing or invalid placements", () => {
    let snapshot = fixtureStart();
    for (const command of fixture.success[0]!.commands.slice(0, -1)) snapshot = transitionMoka(snapshot, command as Command, fixture.completedAt);
    const incomplete = structuredClone(snapshot);
    delete incomplete.moka.placements["walnut-left"];
    expect(() => transitionMoka(incomplete, { kind: "complete", targetId: "B" }, fixture.completedAt)).toThrow();
    const duplicated = structuredClone(snapshot);
    duplicated.moka.placements["walnut-left"] = duplicated.moka.placements["walnut-right"];
    expect(() => transitionMoka(duplicated, { kind: "complete", targetId: "B" }, fixture.completedAt)).toThrow();
    expect(() => transitionMoka(snapshot, { kind: "complete", targetId: "B" })).toThrow();
  });

  it("preserves all six answers for either manual or automatic arrangement", () => {
    for (let bits = 0; bits < 64; bits++) {
      const picks = Array.from({ length: 6 }, (_, index) => (bits & (1 << index)) ? "b" : "a");
      const results = fixture.success.map((scenario) => {
        let snapshot = fixtureStart();
        let choiceIndex = 0;
        for (const original of scenario.commands) {
          let command = original as Command;
          if (command.kind === "choice") command = { ...command, pick: picks[choiceIndex++] as "a" | "b" };
          if (command.kind === "act") {
            const targetId = snapshot.moka.phase === "reservation_action" ? (picks[1] === "a" ? "moka-ledger" : "moka-reservation-bread") : snapshot.moka.phase === "share_action" ? (picks[3] === "a" ? "moka-tired-neighbor" : "moka-tasting-plate") : (picks[4] === "a" ? "moka-dough-double" : "moka-dough-reserved");
            command = { ...command, targetId };
          }
          snapshot = transitionMoka(snapshot, command, fixture.completedAt);
        }
        return snapshot.answers;
      });
      expect(results[0]).toEqual(results[1]);
      expect(results[0]?.map((answer) => answer.pick)).toEqual(picks);
    }
  });
});

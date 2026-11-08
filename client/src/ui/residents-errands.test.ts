import { expect, test, vi } from "vitest";
import lumi from "../../../content/quests/fixtures/lumi-errand.json";
import echo from "../../../content/quests/fixtures/echo-errand.json";
import or from "../../../content/quests/fixtures/or-errand.json";
import { transitionLumi } from "../core/lumi-errand";
import { transitionEcho } from "../core/echo-errand";
import { transitionOr } from "../core/or-errand";
import type { Command, PlaySnapshot } from "../core/play";
import { residentCommand, type Resident } from "./residents-errands";

test("each fixture action uses the confirmed target and action kind", () => {
  const cases = [["lumi", lumi, transitionLumi], ["echo", echo, transitionEcho], ["or", or, transitionOr]] as const;
  for (const [npc, fixture, transition] of cases) for (const path of fixture.success) {
    let snapshot = fixture.initial as PlaySnapshot;
    for (const raw of path.commands) {
      const command = raw as Command;
      if ("targetId" in command) {
        expect(residentCommand(snapshot, npc as Resident, "not-a-target")).toBeNull();
        expect(residentCommand(snapshot, npc as Resident, command.targetId)).toEqual(command);
      }
      snapshot = transition(snapshot, command, "2026-11-02T00:00:00Z");
    }
  }
});

test("carried objects can be set down and picked up only at the active rest", () => {
  const snapshot = structuredClone(lumi.initial) as PlaySnapshot;
  snapshot.segment = "ep_lumi"; snapshot.lumi.phase = "notice_first"; snapshot.lumi.objects.notice = "player"; snapshot.answers = [{ id: "lumi_03", pick: "b" }];
  expect(residentCommand(snapshot, "lumi", "lumi-rest")).toEqual({ kind: "set_down", targetId: "lumi-rest" });
  snapshot.lumi.objects.notice = "lumi-rest";
  expect(residentCommand(snapshot, "lumi", "lumi-rest")).toEqual({ kind: "pickup", targetId: "lumi-rest" });
  expect(residentCommand(snapshot, "lumi", "lumi-board")).toBeNull();
});


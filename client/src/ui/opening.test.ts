import { expect, test } from "vitest";
import { validName, openingSequence } from "./opening";

test("name validation trims and counts Unicode characters without accepting controls", () => {
  expect(validName("  하늘  ")).toBe("하늘");
  expect(validName("  ")).toBe("");
  expect(validName("😀".repeat(12))).toBe("😀".repeat(12));
  expect(validName("😀".repeat(13))).toBeNull();
  expect(validName("a\nb")).toBeNull();
  expect(validName(" a\n")).toBeNull();
  expect(validName("a\u2028b")).toBeNull();
});

test("opening sequence keeps the dog seated for every measurement and reaction", async () => {
  const events: string[] = [];
  await openingSequence({
    intent: async () => { events.push("intent"); },
    howToChoose: async () => { events.push("howToChoose"); },
    prelude: async () => { events.push("prelude"); },
    scene: value => { events.push(value); },
    mode: value => { events.push(value); },
    knot: async value => { events.push(value); },
    name: async () => { events.push("name"); },
    questions: async () => { events.push("question", "reaction"); },
  }, true);
  expect(events).toEqual(["intent", "prelude", "entrance", "lead", "demi_follow", "follow", "postman_intro", "name", "postman_named", "howToChoose", "sit", "question", "reaction", "follow", "prologue_outro"]);
});

test("resume skips the prelude and introductory dialogue but keeps the measurement scene", async () => {
  const events: string[] = [];
  await openingSequence({
    intent: async () => { events.push("intent"); },
    howToChoose: async () => { events.push("howToChoose"); },
    prelude: async () => { events.push("prelude"); },
    scene: value => { events.push(value); },
    mode: value => { events.push(value); },
    knot: async value => { events.push(value); },
    name: async () => { events.push("name"); },
    questions: async () => { events.push("question"); },
  }, false);
  expect(events).toEqual(["entrance", "sit", "question", "follow", "prologue_outro"]);
});

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
    prelude: async () => { events.push("prelude"); },
    scene: value => { events.push(value); },
    mode: value => { events.push(value); },
    knot: async value => { events.push(value); },
    name: async () => { events.push("name"); },
    question: async value => { events.push(value, "reaction"); },
    questions: async () => { events.push("questions"); },
  }, true);
  expect(events).toEqual(["prelude", "entrance", "lead", "demi_follow", "follow", "postman_intro", "sit", "prologue_01", "reaction", "follow", "postman_name", "name", "postman_named", "sit", "questions", "follow", "prologue_outro"]);
});

test("resume skips the prelude and introductory dialogue but keeps the measurement scene", async () => {
  const events: string[] = [];
  await openingSequence({
    prelude: async () => { events.push("prelude"); },
    scene: value => { events.push(value); },
    mode: value => { events.push(value); },
    knot: async value => { events.push(value); },
    name: async () => { events.push("name"); },
    question: async value => { events.push(value); },
    questions: async () => { events.push("questions"); },
  }, false);
  expect(events).toEqual(["entrance", "sit", "questions", "follow", "prologue_outro"]);
});

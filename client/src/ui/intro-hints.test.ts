import { afterEach, expect, test, vi } from "vitest";
import ko from "../../../content/i18n/ko/ui.json";
import en from "../../../content/i18n/en/ui.json";
import { moveHintKey } from "./intro-hints";

afterEach(() => vi.unstubAllGlobals());

test("movement hint follows the pointer type", () => {
  vi.stubGlobal("window", { matchMedia: (q: string) => ({ matches: q === "(pointer: coarse)" }) });
  expect(moveHintKey()).toBe("moveTouch");
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
  expect(moveHintKey()).toBe("moveKeys");
  vi.stubGlobal("window", {});
  expect(moveHintKey()).toBe("moveKeys");
});

test.each([ko, en])("pre-prologue choose advice does not send the player to villagers", ui => {
  expect(Object.keys(ui.howTo).sort()).toEqual(["choose", "dog", "examine", "moveKeys", "moveTouch", "visit"]);
  expect(ui.howTo.choose).not.toContain(ui.howTo.visit);
});

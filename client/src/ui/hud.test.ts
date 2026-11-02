import { expect, it } from "vitest";
import { objectiveKey } from "./hud";
import { Game } from "./game";
import { vi } from "vitest";

it("selects the objective for each exploration stage", () => {
  expect(objectiveKey("hub", "character")).toBe("hub");
  expect(objectiveKey("ep_lumi", "character")).toBe("character");
  expect(objectiveKey("ep_lumi", "quest")).toBe("quest");
  expect(objectiveKey("ep_lumi", "return")).toBe("return");
  expect(objectiveKey("interlude_1", "character")).toBe("interlude");
  expect(objectiveKey("festival", "character")).toBe("festival");
  expect(objectiveKey("gate", "character")).toBe("gate");
});

it("shows the idle villager's name and returns to exploration", () => {
  const game = Object.create(Game.prototype) as any;
  game.state = { lang: "ko", playId: "play", log: [], completed: [], segment: "hub" };
  game.village = { focusSpeaker: vi.fn() };
  game.world = vi.fn();
  game.panel = vi.fn();
  game.interact("s1j2");
  expect(game.panel.mock.calls[0][3]).toBe("s1j2");
  expect(game.panel.mock.calls[0][0]).toBe("지금은 다른 곳을 살펴보자.");
  expect(game.village.focusSpeaker).toHaveBeenCalledWith("s1j2");
  game.panel.mock.calls[0][1][0][1]();
  expect(game.world).toHaveBeenCalledOnce();
});

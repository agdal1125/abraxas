import { expect, it, vi } from "vitest";
import { Game } from "./game";

it("examining and closing leaves the choice log and progress unchanged", () => {
  const game = Object.create(Game.prototype) as any;
  game.state = { lang: "ko", playId: "play", log: [{ id: "prologue_01", pick: "a" }], completed: ["lumi"], segment: "hub" };
  const before = structuredClone(game.state);
  game.controls = { setActive: vi.fn() };
  game.village = { setEnabled: vi.fn() };
  game.overlay = { querySelector: () => null, replaceChildren: vi.fn() };
  let close: (() => void) | undefined;
  game.panel = vi.fn((_text: string, buttons: [string, () => void][]) => { close = buttons[0]?.[1]; });
  game.save = vi.fn();

  game.interact("examine:well");
  expect(game.panel).toHaveBeenCalledOnce();
  close!();
  expect(game.state).toEqual(before);
  expect(game.save).not.toHaveBeenCalled();
  expect(game.village.setEnabled).toHaveBeenCalledWith(true);
});

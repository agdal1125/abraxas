import { afterEach, expect, it, vi } from "vitest";
import { Controls } from "./controls";

it("clears held movement on rotation and waits for fresh input after returning", () => {
  class Element extends EventTarget {
    className = ""; textContent = ""; hidden = false; disabled = false; type = "";
    append() {} setAttribute() {} closest() { return null; }
    hasPointerCapture() { return false; } releasePointerCapture() {}
  }
  const windowTarget = new EventTarget(), documentTarget = new EventTarget();
  vi.stubGlobal("window", windowTarget);
  vi.stubGlobal("document", Object.assign(documentTarget, { createElement: () => new Element(), hidden: false }));
  vi.stubGlobal("HTMLElement", Element);
  const setMoveInput = vi.fn();
  const controls = new Controls(new Element() as unknown as HTMLElement, { setMoveInput });
  controls.setActive(true, "ko");
  const key = () => Object.assign(new Event("keydown", { cancelable: true }), { code: "KeyW", repeat: false });
  windowTarget.dispatchEvent(key());
  expect(setMoveInput).toHaveBeenLastCalledWith(0, 1);
  windowTarget.dispatchEvent(new CustomEvent("abraxas:viewport", { detail: { portrait: true } }));
  expect(setMoveInput).toHaveBeenLastCalledWith(0, 0);
  windowTarget.dispatchEvent(key());
  expect(setMoveInput).toHaveBeenLastCalledWith(0, 0);
  windowTarget.dispatchEvent(new CustomEvent("abraxas:viewport", { detail: { portrait: false } }));
  expect(setMoveInput).toHaveBeenLastCalledWith(0, 0);
  windowTarget.dispatchEvent(key());
  expect(setMoveInput).toHaveBeenLastCalledWith(0, 1);
});
afterEach(() => vi.unstubAllGlobals());

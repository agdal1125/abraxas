import { afterEach, expect, it, vi } from "vitest";
import { Controls } from "./controls";

class Element extends EventTarget {
  className = ""; textContent = ""; hidden = false;
  children: Element[] = [];
  style = { setProperty: vi.fn() };
  classList = { add: vi.fn(), remove: vi.fn() };
  append(...children: Element[]) { this.children.push(...children); }
  setAttribute() {} closest() { return null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 500 }; }
  setPointerCapture() {} hasPointerCapture() { return false; } releasePointerCapture() {}
}

function setup() {
  const windowTarget = new EventTarget(), documentTarget = new EventTarget(), app = new Element();
  vi.stubGlobal("window", windowTarget);
  vi.stubGlobal("document", Object.assign(documentTarget, { createElement: () => new Element(), hidden: false }));
  vi.stubGlobal("HTMLElement", Element);
  const village = { setMoveInput: vi.fn(), hitTargetAt: vi.fn(() => "target"), interactTarget: vi.fn(), interactNearby: vi.fn() };
  const controls = new Controls(app as unknown as HTMLElement, village);
  controls.setActive(true, "ko");
  const pointer = (type: string, x: number, y: number, time: number, id = 1) => { const event = Object.assign(new Event(type, { cancelable: true }), { pointerId: id, pointerType: "touch", button: 0, clientX: x, clientY: y }); Object.defineProperty(event, "timeStamp", { value: time }); app.dispatchEvent(event); };
  const key = (code: string) => windowTarget.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { code, repeat: false }));
  return { app, village, windowTarget, pointer, key };
}

it("interacts on a short tap but not a drag or a long press", () => {
  const { pointer, village } = setup();
  pointer("pointerdown", 700, 200, 0); pointer("pointerup", 705, 200, 100);
  expect(village.interactTarget).toHaveBeenCalledExactlyOnceWith("target");
  pointer("pointerdown", 700, 200, 200); pointer("pointermove", 720, 200, 220); pointer("pointerup", 700, 200, 250);
  pointer("pointerdown", 700, 200, 300); pointer("pointerup", 700, 200, 1600);
  expect(village.interactTarget).toHaveBeenCalledTimes(1);
});

it("accepts a stationary touch delayed by a busy rendering thread", () => {
  const { pointer, village } = setup();
  pointer("pointerdown", 890, 40, 0); pointer("pointerup", 890, 40, 890);
  expect(village.interactTarget).toHaveBeenCalledExactlyOnceWith("target");
});

it("releases the floating joystick without triggering a tap", () => {
  const { pointer, village, app } = setup();
  pointer("pointerdown", 200, 400, 0); pointer("pointermove", 240, 400, 20);
  expect(village.setMoveInput).toHaveBeenLastCalledWith(1, 0);
  pointer("pointerup", 240, 400, 40);
  expect(village.setMoveInput).toHaveBeenLastCalledWith(0, 0);
  expect(village.interactTarget).not.toHaveBeenCalled();
  expect(app.children[0]!.children[0]!.classList.remove).toHaveBeenCalledWith("is-active");
});

it("allows a short target tap in the joystick area and ignores a second pointer", () => {
  const { pointer, village } = setup();
  pointer("pointerdown", 200, 400, 0);
  pointer("pointerdown", 700, 200, 10, 2); pointer("pointerup", 700, 200, 20, 2);
  expect(village.interactTarget).not.toHaveBeenCalled();
  pointer("pointerup", 205, 400, 100);
  expect(village.interactTarget).toHaveBeenCalledExactlyOnceWith("target");
});

it("clears joystick input on cancellation and viewport changes", () => {
  const { pointer, village, windowTarget } = setup();
  pointer("pointerdown", 200, 400, 0); pointer("pointermove", 240, 400, 20);
  pointer("pointercancel", 240, 400, 40);
  expect(village.setMoveInput).toHaveBeenLastCalledWith(0, 0);
  pointer("pointerdown", 200, 400, 50); pointer("pointermove", 240, 400, 60);
  windowTarget.dispatchEvent(new CustomEvent("abraxas:viewport", { detail: { portrait: false } }));
  pointer("pointerup", 240, 400, 70);
  expect(village.setMoveInput).toHaveBeenLastCalledWith(0, 0);
  expect(village.interactTarget).not.toHaveBeenCalled();
});

it("uses E to interact with the nearest target", () => {
  const { key, village } = setup();
  key("KeyE");
  expect(village.interactNearby).toHaveBeenCalledOnce();
});

it("clears held movement on rotation and waits for fresh input after returning", () => {
  const { key, village, windowTarget } = setup();
  key("KeyW"); expect(village.setMoveInput).toHaveBeenLastCalledWith(0, 1);
  windowTarget.dispatchEvent(new CustomEvent("abraxas:viewport", { detail: { portrait: true } }));
  key("KeyW"); expect(village.setMoveInput).toHaveBeenLastCalledWith(0, 0);
  windowTarget.dispatchEvent(new CustomEvent("abraxas:viewport", { detail: { portrait: false } }));
  expect(village.setMoveInput).toHaveBeenLastCalledWith(0, 0);
  key("KeyW"); expect(village.setMoveInput).toHaveBeenLastCalledWith(0, 1);
});
afterEach(() => vi.unstubAllGlobals());

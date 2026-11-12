import { expect, it } from "vitest";
import { enterFullscreenOnTouch } from "./fullscreen";

// A browser that only accepts a fullscreen request while `activated` is true, like user activation.
function browser() {
  const state = { activated: false, requests: 0 };
  const doc = Object.assign(new EventTarget(), {
    fullscreenEnabled: true,
    fullscreenElement: null as object | null,
    documentElement: {
      requestFullscreen: async () => {
        state.requests++;
        if (!state.activated) throw new TypeError("no user activation");
        doc.fullscreenElement = doc.documentElement; doc.dispatchEvent(new Event("fullscreenchange"));
      },
    },
    exitFullscreen: async () => { doc.fullscreenElement = null; doc.dispatchEvent(new Event("fullscreenchange")); },
  });
  const win = new EventTarget();
  const touch = (type: string, pointerType = "touch") => win.dispatchEvent(Object.assign(new Event(type), { pointerType }));
  const settle = () => new Promise(resolve => setTimeout(resolve));
  enterFullscreenOnTouch(win as unknown as Window, doc as unknown as Document);
  return { state, doc, touch, settle };
}

it("asks for fullscreen when a touch lifts, not when it lands, and retries after a refusal", async () => {
  const { state, doc, touch, settle } = browser();
  touch("pointerdown"); await settle();
  expect(state.requests).toBe(0);
  touch("pointerup", "mouse"); await settle();
  expect(state.requests).toBe(0);
  touch("pointerup"); await settle(); // refused: no activation yet
  expect(state.requests).toBe(1); expect(doc.fullscreenElement).toBeNull();
  state.activated = true;
  touch("click"); await settle(); // the click that follows the tap is accepted
  expect(state.requests).toBe(2); expect(doc.fullscreenElement).not.toBeNull();
});

it("stops asking once the player leaves fullscreen on purpose", async () => {
  const { state, doc, touch, settle } = browser();
  state.activated = true;
  touch("pointerup"); await settle();
  await doc.exitFullscreen();
  touch("pointerup"); await settle();
  expect(state.requests).toBe(1); expect(doc.fullscreenElement).toBeNull();
});

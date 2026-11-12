// Fullscreen for phone browsers. Where the Fullscreen API exists (Android Chrome and most in-app browsers) it hides the
// address bar; iPhone Safari has no element fullscreen, so `fullscreenSupported` is false there.

type LockableOrientation = { lock?: (orientation: "landscape") => Promise<void> };

export function fullscreenSupported(doc: Document = document): boolean {
  return Boolean(doc.fullscreenEnabled && doc.documentElement?.requestFullscreen);
}

export function isFullscreen(doc: Document = document): boolean {
  return Boolean(doc.fullscreenElement);
}

/** Resolves to whether the page is fullscreen afterwards. Never rejects: a refusal just leaves the page as it was. */
export async function setFullscreen(on: boolean, doc: Document = document): Promise<boolean> {
  try {
    if (on && !doc.fullscreenElement) {
      await doc.documentElement.requestFullscreen({ navigationUI: "hide" });
      // Only allowed while fullscreen. Keeps the game sideways even when the phone is held upright.
      const orientation = typeof screen === "undefined" ? undefined : screen.orientation as unknown as LockableOrientation | undefined;
      void orientation?.lock?.("landscape").catch(() => {});
    } else if (!on && doc.fullscreenElement) {
      await doc.exitFullscreen();
    }
  } catch { /* No user activation, or the browser refused. */ }
  return Boolean(doc.fullscreenElement);
}

/**
 * Goes fullscreen on the first touch the browser accepts. A touch grants user activation when the finger lifts
 * (pointerup), not when it lands, so asking on pointerdown is always refused. Some browsers only honour the click that
 * follows a tap, so that is tried too. Keeps asking until one request succeeds; once the player leaves fullscreen on
 * purpose it stops, and the settings menu can turn it back on.
 */
export function enterFullscreenOnTouch(win: Window = window, doc: Document = document): void {
  if (!fullscreenSupported(doc)) return;
  let entered = false, lastLift = -Infinity;
  const ask = () => { if (!doc.fullscreenElement) void setFullscreen(true, doc).then(active => { if (active) entered = true; }); };
  const onLift = (event: Event) => { if ((event as PointerEvent).pointerType === "touch") { lastLift = event.timeStamp; ask(); } };
  const onClick = (event: Event) => { if (event.timeStamp - lastLift < 1000) ask(); };
  win.addEventListener("pointerup", onLift, true); win.addEventListener("click", onClick, true);
  doc.addEventListener("fullscreenchange", () => {
    if (entered && !doc.fullscreenElement) { win.removeEventListener("pointerup", onLift, true); win.removeEventListener("click", onClick, true); }
  });
}

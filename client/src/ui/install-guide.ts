export type InstallGuide = "home-screen" | "open-browser";

export type DisplayEnv = {
  userAgent: string;
  fullscreenAvailable: boolean;
  coarsePointer: boolean;
  standalone: boolean;
};

const IN_APP_BROWSER = /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER\(inapp|; wv\)/i;

// iPhone browsers have no fullscreen API, so the home screen is the only way to lose the address bar.
export function installGuideFor(env: DisplayEnv): InstallGuide | null {
  if (env.standalone || env.fullscreenAvailable || !env.coarsePointer) return null;
  return IN_APP_BROWSER.test(env.userAgent) ? "open-browser" : "home-screen";
}

export function currentDisplayEnv(): DisplayEnv {
  const matches = (query: string) => window.matchMedia?.(query).matches ?? false;
  return {
    userAgent: navigator.userAgent,
    fullscreenAvailable: Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen),
    coarsePointer: matches("(pointer: coarse)"),
    standalone: matches("(display-mode: standalone)") || matches("(display-mode: fullscreen)") || Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
  };
}

export function openInstallGuide(parent: HTMLElement, copy: { title: string; steps: string[]; close: string }): void {
  const backdrop = document.createElement("div"), card = document.createElement("div");
  const heading = document.createElement("h2"), steps = document.createElement("ol"), close = document.createElement("button");
  backdrop.className = "hud-menu"; card.className = "hud-menu-card install-guide";
  card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "true"); card.setAttribute("aria-label", copy.title);
  heading.textContent = copy.title;
  for (const text of copy.steps) { const step = document.createElement("li"); step.textContent = text; steps.append(step); }
  close.type = "button"; close.textContent = copy.close; close.addEventListener("click", () => backdrop.remove());
  card.append(heading, steps, close); backdrop.append(card); parent.append(backdrop); close.focus();
}

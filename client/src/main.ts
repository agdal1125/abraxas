import { Village } from "./scenes/village";
import { Game } from "./ui/game";
import { configurePlayTransport } from "./net/plays";
import "./style.css";

const app = document.querySelector<HTMLElement>("#app")!;
const loading = document.createElement("div");
loading.className = "loading-screen"; loading.setAttribute("role", "status");
loading.textContent = "마을을 불러오는 중이에요"; app.append(loading);
const rotate = document.createElement("div");
rotate.className = "rotate-notice"; rotate.setAttribute("role", "status");
rotate.textContent = "기기를 가로로 돌려 주세요"; document.body.append(rotate);
const updateViewport = () => {
  const viewport = window.visualViewport;
  const width = viewport?.width ?? window.innerWidth, height = viewport?.height ?? window.innerHeight;
  Object.assign(app.style, { width: `${width}px`, height: `${height}px`, left: `${viewport?.offsetLeft ?? 0}px`, top: `${viewport?.offsetTop ?? 0}px` });
  const portrait = Math.min(width, height) < 600 && height > width;
  app.inert = portrait; rotate.hidden = !portrait;
  Object.assign(rotate.style, { width: `${width}px`, height: `${height}px`, left: `${viewport?.offsetLeft ?? 0}px`, top: `${viewport?.offsetTop ?? 0}px` });
  window.dispatchEvent(new CustomEvent("abraxas:viewport", { detail: { portrait, width, height } }));
};
let resizeFrame = 0;
const scheduleViewport = () => {
  if (!resizeFrame) resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; updateViewport(); });
};
window.addEventListener("resize", scheduleViewport);
window.addEventListener("orientationchange", scheduleViewport);
window.visualViewport?.addEventListener("resize", scheduleViewport);
window.visualViewport?.addEventListener("scroll", scheduleViewport);
document.addEventListener("fullscreenchange", scheduleViewport);
updateViewport();

if (document.fullscreenEnabled && document.documentElement.requestFullscreen) {
  const enterFullscreen = (event: PointerEvent) => {
    if (event.pointerType !== "touch") return;
    window.removeEventListener("pointerdown", enterFullscreen, true);
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen().catch(() => {});
  };
  window.addEventListener("pointerdown", enterFullscreen, true);
}

const village = new Village(app);
void ((village as { whenReady?: Promise<void> }).whenReady ?? Promise.resolve()).then(async () => {
  let source: Promise<Awaited<ReturnType<typeof import("./net/select-auth").createAuthSource>>> | undefined;
  configurePlayTransport({ auth: { getIdToken: async forceRefresh => {
    const config = await (source ??= import("./net/select-auth").then(({ createAuthSource }) => createAuthSource()).then(config => {
      configurePlayTransport(config);
      return config;
    }).catch(error => { source = undefined; throw error; }));
    return config.auth.getIdToken(forceRefresh);
  } } });
  const game = new Game(app, village);
  updateViewport();
  if (import.meta.env.DEV) Object.assign(window, { __abraxas: { village, game } });
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) loading.remove();
  else { loading.classList.add("is-ready"); window.setTimeout(() => loading.remove(), 180); }
}, () => { loading.remove(); });

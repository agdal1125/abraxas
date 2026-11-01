import { Village } from "./scenes/village";
import { Game } from "./ui/game";
import "./style.css";

const app = document.querySelector<HTMLElement>("#app")!;
const village = new Village(app);
const game = new Game(app, village);
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
window.addEventListener("resize", updateViewport);
window.addEventListener("orientationchange", updateViewport);
window.visualViewport?.addEventListener("resize", updateViewport);
window.visualViewport?.addEventListener("scroll", updateViewport);
updateViewport();
// Dev-only handle for automated playthrough checks (not included in production builds).
if (import.meta.env.DEV) Object.assign(window, { __abraxas: { village, game } });

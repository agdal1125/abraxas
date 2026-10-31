import { Village } from "./scenes/village";
import { Game } from "./ui/game";
import "./style.css";

const app = document.querySelector<HTMLElement>("#app")!;
const village = new Village(app);
const game = new Game(app, village);
// Dev-only handle for automated playthrough checks (not included in production builds).
if (import.meta.env.DEV) Object.assign(window, { __abraxas: { village, game } });

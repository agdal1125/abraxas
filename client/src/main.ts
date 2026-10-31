import Phaser from "phaser";
import { BootScene } from "./scenes/boot-scene";
import { PreloadScene } from "./scenes/preload-scene";
import { VillageScene } from "./scenes/village-scene";

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "app",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#FFF6E9",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, PreloadScene, VillageScene],
};

export const game = new Phaser.Game(config);

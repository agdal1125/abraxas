import Phaser from "phaser";

const BAR_WIDTH = 440;
const BAR_HEIGHT = 24;

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: "PreloadScene" });
  }

  preload(): void {
    for (const name of ["village", "festival", "gate"]) this.load.svg(`bg_${name}`, `assets/bg/${name}.svg`, { width: 720, height: 1280 });
    for (const name of ["lumi", "moka", "echo", "or"]) this.load.svg(`char_${name}`, `assets/char/${name}.svg`, { width: 400, height: 400 });
    this.cameras.main.setBackgroundColor("#FFF6E9");

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const barX = centerX - BAR_WIDTH / 2;
    const barY = centerY - BAR_HEIGHT / 2;

    const track = this.add.graphics();
    track.fillStyle(0xe8c49a, 0.45);
    track.fillRoundedRect(barX, barY, BAR_WIDTH, BAR_HEIGHT, 12);

    const fill = this.add.graphics();
    const drawProgress = (value: number): void => {
      fill.clear();
      fill.fillStyle(0xa8d5a2, 1);
      const width = Math.max(24, BAR_WIDTH * Math.min(Math.max(value, 0), 1));
      fill.fillRoundedRect(barX, barY, width, BAR_HEIGHT, 12);
    };

    drawProgress(0.1);

    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => {
      drawProgress(value);
    });

    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      drawProgress(1);
    });
  }

  create(): void {
    this.scene.start("VillageScene");
  }
}

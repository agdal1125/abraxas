import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#FFF6E9");
    this.scene.start("PreloadScene");
  }
}

import Phaser from "phaser";

export class VillageScene extends Phaser.Scene {
  constructor() {
    super({ key: "VillageScene" });
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#FFF6E9");

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    const backdropCircle = this.add.circle(centerX, centerY - 20, 160, 0xa8d5a2, 0.35);

    const titleText = this.add
      .text(centerX, centerY - 32, "Abraxas", {
        fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: "64px",
        fontStyle: "bold",
        color: "#4A3B32",
      })
      .setOrigin(0.5);

    const subtitleText = this.add
      .text(centerX, centerY + 48, "화면을 탭해 보세요", {
        fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: "28px",
        color: "#4A3B32",
      })
      .setOrigin(0.5);

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      const ripple = this.add.circle(pointer.x, pointer.y, 18, 0xf4a7b9, 0.65);

      this.tweens.add({
        targets: ripple,
        scale: 3.2,
        alpha: 0,
        duration: 420,
        ease: "Cubic.easeOut",
        onComplete: () => {
          ripple.destroy();
        },
      });

      this.tweens.add({
        targets: [titleText, backdropCircle],
        scale: 1.06,
        duration: 130,
        yoyo: true,
        ease: "Sine.easeInOut",
      });

      subtitleText.setText("조용한 마을에 바람이 스칩니다");
    });
  }
}

import Phaser from "phaser";
import { readLeaderboard } from "../game/leaderboard";
import { RETRO_FONT } from "../game/constants";
import { createRetroBackground, createRetroButton } from "../game/ui";

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenuScene");
  }

  preload(): void {
    this.load.image("duck", "/assets/duck.png");
    this.load.image("jam", "/assets/jam.webp");
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    createRetroBackground(this, width, height);

    const title = this.add.text(width * 0.5, height * 0.22, "DUCK SCALE", {
      fontFamily: RETRO_FONT,
      fontSize: "54px",
      color: "#fff3ce",
      stroke: "#2e1b19",
      strokeThickness: 8,
    });
    title.setOrigin(0.5);

    const subtitle = this.add.text(
      width * 0.5,
      height * 0.3,
      "KEEP THE SCALES BALANCED",
      {
        fontFamily: RETRO_FONT,
        fontSize: "24px",
        color: "#ffd189",
        stroke: "#341f1b",
        strokeThickness: 4,
      },
    );
    subtitle.setOrigin(0.5);

    const duck = this.add.image(width * 0.32, height * 0.42, "duck");
    duck.setScale(0.23);
    duck.setAngle(-12);

    const jam = this.add.image(width * 0.68, height * 0.42, "jam");
    jam.setScale(0.2);
    jam.setAngle(10);

    createRetroButton(this, width * 0.5, height * 0.54, "START GAME", () => {
      this.scene.start("GameScene");
    });

    createRetroButton(this, width * 0.5, height * 0.66, "LEADERBOARD", () => {
      this.scene.start("LeaderboardScene");
    });

    const entries = readLeaderboard();
    const highScore = entries[0]?.score ?? 0;

    const highScoreText = this.add.text(
      width * 0.5,
      height * 0.78,
      `HIGH SCORE: ${highScore}`,
      {
        fontFamily: RETRO_FONT,
        fontSize: "26px",
        color: "#fff4e2",
        stroke: "#2a1919",
        strokeThickness: 4,
      },
    );
    highScoreText.setOrigin(0.5);

    const instructions = this.add.text(
      width * 0.5,
      height * 0.88,
      "A/D or ARROWS to move | Catch ducks left and jam right",
      {
        fontFamily: RETRO_FONT,
        fontSize: "18px",
        color: "#ffeec9",
        stroke: "#28161f",
        strokeThickness: 3,
        align: "center",
      },
    );
    instructions.setOrigin(0.5);

    this.tweens.add({
      targets: title,
      y: title.y - 9,
      duration: 1200,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });

    this.tweens.add({
      targets: [duck, jam],
      angle: { from: -8, to: 8 },
      duration: 900,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
      stagger: 180,
    });
  }
}

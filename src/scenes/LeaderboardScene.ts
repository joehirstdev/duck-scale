import Phaser from "phaser";
import { RETRO_FONT } from "../game/constants";
import { createRetroBackground, createRetroButton } from "../game/ui";
import { readLeaderboard } from "../game/leaderboard";

export class LeaderboardScene extends Phaser.Scene {
  constructor() {
    super("LeaderboardScene");
  }

  preload(): void {
    this.load.image("duck", "/assets/duck.png");
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    createRetroBackground(this, width, height);

    const title = this.add.text(width * 0.5, 80, "LEADERBOARD", {
      fontFamily: RETRO_FONT,
      fontSize: "52px",
      color: "#ffe1a1",
      stroke: "#2d191b",
      strokeThickness: 7,
    });
    title.setOrigin(0.5);

    const entries = readLeaderboard();
    if (entries.length === 0) {
      const empty = this.add.text(
        width * 0.5,
        height * 0.45,
        "No scores yet!\nPlay a game to set a score.",
        {
          fontFamily: RETRO_FONT,
          fontSize: "32px",
          color: "#fff2d8",
          stroke: "#2b1a1c",
          strokeThickness: 4,
          align: "center",
        },
      );
      empty.setOrigin(0.5);
    } else {
      entries.forEach((entry, index) => {
        const yPos = 170 + index * 74;
        const color = index === 0 ? "#ffd700" : "#ffffff";

        const rank = this.add.text(width * 0.28, yPos, `#${index + 1}`, {
          fontFamily: RETRO_FONT,
          fontSize: "40px",
          color,
          stroke: "#000000",
          strokeThickness: 5,
        });
        rank.setOrigin(0.5);

        const score = this.add.text(width * 0.52, yPos, `${entry.score}`, {
          fontFamily: RETRO_FONT,
          fontSize: "40px",
          color,
          stroke: "#000000",
          strokeThickness: 5,
        });
        score.setOrigin(0.5);

        const date = this.add.text(width * 0.78, yPos, entry.date, {
          fontFamily: RETRO_FONT,
          fontSize: "24px",
          color,
          stroke: "#000000",
          strokeThickness: 4,
        });
        date.setOrigin(0.5);
      });
    }

    const mascot = this.add.image(width * 0.11, height * 0.88, "duck");
    mascot.setScale(0.28);
    mascot.setAngle(-14);

    createRetroButton(this, width * 0.5, height - 70, "BACK TO MENU", () => {
      this.scene.start("MainMenuScene");
    });

    this.input.keyboard?.on("keydown-ESC", () => {
      this.scene.start("MainMenuScene");
    });

    this.input.keyboard?.on("keydown-M", () => {
      this.scene.start("MainMenuScene");
    });
  }
}

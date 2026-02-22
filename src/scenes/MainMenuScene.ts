import Phaser from "phaser";
import { readLeaderboard } from "../game/leaderboard";
import { RETRO_FONT } from "../game/constants";
import { createRetroBackground, createRetroButton } from "../game/ui";

const SOUNDTRACK_KEY = "soundtrack";

export class MainMenuScene extends Phaser.Scene {
  private keySpace?: Phaser.Input.Keyboard.Key;
  private keyEnter?: Phaser.Input.Keyboard.Key;
  private keyL?: Phaser.Input.Keyboard.Key;

  constructor() {
    super("MainMenuScene");
  }

  private readonly startGame = (): void => {
    this.scene.stop("GameScene");
    this.scene.start("GameScene");
  };

  private readonly openLeaderboard = (): void => {
    this.scene.start("LeaderboardScene");
  };

  preload(): void {
    this.load.image("duck", "/assets/duck.webp");
    this.load.image("jam", "/assets/jam.webp");
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    this.sound.stopByKey(SOUNDTRACK_KEY);

    createRetroBackground(this);

    const title = this.add.text(width * 0.5, height * 0.2, "DUCK SCALE", {
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

    createRetroButton(
      this,
      width * 0.5,
      height * 0.54,
      "START GAME",
      this.startGame,
    );

    createRetroButton(
      this,
      width * 0.5,
      height * 0.66,
      "LEADERBOARD",
      this.openLeaderboard,
    );

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
      "A/D or ARROWS to move | Catch Ducks and Jam without Tipping the Scales",
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

    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.keySpace = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.keyEnter = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
      this.keyL = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L);
    }
  }

  update(): void {
    if (
      (this.keySpace && Phaser.Input.Keyboard.JustDown(this.keySpace)) ||
      (this.keyEnter && Phaser.Input.Keyboard.JustDown(this.keyEnter))
    ) {
      this.startGame();
      return;
    }

    if (this.keyL && Phaser.Input.Keyboard.JustDown(this.keyL)) {
      this.openLeaderboard();
    }
  }
}

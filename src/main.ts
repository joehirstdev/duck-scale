import Phaser from "phaser";
import { addLeaderboardScore, readLeaderboard } from "./leaderboard";

type Side = "left" | "right";
type ShapeKind = "duck" | "jam";

interface FallingItem {
  sprite: Phaser.GameObjects.Image;
  kind: ShapeKind;
  size: number;
  speed: number;
}

interface StackedItem {
  sprite: Phaser.GameObjects.Image;
  size: number;
}

interface LooseBlock {
  sprite: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  spin: number;
}

const GAME_WIDTH = 960;
const GAME_HEIGHT = 640;

const PLAYER_SPEED = 11;
const PLAYER_MARGIN = 20;
const PAN_OFFSET = 92;
const PAN_RADIUS = 38;
const FALLING_ITEM_MIN_SIZE = 28;
const FALLING_ITEM_MAX_SIZE = 56;
const BASE_SPAWN_INTERVAL_MS = 500;
const MIN_SPAWN_INTERVAL_MS = 170;
const SPAWN_RAMP_PER_SCORE_MS = 10;
const BURST_SPAWN_BASE_CHANCE = 0.12;
const BURST_SPAWN_SCORE_FACTOR = 0.005;
const BURST_SPAWN_MAX_CHANCE = 0.42;
const FEEDBACK_DURATION_MS = 760;
const STACK_COMPRESSION = 0.56;
const MAX_WEIGHT_IMBALANCE = 100;
const DEATH_SPIN_TOTAL = Math.PI * 6;
const DEATH_SPIN_SPEED = 0.4;
const DEATH_FLIGHT_GRAVITY = 0.72;
const DEBRIS_GRAVITY = 0.42;
const DUCK_SIDE: Side = "left";
const JAM_SIDE: Side = "right";

const RETRO_FONT = '"Courier New", monospace';

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const randomBetween = (min: number, max: number): number =>
  min + Math.random() * (max - min);

const expectedSideForShape = (kind: ShapeKind): Side =>
  kind === "duck" ? DUCK_SIDE : JAM_SIDE;

const createRetroBackground = (
  scene: Phaser.Scene,
  width: number,
  height: number,
): void => {
  const bg = scene.add.graphics();
  bg.fillGradientStyle(0x5fbedf, 0x5fbedf, 0x4488cc, 0x4488cc, 1);
  bg.fillRect(0, 0, width, height);

  bg.fillStyle(0x2d618f, 0.22);
  for (let y = 0; y < height; y += 6) {
    bg.fillRect(0, y, width, 2);
  }

  bg.setDepth(-1);
};

const createRetroButton = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
): Phaser.GameObjects.Text => {
  const button = scene.add.text(x, y, label, {
    fontFamily: RETRO_FONT,
    fontSize: "32px",
    color: "#ffffff",
    stroke: "#000000",
    strokeThickness: 4,
    backgroundColor: "#4488aa",
    padding: {
      left: 20,
      right: 20,
      top: 10,
      bottom: 10,
    },
  });

  button.setOrigin(0.5);
  button.setInteractive({ useHandCursor: true });

  button.on("pointerover", () => {
    button.setBackgroundColor("#66aacc");
  });

  button.on("pointerout", () => {
    button.setBackgroundColor("#4488aa");
  });

  button.on("pointerdown", () => {
    button.setBackgroundColor("#336688");
  });

  button.on("pointerup", () => {
    button.setBackgroundColor("#66aacc");
    onClick();
  });

  return button;
};

class MainMenuScene extends Phaser.Scene {
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

    const title = this.add.text(
      width * 0.5,
      height * 0.22,
      "DUCK & JAM BALANCE",
      {
        fontFamily: RETRO_FONT,
        fontSize: "54px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 8,
      },
    );
    title.setOrigin(0.5);

    const subtitle = this.add.text(
      width * 0.5,
      height * 0.3,
      "KEEP THE SCALE BALANCED",
      {
        fontFamily: RETRO_FONT,
        fontSize: "24px",
        color: "#ffe37a",
        stroke: "#000000",
        strokeThickness: 4,
      },
    );
    subtitle.setOrigin(0.5);

    const duck = this.add.image(width * 0.34, height * 0.42, "duck");
    duck.setScale(0.45);
    duck.setAngle(-12);

    const jam = this.add.image(width * 0.66, height * 0.42, "jam");
    jam.setScale(0.5);
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
        color: "#ffffff",
        stroke: "#000000",
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
        color: "#ffffff",
        stroke: "#000000",
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

class LeaderboardScene extends Phaser.Scene {
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
      color: "#ffd700",
      stroke: "#000000",
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
          color: "#ffffff",
          stroke: "#000000",
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

    const mascot = this.add.image(width * 0.11, height * 0.86, "duck");
    mascot.setScale(0.28);
    mascot.setAngle(-14);

    createRetroButton(this, width * 0.5, height - 80, "BACK TO MENU", () => {
      this.scene.start("MainMenuScene");
    });

    this.input.keyboard?.on("keydown-ESC", () => {
      this.scene.start("MainMenuScene");
    });
  }
}

class GameScene extends Phaser.Scene {
  private background!: Phaser.GameObjects.Graphics;
  private lanes!: Phaser.GameObjects.Graphics;
  private itemLayer!: Phaser.GameObjects.Container;
  private balanceScale!: Phaser.GameObjects.Container;
  private stackLayer!: Phaser.GameObjects.Container;
  private debrisLayer!: Phaser.GameObjects.Container;

  private scoreText!: Phaser.GameObjects.Text;
  private ruleText!: Phaser.GameObjects.Text;
  private feedbackText!: Phaser.GameObjects.Text;
  private gameOverText!: Phaser.GameObjects.Text;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyR!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyM!: Phaser.Input.Keyboard.Key;
  private keyL!: Phaser.Input.Keyboard.Key;

  private fallingItems: FallingItem[] = [];
  private leftStack: StackedItem[] = [];
  private rightStack: StackedItem[] = [];
  private looseBlocks: LooseBlock[] = [];

  private lastWidth = 0;
  private lastHeight = 0;
  private score = 0;
  private spawnTimerMs = 0;
  private feedbackTimerMs = 0;
  private isGameOver = false;
  private hasWon = false;
  private deathSequenceActive = false;
  private deathTipDirection = 1;
  private deathSpinRemaining = 0;
  private deathFlightActive = false;
  private deathFlightVx = 0;
  private deathFlightVy = 0;

  constructor() {
    super("GameScene");
  }

  preload(): void {
    this.load.image("duck", "/assets/duck.png");
    this.load.image("jam", "/assets/jam.webp");
  }

  create(): void {
    this.background = this.add.graphics();
    this.lanes = this.add.graphics();
    this.itemLayer = this.add.container();
    this.balanceScale = this.createScale();

    this.stackLayer = this.add.container();
    this.balanceScale.add(this.stackLayer);

    this.debrisLayer = this.add.container();

    const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: RETRO_FONT,
      fontSize: "20px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 4,
      fontStyle: "bold",
    };

    const leftLabel = this.add.text(-PAN_OFFSET, -46, "DUCKS", labelStyle);
    leftLabel.setOrigin(0.5);
    this.balanceScale.add(leftLabel);

    const rightLabel = this.add.text(PAN_OFFSET, -46, "JAM", labelStyle);
    rightLabel.setOrigin(0.5);
    this.balanceScale.add(rightLabel);

    this.scoreText = this.add.text(0, 20, `0`, {
      fontFamily: RETRO_FONT,
      fontSize: "28px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 5,
      fontStyle: "bold",
    });
    this.scoreText.setOrigin(0.5, 0);

    this.ruleText = this.add.text(
      0,
      58,
      `Catch ducks on the left and jam on the right. If one side gets too heavy, it tips instantly.`,
      {
        fontFamily: RETRO_FONT,
        fontSize: "17px",
        color: "#e0ebff",
        stroke: "#000000",
        strokeThickness: 3,
        align: "center",
      },
    );
    this.ruleText.setOrigin(0.5, 0);

    this.feedbackText = this.add.text(0, 0, "", {
      fontFamily: RETRO_FONT,
      fontSize: "30px",
      color: "#f2fff2",
      stroke: "#000000",
      strokeThickness: 5,
      fontStyle: "bold",
    });
    this.feedbackText.setOrigin(0.5);
    this.feedbackText.setAlpha(0);

    this.gameOverText = this.add.text(
      0,
      0,
      "GAME OVER\nR/SPACE restart\nM menu  L leaderboard",
      {
        fontFamily: RETRO_FONT,
        fontSize: "44px",
        color: "#ffdfdf",
        align: "center",
        stroke: "#2d0000",
        strokeThickness: 7,
        fontStyle: "bold",
      },
    );
    this.gameOverText.setOrigin(0.5);
    this.gameOverText.setVisible(false);

    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error("Keyboard input is unavailable.");
    }

    this.cursors = keyboard.createCursorKeys();
    this.keyA = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyR = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.keySpace = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyM = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    this.keyL = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L);

    this.balanceScale.x = this.scaleXMid();
    this.layout(true);
  }

  update(_time: number, deltaMs: number): void {
    const deltaTime = deltaMs / 16.6666667;

    this.layout(false);

    if (this.isGameOver) {
      if (
        Phaser.Input.Keyboard.JustDown(this.keyR) ||
        Phaser.Input.Keyboard.JustDown(this.keySpace)
      ) {
        this.resetRun();
      }

      if (Phaser.Input.Keyboard.JustDown(this.keyM)) {
        this.scene.start("MainMenuScene");
        return;
      }

      if (Phaser.Input.Keyboard.JustDown(this.keyL)) {
        this.scene.start("LeaderboardScene");
        return;
      }
    }

    if (!this.isGameOver) {
      const moveLeft = this.cursors.left.isDown || this.keyA.isDown;
      const moveRight = this.cursors.right.isDown || this.keyD.isDown;
      const inputDirection = Number(moveRight) - Number(moveLeft);

      this.balanceScale.x += inputDirection * PLAYER_SPEED * deltaTime;
      this.balanceScale.x = clamp(
        this.balanceScale.x,
        this.minScaleX(),
        this.maxScaleX(),
      );

      this.spawnTimerMs += deltaMs;
      const spawnInterval = this.spawnIntervalForScore(this.score);
      while (this.spawnTimerMs >= spawnInterval) {
        this.spawnTimerMs -= spawnInterval;
        this.spawnItem();
        if (Math.random() < this.burstChanceForScore(this.score)) {
          this.spawnItem();
        }
      }

      for (let index = this.fallingItems.length - 1; index >= 0; index -= 1) {
        const item = this.fallingItems[index];
        item.sprite.y += item.speed * deltaTime;

        const caughtSide = this.tryCatchItem(item, deltaTime);
        if (caughtSide) {
          const expectedSide = expectedSideForShape(item.kind);
          if (caughtSide === expectedSide) {
            this.addItemToStack(caughtSide, item);
          } else {
            const knocked = this.knockTopItemFromStack(caughtSide);
            if (knocked) {
              this.showFeedback("Wrong side!", "#ff9e80");
            }
          }

          this.removeFallingItemAt(index);

          if (this.isGameOver) {
            break;
          }

          continue;
        }

        if (item.sprite.y - item.size > this.scale.height) {
          this.removeFallingItemAt(index);
        }
      }

      const leftWeight = this.getStackWeight(this.leftStack);
      const rightWeight = this.getStackWeight(this.rightStack);
      const weightImbalance = Math.abs(leftWeight - rightWeight);
      if (weightImbalance > MAX_WEIGHT_IMBALANCE) {
        this.triggerDeath();
      }
    } else if (!this.hasWon) {
      this.gameOverText.setScale(1 + Math.sin(this.time.now / 250) * 0.02);
    } else {
      this.gameOverText.setScale(1 + Math.sin(this.time.now / 350) * 0.015);
    }

    if (this.deathSequenceActive) {
      if (this.deathSpinRemaining > 0) {
        const spinStep = Math.min(
          this.deathSpinRemaining,
          DEATH_SPIN_SPEED * deltaTime,
        );
        this.balanceScale.rotation += spinStep * this.deathTipDirection;
        this.deathSpinRemaining -= spinStep;
      } else {
        if (!this.deathFlightActive) {
          this.deathFlightActive = true;
          this.deathFlightVx = this.deathTipDirection * randomBetween(14, 20);
          this.deathFlightVy = randomBetween(-16, -11);
        }

        this.balanceScale.x += this.deathFlightVx * deltaTime;
        this.balanceScale.y += this.deathFlightVy * deltaTime;
        this.deathFlightVy += DEATH_FLIGHT_GRAVITY * deltaTime;
        this.balanceScale.rotation += this.deathTipDirection * 0.32 * deltaTime;
      }
    } else {
      const leftWeight = this.getStackWeight(this.leftStack);
      const rightWeight = this.getStackWeight(this.rightStack);
      const targetRotation = clamp(
        (rightWeight - leftWeight) / 240,
        -0.36,
        0.36,
      );
      const rotationLerp = Math.min(1, 0.14 * deltaTime);
      this.balanceScale.rotation +=
        (targetRotation - this.balanceScale.rotation) * rotationLerp;
    }

    for (let index = this.looseBlocks.length - 1; index >= 0; index -= 1) {
      const block = this.looseBlocks[index];
      block.vy += DEBRIS_GRAVITY * deltaTime;
      block.sprite.x += block.vx * deltaTime;
      block.sprite.y += block.vy * deltaTime;
      block.sprite.rotation += block.spin * deltaTime;
      block.vx *= 0.992;

      if (block.sprite.y - 120 > this.scale.height) {
        block.sprite.destroy();
        this.looseBlocks.splice(index, 1);
      }
    }

    if (this.feedbackTimerMs > 0) {
      this.feedbackTimerMs -= deltaMs;
      this.feedbackText.setAlpha(
        clamp(this.feedbackTimerMs / FEEDBACK_DURATION_MS, 0, 1),
      );
    }

    this.drawWorld();
  }

  private createScale(): Phaser.GameObjects.Container {
    const scale = this.add.container(0, 0);

    const beam = this.add.graphics();
    beam.fillStyle(0xe7ddbe).fillRoundedRect(-128, -20, 256, 10, 6);
    beam.lineStyle(2, 0x8c7e57).strokeRoundedRect(-128, -20, 256, 10, 6);
    scale.add(beam);

    const support = this.add.graphics();
    support.fillStyle(0xc6b78a).fillRoundedRect(-14, -20, 28, 66, 8);
    support.fillStyle(0xc6b78a).fillRect(-4, -50, 8, 30);
    support.fillStyle(0x786647).fillRoundedRect(-56, 42, 112, 18, 8);
    support.lineStyle(2, 0x4e402b).strokeRoundedRect(-56, 42, 112, 18, 8);
    scale.add(support);

    const leftArm = this.add.graphics();
    leftArm.fillStyle(0x6d92c2).fillRect(-PAN_OFFSET, -15, 3, 26);
    scale.add(leftArm);

    const rightArm = this.add.graphics();
    rightArm.fillStyle(0x6d92c2).fillRect(PAN_OFFSET - 3, -15, 3, 26);
    scale.add(rightArm);

    scale.add(this.createPan(-PAN_OFFSET, 0x69b6ff));
    scale.add(this.createPan(PAN_OFFSET, 0xffbb66));

    return scale;
  }

  private createPan(x: number, color: number): Phaser.GameObjects.Graphics {
    const pan = this.add.graphics();
    const trayWidth = PAN_RADIUS * 2.05;
    const trayHeight = Math.max(16, PAN_RADIUS * 0.52);

    pan
      .fillStyle(0xe8f7ff, 0.97)
      .fillRoundedRect(
        x - trayWidth * 0.5,
        10 - trayHeight * 0.5,
        trayWidth,
        trayHeight,
        8,
      )
      .lineStyle(4, color)
      .strokeRoundedRect(
        x - trayWidth * 0.5,
        10 - trayHeight * 0.5,
        trayWidth,
        trayHeight,
        8,
      );

    pan.fillStyle(0xb9dcf0, 0.8);
    pan.fillRect(x - trayWidth * 0.34, 7.5, trayWidth * 0.68, 5);

    return pan;
  }

  private minScaleX(): number {
    return PAN_OFFSET + PLAYER_MARGIN;
  }

  private maxScaleX(): number {
    return this.scale.width - PAN_OFFSET - PLAYER_MARGIN;
  }

  private scaleXMid(): number {
    return this.scale.width * 0.5;
  }

  private stackForSide(side: Side): StackedItem[] {
    return side === "left" ? this.leftStack : this.rightStack;
  }

  private panXForSide(side: Side): number {
    return side === "left" ? -PAN_OFFSET : PAN_OFFSET;
  }

  private pushForSide(side: Side): number {
    return side === "left" ? -1 : 1;
  }

  private spawnIntervalForScore(value: number): number {
    return Math.max(
      MIN_SPAWN_INTERVAL_MS,
      BASE_SPAWN_INTERVAL_MS - value * SPAWN_RAMP_PER_SCORE_MS,
    );
  }

  private burstChanceForScore(value: number): number {
    return Math.min(
      BURST_SPAWN_MAX_CHANCE,
      BURST_SPAWN_BASE_CHANCE + value * BURST_SPAWN_SCORE_FACTOR,
    );
  }

  private layout(force: boolean): void {
    const width = this.scale.width;
    const height = this.scale.height;

    if (!force && this.lastWidth === width && this.lastHeight === height) {
      return;
    }

    this.lastWidth = width;
    this.lastHeight = height;

    this.balanceScale.y = height - 106;
    this.balanceScale.x = clamp(
      this.balanceScale.x || width * 0.5,
      this.minScaleX(),
      this.maxScaleX(),
    );

    this.scoreText.setPosition(width * 0.5, 20);
    this.ruleText.setPosition(width * 0.5, 60);
    this.ruleText.setWordWrapWidth(Math.max(320, width - 80));
    this.feedbackText.setPosition(width * 0.5, height * 0.22);
    this.gameOverText.setPosition(width * 0.5, height * 0.46);

    this.drawWorld();
  }

  private drawWorld(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    this.background.clear();
    this.background.fillStyle(0x5fbecf).fillRect(0, 0, width, height);
    this.background
      .fillStyle(0x4ca0bf)
      .fillRect(0, height * 0.65, width, height * 0.35);
    this.background.fillStyle(0x2f6c8a).fillRect(0, height - 120, width, 120);

    this.lanes.clear();
    const leftPan = this.getPanWorldPosition("left");
    const rightPan = this.getPanWorldPosition("right");

    this.lanes
      .fillStyle(0xffdd66, 0.12)
      .fillRect(leftPan.x - PAN_RADIUS, 0, PAN_RADIUS * 2, height);
    this.lanes
      .fillStyle(0xd86a5f, 0.12)
      .fillRect(rightPan.x - PAN_RADIUS, 0, PAN_RADIUS * 2, height);
  }

  private showFeedback(message: string, colorHex: string): void {
    this.feedbackText.setText(message);
    this.feedbackText.setColor(colorHex);
    this.feedbackText.setAlpha(1);
    this.feedbackTimerMs = FEEDBACK_DURATION_MS;
  }

  private localToWorld(
    localX: number,
    localY: number,
  ): { x: number; y: number } {
    const cos = Math.cos(this.balanceScale.rotation);
    const sin = Math.sin(this.balanceScale.rotation);

    return {
      x: this.balanceScale.x + localX * cos - localY * sin,
      y: this.balanceScale.y + localX * sin + localY * cos,
    };
  }

  private getPanWorldPosition(side: Side): { x: number; y: number } {
    return this.localToWorld(this.panXForSide(side), 10);
  }

  private removeFallingItemAt(index: number): void {
    const item = this.fallingItems[index];
    item.sprite.destroy();
    this.fallingItems.splice(index, 1);
  }

  private clearFallingItems(): void {
    for (let index = this.fallingItems.length - 1; index >= 0; index -= 1) {
      this.removeFallingItemAt(index);
    }
  }

  private clearStack(stack: StackedItem[]): void {
    for (let index = stack.length - 1; index >= 0; index -= 1) {
      stack[index].sprite.destroy();
    }
    stack.length = 0;
  }

  private clearStacks(): void {
    this.clearStack(this.leftStack);
    this.clearStack(this.rightStack);
  }

  private clearLooseBlocks(): void {
    for (let index = this.looseBlocks.length - 1; index >= 0; index -= 1) {
      this.looseBlocks[index].sprite.destroy();
      this.looseBlocks.splice(index, 1);
    }
  }

  private getStackHeight(stack: StackedItem[]): number {
    return stack.reduce(
      (height, stacked) => height + stacked.size * STACK_COMPRESSION + 2,
      0,
    );
  }

  private getStackWeight(stack: StackedItem[]): number {
    return stack.reduce((weight, stacked) => weight + stacked.size, 0);
  }

  private getLandingWorldPosition(
    side: Side,
    incomingSize: number,
  ): { x: number; y: number } {
    const stack = this.stackForSide(side);
    const localPanX = this.panXForSide(side);
    const stackHeight = this.getStackHeight(stack);
    const landingLocalY = 10 - PAN_RADIUS - incomingSize * 0.5 - stackHeight;
    return this.localToWorld(localPanX, landingLocalY);
  }

  private createShapeSprite(
    kind: ShapeKind,
    size: number,
  ): Phaser.GameObjects.Image {
    const sprite = this.add.image(0, 0, kind);
    sprite.setOrigin(0.5);

    const longestSide = Math.max(sprite.width || 1, sprite.height || 1);
    sprite.setScale(size / longestSide);

    return sprite;
  }

  private createFallingItem(): FallingItem {
    const size = randomBetween(FALLING_ITEM_MIN_SIZE, FALLING_ITEM_MAX_SIZE);
    const kind: ShapeKind = Math.random() < 0.5 ? "duck" : "jam";
    const speedBoost = Math.min(this.score * 0.02, 3.4);
    const speed = randomBetween(4.6, 7.8) + speedBoost;

    const sprite = this.createShapeSprite(kind, size);
    sprite.x = randomBetween(
      size * 0.5 + 10,
      this.scale.width - size * 0.5 - 10,
    );
    sprite.y = -size;

    this.itemLayer.add(sprite);

    return {
      sprite,
      kind,
      size,
      speed,
    };
  }

  private spawnItem(): void {
    const item = this.createFallingItem();
    this.fallingItems.push(item);
  }

  private spillStacksOnDeath(): void {
    const spillSide = (side: Side): void => {
      const stack = this.stackForSide(side);
      const sidePush = this.pushForSide(side);

      while (stack.length > 0) {
        const item = stack.pop();
        if (!item) {
          break;
        }

        const world = this.localToWorld(item.sprite.x, item.sprite.y);
        const worldRotation = this.balanceScale.rotation + item.sprite.rotation;

        this.stackLayer.remove(item.sprite);
        item.sprite.x = world.x;
        item.sprite.y = world.y;
        item.sprite.rotation = worldRotation;
        this.debrisLayer.add(item.sprite);

        this.looseBlocks.push({
          sprite: item.sprite,
          vx:
            this.deathTipDirection * randomBetween(3.4, 6.6) +
            sidePush * randomBetween(0.6, 1.8),
          vy: randomBetween(-5.8, -2.4),
          spin:
            this.deathTipDirection * randomBetween(0.03, 0.1) +
            randomBetween(-0.05, 0.05),
        });
      }
    };

    spillSide("left");
    spillSide("right");
  }

  private triggerDeath(): void {
    if (this.isGameOver) {
      return;
    }

    addLeaderboardScore(this.score);

    this.showFeedback("Too imbalanced!", "#ff8080");
    this.isGameOver = true;
    this.hasWon = false;
    this.deathSequenceActive = true;
    const leftWeight = this.getStackWeight(this.leftStack);
    const rightWeight = this.getStackWeight(this.rightStack);
    this.deathTipDirection =
      leftWeight > rightWeight
        ? -1
        : rightWeight > leftWeight
          ? 1
          : Math.random() < 0.5
            ? -1
            : 1;

    this.deathSpinRemaining = DEATH_SPIN_TOTAL;
    this.deathFlightActive = false;
    this.deathFlightVx = 0;
    this.deathFlightVy = 0;

    this.clearFallingItems();
    this.spillStacksOnDeath();

    this.gameOverText.setText(
      "GAME OVER\nR/SPACE restart\nM menu  L leaderboard",
    );
    this.gameOverText.setColor("#ffffff");
    this.gameOverText.setVisible(true);
  }

  private addItemToStack(side: Side, item: FallingItem): void {
    const stack = this.stackForSide(side);
    const localPanX = this.panXForSide(side);
    const stackHeight = this.getStackHeight(stack);

    const sprite = this.createShapeSprite(item.kind, item.size);
    sprite.setPosition(
      localPanX + randomBetween(-PAN_RADIUS * 0.35, PAN_RADIUS * 0.35),
      10 - PAN_RADIUS - item.size * 0.5 - stackHeight,
    );
    sprite.rotation = randomBetween(-0.18, 0.18);

    this.stackLayer.add(sprite);

    const stackedItem: StackedItem = {
      sprite,
      size: item.size,
    };

    stack.push(stackedItem);

    this.score += 1;
    this.showFeedback("+1 caught", "#b3ffb3");
  }

  private knockTopItemFromStack(side: Side): boolean {
    const stack = this.stackForSide(side);
    const removed = stack.pop();
    if (!removed) {
      return false;
    }

    const world = this.localToWorld(removed.sprite.x, removed.sprite.y);
    const worldRotation = this.balanceScale.rotation + removed.sprite.rotation;

    this.stackLayer.remove(removed.sprite);
    removed.sprite.x = world.x;
    removed.sprite.y = world.y;
    removed.sprite.rotation = worldRotation;
    this.debrisLayer.add(removed.sprite);

    const sidePush = this.pushForSide(side);
    this.looseBlocks.push({
      sprite: removed.sprite,
      vx: sidePush * randomBetween(3.6, 6.8),
      vy: randomBetween(-6.4, -3.2),
      spin: randomBetween(-0.18, 0.18),
    });
    this.score = Math.max(0, this.score - 1);

    return true;
  }

  private tryCatchItem(item: FallingItem, deltaTime: number): Side | null {
    const leftLanding = this.getLandingWorldPosition("left", item.size);
    const rightLanding = this.getLandingWorldPosition("right", item.size);
    const horizontalWindow = PAN_RADIUS * 0.9 + item.size * 0.42;
    const verticalWindow = Math.max(16, item.speed * deltaTime * 2.4);

    const leftDeltaX = Math.abs(item.sprite.x - leftLanding.x);
    const rightDeltaX = Math.abs(item.sprite.x - rightLanding.x);
    const leftDeltaY = Math.abs(item.sprite.y - leftLanding.y);
    const rightDeltaY = Math.abs(item.sprite.y - rightLanding.y);

    const canCatchLeft =
      leftDeltaX <= horizontalWindow && leftDeltaY <= verticalWindow;
    const canCatchRight =
      rightDeltaX <= horizontalWindow && rightDeltaY <= verticalWindow;

    if (!canCatchLeft && !canCatchRight) {
      return null;
    }

    if (canCatchLeft && canCatchRight) {
      const leftDistance = Math.hypot(leftDeltaX, leftDeltaY);
      const rightDistance = Math.hypot(rightDeltaX, rightDeltaY);
      return leftDistance <= rightDistance ? "left" : "right";
    }

    return canCatchLeft ? "left" : "right";
  }

  private resetRun(): void {
    this.clearFallingItems();
    this.clearStacks();
    this.clearLooseBlocks();

    this.score = 0;
    this.spawnTimerMs = 0;
    this.feedbackTimerMs = 0;
    this.isGameOver = false;
    this.hasWon = false;
    this.deathSequenceActive = false;
    this.deathTipDirection = 1;
    this.deathSpinRemaining = 0;
    this.deathFlightActive = false;
    this.deathFlightVx = 0;
    this.deathFlightVy = 0;

    this.balanceScale.rotation = 0;
    this.balanceScale.x = this.scaleXMid();
    this.balanceScale.y = this.scale.height - 106;

    this.feedbackText.setAlpha(0);
    this.gameOverText.setScale(1);
    this.gameOverText.setText(
      "GAME OVER\nR/SPACE restart\nM menu  L leaderboard",
    );
    this.gameOverText.setColor("#ffffff");
    this.gameOverText.setVisible(false);
  }
}

const mountPoint = document.getElementById("pixi-container");
if (!mountPoint) {
  throw new Error("Missing #pixi-container mount point.");
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: mountPoint,
  backgroundColor: "#000000",
  pixelArt: true,
  scene: [MainMenuScene, GameScene, LeaderboardScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.destroy(true);
  });
}

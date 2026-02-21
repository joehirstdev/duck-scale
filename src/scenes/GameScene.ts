import Phaser from "phaser";
import { addLeaderboardScore, readLeaderboard } from "../game/leaderboard";
import {
  BASE_SPAWN_INTERVAL_MS,
  BURST_SPAWN_BASE_CHANCE,
  BURST_SPAWN_MAX_CHANCE,
  BURST_SPAWN_SCORE_FACTOR,
  DEATH_FLIGHT_GRAVITY,
  DEATH_SPIN_SPEED,
  DEATH_SPIN_TOTAL,
  DEBRIS_GRAVITY,
  FALLING_ITEM_MAX_SIZE,
  FALLING_ITEM_MIN_SIZE,
  FEEDBACK_DURATION_MS,
  MAX_WEIGHT_IMBALANCE,
  MIN_SPAWN_INTERVAL_MS,
  PAN_OFFSET,
  PAN_RADIUS,
  PLAYER_MARGIN,
  PLAYER_SPEED,
  RETRO_FONT,
  RETRO_PALETTE,
  SPAWN_RAMP_PER_SCORE_MS,
  STACK_COMPRESSION,
  clamp,
  expectedSideForShape,
  randomBetween,
  type FallingItem,
  type LooseBlock,
  type ShapeKind,
  type Side,
  type StackedItem,
} from "../game/constants";

export class GameScene extends Phaser.Scene {
  private background!: Phaser.GameObjects.Graphics;
  private lanes!: Phaser.GameObjects.Graphics;
  private itemLayer!: Phaser.GameObjects.Container;
  private balanceScale!: Phaser.GameObjects.Container;
  private stackLayer!: Phaser.GameObjects.Container;
  private debrisLayer!: Phaser.GameObjects.Container;

  private scoreText!: Phaser.GameObjects.Text;
  private feedbackText!: Phaser.GameObjects.Text;
  private gameOverUi!: Phaser.GameObjects.Container;
  private gameOverTitle!: Phaser.GameObjects.Text;
  private gameOverScore!: Phaser.GameObjects.Text;
  private gameOverBadge!: Phaser.GameObjects.Text;
  private gameOverHint!: Phaser.GameObjects.Text;
  private pauseUi!: Phaser.GameObjects.Container;
  private pauseBackdrop!: Phaser.GameObjects.Rectangle;
  private pauseTitle!: Phaser.GameObjects.Text;
  private pauseHintText!: Phaser.GameObjects.Text;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyEsc!: Phaser.Input.Keyboard.Key;
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
  private isPaused = false;
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
      color: "#fff2cd",
      stroke: "#2f1a1b",
      strokeThickness: 4,
      fontStyle: "bold",
    };

    const leftLabel = this.add.text(-PAN_OFFSET, -46, "DUCKS", labelStyle);
    leftLabel.setOrigin(0.5);
    this.balanceScale.add(leftLabel);

    const rightLabel = this.add.text(PAN_OFFSET, -46, "JAM", labelStyle);
    rightLabel.setOrigin(0.5);
    this.balanceScale.add(rightLabel);

    this.scoreText = this.add.text(0, 20, "", {
      fontFamily: RETRO_FONT,
      fontSize: "28px",
      color: "#fff6df",
      stroke: "#2b1921",
      strokeThickness: 5,
      fontStyle: "bold",
    });
    this.scoreText.setOrigin(0.5, 0);
    this.refreshScoreText();

    this.feedbackText = this.add.text(0, 0, "", {
      fontFamily: RETRO_FONT,
      fontSize: "30px",
      color: "#fff0d2",
      stroke: "#2b1819",
      strokeThickness: 5,
      fontStyle: "bold",
    });
    this.feedbackText.setOrigin(0.5);
    this.feedbackText.setAlpha(0);

    this.createGameOverUi();

    this.createPauseUi();

    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error("Keyboard input is unavailable.");
    }

    this.cursors = keyboard.createCursorKeys();
    this.keyA = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyEsc = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
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

    if (!this.isGameOver && Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
      this.setPaused(!this.isPaused);
      return;
    }

    if (this.isPaused) {
      if (Phaser.Input.Keyboard.JustDown(this.keySpace)) {
        this.setPaused(false);
      }

      if (Phaser.Input.Keyboard.JustDown(this.keyM)) {
        this.setPaused(false);
        this.scene.start("MainMenuScene");
      }

      return;
    }

    if (this.isGameOver) {
      if (
        Phaser.Input.Keyboard.JustDown(this.keyR) ||
        Phaser.Input.Keyboard.JustDown(this.keySpace)
      ) {
        this.resetRun();
      }

      if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
        this.scene.start("MainMenuScene");
        return;
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
    } else {
      this.gameOverTitle.setScale(1 + Math.sin(this.time.now / 250) * 0.03);
      if (this.gameOverBadge.visible) {
        this.gameOverBadge.setScale(1 + Math.sin(this.time.now / 180) * 0.05);
      }
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
    beam.fillStyle(0xffd992).fillRoundedRect(-128, -20, 256, 10, 6);
    beam.lineStyle(2, 0x8d5b3d).strokeRoundedRect(-128, -20, 256, 10, 6);
    scale.add(beam);

    const support = this.add.graphics();
    support.fillStyle(0xf6c776).fillRoundedRect(-14, -20, 28, 66, 8);
    support.fillStyle(0xf6c776).fillRect(-4, -50, 8, 30);
    support.fillStyle(0x5f324d).fillRoundedRect(-56, 42, 112, 18, 8);
    support.lineStyle(2, 0x30172a).strokeRoundedRect(-56, 42, 112, 18, 8);
    scale.add(support);

    const leftArm = this.add.graphics();
    leftArm.fillStyle(0xf0be7a).fillRect(-PAN_OFFSET, -15, 3, 26);
    scale.add(leftArm);

    const rightArm = this.add.graphics();
    rightArm.fillStyle(0xf0be7a).fillRect(PAN_OFFSET - 3, -15, 3, 26);
    scale.add(rightArm);

    scale.add(this.createPan(-PAN_OFFSET, 0xffd789));
    scale.add(this.createPan(PAN_OFFSET, 0xff8c74));

    return scale;
  }

  private createPan(x: number, color: number): Phaser.GameObjects.Graphics {
    const pan = this.add.graphics();
    const trayWidth = PAN_RADIUS * 2.05;
    const trayHeight = Math.max(16, PAN_RADIUS * 0.52);

    pan
      .fillStyle(0xfff1cf, 0.97)
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

    pan.fillStyle(0xf7d5a3, 0.82);
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
    this.feedbackText.setPosition(width * 0.5, height * 0.22);
    this.gameOverTitle.setPosition(width * 0.5, height * 0.34);
    this.gameOverScore.setPosition(width * 0.5, height * 0.45);
    this.gameOverBadge.setPosition(width * 0.5, height * 0.54);
    this.gameOverHint.setPosition(width * 0.5, height * 0.66);
    this.pauseBackdrop.setSize(width, height);
    this.pauseTitle.setPosition(width * 0.5, height * 0.43);
    this.pauseHintText.setPosition(width * 0.5, height * 0.57);

    this.drawWorld();
  }

  private drawWorld(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    this.background.clear();
    this.background
      .fillGradientStyle(
        RETRO_PALETTE.skyTop,
        RETRO_PALETTE.skyTop,
        RETRO_PALETTE.skyBottom,
        RETRO_PALETTE.skyBottom,
        1,
      )
      .fillRect(0, 0, width, height);
    this.background
      .fillStyle(RETRO_PALETTE.sun, 0.9)
      .fillCircle(width * 0.8, height * 0.22, Math.min(90, height * 0.14));
    this.background
      .fillStyle(RETRO_PALETTE.horizon, 0.76)
      .fillRect(0, height * 0.58, width, height * 0.18);
    this.background
      .fillStyle(RETRO_PALETTE.skyline, 0.92)
      .fillRect(0, height * 0.72, width, height * 0.16);
    this.background
      .fillStyle(RETRO_PALETTE.ground, 0.97)
      .fillRect(0, height - 120, width, 120);

    this.lanes.clear();
    const leftPan = this.getPanWorldPosition("left");
    const rightPan = this.getPanWorldPosition("right");

    this.lanes
      .fillStyle(RETRO_PALETTE.laneDuck, 0.15)
      .fillRect(leftPan.x - PAN_RADIUS, 0, PAN_RADIUS * 2, height);
    this.lanes
      .fillStyle(RETRO_PALETTE.laneJam, 0.15)
      .fillRect(rightPan.x - PAN_RADIUS, 0, PAN_RADIUS * 2, height);
  }

  private showFeedback(message: string, colorHex: string): void {
    this.feedbackText.setText(message);
    this.feedbackText.setColor(colorHex);
    this.feedbackText.setAlpha(1);
    this.feedbackTimerMs = FEEDBACK_DURATION_MS;
  }

  private refreshScoreText(): void {
    this.scoreText.setText(`Score: ${this.score}`);
  }

  private createGameOverUi(): void {
    this.gameOverTitle = this.add.text(0, 0, "GAME OVER", {
      fontFamily: RETRO_FONT,
      fontSize: "64px",
      color: "#ff6a74",
      stroke: "#220b11",
      strokeThickness: 7,
      fontStyle: "bold",
    });
    this.gameOverTitle.setOrigin(0.5);

    this.gameOverScore = this.add.text(0, 0, "Score: 0", {
      fontFamily: RETRO_FONT,
      fontSize: "34px",
      color: "#ffe39f",
      stroke: "#1f1018",
      strokeThickness: 5,
      fontStyle: "bold",
    });
    this.gameOverScore.setOrigin(0.5);

    this.gameOverBadge = this.add.text(0, 0, "NEW HIGH SCORE!", {
      fontFamily: RETRO_FONT,
      fontSize: "30px",
      color: "#ff77ce",
      stroke: "#2b1030",
      strokeThickness: 5,
      fontStyle: "bold",
    });
    this.gameOverBadge.setOrigin(0.5);
    this.gameOverBadge.setVisible(false);

    this.gameOverHint = this.add.text(
      0,
      0,
      "SPACE or R to retry\nM menu    L leaderboard",
      {
        fontFamily: RETRO_FONT,
        fontSize: "28px",
        color: "#fff4df",
        stroke: "#1c111a",
        strokeThickness: 5,
        align: "center",
      },
    );
    this.gameOverHint.setOrigin(0.5);
    this.gameOverHint.setLineSpacing(10);

    this.gameOverUi = this.add.container(0, 0, [
      this.gameOverTitle,
      this.gameOverScore,
      this.gameOverBadge,
      this.gameOverHint,
    ]);
    this.gameOverUi.setDepth(2100);
    this.gameOverUi.setVisible(false);
  }

  private createPauseUi(): void {
    this.pauseBackdrop = this.add.rectangle(
      0,
      0,
      this.scale.width,
      this.scale.height,
      0x000000,
      0.62,
    );
    this.pauseBackdrop.setOrigin(0, 0);

    this.pauseTitle = this.add.text(0, 0, "PAUSED", {
      fontFamily: RETRO_FONT,
      fontSize: "64px",
      color: "#ffe39d",
      stroke: "#2a1618",
      strokeThickness: 7,
      fontStyle: "bold",
    });
    this.pauseTitle.setOrigin(0.5);

    this.pauseHintText = this.add.text(
      0,
      0,
      "SPACE or ESC to resume\nM for menu",
      {
        fontFamily: RETRO_FONT,
        fontSize: "27px",
        color: "#fff4de",
        stroke: "#24151b",
        strokeThickness: 5,
        align: "center",
      },
    );
    this.pauseHintText.setOrigin(0.5);
    this.pauseHintText.setLineSpacing(10);

    this.pauseUi = this.add.container(0, 0, [
      this.pauseBackdrop,
      this.pauseTitle,
      this.pauseHintText,
    ]);
    this.pauseUi.setDepth(2000);
    this.pauseUi.setVisible(false);
  }

  private setPaused(paused: boolean): void {
    this.isPaused = paused;
    this.pauseUi.setVisible(paused);
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

    this.setPaused(false);
    const previousHighScore = readLeaderboard()[0]?.score ?? 0;
    const isNewHighScore = this.score > 0 && this.score > previousHighScore;
    addLeaderboardScore(this.score);

    this.showFeedback("Too imbalanced!", "#ff8080");
    this.isGameOver = true;
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

    this.gameOverTitle.setScale(1);
    this.gameOverScore.setText(`Score: ${this.score}`);
    this.gameOverBadge.setVisible(isNewHighScore);
    this.gameOverBadge.setScale(1);
    this.gameOverUi.setVisible(true);

    this.setHudVisible(false);
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
    this.refreshScoreText();
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
    this.refreshScoreText();

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
    this.setPaused(false);
    this.clearFallingItems();
    this.clearStacks();
    this.clearLooseBlocks();

    this.score = 0;
    this.refreshScoreText();
    this.spawnTimerMs = 0;
    this.feedbackTimerMs = 0;
    this.isGameOver = false;
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
    this.gameOverTitle.setScale(1);
    this.gameOverScore.setText("Score: 0");
    this.gameOverBadge.setVisible(false);
    this.gameOverBadge.setScale(1);
    this.gameOverUi.setVisible(false);

    this.setHudVisible(true);
  }

  private setHudVisible(visible: boolean): void {
    this.scoreText.setVisible(visible);
    this.feedbackText.setVisible(visible);
  }
}

import Phaser from "phaser";
import { addLeaderboardScore, readLeaderboard } from "../game/leaderboard";
import {
  BALANCE_ROTATION_DIVISOR,
  BALANCE_ROTATION_MAX,
  DEATH_FLIGHT_GRAVITY,
  DEATH_SPIN_SPEED,
  DEATH_SPIN_TOTAL,
  DEBRIS_GRAVITY,
  DIAL_MAX_NEEDLE_ANGLE,
  DIAL_NEEDLE_LERP,
  FEEDBACK_DURATION_MS,
  GLASS_BREAK_SFX_VOLUME,
  LOSE_SFX_VOLUME,
  MAX_WEIGHT_IMBALANCE,
  MAX_FRAME_DELTA_MS,
  MAX_SPAWN_BACKLOG_INTERVALS,
  MAX_SPAWNS_PER_FRAME,
  PAN_OFFSET,
  PAN_RADIUS,
  PLAYER_SPEED,
  QUACK_SFX_VOLUME,
  RETRO_FONT,
  SCALE_BASELINE_OFFSET,
  SOUNDTRACK_VOLUME,
  SUCCESS_SFX_VOLUME,
  clamp,
  expectedSideForShape,
  randomBetween,
  type FallingItem,
  type LooseBlock,
  type Side,
  type StackedItem,
} from "../game/constants";
import {
  burstChanceForScore,
  clearFallingItems,
  createFallingItem,
  getLandingWorldPosition,
  getStackHeight,
  getWeightDelta,
  getWeightImbalance,
  panXForSide,
  pushForSide,
  randomStackedRotation,
  removeFallingItemAt,
  spawnIntervalForScore,
  stackForSide,
  tryCatchItem,
} from "../game/gameplay";
import {
  createGameOverUi,
  createPauseUi,
  createScale,
  drawWorld,
  localToWorld,
} from "../game/gameView";

const SOUNDTRACK_KEY = "soundtrack";
const QUACK_SFX_KEY = "quackSfx";
const GLASS_BREAK_SFX_KEY = "glassBreakSfx";
const SUCCESS_SFX_KEY = "successSfx";
const LOSE_SFX_KEY = "loseSfx";

export class GameScene extends Phaser.Scene {
  private background!: Phaser.GameObjects.Graphics;
  private lanes!: Phaser.GameObjects.Graphics;
  private itemLayer!: Phaser.GameObjects.Container;
  private balanceScale!: Phaser.GameObjects.Container;
  private balanceDialNeedle!: Phaser.GameObjects.Graphics;
  private stackLayer!: Phaser.GameObjects.Container;
  private debrisLayer!: Phaser.GameObjects.Container;

  private scoreText!: Phaser.GameObjects.Text;
  private feedbackText!: Phaser.GameObjects.Text;
  private gameOverUi!: Phaser.GameObjects.Container;
  private gameOverTitle!: Phaser.GameObjects.Text;
  private gameOverScore!: Phaser.GameObjects.Text;
  private gameOverBadge!: Phaser.GameObjects.Text;
  private gameOverRetryText!: Phaser.GameObjects.Text;
  private gameOverMenuText!: Phaser.GameObjects.Text;
  private gameOverLeaderboardText!: Phaser.GameObjects.Text;
  private pauseUi!: Phaser.GameObjects.Container;
  private pauseBackdrop!: Phaser.GameObjects.Rectangle;
  private pauseTitle!: Phaser.GameObjects.Text;
  private pauseResumeText!: Phaser.GameObjects.Text;
  private pauseMenuText!: Phaser.GameObjects.Text;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyEsc!: Phaser.Input.Keyboard.Key;
  private keyEnter!: Phaser.Input.Keyboard.Key;
  private keyH!: Phaser.Input.Keyboard.Key;
  private keyL!: Phaser.Input.Keyboard.Key;
  private keyM!: Phaser.Input.Keyboard.Key;
  private keyQ!: Phaser.Input.Keyboard.Key;
  private keyR!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;

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
    this.load.image("duck", "/assets/duck.webp");
    this.load.image("jam", "/assets/jam.webp");
    this.load.audio(SOUNDTRACK_KEY, "/assets/aparte.ogg");
    this.load.audio(QUACK_SFX_KEY, "/assets/quack.ogg");
    this.load.audio(GLASS_BREAK_SFX_KEY, "/assets/glass-break.ogg");
    this.load.audio(SUCCESS_SFX_KEY, "/assets/success.ogg");
    this.load.audio(LOSE_SFX_KEY, "/assets/lose.ogg");
  }

  create(): void {
    this.background = this.add.graphics();
    this.lanes = this.add.graphics();
    this.itemLayer = this.add.container();

    const { balanceScale, balanceDialNeedle } = createScale(this);
    this.balanceScale = balanceScale;
    this.balanceDialNeedle = balanceDialNeedle;

    this.stackLayer = this.add.container();
    this.balanceScale.add(this.stackLayer);
    this.debrisLayer = this.add.container();

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

    const gameOver = createGameOverUi(this);
    this.gameOverUi = gameOver.container;
    this.gameOverTitle = gameOver.title;
    this.gameOverScore = gameOver.score;
    this.gameOverBadge = gameOver.badge;
    this.gameOverRetryText = gameOver.retryText;
    this.gameOverMenuText = gameOver.menuText;
    this.gameOverLeaderboardText = gameOver.leaderboardText;

    const pause = createPauseUi(this);
    this.pauseUi = pause.container;
    this.pauseBackdrop = pause.backdrop;
    this.pauseTitle = pause.title;
    this.pauseResumeText = pause.resumeText;
    this.pauseMenuText = pause.menuText;

    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error("Keyboard input is unavailable.");
    }

    this.cursors = keyboard.createCursorKeys();
    this.keyA = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyEsc = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keyH = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    this.keyR = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.keySpace = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyEnter = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.keyM = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    this.keyL = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L);
    this.keyQ = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.stopSoundtrack();
    });

    this.initializeFreshRun();
    this.layout(true);
  }

  update(_time: number, deltaMs: number): void {
    const cappedDeltaMs = Math.min(deltaMs, MAX_FRAME_DELTA_MS);
    const deltaTime = cappedDeltaMs / 16.6666667;

    this.layout(false);

    if (
      !this.isGameOver &&
      (Phaser.Input.Keyboard.JustDown(this.keyEsc) ||
        Phaser.Input.Keyboard.JustDown(this.keyQ))
    ) {
      this.setPaused(!this.isPaused);
      return;
    }

    if (this.isPaused) {
      if (
        Phaser.Input.Keyboard.JustDown(this.keySpace) ||
        Phaser.Input.Keyboard.JustDown(this.keyEnter)
      ) {
        this.setPaused(false);
      }

      if (Phaser.Input.Keyboard.JustDown(this.keyM)) {
        this.goToScene("MainMenuScene");
      }

      this.drawWorld();
      return;
    }

    if (this.isGameOver) {
      if (
        Phaser.Input.Keyboard.JustDown(this.keyR) ||
        Phaser.Input.Keyboard.JustDown(this.keySpace) ||
        Phaser.Input.Keyboard.JustDown(this.keyEnter)
      ) {
        this.initializeFreshRun();
        return;
      }

      if (
        Phaser.Input.Keyboard.JustDown(this.keyEsc) ||
        Phaser.Input.Keyboard.JustDown(this.keyQ) ||
        Phaser.Input.Keyboard.JustDown(this.keyM)
      ) {
        this.goToScene("MainMenuScene");
        return;
      }

      if (Phaser.Input.Keyboard.JustDown(this.keyL)) {
        this.goToScene("LeaderboardScene");
        return;
      }
    }

    if (!this.isGameOver) {
      this.updateScaleMovement(deltaTime);
      this.updateSpawner(cappedDeltaMs);
      this.updateFallingItems(deltaTime);

      if (
        getWeightImbalance(this.leftStack, this.rightStack) >
        MAX_WEIGHT_IMBALANCE
      ) {
        this.triggerDeath();
      }
    } else {
      this.gameOverTitle.setScale(1 + Math.sin(this.time.now / 250) * 0.03);
      if (this.gameOverBadge.visible) {
        this.gameOverBadge.setScale(1 + Math.sin(this.time.now / 180) * 0.05);
      }
    }

    if (this.deathSequenceActive) {
      this.updateDeathSequence(deltaTime);
    } else {
      const weightDelta = getWeightDelta(this.leftStack, this.rightStack);
      const targetRotation = clamp(
        weightDelta / BALANCE_ROTATION_DIVISOR,
        -BALANCE_ROTATION_MAX,
        BALANCE_ROTATION_MAX,
      );
      const rotationLerp = Math.min(1, 0.14 * deltaTime);
      this.balanceScale.rotation +=
        (targetRotation - this.balanceScale.rotation) * rotationLerp;
    }

    this.updateLooseBlocks(deltaTime);

    if (this.feedbackTimerMs > 0) {
      this.feedbackTimerMs -= cappedDeltaMs;
      this.feedbackText.setAlpha(
        clamp(this.feedbackTimerMs / FEEDBACK_DURATION_MS, 0, 1),
      );
    }

    this.updateBalanceDial(deltaTime);
    this.drawWorld();
  }

  private updateScaleMovement(deltaTime: number): void {
    const moveLeft =
      this.cursors.left.isDown || this.keyA.isDown || this.keyH.isDown;
    const moveRight =
      this.cursors.right.isDown || this.keyD.isDown || this.keyL.isDown;
    const inputDirection = Number(moveRight) - Number(moveLeft);

    this.balanceScale.x += inputDirection * PLAYER_SPEED * deltaTime;
    this.balanceScale.x = clamp(
      this.balanceScale.x,
      this.minScaleX(),
      this.maxScaleX(),
    );
  }

  private updateSpawner(cappedDeltaMs: number): void {
    const spawnInterval = spawnIntervalForScore(this.score);
    const maxBacklogMs = spawnInterval * MAX_SPAWN_BACKLOG_INTERVALS;
    this.spawnTimerMs = Math.min(
      this.spawnTimerMs + cappedDeltaMs,
      maxBacklogMs,
    );

    let spawnsThisFrame = 0;
    while (
      this.spawnTimerMs >= spawnInterval &&
      spawnsThisFrame < MAX_SPAWNS_PER_FRAME
    ) {
      this.spawnTimerMs -= spawnInterval;
      this.fallingItems.push(
        createFallingItem(this, this.itemLayer, this.score),
      );
      spawnsThisFrame += 1;

      if (
        spawnsThisFrame < MAX_SPAWNS_PER_FRAME &&
        Math.random() < burstChanceForScore(this.score)
      ) {
        this.fallingItems.push(
          createFallingItem(this, this.itemLayer, this.score),
        );
        spawnsThisFrame += 1;
      }
    }
  }

  private updateFallingItems(deltaTime: number): void {
    for (let index = this.fallingItems.length - 1; index >= 0; index -= 1) {
      const item = this.fallingItems[index];
      item.sprite.y += item.speed * deltaTime;

      const leftLanding = getLandingWorldPosition(
        "left",
        item.size,
        this.leftStack,
        this.rightStack,
        (localX, localY) => localToWorld(this.balanceScale, localX, localY),
      );
      const rightLanding = getLandingWorldPosition(
        "right",
        item.size,
        this.leftStack,
        this.rightStack,
        (localX, localY) => localToWorld(this.balanceScale, localX, localY),
      );

      const caughtSide = tryCatchItem(
        item,
        deltaTime,
        leftLanding,
        rightLanding,
      );
      if (caughtSide) {
        const expectedSide = expectedSideForShape(item.kind);
        if (caughtSide === expectedSide) {
          removeFallingItemAt(this.fallingItems, index);
          this.addItemToStack(caughtSide, item);
        } else {
          const knocked = this.knockTopItemFromStack(caughtSide);
          if (knocked) {
            if (caughtSide === "left") {
              this.playSfx(QUACK_SFX_KEY, QUACK_SFX_VOLUME);
            } else {
              this.playSfx(GLASS_BREAK_SFX_KEY, GLASS_BREAK_SFX_VOLUME);
            }
            removeFallingItemAt(this.fallingItems, index);
            this.showFeedback("Wrong side!", "#ff9e80");
          }
        }

        if (this.isGameOver) {
          break;
        }

        continue;
      }

      if (item.sprite.y - item.size > this.scale.height) {
        removeFallingItemAt(this.fallingItems, index);
      }
    }
  }

  private updateLooseBlocks(deltaTime: number): void {
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
  }

  private scaleHalfWidth(): number {
    const trayHalfWidth = PAN_RADIUS * 1.025 + 2;
    return PAN_OFFSET + trayHalfWidth;
  }

  private edgeOverlapAllowance(): number {
    return this.scaleHalfWidth();
  }

  private minScaleX(): number {
    return this.scaleHalfWidth() - this.edgeOverlapAllowance();
  }

  private maxScaleX(): number {
    return (
      this.scale.width - this.scaleHalfWidth() + this.edgeOverlapAllowance()
    );
  }

  private scaleXMid(): number {
    return this.scale.width * 0.5;
  }

  private layout(force: boolean): void {
    const width = this.scale.width;
    const height = this.scale.height;

    if (!force && this.lastWidth === width && this.lastHeight === height) {
      return;
    }

    this.lastWidth = width;
    this.lastHeight = height;

    this.balanceScale.y = height - SCALE_BASELINE_OFFSET;
    this.balanceScale.x = clamp(
      this.balanceScale.x || width * 0.5,
      this.minScaleX(),
      this.maxScaleX(),
    );

    this.scoreText.setPosition(width * 0.5, 20);
    this.feedbackText.setPosition(width * 0.5, height * 0.22);
    this.gameOverTitle.setPosition(width * 0.5, height * 0.35);
    this.gameOverScore.setPosition(width * 0.5, height * 0.5);
    this.gameOverBadge.setPosition(width * 0.5, height * 0.56);
    this.gameOverRetryText.setPosition(width * 0.5, height * 0.62);
    this.gameOverMenuText.setPosition(width * 0.5, height * 0.69);
    this.gameOverLeaderboardText.setPosition(width * 0.5, height * 0.76);
    this.pauseBackdrop.setSize(width, height);
    this.pauseTitle.setPosition(width * 0.5, height * 0.42);
    this.pauseResumeText.setPosition(width * 0.5, height * 0.55);
    this.pauseMenuText.setPosition(width * 0.5, height * 0.66);

    this.drawWorld();
  }

  private drawWorld(): void {
    drawWorld(this, this.background, this.lanes, this.balanceScale);
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

  private setPaused(paused: boolean, manageSound = true): void {
    this.isPaused = paused;
    this.pauseUi.setVisible(paused);

    if (manageSound) {
      this.setSoundtrackPaused(paused);
    }
  }

  private goToScene(target: "MainMenuScene" | "LeaderboardScene"): void {
    this.setPaused(false, false);
    this.stopSoundtrack();
    this.resetDeathState();
    this.scene.start(target);
  }

  private startSoundtrackLoop(): void {
    this.stopSoundtrack();

    if (this.sound.locked) {
      this.sound.once(Phaser.Sound.Events.UNLOCKED, () => {
        this.sound.play(SOUNDTRACK_KEY, {
          loop: true,
          volume: SOUNDTRACK_VOLUME,
        });
      });
      return;
    }

    this.sound.play(SOUNDTRACK_KEY, {
      loop: true,
      volume: SOUNDTRACK_VOLUME,
    });
  }

  private stopSoundtrack(): void {
    this.sound.stopByKey(SOUNDTRACK_KEY);
  }

  private setSoundtrackPaused(paused: boolean): void {
    const soundtrack = this.sound.get(SOUNDTRACK_KEY);
    if (!soundtrack) {
      return;
    }

    if (paused) {
      soundtrack.pause();
    } else {
      soundtrack.resume();
    }
  }

  private playSfx(key: string, volume: number): void {
    if (this.sound.locked) {
      return;
    }

    this.sound.play(key, { volume });
  }

  private updateBalanceDial(deltaTime: number): void {
    const weightDelta = getWeightDelta(this.leftStack, this.rightStack);
    const targetNeedleRotation =
      -clamp(weightDelta / MAX_WEIGHT_IMBALANCE, -1, 1) * DIAL_MAX_NEEDLE_ANGLE;
    const lerpFactor = Math.min(1, DIAL_NEEDLE_LERP * deltaTime);
    this.balanceDialNeedle.rotation +=
      (targetNeedleRotation - this.balanceDialNeedle.rotation) * lerpFactor;
  }

  private addItemToStack(side: Side, item: FallingItem): void {
    const stack = stackForSide(side, this.leftStack, this.rightStack);
    const localPanX = panXForSide(side);
    const stackHeight = getStackHeight(stack);

    const sprite = this.add.image(0, 0, item.kind);
    sprite.setOrigin(0.5);
    const longestSide = Math.max(sprite.width || 1, sprite.height || 1);
    sprite.setScale(item.size / longestSide);
    if (item.kind === "duck") {
      sprite.setFlipX(Math.random() < 0.5);
    }
    sprite.rotation = randomStackedRotation();

    sprite.setPosition(
      localPanX + randomBetween(-PAN_RADIUS * 0.35, PAN_RADIUS * 0.35),
      10 - PAN_RADIUS - item.size * 0.5 - stackHeight,
    );

    this.stackLayer.add(sprite);

    stack.push({
      sprite,
      size: item.size,
    });

    this.score += 1;
    this.playSfx(SUCCESS_SFX_KEY, SUCCESS_SFX_VOLUME);
    this.refreshScoreText();
    this.showFeedback("+1 caught", "#b3ffb3");
  }

  private knockTopItemFromStack(side: Side): boolean {
    const stack = stackForSide(side, this.leftStack, this.rightStack);
    const removed = stack.pop();
    if (!removed) {
      return false;
    }

    const world = localToWorld(
      this.balanceScale,
      removed.sprite.x,
      removed.sprite.y,
    );
    const worldRotation = this.balanceScale.rotation + removed.sprite.rotation;

    this.stackLayer.remove(removed.sprite);
    removed.sprite.x = world.x;
    removed.sprite.y = world.y;
    removed.sprite.rotation = worldRotation;
    this.debrisLayer.add(removed.sprite);

    const sidePush = pushForSide(side);
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

  private spillStacksOnDeath(): void {
    const spillSide = (side: Side): void => {
      const stack = stackForSide(side, this.leftStack, this.rightStack);
      const sidePush = pushForSide(side);

      while (stack.length > 0) {
        const item = stack.pop();
        if (!item) {
          break;
        }

        const world = localToWorld(
          this.balanceScale,
          item.sprite.x,
          item.sprite.y,
        );
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
    this.playSfx(LOSE_SFX_KEY, LOSE_SFX_VOLUME);
    this.stopSoundtrack();

    this.showFeedback("Too imbalanced!", "#ff8080");
    this.isGameOver = true;

    const weightDelta = getWeightDelta(this.leftStack, this.rightStack);
    this.beginDeathSequence(weightDelta);

    clearFallingItems(this.fallingItems);
    this.spillStacksOnDeath();

    this.gameOverTitle.setScale(1);
    this.gameOverScore.setText(`Score: ${this.score}`);
    this.gameOverBadge.setVisible(isNewHighScore);
    this.gameOverBadge.setScale(1);
    this.gameOverUi.setVisible(true);

    this.setHudVisible(false);
  }

  private beginDeathSequence(weightDelta: number): void {
    this.deathSequenceActive = true;
    if (weightDelta === 0) {
      this.deathTipDirection = Math.random() < 0.5 ? -1 : 1;
    } else {
      this.deathTipDirection = weightDelta > 0 ? 1 : -1;
    }
    this.deathSpinRemaining = DEATH_SPIN_TOTAL;
    this.deathFlightActive = false;
    this.deathFlightVx = 0;
    this.deathFlightVy = 0;
  }

  private updateDeathSequence(deltaTime: number): void {
    if (this.deathSpinRemaining > 0) {
      const spinStep = Math.min(
        this.deathSpinRemaining,
        DEATH_SPIN_SPEED * deltaTime,
      );
      this.balanceScale.rotation += spinStep * this.deathTipDirection;
      this.deathSpinRemaining -= spinStep;
      return;
    }

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

  private setHudVisible(visible: boolean): void {
    this.scoreText.setVisible(visible);
    this.feedbackText.setVisible(visible);
  }

  private resetDeathState(): void {
    this.deathSequenceActive = false;
    this.deathTipDirection = 1;
    this.deathSpinRemaining = 0;
    this.deathFlightActive = false;
    this.deathFlightVx = 0;
    this.deathFlightVy = 0;
  }

  private initializeFreshRun(): void {
    this.itemLayer.removeAll(true);
    this.stackLayer.removeAll(true);
    this.debrisLayer.removeAll(true);

    this.fallingItems = [];
    this.leftStack = [];
    this.rightStack = [];
    this.looseBlocks = [];

    this.score = 0;
    this.refreshScoreText();
    this.spawnTimerMs = 0;
    this.feedbackTimerMs = 0;
    this.isGameOver = false;
    this.isPaused = false;
    this.resetDeathState();

    this.balanceScale.rotation = 0;
    this.balanceScale.x = this.scaleXMid();
    this.balanceScale.y = this.scale.height - SCALE_BASELINE_OFFSET;
    this.balanceDialNeedle.rotation = 0;

    this.feedbackText.setAlpha(0);
    this.gameOverTitle.setScale(1);
    this.gameOverScore.setText("Score: 0");
    this.gameOverBadge.setVisible(false);
    this.gameOverBadge.setScale(1);
    this.gameOverUi.setVisible(false);

    this.setPaused(false);
    this.setHudVisible(true);
    this.startSoundtrackLoop();
  }
}

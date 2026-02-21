import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  Text,
  Texture,
} from "pixi.js";

type Side = "left" | "right";
type ShapeKind = "duck" | "jam";

interface FallingItem {
  graphic: Sprite;
  kind: ShapeKind;
  size: number;
  speed: number;
}

interface StackedItem {
  graphic: Sprite;
  size: number;
  weight: number;
}

interface LooseBlock {
  graphic: Sprite;
  vx: number;
  vy: number;
  spin: number;
}

const PLAYER_SPEED = 11;
const PLAYER_MARGIN = 20;
const PAN_OFFSET = 92;
const PAN_RADIUS = 38;
const BASE_SPAWN_INTERVAL_MS = 500;
const MIN_SPAWN_INTERVAL_MS = 170;
const SPAWN_RAMP_PER_SCORE_MS = 10;
const BURST_SPAWN_BASE_CHANCE = 0.12;
const BURST_SPAWN_SCORE_FACTOR = 0.005;
const BURST_SPAWN_MAX_CHANCE = 0.42;
const TARGET_SCORE = 35;
const FEEDBACK_DURATION_MS = 760;
const STACK_COMPRESSION = 0.56;
const MAX_SIDE_COUNT_DIFF = 3;
const DEATH_SPIN_TOTAL = Math.PI * 6;
const DEATH_SPIN_SPEED = 0.4;
const DEATH_FLIGHT_GRAVITY = 0.72;
const DEBRIS_GRAVITY = 0.42;
const DUCK_SIDE: Side = "left";
const JAM_SIDE: Side = "right";

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const randomBetween = (min: number, max: number): number =>
  min + Math.random() * (max - min);

const expectedSideForShape = (kind: ShapeKind): Side =>
  kind === "duck" ? DUCK_SIDE : JAM_SIDE;

const createShapeGraphic = (
  kind: ShapeKind,
  size: number,
  textures: Record<ShapeKind, Texture>,
): Sprite => {
  const sprite = new Sprite(textures[kind]);
  sprite.anchor.set(0.5);

  const sourceW = sprite.texture.width || 1;
  const sourceH = sprite.texture.height || 1;
  const longestSide = Math.max(sourceW, sourceH);
  const scale = size / longestSide;
  sprite.scale.set(scale);

  return sprite;
};

const createPan = (radius: number, color: number): Graphics => {
  const pan = new Graphics();
  const trayWidth = radius * 2.05;
  const trayHeight = Math.max(16, radius * 0.52);
  pan
    .roundRect(-trayWidth * 0.5, -trayHeight * 0.5, trayWidth, trayHeight, 8)
    .fill({ color: 0xe8f7ff, alpha: 0.97 });
  pan
    .roundRect(-trayWidth * 0.5, -trayHeight * 0.5, trayWidth, trayHeight, 8)
    .stroke({ width: 4, color });
  pan
    .rect(-trayWidth * 0.34, -2.5, trayWidth * 0.68, 5)
    .fill({ color: 0xb9dcf0, alpha: 0.8 });
  return pan;
};

const createScale = (): Container => {
  const scale = new Container();

  const beam = new Graphics();
  beam.roundRect(-128, -20, 256, 10, 6).fill(0xe7ddbe);
  beam.roundRect(-128, -20, 256, 10, 6).stroke({ width: 2, color: 0x8c7e57 });
  scale.addChild(beam);

  const support = new Graphics();
  support.roundRect(-14, -20, 28, 66, 8).fill(0xc6b78a);
  support.rect(-4, -50, 8, 30).fill(0xc6b78a);
  support.roundRect(-56, 42, 112, 18, 8).fill(0x786647);
  support.roundRect(-56, 42, 112, 18, 8).stroke({ width: 2, color: 0x4e402b });
  scale.addChild(support);

  const leftArm = new Graphics();
  leftArm.rect(-PAN_OFFSET, -15, 3, 26).fill(0x6d92c2);
  scale.addChild(leftArm);

  const rightArm = new Graphics();
  rightArm.rect(PAN_OFFSET - 3, -15, 3, 26).fill(0x6d92c2);
  scale.addChild(rightArm);

  const leftPan = createPan(PAN_RADIUS, 0x69b6ff);
  leftPan.position.set(-PAN_OFFSET, 10);
  scale.addChild(leftPan);

  const rightPan = createPan(PAN_RADIUS, 0xffbb66);
  rightPan.position.set(PAN_OFFSET, 10);
  scale.addChild(rightPan);

  return scale;
};

(async () => {
  const app = new Application();
  await app.init({ background: "#000000", resizeTo: window, antialias: true });

  const duckTexture = (await Assets.load("/assets/duck.png")) as Texture;
  const jamTexture = (await Assets.load("/assets/jam.webp")) as Texture;
  const textures: Record<ShapeKind, Texture> = {
    duck: duckTexture,
    jam: jamTexture,
  };

  const mountPoint = document.getElementById("pixi-container");
  if (!mountPoint) {
    throw new Error("Missing #pixi-container mount point.");
  }
  mountPoint.appendChild(app.canvas);

  const background = new Graphics();
  app.stage.addChild(background);

  const lanes = new Graphics();
  app.stage.addChild(lanes);

  const itemLayer = new Container();
  app.stage.addChild(itemLayer);

  const scale = createScale();
  app.stage.addChild(scale);

  const stackLayer = new Container();
  scale.addChild(stackLayer);

  const debrisLayer = new Container();
  app.stage.addChild(debrisLayer);

  const labelStyle = {
    fontFamily: "monospace",
    fontSize: 18,
    fill: 0xd9e6ff,
    fontWeight: "bold" as const,
  };

  const leftLabel = new Text("DUCKS", labelStyle);
  leftLabel.anchor.set(0.5);
  leftLabel.position.set(-PAN_OFFSET, -46);
  scale.addChild(leftLabel);

  const rightLabel = new Text("JAM", labelStyle);
  rightLabel.anchor.set(0.5);
  rightLabel.position.set(PAN_OFFSET, -46);
  scale.addChild(rightLabel);

  const hudStyle = {
    fontFamily: "monospace",
    fontSize: 26,
    fill: 0xf3f6ff,
    fontWeight: "bold" as const,
  };

  const scoreText = new Text(`0 out of ${TARGET_SCORE}`, hudStyle);
  scoreText.anchor.set(0.5, 0);
  app.stage.addChild(scoreText);

  const ruleText = new Text(
    `Catch ducks on the left and jam on the right. Each correct catch is +1 point. More than ${MAX_SIDE_COUNT_DIFF} pieces off-balance tips instantly. Reach ${TARGET_SCORE} to win.`,
    {
      fontFamily: "monospace",
      fontSize: 18,
      fill: 0xc8d7ff,
      align: "center",
      wordWrap: true,
      wordWrapWidth: 900,
    },
  );
  ruleText.anchor.set(0.5, 0);
  app.stage.addChild(ruleText);

  const feedbackText = new Text("", {
    fontFamily: "monospace",
    fontSize: 30,
    fill: 0xf2fff2,
    fontWeight: "bold" as const,
  });
  feedbackText.anchor.set(0.5);
  feedbackText.alpha = 0;
  app.stage.addChild(feedbackText);

  const gameOverText = new Text("GAME OVER\nPress R to restart", {
    fontFamily: "monospace",
    fontSize: 48,
    fill: 0xffdfdf,
    align: "center",
    fontWeight: "bold" as const,
    stroke: { color: 0x2d0000, width: 5 },
  });
  gameOverText.anchor.set(0.5);
  gameOverText.visible = false;
  app.stage.addChild(gameOverText);

  const fallingItems: FallingItem[] = [];
  const leftStack: StackedItem[] = [];
  const rightStack: StackedItem[] = [];
  const looseBlocks: LooseBlock[] = [];

  const keyState = {
    left: false,
    right: false,
  };

  let lastWidth = 0;
  let lastHeight = 0;
  let score = 0;
  let spawnTimerMs = 0;
  let feedbackTimerMs = 0;
  let leftWeight = 0;
  let rightWeight = 0;
  let isGameOver = false;
  let hasWon = false;
  let deathSequenceActive = false;
  let deathTipDirection = 1;
  let deathSpinRemaining = 0;
  let deathFlightActive = false;
  let deathFlightVx = 0;
  let deathFlightVy = 0;

  const stackForSide = (side: Side): StackedItem[] =>
    side === "left" ? leftStack : rightStack;
  const panXForSide = (side: Side): number =>
    side === "left" ? -PAN_OFFSET : PAN_OFFSET;
  const pushForSide = (side: Side): number => (side === "left" ? -1 : 1);
  const weightForSide = (side: Side): number =>
    side === "left" ? leftWeight : rightWeight;
  const setWeightForSide = (side: Side, value: number): void => {
    if (side === "left") {
      leftWeight = value;
    } else {
      rightWeight = value;
    }
  };
  const adjustWeightForSide = (side: Side, delta: number): void => {
    setWeightForSide(side, weightForSide(side) + delta);
  };
  const spawnIntervalForScore = (value: number): number =>
    Math.max(
      MIN_SPAWN_INTERVAL_MS,
      BASE_SPAWN_INTERVAL_MS - value * SPAWN_RAMP_PER_SCORE_MS,
    );
  const burstChanceForScore = (value: number): number =>
    Math.min(
      BURST_SPAWN_MAX_CHANCE,
      BURST_SPAWN_BASE_CHANCE + value * BURST_SPAWN_SCORE_FACTOR,
    );

  const minScaleX = (): number => PAN_OFFSET + PLAYER_MARGIN;
  const maxScaleX = (): number => app.screen.width - PAN_OFFSET - PLAYER_MARGIN;

  const getPanWorldPosition = (side: Side): { x: number; y: number } => {
    const localX = panXForSide(side);
    const position = scale.toGlobal({ x: localX, y: 10 });
    return { x: position.x, y: position.y };
  };

  const drawWorld = (): void => {
    const width = app.screen.width;
    const height = app.screen.height;

    background.clear();
    background.rect(0, 0, width, height).fill(0x5fbecf);
    background.rect(0, height * 0.65, width, height * 0.35).fill(0x4ca0bf);
    background.rect(0, height - 120, width, 120).fill(0x2f6c8a);

    lanes.clear();
    const leftPan = getPanWorldPosition("left");
    const rightPan = getPanWorldPosition("right");

    lanes.rect(leftPan.x - PAN_RADIUS, 0, PAN_RADIUS * 2, height).fill({
      color: 0xffdd66,
      alpha: 0.12,
    });
    lanes.rect(rightPan.x - PAN_RADIUS, 0, PAN_RADIUS * 2, height).fill({
      color: 0xd86a5f,
      alpha: 0.12,
    });
  };

  const layout = (): void => {
    if (lastWidth === app.screen.width && lastHeight === app.screen.height) {
      return;
    }

    lastWidth = app.screen.width;
    lastHeight = app.screen.height;

    scale.y = app.screen.height - 106;
    scale.x = clamp(
      scale.x || app.screen.width * 0.5,
      minScaleX(),
      maxScaleX(),
    );

    scoreText.position.set(app.screen.width * 0.5, 20);
    ruleText.position.set(app.screen.width * 0.5, 56);
    ruleText.style.wordWrapWidth = Math.max(320, app.screen.width - 80);
    feedbackText.position.set(app.screen.width * 0.5, app.screen.height * 0.22);
    gameOverText.position.set(app.screen.width * 0.5, app.screen.height * 0.45);
    drawWorld();
  };

  const updateHud = (): void => {
    scoreText.text = `${Math.min(score, TARGET_SCORE)} out of ${TARGET_SCORE}`;
  };

  const showFeedback = (message: string, tint: number): void => {
    feedbackText.text = message;
    feedbackText.tint = tint;
    feedbackText.alpha = 1;
    feedbackTimerMs = FEEDBACK_DURATION_MS;
  };

  const removeFallingItemAt = (index: number): void => {
    const item = fallingItems[index];
    itemLayer.removeChild(item.graphic);
    item.graphic.destroy();
    fallingItems.splice(index, 1);
  };

  const clearFallingItems = (): void => {
    for (let index = fallingItems.length - 1; index >= 0; index -= 1) {
      removeFallingItemAt(index);
    }
  };

  const clearStack = (stack: StackedItem[]): void => {
    for (let index = stack.length - 1; index >= 0; index -= 1) {
      const item = stack[index];
      stackLayer.removeChild(item.graphic);
      item.graphic.destroy();
    }
    stack.length = 0;
  };

  const clearStacks = (): void => {
    clearStack(leftStack);
    clearStack(rightStack);
    setWeightForSide("left", 0);
    setWeightForSide("right", 0);
  };

  const clearLooseBlocks = (): void => {
    for (let index = looseBlocks.length - 1; index >= 0; index -= 1) {
      const block = looseBlocks[index];
      debrisLayer.removeChild(block.graphic);
      block.graphic.destroy();
      looseBlocks.splice(index, 1);
    }
  };

  const getStackHeight = (stack: StackedItem[]): number =>
    stack.reduce(
      (height, stacked) => height + stacked.size * STACK_COMPRESSION + 2,
      0,
    );

  const getLandingWorldPosition = (
    side: Side,
    incomingSize: number,
  ): { x: number; y: number } => {
    const stack = stackForSide(side);
    const localPanX = panXForSide(side);
    const stackHeight = getStackHeight(stack);
    const landingLocalY = 10 - PAN_RADIUS - incomingSize * 0.5 - stackHeight;
    const position = scale.toGlobal({ x: localPanX, y: landingLocalY });
    return { x: position.x, y: position.y };
  };

  const createFallingItem = (): FallingItem => {
    const size = randomBetween(32, 68);
    const kind: ShapeKind = Math.random() < 0.5 ? "duck" : "jam";
    const speedBoost = Math.min(score * 0.02, 3.4);
    const speed = randomBetween(4.6, 7.8) + speedBoost;
    const graphic = createShapeGraphic(kind, size, textures);

    graphic.x = randomBetween(
      size * 0.5 + 10,
      app.screen.width - size * 0.5 - 10,
    );
    graphic.y = -size;

    return {
      graphic,
      kind,
      size,
      speed,
    };
  };

  const spawnItem = (): void => {
    const item = createFallingItem();
    fallingItems.push(item);
    itemLayer.addChild(item.graphic);
  };

  const spillStacksOnDeath = (): void => {
    const spillSide = (side: Side): void => {
      const stack = stackForSide(side);
      const sidePush = pushForSide(side);
      while (stack.length > 0) {
        const item = stack.pop();
        if (!item) {
          break;
        }

        const global = stackLayer.toGlobal(item.graphic.position);
        stackLayer.removeChild(item.graphic);
        debrisLayer.addChild(item.graphic);
        item.graphic.position.set(global.x, global.y);

        looseBlocks.push({
          graphic: item.graphic,
          vx:
            deathTipDirection * randomBetween(3.4, 6.6) +
            sidePush * randomBetween(0.6, 1.8),
          vy: randomBetween(-5.8, -2.4),
          spin:
            deathTipDirection * randomBetween(0.03, 0.1) +
            randomBetween(-0.05, 0.05),
        });
      }
    };

    spillSide("left");
    spillSide("right");
    setWeightForSide("left", 0);
    setWeightForSide("right", 0);
  };

  const triggerDeath = (): void => {
    if (isGameOver) {
      return;
    }

    showFeedback("Too imbalanced!", 0xff8080);
    isGameOver = true;
    hasWon = false;
    deathSequenceActive = true;
    deathTipDirection =
      leftStack.length > rightStack.length
        ? -1
        : rightStack.length > leftStack.length
          ? 1
          : Math.random() < 0.5
            ? -1
            : 1;
    deathSpinRemaining = DEATH_SPIN_TOTAL;
    deathFlightActive = false;
    deathFlightVx = 0;
    deathFlightVy = 0;
    clearFallingItems();
    spillStacksOnDeath();
    gameOverText.text = "GAME OVER\nPress R to restart";
    gameOverText.tint = 0xffffff;
    gameOverText.visible = true;
  };

  const addItemToStack = (side: Side, item: FallingItem): void => {
    const stack = stackForSide(side);
    const localPanX = panXForSide(side);
    const stackHeight = getStackHeight(stack);
    const stackedGraphic = createShapeGraphic(item.kind, item.size, textures);

    stackedGraphic.position.set(
      localPanX + randomBetween(-PAN_RADIUS * 0.35, PAN_RADIUS * 0.35),
      10 - PAN_RADIUS - item.size * 0.5 - stackHeight,
    );
    stackedGraphic.rotation = randomBetween(-0.18, 0.18);
    stackLayer.addChild(stackedGraphic);

    const stackedItem: StackedItem = {
      graphic: stackedGraphic,
      size: item.size,
      weight: item.size,
    };
    stack.push(stackedItem);
    adjustWeightForSide(side, stackedItem.weight);

    score += 1;
    showFeedback("+1 caught", 0xb3ffb3);

    if (score >= TARGET_SCORE) {
      score = TARGET_SCORE;
      isGameOver = true;
      hasWon = true;
      gameOverText.text = "YOU WIN\n35/35\nPress R to restart";
      gameOverText.tint = 0xb6ffd1;
      gameOverText.visible = true;
    }
  };

  const knockTopItemFromStack = (side: Side): boolean => {
    const stack = stackForSide(side);
    const removed = stack.pop();
    if (!removed) {
      return false;
    }

    const worldPosition = stackLayer.toGlobal(removed.graphic.position);
    stackLayer.removeChild(removed.graphic);
    debrisLayer.addChild(removed.graphic);
    removed.graphic.position.set(worldPosition.x, worldPosition.y);

    const sidePush = pushForSide(side);
    looseBlocks.push({
      graphic: removed.graphic,
      vx: sidePush * randomBetween(3.6, 6.8),
      vy: randomBetween(-6.4, -3.2),
      spin: randomBetween(-0.18, 0.18),
    });
    setWeightForSide(side, Math.max(0, weightForSide(side) - removed.weight));

    score = Math.max(0, score - 1);
    return true;
  };

  const tryCatchItem = (item: FallingItem, deltaTime: number): Side | null => {
    const leftLanding = getLandingWorldPosition("left", item.size);
    const rightLanding = getLandingWorldPosition("right", item.size);
    const horizontalWindow = PAN_RADIUS * 0.9 + item.size * 0.42;
    const verticalWindow = Math.max(16, item.speed * deltaTime * 2.4);

    const leftDeltaX = Math.abs(item.graphic.x - leftLanding.x);
    const rightDeltaX = Math.abs(item.graphic.x - rightLanding.x);
    const leftDeltaY = Math.abs(item.graphic.y - leftLanding.y);
    const rightDeltaY = Math.abs(item.graphic.y - rightLanding.y);

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
  };

  const resetRun = (): void => {
    clearFallingItems();
    clearStacks();
    score = 0;
    spawnTimerMs = 0;
    feedbackTimerMs = 0;
    clearLooseBlocks();
    isGameOver = false;
    hasWon = false;
    deathSequenceActive = false;
    deathTipDirection = 1;
    deathSpinRemaining = 0;
    deathFlightActive = false;
    deathFlightVx = 0;
    deathFlightVy = 0;
    scale.rotation = 0;
    scale.x = app.screen.width * 0.5;
    scale.y = app.screen.height - 106;
    feedbackText.alpha = 0;
    gameOverText.text = "GAME OVER\nPress R to restart";
    gameOverText.tint = 0xffffff;
    gameOverText.visible = false;
    updateHud();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "ArrowLeft" || event.code === "KeyA") {
      keyState.left = true;
    }
    if (event.code === "ArrowRight" || event.code === "KeyD") {
      keyState.right = true;
    }
    if ((event.code === "KeyR" || event.code === "Space") && isGameOver) {
      resetRun();
    }
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    if (event.code === "ArrowLeft" || event.code === "KeyA") {
      keyState.left = false;
    }
    if (event.code === "ArrowRight" || event.code === "KeyD") {
      keyState.right = false;
    }
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  scale.x = app.screen.width * 0.5;
  updateHud();
  layout();
  drawWorld();

  app.ticker.add((ticker) => {
    layout();

    const inputDirection = Number(keyState.right) - Number(keyState.left);
    if (!isGameOver) {
      scale.x += inputDirection * PLAYER_SPEED * ticker.deltaTime;
      scale.x = clamp(scale.x, minScaleX(), maxScaleX());

      spawnTimerMs += ticker.deltaMS;
      const spawnInterval = spawnIntervalForScore(score);
      while (spawnTimerMs >= spawnInterval) {
        spawnTimerMs -= spawnInterval;
        spawnItem();
        const burstChance = burstChanceForScore(score);
        if (Math.random() < burstChance) {
          spawnItem();
        }
      }

      for (let index = fallingItems.length - 1; index >= 0; index -= 1) {
        const item = fallingItems[index];
        item.graphic.y += item.speed * ticker.deltaTime;

        const caughtSide = tryCatchItem(item, ticker.deltaTime);
        if (caughtSide) {
          const expectedSide = expectedSideForShape(item.kind);
          if (caughtSide === expectedSide) {
            addItemToStack(caughtSide, item);
          } else {
            const knocked = knockTopItemFromStack(caughtSide);
            if (knocked) {
              showFeedback("-1 wrong side!", 0xff9e80);
            } else {
              showFeedback("Wrong pan! No stack to knock.", 0xffb780);
            }
          }
          removeFallingItemAt(index);
          if (isGameOver) {
            break;
          }
          continue;
        }

        if (item.graphic.y - item.size > app.screen.height) {
          showFeedback("Missed!", 0xffa2a2);
          removeFallingItemAt(index);
        }
      }

      const countImbalance = Math.abs(leftStack.length - rightStack.length);
      if (countImbalance >= MAX_SIDE_COUNT_DIFF) {
        triggerDeath();
      }
    } else if (!hasWon) {
      gameOverText.scale.set(1 + Math.sin(performance.now() / 250) * 0.02);
    } else {
      gameOverText.scale.set(1 + Math.sin(performance.now() / 350) * 0.015);
    }

    if (deathSequenceActive) {
      if (deathSpinRemaining > 0) {
        const spinStep = Math.min(
          deathSpinRemaining,
          DEATH_SPIN_SPEED * ticker.deltaTime,
        );
        scale.rotation += spinStep * deathTipDirection;
        deathSpinRemaining -= spinStep;
      } else {
        if (!deathFlightActive) {
          deathFlightActive = true;
          deathFlightVx = deathTipDirection * randomBetween(14, 20);
          deathFlightVy = randomBetween(-16, -11);
        }

        scale.x += deathFlightVx * ticker.deltaTime;
        scale.y += deathFlightVy * ticker.deltaTime;
        deathFlightVy += DEATH_FLIGHT_GRAVITY * ticker.deltaTime;
        scale.rotation += deathTipDirection * 0.32 * ticker.deltaTime;
      }
    } else {
      const targetRotation = clamp(
        (rightWeight - leftWeight) / 240,
        -0.36,
        0.36,
      );
      const rotationLerp = Math.min(1, 0.14 * ticker.deltaTime);
      scale.rotation += (targetRotation - scale.rotation) * rotationLerp;
    }

    for (let index = looseBlocks.length - 1; index >= 0; index -= 1) {
      const block = looseBlocks[index];
      block.vy += DEBRIS_GRAVITY * ticker.deltaTime;
      block.graphic.x += block.vx * ticker.deltaTime;
      block.graphic.y += block.vy * ticker.deltaTime;
      block.graphic.rotation += block.spin * ticker.deltaTime;
      block.vx *= 0.992;

      if (block.graphic.y - 120 > app.screen.height) {
        debrisLayer.removeChild(block.graphic);
        block.graphic.destroy();
        looseBlocks.splice(index, 1);
      }
    }

    if (feedbackTimerMs > 0) {
      feedbackTimerMs -= ticker.deltaMS;
      feedbackText.alpha = clamp(feedbackTimerMs / FEEDBACK_DURATION_MS, 0, 1);
    }

    drawWorld();
    updateHud();
  });
})();

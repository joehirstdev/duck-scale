import { Application, Container, Graphics, Text } from "pixi.js";

type Side = "left" | "right";
type ShapeKind = "circle" | "square";

interface FallingItem {
  graphic: Graphics;
  kind: ShapeKind;
  size: number;
  speed: number;
}

interface StackedItem {
  graphic: Graphics;
  size: number;
  weight: number;
}

interface LooseBlock {
  graphic: Graphics;
  vx: number;
  vy: number;
  spin: number;
}

const PLAYER_SPEED = 8;
const PLAYER_MARGIN = 20;
const PAN_OFFSET = 92;
const PAN_RADIUS = 38;
const BASE_SPAWN_INTERVAL_MS = 700;
const MIN_SPAWN_INTERVAL_MS = 300;
const TARGET_SCORE = 35;
const FEEDBACK_DURATION_MS = 950;
const STACK_COMPRESSION = 0.56;
const MAX_SIDE_COUNT_DIFF = 2;
const DEATH_SPIN_TOTAL = Math.PI * 4;
const DEATH_SPIN_SPEED = 0.4;
const DEATH_FLIGHT_GRAVITY = 0.72;
const DEBRIS_GRAVITY = 0.42;
const CIRCLE_SIDE: Side = "left";
const SQUARE_SIDE: Side = "right";

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const randomBetween = (min: number, max: number): number =>
  min + Math.random() * (max - min);

const expectedSideForShape = (kind: ShapeKind): Side =>
  kind === "circle" ? CIRCLE_SIDE : SQUARE_SIDE;

const createShapeGraphic = (kind: ShapeKind, size: number): Graphics => {
  const graphic = new Graphics();
  const fillColor = kind === "circle" ? 0x63c6ff : 0xffbd68;
  const borderColor = kind === "circle" ? 0x15233f : 0x41260f;
  const half = size * 0.5;

  if (kind === "circle") {
    graphic.circle(0, 0, half).fill(fillColor);
    graphic.circle(0, 0, half).stroke({ width: 2, color: borderColor });
  } else {
    graphic.roundRect(-half, -half, size, size, 5).fill(fillColor);
    graphic
      .roundRect(-half, -half, size, size, 5)
      .stroke({ width: 2, color: borderColor });
  }

  return graphic;
};

const createPan = (radius: number, color: number): Graphics => {
  const pan = new Graphics();
  pan.circle(0, 0, radius).fill({ color: 0x10213b, alpha: 0.9 });
  pan.circle(0, 0, radius).stroke({ width: 4, color });
  pan
    .rect(-radius * 0.8, -6, radius * 1.6, 12)
    .fill({ color: 0x24395c, alpha: 0.35 });
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
  await app.init({ background: "#0a1120", resizeTo: window, antialias: true });

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

  const leftLabel = new Text("CIRCLES", labelStyle);
  leftLabel.anchor.set(0.5);
  leftLabel.position.set(-PAN_OFFSET, -46);
  scale.addChild(leftLabel);

  const rightLabel = new Text("SQUARES", labelStyle);
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
    `Catch circles on the left and squares on the right. Each correct catch is +1 point. More than ${MAX_SIDE_COUNT_DIFF} pieces off-balance tips instantly. Reach ${TARGET_SCORE} to win.`,
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

  const minScaleX = (): number => PAN_OFFSET + PLAYER_MARGIN;
  const maxScaleX = (): number => app.screen.width - PAN_OFFSET - PLAYER_MARGIN;

  const getPanWorldPosition = (side: Side): { x: number; y: number } => {
    const localX = side === "left" ? -PAN_OFFSET : PAN_OFFSET;
    const position = scale.toGlobal({ x: localX, y: 10 });
    return { x: position.x, y: position.y };
  };

  const drawWorld = (): void => {
    const width = app.screen.width;
    const height = app.screen.height;

    background.clear();
    background.rect(0, 0, width, height).fill(0x0c1528);
    background.rect(0, height * 0.65, width, height * 0.35).fill(0x0f1f3a);
    background.rect(0, height - 120, width, 120).fill(0x172845);

    lanes.clear();
    const leftPan = getPanWorldPosition("left");
    const rightPan = getPanWorldPosition("right");

    lanes.rect(leftPan.x - PAN_RADIUS, 0, PAN_RADIUS * 2, height).fill({
      color: 0x355980,
      alpha: 0.08,
    });
    lanes.rect(rightPan.x - PAN_RADIUS, 0, PAN_RADIUS * 2, height).fill({
      color: 0x805d38,
      alpha: 0.08,
    });
    lanes.circle(leftPan.x, leftPan.y, PAN_RADIUS + 6).stroke({
      width: 2,
      color: 0x69b6ff,
      alpha: 0.45,
    });
    lanes.circle(rightPan.x, rightPan.y, PAN_RADIUS + 6).stroke({
      width: 2,
      color: 0xffbb66,
      alpha: 0.45,
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
    leftWeight = 0;
    rightWeight = 0;
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
    const stack = side === "left" ? leftStack : rightStack;
    const localPanX = side === "left" ? -PAN_OFFSET : PAN_OFFSET;
    const stackHeight = getStackHeight(stack);
    const landingLocalY = 10 - PAN_RADIUS - incomingSize * 0.5 - stackHeight;
    const position = scale.toGlobal({ x: localPanX, y: landingLocalY });
    return { x: position.x, y: position.y };
  };

  const createFallingItem = (): FallingItem => {
    const size = randomBetween(16, 58);
    const kind: ShapeKind = Math.random() < 0.5 ? "circle" : "square";
    const speedBoost = Math.min(score * 0.012, 1.8);
    const speed = randomBetween(2.6, 5.0) + speedBoost;
    const graphic = createShapeGraphic(kind, size);

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
      const stack = side === "left" ? leftStack : rightStack;
      const sidePush = side === "left" ? -1 : 1;
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
    leftWeight = 0;
    rightWeight = 0;
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
    const stack = side === "left" ? leftStack : rightStack;
    const localPanX = side === "left" ? -PAN_OFFSET : PAN_OFFSET;
    const stackHeight = getStackHeight(stack);
    const stackedGraphic = createShapeGraphic(item.kind, item.size);

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

    if (side === "left") {
      leftWeight += stackedItem.weight;
    } else {
      rightWeight += stackedItem.weight;
    }

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
      const spawnInterval = Math.max(
        MIN_SPAWN_INTERVAL_MS,
        BASE_SPAWN_INTERVAL_MS - score * 6,
      );
      while (spawnTimerMs >= spawnInterval) {
        spawnTimerMs -= spawnInterval;
        spawnItem();
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
            showFeedback("Wrong pan! Rejected.", 0xffb780);
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
      if (countImbalance > MAX_SIDE_COUNT_DIFF) {
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

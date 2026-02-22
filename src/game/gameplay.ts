import Phaser from "phaser";
import {
  BASE_SPAWN_INTERVAL_MS,
  BURST_SPAWN_BASE_CHANCE,
  BURST_SPAWN_MAX_CHANCE,
  BURST_SPAWN_SCORE_FACTOR,
  CATCH_HORIZONTAL_WINDOW_RATIO,
  CATCH_VERTICAL_WINDOW_MIN,
  CATCH_VERTICAL_WINDOW_MULTIPLIER,
  DUCK_FALLING_ROTATION_MAX,
  DUCK_FALLING_ROTATION_MIN,
  FALLING_ITEM_MAX_SIZE,
  FALLING_ITEM_MIN_SIZE,
  FALLING_SPEED_BOOST_MAX,
  FALLING_SPEED_BOOST_PER_SCORE,
  FALLING_SPEED_MAX,
  FALLING_SPEED_MIN,
  JAM_FALLING_ROTATION_MAX,
  JAM_FALLING_ROTATION_MIN,
  MIN_SPAWN_INTERVAL_MS,
  PAN_OFFSET,
  PAN_RADIUS,
  SPAWN_RAMP_PER_SCORE_MS,
  STACKED_ROTATION_MAX,
  STACKED_ROTATION_MIN,
  STACK_COMPRESSION,
  randomBetween,
  type FallingItem,
  type ShapeKind,
  type Side,
  type StackedItem,
} from "./constants";

export const panXForSide = (side: Side): number =>
  side === "left" ? -PAN_OFFSET : PAN_OFFSET;

export const pushForSide = (side: Side): number => (side === "left" ? -1 : 1);

export const stackForSide = (
  side: Side,
  leftStack: StackedItem[],
  rightStack: StackedItem[],
): StackedItem[] => (side === "left" ? leftStack : rightStack);

export const spawnIntervalForScore = (value: number): number =>
  Math.max(
    MIN_SPAWN_INTERVAL_MS,
    BASE_SPAWN_INTERVAL_MS - value * SPAWN_RAMP_PER_SCORE_MS,
  );

export const burstChanceForScore = (value: number): number =>
  Math.min(
    BURST_SPAWN_MAX_CHANCE,
    BURST_SPAWN_BASE_CHANCE + value * BURST_SPAWN_SCORE_FACTOR,
  );

export const getStackHeight = (stack: StackedItem[]): number =>
  stack.reduce(
    (height, stacked) => height + stacked.size * STACK_COMPRESSION + 2,
    0,
  );

export const getWeightDelta = (
  leftStack: StackedItem[],
  rightStack: StackedItem[],
): number => {
  const leftWeight = leftStack.reduce(
    (weight, stacked) => weight + stacked.size,
    0,
  );
  const rightWeight = rightStack.reduce(
    (weight, stacked) => weight + stacked.size,
    0,
  );
  return rightWeight - leftWeight;
};

export const getWeightImbalance = (
  leftStack: StackedItem[],
  rightStack: StackedItem[],
): number => Math.abs(getWeightDelta(leftStack, rightStack));

const createShapeSprite = (
  scene: Phaser.Scene,
  kind: ShapeKind,
  size: number,
): Phaser.GameObjects.Image => {
  const sprite = scene.add.image(0, 0, kind);
  sprite.setOrigin(0.5);

  const longestSide = Math.max(sprite.width || 1, sprite.height || 1);
  sprite.setScale(size / longestSide);

  if (kind === "duck") {
    sprite.setFlipX(Math.random() < 0.5);
    sprite.rotation = randomBetween(
      DUCK_FALLING_ROTATION_MIN,
      DUCK_FALLING_ROTATION_MAX,
    );
  } else {
    sprite.setFlipX(false);
    sprite.rotation = randomBetween(
      JAM_FALLING_ROTATION_MIN,
      JAM_FALLING_ROTATION_MAX,
    );
  }

  return sprite;
};

export const createFallingItem = (
  scene: Phaser.Scene,
  itemLayer: Phaser.GameObjects.Container,
  score: number,
): FallingItem => {
  const size = randomBetween(FALLING_ITEM_MIN_SIZE, FALLING_ITEM_MAX_SIZE);
  const kind: ShapeKind = Math.random() < 0.5 ? "duck" : "jam";
  const speedBoost = Math.min(
    score * FALLING_SPEED_BOOST_PER_SCORE,
    FALLING_SPEED_BOOST_MAX,
  );
  const speed =
    randomBetween(FALLING_SPEED_MIN, FALLING_SPEED_MAX) + speedBoost;

  const sprite = createShapeSprite(scene, kind, size);
  sprite.x = randomBetween(
    size * 0.5 + 10,
    scene.scale.width - size * 0.5 - 10,
  );
  sprite.y = -size;
  itemLayer.add(sprite);

  return {
    sprite,
    kind,
    size,
    speed,
  };
};

export const removeFallingItemAt = (
  fallingItems: FallingItem[],
  index: number,
): FallingItem => {
  const item = fallingItems[index];
  item.sprite.destroy();
  fallingItems.splice(index, 1);
  return item;
};

export const clearFallingItems = (fallingItems: FallingItem[]): void => {
  for (let index = fallingItems.length - 1; index >= 0; index -= 1) {
    removeFallingItemAt(fallingItems, index);
  }
};

export const getLandingWorldPosition = (
  side: Side,
  incomingSize: number,
  leftStack: StackedItem[],
  rightStack: StackedItem[],
  toWorld: (localX: number, localY: number) => { x: number; y: number },
): { x: number; y: number } => {
  const stack = stackForSide(side, leftStack, rightStack);
  const localPanX = panXForSide(side);
  const stackHeight = getStackHeight(stack);
  const landingLocalY = 10 - PAN_RADIUS - incomingSize * 0.5 - stackHeight;
  return toWorld(localPanX, landingLocalY);
};

export const tryCatchItem = (
  item: FallingItem,
  deltaTime: number,
  leftLanding: { x: number; y: number },
  rightLanding: { x: number; y: number },
): Side | null => {
  const horizontalWindow =
    PAN_RADIUS * CATCH_HORIZONTAL_WINDOW_RATIO + item.size * 0.42;
  const verticalWindow = Math.max(
    CATCH_VERTICAL_WINDOW_MIN,
    item.speed * deltaTime * CATCH_VERTICAL_WINDOW_MULTIPLIER,
  );

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
};

export const randomStackedRotation = (): number =>
  randomBetween(STACKED_ROTATION_MIN, STACKED_ROTATION_MAX);

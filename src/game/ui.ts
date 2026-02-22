import Phaser from "phaser";
import { RETRO_FONT, RETRO_PALETTE } from "./constants";

const DAY_NIGHT_CYCLE_MS = 120_000;
const CELESTIAL_PHASE_OFFSET = 0;
const NIGHT_START_DAY_AMOUNT = 0.08;
const DAY_START_DAY_AMOUNT = 0.72;
const STAR_FADE_START_PHASE = 0.46;
const STAR_FADE_END_PHASE = 0.74;
const FIRST_START_OFFSET_MS = 20_000;
const SUN_X_RATIO = 0.76;
const MOON_X_RATIO = 0.74;
const CELESTIAL_DRIFT_RATIO = 0.065;

let hasAppliedFirstStartOffset = false;

const NIGHT_PALETTE = {
  skyTop: 0x102455,
  skyBottom: 0x1a1039,
  horizon: 0x22194f,
  skyline: 0x17142f,
  ground: 0x120f24,
  frame: 0x20183b,
  moon: 0xbcc8d7,
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const lerp = (from: number, to: number, amount: number): number =>
  from + (to - from) * amount;

const easeInOutSine = (value: number): number =>
  0.5 - 0.5 * Math.cos(Math.PI * clamp01(value));

const mixColor = (from: number, to: number, amount: number): number => {
  const red = Math.round(lerp((from >> 16) & 0xff, (to >> 16) & 0xff, amount));
  const green = Math.round(lerp((from >> 8) & 0xff, (to >> 8) & 0xff, amount));
  const blue = Math.round(lerp(from & 0xff, to & 0xff, amount));
  return (red << 16) | (green << 8) | blue;
};

export const drawRetroBackground = (
  graphics: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  timeMs = performance.now(),
): void => {
  const phase =
    ((timeMs % DAY_NIGHT_CYCLE_MS) / DAY_NIGHT_CYCLE_MS +
      CELESTIAL_PHASE_OFFSET) %
    1;
  const nightProgress = phase >= 0.5 ? (phase - 0.5) / 0.5 : 0;
  const dayProgress = phase < 0.5 ? phase / 0.5 : 0;
  let dayAmount = 0;
  if (phase < 0.5) {
    if (dayProgress < 0.5) {
      const toMidDay = easeInOutSine(dayProgress / 0.5);
      dayAmount = lerp(DAY_START_DAY_AMOUNT, 1, toMidDay);
    } else {
      const fromMidDay = easeInOutSine((dayProgress - 0.5) / 0.5);
      dayAmount = lerp(1, NIGHT_START_DAY_AMOUNT, fromMidDay);
    }
  } else if (nightProgress < 0.5) {
    const toMidNight = easeInOutSine(nightProgress / 0.5);
    dayAmount = lerp(NIGHT_START_DAY_AMOUNT, 0, toMidNight);
  } else {
    const fromMidNight = easeInOutSine((nightProgress - 0.5) / 0.5);
    dayAmount = lerp(0, DAY_START_DAY_AMOUNT, fromMidNight);
  }

  const nightAmount = 1 - dayAmount;
  const twilightAmount = 1 - Math.abs(dayAmount * 2 - 1);

  const skyTop = mixColor(
    NIGHT_PALETTE.skyTop,
    RETRO_PALETTE.skyTop,
    dayAmount,
  );
  const skyBottom = mixColor(
    NIGHT_PALETTE.skyBottom,
    RETRO_PALETTE.skyBottom,
    dayAmount,
  );
  const horizonColor = mixColor(
    NIGHT_PALETTE.horizon,
    RETRO_PALETTE.horizon,
    dayAmount,
  );
  const skylineColor = mixColor(
    NIGHT_PALETTE.skyline,
    RETRO_PALETTE.skyline,
    dayAmount,
  );
  const groundColor = mixColor(
    NIGHT_PALETTE.ground,
    RETRO_PALETTE.ground,
    dayAmount,
  );
  const frameColor = mixColor(
    NIGHT_PALETTE.frame,
    RETRO_PALETTE.frame,
    dayAmount,
  );

  graphics
    .fillGradientStyle(skyTop, skyTop, skyBottom, skyBottom, 1)
    .fillRect(0, 0, width, height);

  const skylineBaseY = height * 0.74;
  const buildingWidth = Math.max(34, Math.floor(width / 17));
  const buildingHeights = [74, 46, 58, 88, 64, 96, 52, 80, 68, 104];
  const tallestBuilding = Math.max(...buildingHeights);
  const horizonY = skylineBaseY - tallestBuilding - 14;
  const horizonHeight = skylineBaseY - horizonY;

  const starsProgress = clamp01(
    (phase - STAR_FADE_START_PHASE) /
      (STAR_FADE_END_PHASE - STAR_FADE_START_PHASE),
  );
  const starsFade = easeInOutSine(starsProgress);
  const starsAlpha = nightAmount * 0.8 * starsFade;
  if (starsAlpha > 0.03) {
    graphics.fillStyle(0xf7f8ff, starsAlpha);
    for (let index = 0; index < 26; index += 1) {
      const normalizedX = ((index * 137 + 71) % 997) / 997;
      const normalizedY = ((index * 283 + 109) % 997) / 997;
      const x = width * (0.03 + normalizedX * 0.94);
      const y = height * (0.05 + normalizedY * 0.38);
      const size = index % 5 === 0 ? 2.2 : 1.4;
      graphics.fillCircle(x, y, size);
    }
  }

  const sunRadius = Math.min(92, height * 0.14);
  const moonRadius = sunRadius * 0.65;
  const sunStartY = -sunRadius * 1.4;
  const sunEndY = horizonY + sunRadius;
  const moonStartY = -moonRadius * 1.6;
  const moonEndY = horizonY + moonRadius;

  const sunProgress = easeInOutSine(phase < 0.5 ? phase / 0.5 : 1);
  const moonProgress = easeInOutSine(phase >= 0.5 ? (phase - 0.5) / 0.5 : 0);

  const sunDrift = width * CELESTIAL_DRIFT_RATIO * (sunProgress - 0.5);
  const moonDrift = width * CELESTIAL_DRIFT_RATIO * (moonProgress - 0.5);
  const sunX = width * SUN_X_RATIO + sunDrift;
  const sunY = lerp(sunStartY, sunEndY, sunProgress);
  const moonX = width * MOON_X_RATIO + moonDrift;
  const moonY = lerp(moonStartY, moonEndY, moonProgress);

  if (phase < 0.5 && sunY + sunRadius > 0) {
    graphics
      .fillStyle(RETRO_PALETTE.sun, 0.95)
      .fillCircle(sunX, sunY, sunRadius);
    graphics.lineStyle(2, RETRO_PALETTE.sunLine, 0.62);
    for (let offset = -26; offset <= 26; offset += 11) {
      const y = sunY + offset;
      const halfWidth = Math.sqrt(
        Math.max(0, sunRadius * sunRadius - offset * offset),
      );
      graphics.lineBetween(sunX - halfWidth, y, sunX + halfWidth, y);
    }
  }

  if (phase >= 0.5 && moonY + moonRadius > 0) {
    graphics
      .fillStyle(NIGHT_PALETTE.moon, 0.62)
      .fillCircle(moonX, moonY, moonRadius);
    graphics.fillStyle(0x8c9bb3, 0.36);
    graphics.fillCircle(moonX - moonRadius * 0.22, moonY - moonRadius * 0.1, 5);
    graphics.fillCircle(moonX + moonRadius * 0.2, moonY + moonRadius * 0.18, 4);
  }

  // Everything below horizon is occluded so celestial bodies are sliced at the line.
  graphics.fillStyle(skyBottom, 1);
  graphics.fillRect(0, horizonY, width, height - horizonY);

  graphics.fillStyle(horizonColor, 1);
  graphics.fillRect(0, horizonY, width, horizonHeight);

  graphics.fillStyle(skylineColor, 0.58 + dayAmount * 0.16);
  for (let x = 0; x < width + buildingWidth; x += buildingWidth) {
    const heightIndex = Math.floor(x / buildingWidth) % buildingHeights.length;
    const buildingHeight = buildingHeights[heightIndex];
    graphics.fillRect(
      x,
      skylineBaseY - buildingHeight,
      buildingWidth - 3,
      buildingHeight,
    );
  }

  graphics.fillStyle(groundColor, 0.95).fillRect(0, height - 108, width, 108);

  graphics.fillStyle(frameColor, 0.06 + twilightAmount * 0.02);
  for (let y = 0; y < height; y += 7) {
    graphics.fillRect(0, y, width, 2);
  }
};

export const createRetroBackground = (
  scene: Phaser.Scene,
  _width?: number,
  _height?: number,
): void => {
  void _width;
  void _height;

  const bg = scene.add.graphics();
  bg.setDepth(-1);
  const cycleStartOffsetMs = hasAppliedFirstStartOffset
    ? 0
    : FIRST_START_OFFSET_MS;
  hasAppliedFirstStartOffset = true;

  const redraw = (): void => {
    bg.clear();
    drawRetroBackground(
      bg,
      scene.scale.width,
      scene.scale.height,
      scene.time.now + cycleStartOffsetMs,
    );
  };

  redraw();

  scene.events.on(Phaser.Scenes.Events.UPDATE, redraw);
  scene.scale.on(Phaser.Scale.Events.RESIZE, redraw);

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, redraw);
    scene.scale.off(Phaser.Scale.Events.RESIZE, redraw);
  });
};

export const createRetroButton = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
): Phaser.GameObjects.Text => {
  const button = scene.add.text(x, y, label, {
    fontFamily: RETRO_FONT,
    fontSize: "32px",
    color: "#fff6e5",
    stroke: "#2e1b19",
    strokeThickness: 4,
    backgroundColor: RETRO_PALETTE.buttonBase,
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
    button.setBackgroundColor(RETRO_PALETTE.buttonHover);
  });

  button.on("pointerout", () => {
    button.setBackgroundColor(RETRO_PALETTE.buttonBase);
  });

  button.on("pointerdown", () => {
    button.setBackgroundColor(RETRO_PALETTE.buttonPressed);
  });

  button.on("pointerup", () => {
    button.setBackgroundColor(RETRO_PALETTE.buttonHover);
    onClick();
  });

  return button;
};

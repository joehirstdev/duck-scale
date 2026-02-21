import Phaser from "phaser";
import { RETRO_FONT, RETRO_PALETTE } from "./constants";

export const createRetroBackground = (
  scene: Phaser.Scene,
  width: number,
  height: number,
): void => {
  const bg = scene.add.graphics();
  bg.fillGradientStyle(
    RETRO_PALETTE.skyTop,
    RETRO_PALETTE.skyTop,
    RETRO_PALETTE.skyBottom,
    RETRO_PALETTE.skyBottom,
    1,
  );
  bg.fillRect(0, 0, width, height);

  const sunX = width * 0.76;
  const sunY = height * 0.26;
  const sunRadius = Math.min(92, height * 0.14);
  bg.fillStyle(RETRO_PALETTE.sun, 0.94).fillCircle(sunX, sunY, sunRadius);

  bg.lineStyle(2, RETRO_PALETTE.sunLine, 0.62);
  for (let offset = -26; offset <= 26; offset += 11) {
    const y = sunY + offset;
    const halfWidth = Math.sqrt(
      Math.max(0, sunRadius * sunRadius - offset * offset),
    );
    bg.lineBetween(sunX - halfWidth, y, sunX + halfWidth, y);
  }

  bg.fillStyle(RETRO_PALETTE.horizon, 0.75);
  bg.fillRect(0, height * 0.58, width, height * 0.16);

  const skylineBaseY = height * 0.74;
  const buildingWidth = Math.max(34, Math.floor(width / 17));
  const buildingHeights = [74, 46, 58, 88, 64, 96, 52, 80, 68, 104];
  bg.fillStyle(RETRO_PALETTE.skyline, 0.9);
  for (let x = 0; x < width + buildingWidth; x += buildingWidth) {
    const heightIndex = Math.floor(x / buildingWidth) % buildingHeights.length;
    const buildingHeight = buildingHeights[heightIndex];
    bg.fillRect(
      x,
      skylineBaseY - buildingHeight,
      buildingWidth - 3,
      buildingHeight,
    );
  }

  bg.fillStyle(RETRO_PALETTE.ground, 0.96).fillRect(
    0,
    height - 108,
    width,
    108,
  );

  bg.fillStyle(RETRO_PALETTE.frame, 0.12);
  for (let y = 0; y < height; y += 7) {
    bg.fillRect(0, y, width, 2);
  }

  bg.setDepth(-1);
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

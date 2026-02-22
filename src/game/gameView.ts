import Phaser from "phaser";
import {
  PAN_OFFSET,
  PAN_RADIUS,
  RETRO_FONT,
  RETRO_PALETTE,
  type Side,
} from "./constants";
import { drawRetroBackground } from "./ui";

export interface ScaleParts {
  balanceScale: Phaser.GameObjects.Container;
  balanceDialNeedle: Phaser.GameObjects.Graphics;
}

export interface GameOverUi {
  container: Phaser.GameObjects.Container;
  title: Phaser.GameObjects.Text;
  score: Phaser.GameObjects.Text;
  badge: Phaser.GameObjects.Text;
  retryText: Phaser.GameObjects.Text;
  menuText: Phaser.GameObjects.Text;
  leaderboardText: Phaser.GameObjects.Text;
}

export interface PauseUi {
  container: Phaser.GameObjects.Container;
  backdrop: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  resumeText: Phaser.GameObjects.Text;
  menuText: Phaser.GameObjects.Text;
}

const createPan = (
  scene: Phaser.Scene,
  x: number,
  color: number,
): Phaser.GameObjects.Graphics => {
  const pan = scene.add.graphics();
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
};

export const createScale = (scene: Phaser.Scene): ScaleParts => {
  const balanceScale = scene.add.container(0, 0);

  const beam = scene.add.graphics();
  beam.fillStyle(0xffd992).fillRoundedRect(-128, -20, 256, 10, 6);
  beam.lineStyle(2, 0x8d5b3d).strokeRoundedRect(-128, -20, 256, 10, 6);
  balanceScale.add(beam);

  const support = scene.add.graphics();
  support.fillStyle(0xf6c776).fillRoundedRect(-14, -20, 28, 66, 8);
  support.fillStyle(0xf6c776).fillRect(-4, -50, 8, 30);
  support.fillStyle(0x5f324d).fillRoundedRect(-56, 42, 112, 18, 8);
  support.lineStyle(2, 0x30172a).strokeRoundedRect(-56, 42, 112, 18, 8);
  balanceScale.add(support);

  const leftArm = scene.add.graphics();
  leftArm.fillStyle(0xf0be7a).fillRect(-PAN_OFFSET, -15, 3, 26);
  balanceScale.add(leftArm);

  const rightArm = scene.add.graphics();
  rightArm.fillStyle(0xf0be7a).fillRect(PAN_OFFSET - 3, -15, 3, 26);
  balanceScale.add(rightArm);

  const dial = scene.add.container(0, -6);
  const radius = 18;
  const start = Math.PI * 0.25;
  const end = Math.PI * 0.75;

  const face = scene.add.graphics();
  face.fillStyle(0xfff3d4, 0.93);
  face.beginPath();
  face.moveTo(0, 0);
  face.arc(0, 0, radius, start, end, false);
  face.closePath();
  face.fillPath();
  face.lineStyle(2, 0x5e3a2f, 1);
  face.beginPath();
  face.arc(0, 0, radius, start, end, false);
  face.strokePath();

  const balanceDialNeedle = scene.add.graphics();
  balanceDialNeedle.lineStyle(3, 0xd54f45, 1);
  balanceDialNeedle.lineBetween(0, 0, 0, 14);
  balanceDialNeedle.fillStyle(0x632d26, 1).fillCircle(0, 0, 3);

  dial.add(face);
  dial.add(balanceDialNeedle);
  balanceScale.add(dial);

  balanceScale.add(createPan(scene, -PAN_OFFSET, 0xffd789));
  balanceScale.add(createPan(scene, PAN_OFFSET, 0xff8c74));

  const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: RETRO_FONT,
    fontSize: "20px",
    color: "#fff2cd",
    stroke: "#2f1a1b",
    strokeThickness: 4,
    fontStyle: "bold",
  };

  const leftLabel = scene.add.text(-PAN_OFFSET, -46, "DUCKS", labelStyle);
  leftLabel.setOrigin(0.5);
  balanceScale.add(leftLabel);

  const rightLabel = scene.add.text(PAN_OFFSET, -46, "JAM", labelStyle);
  rightLabel.setOrigin(0.5);
  balanceScale.add(rightLabel);

  return { balanceScale, balanceDialNeedle };
};

export const createGameOverUi = (scene: Phaser.Scene): GameOverUi => {
  const title = scene.add.text(0, 0, "GAME OVER", {
    fontFamily: RETRO_FONT,
    fontSize: "64px",
    color: "#ff6a74",
    stroke: "#220b11",
    strokeThickness: 7,
    fontStyle: "bold",
  });
  title.setOrigin(0.5);

  const score = scene.add.text(0, 0, "Score: 0", {
    fontFamily: RETRO_FONT,
    fontSize: "34px",
    color: "#ffe39f",
    stroke: "#1f1018",
    strokeThickness: 5,
    fontStyle: "bold",
  });
  score.setOrigin(0.5);

  const badge = scene.add.text(0, 0, "NEW HIGH SCORE!", {
    fontFamily: RETRO_FONT,
    fontSize: "30px",
    color: "#ff77ce",
    stroke: "#2b1030",
    strokeThickness: 5,
    fontStyle: "bold",
  });
  badge.setOrigin(0.5);
  badge.setVisible(false);

  const retryText = scene.add.text(0, 0, "Press SPACE to retry", {
    fontFamily: RETRO_FONT,
    fontSize: "24px",
    color: "#fff4df",
    stroke: "#1c111a",
    strokeThickness: 4,
  });
  retryText.setOrigin(0.5);

  const menuText = scene.add.text(0, 0, "Press M for main menu", {
    fontFamily: RETRO_FONT,
    fontSize: "24px",
    color: "#fff4df",
    stroke: "#1c111a",
    strokeThickness: 4,
  });
  menuText.setOrigin(0.5);

  const leaderboardText = scene.add.text(0, 0, "Press L to view leaderboard", {
    fontFamily: RETRO_FONT,
    fontSize: "24px",
    color: "#fff4df",
    stroke: "#1c111a",
    strokeThickness: 4,
  });
  leaderboardText.setOrigin(0.5);

  const container = scene.add.container(0, 0, [
    title,
    score,
    badge,
    retryText,
    menuText,
    leaderboardText,
  ]);
  container.setDepth(2100);
  container.setVisible(false);

  return {
    container,
    title,
    score,
    badge,
    retryText,
    menuText,
    leaderboardText,
  };
};

export const createPauseUi = (scene: Phaser.Scene): PauseUi => {
  const backdrop = scene.add.rectangle(
    0,
    0,
    scene.scale.width,
    scene.scale.height,
    0x000000,
    0.62,
  );
  backdrop.setOrigin(0, 0);

  const title = scene.add.text(0, 0, "GAME PAUSED", {
    fontFamily: RETRO_FONT,
    fontSize: "64px",
    color: "#ffe39d",
    stroke: "#2a1618",
    strokeThickness: 7,
    fontStyle: "bold",
  });
  title.setOrigin(0.5);

  const resumeText = scene.add.text(0, 0, "Press SPACE or ESC to continue", {
    fontFamily: RETRO_FONT,
    fontSize: "24px",
    color: "#fff4de",
    stroke: "#24151b",
    strokeThickness: 5,
  });
  resumeText.setOrigin(0.5);

  const menuText = scene.add.text(0, 0, "Press M for main menu", {
    fontFamily: RETRO_FONT,
    fontSize: "24px",
    color: "#fff4de",
    stroke: "#24151b",
    strokeThickness: 5,
  });
  menuText.setOrigin(0.5);

  const container = scene.add.container(0, 0, [
    backdrop,
    title,
    resumeText,
    menuText,
  ]);
  container.setDepth(2000);
  container.setVisible(false);

  return {
    container,
    backdrop,
    title,
    resumeText,
    menuText,
  };
};

export const localToWorld = (
  balanceScale: Phaser.GameObjects.Container,
  localX: number,
  localY: number,
): { x: number; y: number } => {
  const cos = Math.cos(balanceScale.rotation);
  const sin = Math.sin(balanceScale.rotation);

  return {
    x: balanceScale.x + localX * cos - localY * sin,
    y: balanceScale.y + localX * sin + localY * cos,
  };
};

export const getPanWorldPosition = (
  balanceScale: Phaser.GameObjects.Container,
  side: Side,
): { x: number; y: number } => {
  const panX = side === "left" ? -PAN_OFFSET : PAN_OFFSET;
  return localToWorld(balanceScale, panX, 10);
};

export const drawWorld = (
  scene: Phaser.Scene,
  background: Phaser.GameObjects.Graphics,
  lanes: Phaser.GameObjects.Graphics,
  balanceScale: Phaser.GameObjects.Container,
): void => {
  const width = scene.scale.width;
  const height = scene.scale.height;

  background.clear();
  drawRetroBackground(background, width, height);

  lanes.clear();
  const leftPan = getPanWorldPosition(balanceScale, "left");
  const rightPan = getPanWorldPosition(balanceScale, "right");

  lanes
    .fillStyle(RETRO_PALETTE.laneDuck, 0.15)
    .fillRect(leftPan.x - PAN_RADIUS, 0, PAN_RADIUS * 2, height);
  lanes
    .fillStyle(RETRO_PALETTE.laneJam, 0.15)
    .fillRect(rightPan.x - PAN_RADIUS, 0, PAN_RADIUS * 2, height);
};

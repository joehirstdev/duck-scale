import Phaser from "phaser";

export type Side = "left" | "right";
export type ShapeKind = "duck" | "jam";

export interface FallingItem {
  sprite: Phaser.GameObjects.Image;
  kind: ShapeKind;
  size: number;
  speed: number;
}

export interface StackedItem {
  sprite: Phaser.GameObjects.Image;
  size: number;
}

export interface LooseBlock {
  sprite: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  spin: number;
}

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 640;

export const PLAYER_SPEED = 11;
export const PAN_OFFSET = 92;
export const PAN_RADIUS = 38;
export const FALLING_ITEM_MIN_SIZE = 28;
export const FALLING_ITEM_MAX_SIZE = 56;
export const BASE_SPAWN_INTERVAL_MS = 500;
export const MIN_SPAWN_INTERVAL_MS = 170;
export const SPAWN_RAMP_PER_SCORE_MS = 10;
export const BURST_SPAWN_BASE_CHANCE = 0.12;
export const BURST_SPAWN_SCORE_FACTOR = 0.005;
export const BURST_SPAWN_MAX_CHANCE = 0.42;
export const FEEDBACK_DURATION_MS = 760;
export const STACK_COMPRESSION = 0.56;
export const MAX_WEIGHT_IMBALANCE = 100;
export const DEATH_SPIN_TOTAL = Math.PI * 6;
export const DEATH_SPIN_SPEED = 0.4;
export const DEATH_FLIGHT_GRAVITY = 0.72;
export const DEBRIS_GRAVITY = 0.42;
export const DUCK_SIDE: Side = "left";
export const JAM_SIDE: Side = "right";

export const RETRO_FONT = '"Courier New", monospace';
export const RETRO_PALETTE = {
  skyTop: 0xf5b36a,
  skyBottom: 0x6a4e9c,
  sun: 0xffe8a5,
  sunLine: 0xffbf72,
  horizon: 0x4c2f66,
  skyline: 0x302043,
  ground: 0x1a132d,
  frame: 0x2b1d40,
  laneDuck: 0xffd789,
  laneJam: 0xff8c74,
  buttonBase: "#c55b50",
  buttonHover: "#de7d70",
  buttonPressed: "#9f3c35",
};

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const randomBetween = (min: number, max: number): number =>
  min + Math.random() * (max - min);

export const expectedSideForShape = (kind: ShapeKind): Side =>
  kind === "duck" ? DUCK_SIDE : JAM_SIDE;

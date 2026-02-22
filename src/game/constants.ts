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

export const SCALE_BASELINE_OFFSET = 88;
export const SOUNDTRACK_VOLUME = 0.35;
export const QUACK_SFX_VOLUME = 0.12;
export const GLASS_BREAK_SFX_VOLUME = 0.35;
export const SUCCESS_SFX_VOLUME = 0.8;
export const LOSE_SFX_VOLUME = 0.15;
export const DIAL_MAX_NEEDLE_ANGLE = 0.72;
export const DIAL_NEEDLE_LERP = 0.18;
export const MAX_FRAME_DELTA_MS = 50;
export const MAX_SPAWNS_PER_FRAME = 4;
export const MAX_SPAWN_BACKLOG_INTERVALS = 2;
export const FALLING_SPEED_MIN = 4.6;
export const FALLING_SPEED_MAX = 7.8;
export const FALLING_SPEED_BOOST_PER_SCORE = 0.02;
export const FALLING_SPEED_BOOST_MAX = 3.4;
export const DUCK_FALLING_ROTATION_MIN = -0.2;
export const DUCK_FALLING_ROTATION_MAX = 0.2;
export const JAM_FALLING_ROTATION_MIN = -0.14;
export const JAM_FALLING_ROTATION_MAX = 0.14;
export const STACKED_ROTATION_MIN = -0.14;
export const STACKED_ROTATION_MAX = 0.14;
export const CATCH_HORIZONTAL_WINDOW_RATIO = 0.9;
export const CATCH_VERTICAL_WINDOW_MULTIPLIER = 2.4;
export const CATCH_VERTICAL_WINDOW_MIN = 16;
export const BALANCE_ROTATION_DIVISOR = 240;
export const BALANCE_ROTATION_MAX = 0.36;

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

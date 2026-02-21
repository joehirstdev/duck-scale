import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "./game/constants";
import { GameScene } from "./scenes/GameScene";
import { LeaderboardScene } from "./scenes/LeaderboardScene";
import { MainMenuScene } from "./scenes/MainMenuScene";

const mountPoint = document.getElementById("pixi-container");
if (!mountPoint) {
  throw new Error("Missing #pixi-container mount point.");
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: mountPoint,
  backgroundColor: "#120d1f",
  pixelArt: true,
  scene: [MainMenuScene, GameScene, LeaderboardScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.destroy(true);
  });
}

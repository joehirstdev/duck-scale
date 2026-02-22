# Duck Scale

Retro arcade balancing game made for [Duck Sauce Games 2026](https://www.ducksauce.games/) (theme: "scale").

Built with TypeScript and Phaserjs, using Vite for bundling, Bun for package management, and hosted on Cloudflare.

## Play Online

[Play Duck Scale](https://duckscale.joehirst.dev/)

## Gameplay

- Move left/right to position the scale under falling items.
- Catch ducks on the **left** pan and jam on the **right** pan.
- Correct catches add to the stack and increase your score.
- Wrong-side hits knock items off the stack.
- The run ends when the scale gets too imbalanced.
- Scoring is endless, and the top leaderboard scores are saved in browser `localStorage` (local to your browser).
- Retro vaporwave-inspired background with an animated day/night cycle.

## Controls

- Move: `A/D` or `Left/Right Arrow` (also `H/L`)
- Pause: `Esc` or `Q`
- Resume (paused): `Space`, `Enter`, or `Esc`
- Main menu (paused/game over): `M`
- Retry (game over): `Space`, `Enter`, or `R`
- Open leaderboard: `L`

## Project Structure

- `src/main.ts`: Phaser bootstrap and scene registration
- `src/scenes/`: `MainMenuScene`, `GameScene`, `LeaderboardScene`
- `src/game/constants.ts`: gameplay, audio, and tuning constants
- `src/game/gameplay.ts`: spawning, catching, stacking, weight math
- `src/game/gameView.ts`: scale drawing and HUD/overlay UI builders
- `src/game/ui.ts`: shared retro background, buttons, day/night visuals
- `src/game/leaderboard.ts`: localStorage leaderboard read/write
- `public/assets/`: ducks, jam, and audio files
- `src/style.css`: global page styles

## Development

Prerequisite: Bun installed.

```bash
bun install
bun run dev
```

Useful scripts:

- `bun run build`: production build
- `bun run preview`: preview built app
- `bun run preview:cf`: run with Wrangler
- `bun run typecheck`: TypeScript check (`tsc --noEmit`)
- `bun run lint`: Prettier check + ESLint
- `bun run lint:fix`: auto-fix lint issues
- `bun run format`: run Prettier

## Music

Soundtrack by James Boag, produced specifically for this game.

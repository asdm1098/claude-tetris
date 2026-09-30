# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tetris in vanilla JS + HTML5 Canvas. No dependencies, no `package.json`, no build, no tests, no linter. UI text and README are in Spanish.

## Run

Open `index.html` directly, or serve statically: `python -m http.server 8000` → `http://localhost:8000`.

## Architecture

Three files, all logic in `game.js` (single script, global state, no modules):

- `index.html` — fixed DOM ids that `game.js` looks up at load (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`). Renaming an id breaks the game.
- `game.js` — state lives in module-level `let` vars (`board`, `current`, `next`, `score`, ...) reset by `init()`. Board is `ROWS×COLS` matrix; cell = 0 or piece type 1–7, which indexes both `COLORS` and `PIECES`.
- Game loop: `loop()` via `requestAnimationFrame`, accumulates `dropAccum` vs `dropInterval`. Pause/game over stop it with `cancelAnimationFrame(animId)`; resume/restart re-enter via `loop()`/`init()`.
- Piece lifecycle: `lockPiece()` = `merge()` → `clearLines()` → `spawn()`. `spawn()` calls `endGame()` if the new piece collides.
- Canvas size is hardcoded in `index.html` (`300×600` = `COLS×BLOCK` × `ROWS×BLOCK`); changing `COLS`/`ROWS`/`BLOCK` requires updating it. `next-canvas` is 120×120 (4×4 cells at 30px).
- Rotation: `rotateCW` + simple horizontal kick list `[0,-1,1,-2,2]` in `tryRotate` (not SRS).
- Pause (`// ---- Pausa ----` in `game.js`): `P`/`Escape` toggles `#pause-menu` (ids `pause-*`: Reanudar/Reiniciar/Ver controles/Nivel inicial 1–10); `paused` blocks game keys. `startLevel` seeds `level`/`dropInterval` in `init()`.
- Scoring: `LINE_SCORES × level`; soft drop +1/cell, hard drop +2/cell. Level = `startLevel+floor(lines/10)`; `dropInterval = max(100, 1000-(level-1)*90)`.
- Skins (`// ---- Skins ----` in `game.js`): `SKINS = {retro, neon, pastel, pixel}`, each `{colors, boardBg, grid, drawBlock(ctx,x,y,color,size)}`; global `drawBlock` dispatches to active skin. `<select id="skin-select">` (options built from `SKINS`), persisted in `localStorage['tetris-skin']`, `applySkin()` redraws. `boardBg`/`grid` null = use theme CSS. Retro keeps light/dark palettes; other skins have fixed palettes.
- Records (`// ---- Records ----` in `game.js`): `localStorage['tetris-records']` = `{top:[{name,score}×5], bestCombo, maxLines}`. The overlay doubles as start screen (game waits for "Jugar"; `gameOver=true` until `init()`). `endGame()` → `recordsOnGameOver()` updates bests, shows name form if score qualifies. Combo = consecutive locks clearing ≥1 line (`combo`/`maxCombo`, reset in `init()`). Keydown ignores events from `INPUT`. Extra ids: `records-*`.

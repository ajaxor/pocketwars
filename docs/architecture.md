# Architecture

Plain ES modules, no bundler, no runtime dependencies. Node 22+ is only needed for tests and tools.

```
data/            game content as JSON (units, terrain, factions, rules, ai) and data/maps/*.map.json
src/data/        validate.js, registry.js (frozen lookup of the data), map-format.js, loader.js
src/engine/      pure game rules; no DOM. Game facade + queries, movement, combat, capture, economy, victory, ai
src/render/      canvas drawing: renderer, unit art (unit-art.js), unit-frame.js, unit-sprites.js, terrain sprites (decor and
                 buildings), terrain-styles.js (tile shape and finish, several styles), effects, move animator
src/ui/          controller (taps -> orders), hud, presenter (events -> animations), session (frame loop, AI pacing)
src/main.js      boot(): load data + map, create Game, start Session
index.html       title screen and cache-busting loader (imports src/main.js from the current build folder)
tests/           node --test suites (attributes/, engine/, data/, ui/, render/)
tools/           validate-data.mjs, serve.mjs, sprite-lab/ (offline PNG rendering of unit art styles; see its README)
gallery/         live preview pages published next to the game: unit art (index.html) and terrain styles (terrain.html);
                 both run the game's own render code on canvas
```

## Layers

- **Data -> Registry.** JSON is validated (`validateData`) and frozen into a `Registry`. Every problem is reported at once
  (`DataError`). Nothing in the engine reads raw JSON.
- **Engine.** `Game` is the only thing the UI and AI mutate through:
  `act({unitId, to, action})`, `build(x, y, type)`, `endTurn()`, `undo()`. Each returns `{ok, error?, events}`.
  Events (`move`, `strike`, `capture`, `build`, `turnStart`, `gameOver`) are plain data; the engine never animates or draws.
- **Render / UI.** The `Presenter` turns events into animations. The `Controller` keeps move previews in its own state
  (`dest`), so the engine never sees half-finished moves.
- **Special handling is data.** Engine code asks `hasAttribute(def, 'capture')`; it never compares unit ids.
  See `docs/attributes.md`.

## Terrain tile styles

`src/render/terrain-styles.js` decides how a tile looks (shape, gap, gradient, outline); the decorations and buildings drawn on it
are in `terrain-sprites.js` and are shared by every style. A style is one object in `TILE_STYLES`
(`id`, `name`, `note`, `board`, `face(S)`, `paint(...)`), and `drawTerrainLayer` paints the map with it. The renderer takes the
style id as an option and also uses `face(S)` to shape the reach, target and selection highlights.

The game picks a style from `?tiles=<id>`, otherwise from the choice saved by the gallery (`localStorage`, key
`pocketwars.tiles`), otherwise `DEFAULT_TILE_STYLE`. Compare styles at `gallery/terrain.html`.
`render.height` in `data/terrain.json` (0 to 1, default 1) is how raised a tile is in styles that show height (Tabletop).

## Loading and deploy

`index.html` fetches `version.json` (never cached) and imports `v/<hash>/src/main.js`. The workflow publishes
`src/`, `data/` and `style.css` under `v/<hash>/`, so module imports and JSON fetches (all relative) are cache-busted
together. In dev there is no `version.json`; the loader uses `./` with a timestamp query.

ES modules and `fetch` do not work from `file://`; run `npm start`.

## Testing approach

Attribute tests build tiny synthetic rulesets (`tests/helpers/fixtures.js`) in which two otherwise identical units differ only
in the attribute under test, which proves the attribute (and nothing else) causes the behaviour. Shipped data is covered by
`tests/data/` including a damage table captured from the pre-refactor game.

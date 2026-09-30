# Architecture

Plain ES modules, no bundler, no runtime dependencies. Node 22+ is only needed for tests and tools.

```
data/            game content as JSON (units, terrain, factions, rules, ai) and data/maps/*.map.json
src/data/        validate.js, registry.js (frozen lookup of the data), map-format.js, loader.js
src/engine/      pure game rules; no DOM. Game facade + queries, movement, combat, capture, economy, victory, ai
src/render/      canvas drawing: renderer, unit art (unit-art.js), unit-frame.js, unit-sprites.js, terrain sprites (buildings,
                 flat decor), terrain-layer.js (rounded merged tiles), terrain-themes.js (alternative terrain art), effects, move animator
src/ui/          controller (taps -> orders), hud, presenter (events -> animations), session (frame loop, AI pacing)
src/main.js      boot(): load data + map, create Game, start Session
index.html       title screen and cache-busting loader (imports src/main.js from the current build folder)
tests/           node --test suites (attributes/, engine/, data/, ui/, render/)
tools/           validate-data.mjs, serve.mjs, sprite-lab/ (offline PNG rendering of unit art styles; see its README)
gallery/         live preview pages published next to the game: unit art (index.html) and terrain art themes (terrain.html);
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

## Terrain drawing

`src/render/terrain-layer.js` paints the map: tiles of the same base colour join into one shape and only the outer corners are
rounded (each corner is filled with the colour it opens onto). What is drawn on a tile is a *theme*
(`src/render/terrain-themes.js`): `terrain.json -> render.decor` names a drawing (`grass`, `road`, `forest`, `mountain`, `sea`)
and every theme supplies one function per name, `decor(g, px, py, S, {x, y, now})`, where `x, y` seed per-tile variation and
`now` animates the sea. Buildings (`terrain-sprites.js`) are the same in every theme. A test requires every theme to cover
every decor name the data uses, so a new decor name means adding it to every theme.

The game picks a theme from `?terrain=<id>`, otherwise from the choice saved by the gallery (`localStorage`, key
`pocketwars.terrain`), otherwise `DEFAULT_TERRAIN_THEME`. Compare themes at `gallery/terrain.html`.

## Loading and deploy

`index.html` fetches `version.json` (never cached) and imports `v/<hash>/src/main.js`. The workflow publishes
`src/`, `data/` and `style.css` under `v/<hash>/`, so module imports and JSON fetches (all relative) are cache-busted
together. In dev there is no `version.json`; the loader uses `./` with a timestamp query.

ES modules and `fetch` do not work from `file://`; run `npm start`.

## Testing approach

Attribute tests build tiny synthetic rulesets (`tests/helpers/fixtures.js`) in which two otherwise identical units differ only
in the attribute under test, which proves the attribute (and nothing else) causes the behaviour. Shipped data is covered by
`tests/data/` including a damage table captured from the pre-refactor game.

# Architecture

Plain ES modules, no bundler, no runtime dependencies. Node 22+ is only needed for tests and tools.

```
data/            game content as JSON (units, terrain, factions, rules, ai) and data/maps/*.map.json
src/data/        validate.js, registry.js (frozen lookup of the data), map-format.js, loader.js
src/engine/      pure game rules; no DOM. Game facade + queries, movement, combat, capture, economy, victory, ai
src/render/      canvas drawing: renderer, unit art (unit-art.js), unit-frame.js, unit-sprites.js, buildings.js, color.js,
                 terrain-art.js (trees, mountains, sea), terrain-layer.js (rounded merged tiles), effects, move animator
src/ui/          controller (taps -> orders), hud, presenter (events -> animations), session (frame loop, AI pacing)
src/main.js      boot(): load data + map, create Game, start Session
src/launcher.js  runs after the shell: loads style.css, shows the title screen, loads the game behind it, waits for Start
src/ui/title-screen.js  the title screen view (logo, progress, Start, gallery links, update button); styles are `.title*` in style.css
index.html       tiny shell: the game's DOM plus a few lines that find the build folder and hand over to src/launcher.js
tests/           node --test suites (attributes/, engine/, data/, ui/, render/)
tools/           validate-data.mjs, serve.mjs, sprite-lab/ (offline PNG rendering of unit art styles; see its README)
gallery/         live preview pages published next to the game: unit art (index.html), which runs the game's own
                 render code on canvas and is linked from the title screen
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
rounded (each corner is filled with the colour it opens onto). What is drawn on a tile is in `src/render/terrain-art.js`:
`terrain.json -> render.decor` names a drawing (`grass`, `road`, `forest`, `mountain`, `sea`) and `TERRAIN_DECOR` supplies one
function per name, `decor(g, px, py, S, {x, y, now})`, where `x, y` seed per-tile variation and `now` twinkles the sea. A test
requires a drawing for every decor name the data uses. Buildings (`buildings.js`: flat-shaded boxes seen from the front-left
with a soft ground shadow, one silhouette per kind; the barracks is a three-peaked tent) are drawn on top.

## Loading and deploy

`index.html` is a tiny shell. It fetches `version.json` (never cached) and imports `v/<hash>/src/launcher.js`, which loads
`style.css`, shows the title screen and imports `src/main.js` behind it. The workflow publishes `src/`, `data/` and `style.css`
under `v/<hash>/`, so module imports and JSON fetches (all relative) are cache-busted together. Because the title screen lives in
the build and not in the shell, a stale cached `index.html` cannot hide changes to it. In dev, and on a site served without
`version.json`, the loader uses `./` with a timestamp query and the title screen shows "build dev" (no update button).

To add a button to the title screen, add an entry to `GALLERIES` in `src/launcher.js`.

ES modules and `fetch` do not work from `file://`; run `npm start`.

## Testing approach

Attribute tests build tiny synthetic rulesets (`tests/helpers/fixtures.js`) in which two otherwise identical units differ only
in the attribute under test, which proves the attribute (and nothing else) causes the behaviour. Shipped data is covered by
`tests/data/` including a damage table captured from the pre-refactor game.

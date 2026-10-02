# Architecture

Plain ES modules, no bundler, no runtime dependencies. Node 22+ is only needed for tests and tools.

```
data/            game content as JSON (units, weapons, terrain, factions, rules, ai) and data/maps/*.map.json
src/data/        validate.js, registry.js (frozen lookup of the data), map-format.js, loader.js
src/engine/      pure game rules; no DOM. Game facade + queries, movement, combat, sight (line of sight), capture, economy, victory, ai
src/render/      canvas drawing: renderer, unit art (unit-art.js), unit-frame.js, unit-sprites.js, buildings.js, color.js,
                 terrain-art.js (trees, mountains, sea), terrain-layer.js (rounded merged tiles), effects, move animator
src/ui/          controller (taps -> orders), hud (the windows), kit (buttons/windows/chips), info + build-menu (facts as plain data),
                 presenter (events -> animations), session (frame loop, AI pacing)
src/fonts/       the self-hosted typeface (Fredoka, OFL); declared in style.css, named for canvas text in src/render/font.js
src/main.js      boot(): load data + map, create Game, start Session
src/launcher.js  runs after the shell: loads style.css, shows the title screen, loads the game behind it, waits for Quick Start (a random map)
src/ui/title-screen.js  the title screen view (logo, progress, Quick Start, gallery links, update button); styles are `.title*` in style.css
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
  Events (`move`, `interrupt`, `dive`, `surface`, `strike`, `capture`, `build`, `turnStart`, `eliminated`, `gameOver`) are plain data; the engine never animates or draws.
- **Render / UI.** The `Presenter` turns events into animations. The `Controller` keeps move previews in its own state
  (`dest`), so the engine never sees half-finished moves.
- **Hidden information.** `src/engine/detection.js` (who sees a submerged unit) and `submerge.js` (diving rules) are the only places that
  know; movement, combat, AI, the renderer (`Renderer.viewer`) and the controller all ask `canSee`. A move that hits a hidden unit is
  *interrupted* (see combat.md); the Controller resumes the unit in its act menu and the AI issues a second order.
- **Special handling is data.** Engine code asks `hasAttribute(def, 'capture')`; it never compares unit ids.
  See `docs/attributes.md`.

## UI

The map is one canvas that covers the whole window (`Renderer.fit`): the biggest whole-pixel tile size that fits the board below the
status bar, centred. Everything else floats over it in `#ui`, built by `src/ui/hud.js`:

- **Status bar**, pinned to the top: turn, day, funds, properties, Undo, End turn and a gear that opens the in-game menu (Resume, Reset mission, Quit to title; the last two ask first). Quit calls the host's `onQuit`, which re-shows the title screen.
- **Dock**: a column of windows on the screen edge *away from* the tile being worked on (`Hud.focus` gives the tile, the session turns it
  into `top` or `bottom` with `Session.#placeDock`). Top to bottom of the column: order buttons (or the build menu), the unit and
  terrain info cards, then toasts. The info cards and toasts let taps through to the map; the order buttons and build menu do not.
- **Info cards** show a tapped tile: the unit (HP, move, range, attack, armor, cover, attribute tags, capture progress) and the terrain
  (defense stars, move cost per move class, owner, income, repair, what it builds). When an attack target is picked the card shows the
  enemy with the damage it would take.
- **Build menu**: a row per unit the property can build (picture, move/range/attack, cost); tapping a row selects it and shows its weapon
  and armor; the big button builds it. Units the player cannot pay for are greyed and the button says how much is missing.

What the windows show is computed as plain data in `src/ui/info.js` and `src/ui/build-menu.js` (no DOM, tested directly); the controller
hands those models to the Hud, which owns all DOM. Buttons, windows, chips, stars and meters come from `src/ui/kit.js` and are styled by
the tokens at the top of `style.css`, so a new window looks like the rest without new CSS. Attribute names shown to the player are the
`label` of each attribute in the catalogue (`src/engine/attributes.js`).

## Camera, gestures and skirmish

- `src/render/camera.js` is pure arithmetic: tile size, the map point at the centre, clamping, zoom around a point, `reveal` and easing.
  A map that fits at 36px or more is shown whole; a bigger one scrolls. `Renderer` owns a `Camera` and only draws the visible tiles.
- `src/ui/gestures.js` turns pointer and wheel events into `onTap`, `onPan`, `onZoom` and (optionally) `onHold`; the session decides what they do. Holding during the computer's turn fast-forwards it: the session's clock is a `Pacer` (`src/ui/pacing.js`) that runs four times as fast while held, and every pause in the computer's turn goes through it.
- Leaders speak in battle: `src/campaign/commentary.js` decides what is said and when, `src/ui/commentary-banner.js` shows it, and `main.js` gives the session `voices` (the campaign's speech files). Without a campaign or without leaders on the map nobody speaks.
- `src/data/skirmish.js` holds the skirmish rules (colours, who plays, funds); `src/ui/skirmish-screen.js` shows them with map
  previews from `src/render/minimap.js`. `boot()` returns `{registry, map, maps, defaultMapId, play(map)}` and the launcher calls `play`.
- `data/loadouts.json` gives each leader a kit (build menus and a starting formation); `src/data/formation.js` places the formation around the HQ and `menuFor` in `economy.js` applies the menus. See `docs/leaders.md`.
- With three or more players, capturing an HQ eliminates its owner (`eliminate` in `victory.js`); the last player left wins.

## Terrain drawing

`src/render/terrain-layer.js` paints the map: tiles of the same base colour join into one shape and only the outer corners are
rounded (each corner is filled with the colour it opens onto). What is drawn on a tile is in `src/render/terrain-art.js`:
`terrain.json -> render.decor` names a drawing (`road`, `forest`, `mountain`, `rough`, `sea`, `shoals`; ground.json names `grass` and `dirt`) and `TERRAIN_DECOR` supplies one
function per name, `decor(g, px, py, S, {x, y, now})`, where `x, y` seed per-tile variation and `now` twinkles the sea. A test
requires a drawing for every decor name the data uses. Buildings (`buildings.js`: flat-shaded boxes seen from the front-left
with a soft ground shadow, one silhouette per kind; the barracks is a pair of squat canvas tents with a flag) are drawn on top.

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
`tests/data/` including a damage baseline (`tools/regen-damage-baseline.mjs` rewrites it after a deliberate retune). How damage and
targeting work: `docs/combat.md`.

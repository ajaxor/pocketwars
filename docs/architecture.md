# Architecture

Plain ES modules, no bundler, no runtime dependencies. Node 22+ is only needed for tests and tools.

```
data/            game content as JSON (units, weapons, terrain, factions, rules, ai, ai-strategies) and data/maps/*.map.json
src/data/        validate.js, registry.js (frozen lookup of the data), map-format.js, loader.js
src/engine/      pure game rules; no DOM. Game facade + queries, movement, combat, sight (line of sight), capture, economy, victory,
                 structures (turrets, jammer, cracked walls; neutral fire), fog (fog of war)
src/ai/          computer opponents side by side (docs/ai.md): engines.js (registry), runner.js (plays an engine's steps), greedy.js,
                 strategist/ (the default), evaluate.js (who is ahead), history.js (what it learned about the player)
src/render/      canvas drawing: renderer, unit art (unit-art.js), unit-frame.js, unit-sprites.js, buildings.js, color.js,
                 terrain-art.js (trees, mountains, sea), terrain-layer.js (rounded merged tiles), effects, move animator, arrivals (reinforcements)
src/ui/          controller (taps -> orders), hud (the windows), kit (buttons/windows/chips), info + build-menu (facts as plain data),
                 presenter (events -> animations), session (frame loop, AI pacing)
src/fonts/       the self-hosted typeface (Fredoka, OFL); declared in style.css, named for canvas text in src/render/font.js
src/main.js      boot(): load data + map, create Game, start Session
src/launcher.js  runs after the shell: loads style.css, shows the title screen, loads the game behind it, waits for Quick Start (a random map)
src/editor/      the map editor: model.js (the map being edited, undo, symmetry), palette.js, storage.js (My maps, the draft),
                 editor-screen.js (the page; draws with the game's Renderer)
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
- **Fog of war.** `src/engine/fog.js` works out what each human player sees while a jammer stands; `canSee` (detection.js) applies it, so
  everything that already respected hidden units respects fog. Sight is cached on `game.revision`, which every Game method bumps through
  `game.touch()` (which also records explored tiles in `state.explored`). The renderer greys out explored tiles and blacks out the rest.
- **Structures** (`src/engine/structures.js`): turrets, jammers and cracked walls are units with the `structure` attribute, possibly owned by
  nobody (`owner: null`). Walls are terrain, drawn by `src/render/walls.js` as a layer between the terrain and the units.
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

**Tilesets.** `data/tilesets.json` gives each army a home land (`temperate`, `tundra`, `desert`, `urban`, `jungle`, `ruins`, `islands`, `highlands`, `royal`):
a default ground plus per-terrain overrides `{ name, render: { base, decor, mini, style, group } }`. A tileset is a skin: `registry.skin(tilesetId, terrainId)` is the
terrain with the tileset's name and render options laid over it, and the rules (move costs, defense, attributes) are never touched. A map names its tileset
(`"tileset"`); the renderer, minimap, editor palette and info cards ask `skin`, the engine reads terrain directly. Drawings live in `terrain-art.js` plus
`terrain-wood.js` (round trees, palms, deadwood), `terrain-relief.js` (mesa, towers, spires, cliffs), `terrain-ground.js` (ground textures and soft terrain),
`terrain-ruins.js`; each reads the tileset's `render.style` for its colours. See [terrain.md](terrain.md). `node tools/sprite-lab/terrain.mjs` renders every tileset (or `--map=id`) to PNG.

**Changing terrain.** The map is frozen, but a rebuilt ruin changes a tile, so the game state holds `terrain` (a copy of the map's terrain grid, snapshotted for Undo) and
every rule reads a tile through `queries.terrainIdAt` / `terrainAt`.

## Loading and deploy

`index.html` is a tiny shell. It fetches `version.json` (never cached) and imports `v/<hash>/src/launcher.js`, which loads
`style.css`, shows the title screen and imports `src/main.js` behind it. The workflow publishes `src/`, `data/` and `style.css`
under `v/<hash>/`, so module imports and JSON fetches (all relative) are cache-busted together. Because the title screen lives in
the build and not in the shell, a stale cached `index.html` cannot hide changes to it. In dev, and on a site served without
`version.json`, the loader uses `./` with a timestamp query and the title screen shows "build dev" (no update button).

To add a button to the title screen, add an entry to `GALLERIES` in `src/launcher.js`.

## Map editor

The title screen's **Map editor** opens `src/editor/editor-screen.js` over the title screen (like the skirmish page). It edits an `EditorModel`
(`model.js`: plain mutable grids plus units and players, with snapshot undo/redo) and draws it every frame with the game's own `Renderer`,
fed a throw-away game (`createState` of the model, so cracked walls appear on breakable wall tiles exactly as in play) and stub effects. The
palette (`palette.js`) is read from the registry, so new terrain and units appear in it without editor changes. The map being edited is saved
to localStorage after every change; Save keeps a copy in "My maps", which the skirmish page lists (`customMaps` in `storage.js`); Download
gives the `.map.json` to add to `data/maps/`. Play parses the map (`parseMap`) and hands it to `game.play`, like the skirmish page.

ES modules and `fetch` do not work from `file://`; run `npm start`.

## Testing approach

Attribute tests build tiny synthetic rulesets (`tests/helpers/fixtures.js`) in which two otherwise identical units differ only
in the attribute under test, which proves the attribute (and nothing else) causes the behaviour. Shipped data is covered by
`tests/data/` including a damage baseline (`tools/regen-damage-baseline.mjs` rewrites it after a deliberate retune). How damage and
targeting work: `docs/combat.md`.

## Reinforcements (units arriving from off screen)

`src/render/arrivals.js` animates units sliding onto the map from outside the window, several at once, each on its own path (in tiles, may have
waypoints) and delay. It is purely visual: the units already exist in `game.state`, and the renderer draws a unit that is in `Session.arrivals`
at its place on the way in (and dims no building under it) until it has arrived. `Session.reinforce(units, { from, gap, msPerTile })` plans the
entrances from the current camera (`Renderer.viewBounds()`, `planEntrances`, `entryPath`) and returns a promise that resolves when the last unit is in.

- **Battle opening:** `#intro()` brings in every human player's units while the leaders' opening lines play; input stays locked until both are done. A tap on the map skips the entrance.
- **Scripted events (campaign):** spawn the units into the game state, then `await session.reinforce(spawned, { from: 'left' })` (an edge name, or `(unit) => [[x, y], ...]` for your own route). By default each unit comes from the nearest window edge it can drive in from without turning round. The sequence is on the game clock (`Pacer`), so fast-forward speeds it up too.

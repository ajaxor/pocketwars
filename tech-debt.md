# Tech debt

Code and architecture problems: duplication, hand-placed or tangled code, performance costs, test and tooling gaps. Features, balance work, content and AI capability are in `backlog.md`.

Last sorted 9 October 2026, after a pass through every item. Nothing here is a known bug; every entry is a trade-off that was looked at and left on purpose, with the reason, so it is not rediscovered as "debt" each time. Revisit an entry when its trigger happens.

## Left on purpose (revisit when the trigger happens)

Engine and data
- **Supply and Heal are near-duplicates** (`supply.js`, `heal.js`, buttons, AI scores). They differ in who pays, what they restore (ammo, fuel, HP) and how targets are chosen; a generic "support order" would need a plan/resolve pair with flags for each difference. *Trigger: a third support order.*
- **Fuel and ammo are parallel code** (`fuel.js`, `ammo.js`). A generic meter pays off with a third resource (morale, charge). *Trigger: a third meter.*
- **Structures are units** (turrets, jammer, cracked wall: `structure` attribute, owner `null` when neutral). Code that loops over `state.units` goes through `structures.js`. *Trigger: many more kinds of fixture.*
- **`submerged` is the stored truth for a hidden layer.** Units that live under water for good (hunter sub, mine) are created with it set; `layerIdOf` and the renderer read it. One flag, set in one place (`makeUnit`); a derived value would be a second copy, not a first.
- **`unit.halted` also means "mid-way through several attacks"** (`attacksPerTurn`). Both states have the same meaning for every reader (may act from here, may not move), so the shared field is deliberate; documented in `attributes.js`.
- **Ambush is one global rule** (`rules.ambushMultiplier`, `unit.ambush` set at turn start). A per-unit value waits for a unit that needs a different bonus.
- **New move classes cost a column per terrain** (`diver`, `bike`, `hover`, `amphibious_tread`). Validation now errors when a terrain omits one, so it cannot be forgotten; a per-unit override would only hide the cost table.
- **Ship special cases** (a ship starts on its land shipyard; a unit next to an owned property it cannot enter is repaired as if on it). Each is one rule in one place (`economy.js`) and tested.
- **Leader is not derived from faction.** A map pairs any nation with any kit on purpose (skirmish picks them separately). Names and portraits live in `campaign.json`, kits in `loadouts.json`; skirmish falls back to the title-cased id. `Session.leaderName` is an injected function, so there is nothing to test beyond `main.js`.
- **`amphibious` is a real category** (marine): damage multipliers, healing, supply, vision and repair lists use it. Not vestigial.
- **The AI's reach and distance searches are recomputed per unit** (20-40 ms per turn on big maps). Caching reachable tiles per unit is only worth it with deeper look-ahead (see `backlog.md`).
- **Plans earlier in a turn are trusted** when nothing fought near them (`stillGood`), and every plan is re-validated against the engine before it is played. If the rules ever let units react in the other side's turn the trust has to go.
- **Static map analysis reads `map.terrain` directly** (AI areas, map generation, the editor). That is the map as authored; rule code uses `terrainIdAt`.

Rendering and art
- **Sprite art is tuned by eye**: ship scale wrappers, wake and bubble overshoot, hand-placed missile spacing (`DX`, `DY`), the carrier deck mapping and lowering, polygon hover hulls, sub hull shapes, mech `fit` scales, the two mine drawings, the visor queue in `concept-art-mechs.js` (reset per sprite, synchronous), `hoverLift` bob in the sprites. Sharing them as parts is possible, but with no pixel tests a refactor changes pictures unseen. *Trigger: a unit that needs the same shape again (a second 3/4 deck, a second launcher, hover units shipping, the amphibious tank moving into `units.json`: then it must set `render.waterSprite` and the swim art must move with it).*
- **Black-part outlines work by colour string** (`skipBlack`); gradients and patterns are never treated as black. The proxy costs about 7% over a plain outline.
- **Gallery-only art** (concept sprites, structure art, defence extras, the `wide` card class) stays in `gallery/` or beside it until those units ship; `concept-art.js` still re-imports the moved modules for its merged tables.
- **Wall drawing order** (`drawWalls` paints row by row, before units) means a unit in the tile above a riser is drawn over it. The cracked wall draws through the wall layer, so its destruction shows rubble but no falling sprite.
- **The editor drives the `Renderer` with stand-ins** (state from `createState`, stub effects). It rebuilds that state once per edit (not per frame), fine to 64x64.
- **Written legends** for properties come from the generic glyph pool (readable, not as tidy as hand-written).
- **Attack animations and tileset art are tuned in the gallery** (contact sheets, headless phone-size renders), not on a device; shells arcing above the top row leave the screen.
- **The menu backdrop** paints one 24x24 battlefield into an off-screen canvas (up to about 2700 px a side) and is dropped whenever another page covers the title. An `ImageBitmap` or worker would be lighter. *Trigger: a memory report on a low-end phone.*
- **Drawings and data for the removed tilesets are still in the code** (October 2026): the `towers` and `spires` relief drawings, the `paving`, `heath` and `lawn` ground textures and their `ground.json` entries belonged to the urban, highlands and royal tilesets, which no map uses now. They are tested (every ground has a drawing) so they cost little, but they are dead weight; move them to `src/render/unused/` the day nobody wants them back. *Trigger: a pass over the art, or a new tileset that wants them.*
- **`src/render/unused/removed-terrain.js` is archived art, not live code.** It is imported by one test that only checks it loads, so it cannot rot silently, but nothing checks that it still draws; reviving a drawing means wiring it in and giving it a test.
- **`render.inlay` and the flat-side corner logic in `paintTile` are now unused by shipped data** (roads no longer carry a base colour). `terrain-art.test.js` still covers the mechanism with a synthetic road; delete both together if no terrain needs them. *Trigger: the next terrain pass.*
- **The reach overlay rebuilds its shape every frame** (`Renderer#drawReach`: the joined outline loops from `render/tile-outline.js` plus one band per slant; the attack ring traces its loops every frame too). Fine at today's move ranges on phone-sized boards; cache the path per selection if a 64x64 map with a long-range flier shows frame drops. *Trigger: a measured slow frame.*
- **The menu backdrop test is seed-sensitive.** `the units are drawn afresh on every frame` needs a seed whose field contains animated units; removing the rough-ground noise shifted the random stream and seed 8 stopped qualifying (seeds 4 and 6 do not either), so it now uses seed 1. A fixed field built by hand would stop this recurring.
- **Map files are in two JSON styles.** The maps changed in the October 2026 terrain rework were rewritten in the compact style (one line per legend entry, player and unit); the untouched ones keep the older expanded style. A `tools/` formatter would settle it.

Tooling and tests
- **Greedy-engine build rules are global** in `data/ai.json` (including per-unit caps for `rpg_trooper`, `motorcycle`): the greedy engine is the frozen baseline the strategist is measured against.
- **Training maps sit outside the game** (`tools/ai/maps/`): Archipelago's HQs cannot reach each other on foot, which the shipped-map tests forbid.
- **`tools/` read data through `tests/helpers/node-io.js`.** Six lines, shared on purpose.
- **Gallery pipeline stages** are hand-edited in `gallery/status.json`; `catalog.js` validates the ids and stage names, not whether "balanced" matches the baselines.
- **Browser coverage that needs a person**: a physical touch device (the ghost-click guard is covered in headless touch emulation), attack animation timing, in-game tileset look under fog and zoom, join and dialogue wiring (unit-tested as pure logic only), generated field quality (tested for validity, not looks).


Cleanup pass 3 (9 October 2026), fixed:
- **Build-menu order** is derived (`menuByPrice` in `economy.js`: cheapest first, then data order); the sort tool is gone.
- **Kit drift and stranded exclusive units** are checked on the shipped data (`validateShippedKit`, run by `npm run validate`).
- **Tileset `style` keys** are audited against the drawings' defaults (`tests/render/tileset-styles.test.js`).
- **`moveFirePenalty`** removed (no unit used it); **Recon's sprite** renamed from `technical` to `recon`.
- **Mine inertness** is one helper (`isInertDef`) instead of four hand-written checks.
- **Terrain reads** in the AI goals and renderer go through `terrainIdAt`.
- **Fog cache**: `game.edit(fn)` changes state and refreshes sight in one step; fog shapes are cached while the fog is steady (rebuilt only on a sight, camera or zoom change).
- **Reinforcements**: `Session.callIn(specs)` spawns through `Game.spawn` and then animates them in.
- **Damage baselines** now cover every armed unit (`node tools/regen-damage-baseline.mjs --extend`).
- **Smoke test** also paints in the editor (tap, Undo, Redo) at phone and desktop sizes.
- Stale entries removed: the duplicated `gait` helper (already shared), the duplicate Missile/Mech/Hover/Sub notes (merged above), the "AI tuning is stale" note (re-stamped).

## Resolved in earlier passes (October 2026)

Fixed in the first pass:
- **Boot waste**: `boot()` no longer starts a hidden session under the menu; `play()` creates it.
- **Launcher routing**: a `ScreenStack` (`src/ui/screen-stack.js`) now owns skirmish, editor and campaign pages.
- **Skirmish redraw**: pages render lazily, only the visible step; the 880px breakpoint is shared with CSS and guarded by a test.
- **Engine-level spawn**: `Game.spawn({type, owner, x, y})` exists, so reinforcements are no longer visual-only.
- **Mines**: a per-player cap (`maxMinesPerPlayer`), no leak of hidden units when laying, and laying is interrupted by a hidden unit on the tile.
- **AI**: a refused order is replanned once instead of wasting the unit's turn.
- **Engine picker**: skirmish can choose the computer opponent when more than one engine is registered.
- **Exclusive units**: a test fails if a leader dropped from the loadouts strands an exclusive unit.
- **Art**: the `ground` shadow and the infantry body/helmet are shared through `parts.js`; a test draws every gallery concept sprite.
- **Browser smoke test** (`npm run smoke`, `tools/smoke`): headless Chromium at phone and desktop sizes covers the title, skirmish, editor, campaign, galleries, a full round with and without fog, the build menu, and sideways-scroll checks. It found and fixed a real touch bug: the ghost-click guard let a synthetic click (detail 0) through.

Computer opponent pass (9 October 2026):
- **Fixed**: every planned order is re-checked against the engine before it is played (a route closed mid-turn is caught); what the human sees of the computer's turn is now a tested module (`src/ui/ai-visibility.js`: fights in the fog, mines, captures and submarines stay hidden); tests for support units keeping out of reach, dropped troops leaving their carrier, and the new parameters.
- **Measured, no effect (kept as parameters, all off)**: `join` (merge two badly hurt units), `hide` (a sniper's cloak lowers the threat), `fuelSlack` (fliers stay out longer), `finish` (go for the HQ when far ahead). Each was played in 152-game mirrors or 114 games against greedy: 49-51% and 84-86% against 50% and 84%.
- **Checked**: the heal weight (flat across its range), the tuning (256 rounds, nothing better), the support-unit danger item (already handled by the strategist), and the reasons games reach the day limit (see below).

Deliberately not done:
- **AI and fog of war**: fog is a player-only feature by design; the computer sees the whole board.

Also resolved earlier and removed from the lists: the mine hidden-tile leak, the first breakpoint/launcher/skirmish-redraw items, shared header classes, the `unreachable` AI engine error, fuel valuation for copters, and the stale notes on the APC and mechanic.

- **Dead drawings after the jungle removal.** `roundwood`/rainforest canopy, moss ground and mossy crag art are no longer used by any tileset (as are some towers, spires, paving, heath and lawn drawings); delete or archive them under `src/render/unused/` once it is clear they will not come back.
- **Road dead-end fade is cosmetic only.** `roadShape` still reports a lone or dead-end tile as a straight through-road; the fade is derived in the drawing from the raw `link` flags, so any other consumer of `arms` sees the full-length road.

# Tech debt and architecture notes

- **AI build rules are global.** `data/ai.json` has one rule set per category. A leader menu that adds a category the profile has no rules for is never built by the computer. Leader-specific AI rules (or a per-leader profile) will be needed once kits really differ.
- **Kit drift.** The default kit mirrors the category menus by hand. A test guards it, but every new unit must also be added to `data/loadouts.json`.
- **Leader identity is split.** Names/portraits live in `campaign.json`, loadouts in `loadouts.json`. Skirmish depends on the campaign data only for names and portraits (fallback: title-cased id). Consider one source.
- **Cramped maps.** On `classic` the formation pushes some units to odd spots (artillery ends up ahead); on `tri_point` properties on the row ahead displace five units. Naval fleets now come from the shipyard set, so they no longer vanish, but they are one default destroyer per shipyard rather than the map author's fleet. A map with no factories (`river_run`) gives only the HQ and airfield sets. Maps may need hand-authored formation hints.
- **Quick Start / default mission** do not use leaders.
- **`Session.leaderName`** is an ad hoc hook for the intro matchup line; there is no Session/UI test for it.
- **Skirmish screen** re-renders every portrait canvas on each change.
- **Leaders are independent of team colour**; they could be tied together later.
- **Not visually verified.** The picker's layout at phone width was not checked in a browser (the sandbox browser could not reach localhost); only unit tests cover it.
- **Session has no automated test.** The commentary logic, banner, pacer and hold gesture are unit-tested, but the Session wiring (opening cards, the banner during the computer's turn, fast-forward) was only checked with a throwaway headless-browser script. A small browser smoke test in `tools/` would pay for itself.
- **Some situations are unused in battle.** Milestones now have dedicated situations (`first_blood`, `hq_threat`, `killing_spree`, ...), but `greeting`, `praise` and `tech` are still never used in battle, and milestone-to-situation links live in code rather than data.
- **The banner covers the bottom of the map** during opening cards and the computer's turn; it could move to the side of the screen away from the action, like the dock.
- **Portrait colours follow the leader's own faction**, while the banner accent and the units follow the team colour, so a leader can look mismatched with their army.
- **Eye drawing is parametric but 2D-flat:** expressions (angry, shock) only change brow and lid openness, not each style's eye shape.
- **Reinforcements are visual only.** `Session.reinforce` animates units that already exist; there is no engine-level spawn (event or order) yet, so a campaign script must add units to `game.state.units` itself, and an undo or save would not know about the arrival. Entrances also ignore terrain and other units on the way (a straight line from the window edge), and the entry point is chosen from the window, so on a zoomed map the units drive in over whatever is between.
- **The rocket launcher is the first unit to need resupply outside the airfield.** Factories now resupply `vehicle` units, so every vehicle with an `ammo` attribute would use it; there is no supply truck yet (a concept). The AI builds at most one launcher and has no special logic to keep it fed. Damage baseline cases do not cover the rockets.
- **Remaining concept units** (APC, mines, automated factory, carrier landing) are still prose/art only; the seventeen drafted units (incl. RPG trooper, stealth copter, conscript, diver and motorcycle) now ship; the spy lost its sabotage idea and is plain stealth infantry.
- **Parts library is a first cut.** `src/render/parts.js` covers wheels, treads, legs, hover, hulls, propellers, turrets, tubes, dishes and effects, but the static defences' pads and sandbags, the ship deck `mount`, the hand-drawn radar dishes and the medic cross are still per-file (listed in `docs/render-parts.md`). The game sprites in `unit-art.js` still build some wheels/tracks by hand where they differ from `wheel`/`treads`.

- **Gallery pipeline statuses are hand-edited** in `gallery/status.json`. The 17 original units were marked `solid` by assumption (rocket launcher `draft`); nothing checks that `balanced`/`ready` match the damage baselines or the interface.
- **Gallery has no browser test.** It was checked once with a headless Chromium script (all tabs, dialogue tester, phone width); `tests/gallery/catalog.test.js` covers only the data. `portraits.html` is still a separate design lab, and the kit icons are static (not animated).
- **Stealth tank still has no cloak.** The `cloak` attribute now exists (used by the stealth fighter/bomber); the stealth tank could adopt it with a data change, but it is untested for ground play.
- **Some structures are still concept-only.** Labs, bunker, radar station, supply depot, the gun turret, watchtower and tank traps exist only as gallery art plus prose. Walls, cracked walls, the cannon/SAM/artillery turrets and the jammer are in the game (October 2026).
- **Gallery structure art is separate from the game's** `src/render/buildings.js` (`gallery/structure-art.js` borrows its `kit` helpers); if structures ship, merge them so there is one drawing path.
- **APC** is art only; the APC reuses the transport's carry mechanic in prose, not in data.

- **New units are `exclusive`** (kept off default and category menus) and reachable only through leader loadouts; the default kit guard test does not cover them, so a leader dropped from `data/loadouts.json` silently strands its unit.
- **Support-unit AI ignores danger.** Medics, mechanics, radar planes and spies path toward goals (wounded allies, the army, enemy properties) without weighing threats, and will walk into fire.
- **Mechanic has no mines.** The concept's mine laying was not built; it is a repair/heal unit only.
- **Only the sniper is revealed by firing.** The always-cloaked units (spy, stealth fighter/bomber/copter) stay hidden after they shoot unless an enemy is adjacent or has radar; `cloak.revealedByFiring` exists if that should change.
- **The AI does not use the sniper's forest cloak:** it picks tiles by cover and distance, not by whether the tile hides it.
- **A carried unit that was halted by a hidden enemy** used to crash the AI (no tile to choose); fixed with a size check, but `carriedBy` handling in `chooseOrder` is fragile.
- **Radar adds no fog sight.** Radar only finds cloaked units; the radar plane just has a long `vision` (6) in fog of war.
- **Heal visuals were not verified in a browser** (the Heal button label and the +HP call-outs); only engine tests cover them.
- **Sprites moved from `gallery/` to `src/render/art-*.js`** so the deploy build includes them; the gallery imports them back. Older gallery art files may still want the same treatment.
- **No damage-baseline cases for the new units** (spy, medic pistol, RPG trooper, stealth copter); the baseline tool covers only the original units.
- **RPG trooper has no weakness against infantry:** its armor piercing gives it full damage on everything; only its single round limits it.
- **Heal order is all-or-nothing on adjacency:** it heals every eligible neighbour, with no way to choose one, and the AI scores tiles by total HP restored but ignores the funds cost.
- **Diver and bike are two new move classes** (`diver`, `bike`) with a cost per terrain; every new terrain must now list both, and the terrain window shows eight move chips. A per-unit cost override would scale better than a class per special unit.
- **Diver is infantry on land** (hit by ordinary rifles, healed by medics) and is only hidden in deep water; it cannot capture, and nothing lets it carry its harpoon's strength against ships onto shoals (shoals are not deep, so it surfaces there).
- **Diver and motorcycle art in the gallery is unit-sheet only:** the swim sprite ignores the `submerged` fade that submarines use, and the dive splash plays when a diver enters the sea.
- **`unit.moved` now drives two rules** (commando rest, motorcycle moved-fire penalty); it is cleared at the owner's turn start, so a counterattack must explicitly opt out (it does).
- **The AI builds the diver only when the enemy has ships** and does not steer divers into water on purpose; it moves them like any foot unit toward goals, and the diver's move class lets it swim where it can reach them.

- **Hover bob lives in the sprites, not the frame.** `unit-frame.js` bobs every unit with an altitude on a fast, fairly deep sine; the hover concepts wanted a slow, shallow one, so their data now has `altitude: 0` and `concept-art.js` (`hoverLift`) draws the lift and the gentle rock itself. If the hover units ship, keep their altitude at 0 or move this into a per-unit bob setting in the frame, otherwise they will double-lift and jitter again.
- **The amphibious tank's propeller depends on `waterSprite`.** The land sprite has no propeller and `amphibious_tank_swim` adds it; the gallery shows this through `concepts.json` `waterSprite`. When the unit moves into `data/units.json` it must set `render.waterSprite` (the marine and diver already do), and the swim art has to move out of the gallery with it.
- **The drop pod is now filed under Air but is drawn hovering** (altitude 0.08, air shadow, legs out). Its mechanic (it lands, then stays on the board as a bunker) needs a landed pose or a second sprite; today it only shows the descent.
- **Six walkers, no engine support.** Strider, titan and the four new mechs (rocket, scout, flame, bulwark) are art plus prose in `concepts.json`; their stats are guesses and nothing checks them against damage baselines. The flame walker's explosion and the bulwark's frontal shield are not expressible with today's attributes. "Walker" is used to avoid confusion with the existing Mech infantry unit.
- **The `ground` shadow helper is copied** into `concept-art.js`, `concept-art-vehicles.js` and `concept-art-mechs.js` (and elsewhere); it belongs in `parts.js` next to the other drawing helpers.
- **Gallery changes were checked headlessly only** (sprite-lab PNG sheets at several animation times and a bounds script, plus the unit tests); the live gallery page, including the third "on water" tile for the amphibious tank and the drop pod's new Air tab, was not opened in a browser.
- **The regular submarine and the missile sub draw their dive separately.** `surfacing` (parts.js) copies the waterline, dip and foam logic that is inline in `unit-art.js` `submarine`; the game's sub should switch to the part so there is one dive. The hunter sub and abyss sub are still always drawn dived in the underwater shade and never surface.
- **Ship art has hard-coded scale wrappers.** Each ship is shrunk by a magic factor (`under(…, .86)`, `scale(.77)`) and the stern foam and propeller bubbles still poke outside the tile on the carrier, dreadnought, landing craft and mine layer; the bounds are not enforced by any test.
- **The carrier's perspective deck is hand-placed.** The deck, runway and parked planes use a small local `P(t, v)` mapping; if more ships want a 3/4 deck (a second carrier class, a hover carrier) it should become a shared part. Parked planes are drawn in the sprite, not as real units, so they cannot show a launch or an empty deck.
- **Concept mechs use a per-sprite `fit` scale.** The sloped, crested walkers are taller than the tile allows, so the titan, rocket walker and bulwark are shrunk about the ground line in `concept-art-mechs.js`; the proportions should be adjusted at the source (or the helper moved to `parts.js`) rather than scaled. The new limb, leg, helmet, pauldron, claw and gun-pod helpers are local to that file and are the start of a shared walker kit if the mechs ship.
- **Missiles seen "front to back" are placed by hand.** The SAM launcher and rocket buggy draw their missiles with a local `missile` helper and a hand-picked depth step (`DX`, `DY`) so they fan up and to the right; if more launchers need it this should be one shared part with the perspective step as a parameter. The SAM's concept text now says three missiles (one after moving), but nothing ties the sprite's missile count to the unit's ammo.
- **The amphibious tank swim sprite's propeller bubbles leave the tile** (about 0.6 tiles to the left of centre), like the ships' stern wakes; there is no per-sprite clip or bounds test.
- **Hover units draw their own lift and bob.** `hoverLift` in `concept-art.js` (deeper, slower sine, about a third of the tubing waves' rate) still lives in the sprites with altitude 0 in the data, and the tubing nozzles and ring positions are hand-placed per craft. If the hover units ship, move the bob rate and depth into a per-unit setting in `unit-frame.js` so waves, lift and shadow share one clock.
- **Mech idle is a gait value, not an animation state.** `gait` returns 1/.4/0 and `leg` branches on `walk >= 1` to pick stride or shuffle; arms use `armSwing`. A real idle/walk/attack state (and a place for a breathing or weapon-check idle) belongs in the walker kit, not in magic numbers.
- **Missile depth is still hand-tuned.** The SAM and buggy rockets now use an outlined `missile` helper with per-sprite offsets (`DX`, `DY`) picked by eye so that the perpendicular gap clears the rocket thickness; they overlap the SAM's dish a little. A shared launcher part should compute the spacing from the thickness.
- **Swim propeller hangs below the hull by hand** (`amphibious_tank_swim`, a strut plus `propeller` at y .275); its bubbles still trail off the tile's left edge.
- **Mechanic is now armed but the AI does not know it.** The wrench (12 damage, armor piercing 1) is in `data/weapons.json`, so the computer's attack scoring may now send mechanics at enemies; the AI still treats them as support units. Damage baselines do not cover the wrench, and the mechanic's gallery text is the only place the rule is described.
- **Gallery cards with a water tile use a `wide` class.** Cards with three tiles span two grid columns above 700px and wrap below that; any future unit with four icons would need the same treatment. The grid could size cards from their content instead.
- **Mech visors share one scanner in `helm`.** The sweeping light runs on a fixed rate (`w * 3`) for every walker and ignores the walker's state; the scout still draws its own eye disc over the visor.
- **Hover tank and scout shapes are polygon-by-hand,** with the scout's chin gun placed against the hull by eye; nothing ties either to a shared hover hull part.
- **Submarine hull shapes are duplicated by hand.** The missile sub's `half()` profile (thickness, stern taper) and the hunter sub's quadratic body are separate from the regular sub in `unit-art.js`; the sail, bow plane and tail fin shapes are all per-sprite.
- **Mech idle is only the visor light now.** Legs and arms are frozen unless the walker moves; shading was cut to two tones (body and dark), but the shield face, rocket pod tubes and fuel tank still use ad hoc lighter/darker mixes in `concept-art-mechs.js`.
- **Missile overlap is tuned by eye again.** The SAM and buggy now stack their rockets with a small perspective offset (`DX`, `DY`) so the back ones peek over the front one; the buggy's rack is a flat polygon behind them. Still no shared launcher part.
- **The missile sub and the regular sub are now near-twins but separate code** (`box` hull plus tower plus periscope in both); the bulge under the forward section exists only on the missile sub. A parametric sub hull part would fold the three subs together.
- **Mech visors use a module-level draw queue.** `helm` pushes its visor into a shared `visors` list that the `sprite` wrapper flushes after the walker is drawn, so the visor sits above the arms and pauldrons. It works, but it is hidden global state; a proper draw-layer (or splitting each walker into back/body/front passes) would be cleaner.
- **Carrier deck is lowered with a blanket translate** over the whole light pass (deck, slab and island), rather than by editing the hull's deck line; the hull and deck no longer share one height constant.
- **Two mine drawings.** The mine layer's `mine` helper (concept-art.js) and the gallery's `seaMine` (concept-art-static.js) now share a look (one colour, six even spikes) but are separate code; the sea mine's anchor chain is hand-placed ovals under the bottom spike.
- **The SAM launcher still carries leftover multi-missile geometry** (`DX`/`DY` perspective offsets and a bed polygon sized for several rockets); with a single missile these could collapse into plain bed and rail strokes. The `missile` helper now takes a nose colour so the buggy's rocket can use the team colour.
- **"Black parts: No outline" works by colour string.** `drawOutlined` with `skipBlack` redraws the sprite into a mask through a wrapper context that skips fills and strokes whose colour is near-black (all channels <= 52), so there is no pixel read-back and it costs about 7% over a plain outline in a Node benchmark. It only sees colours set through `fillStyle`/`strokeStyle`: gradients, patterns and images are never treated as black, and a very dark team colour could be. The proxy adds a small cost per drawing call; the cleaner fix is for sprites to draw ink through a named layer.
- **Outline scratch canvases were shared across slots (fixed).** `outline.js` tracked one `make` owner for all scratch canvases, so a stale edge canvas could be reused after the body canvas was rebuilt; the owner is now tracked per canvas.
- **Black parts are no longer outlined in the game too.** `unit-sprites.js` passes `skipBlack: true`, so every unit on the board is drawn twice into scratch canvases (body and mask) before the outline stamps; the per-frame cost has only been measured in Node (about 4 ms a tile at 96 px on a CPU canvas), not on a phone with a full board. The gallery's "Black parts" toggle now defaults to "No outline" to match, and the test for the game default only checks the source text.

## Gallery units drafted into the game
- **Hidden-tile leak when laying mines.** `layTiles` skips any tile with a unit on it, hidden enemy submarines included, so a mine layer's highlighted tiles (and the `bad-lay-tile` error) can reveal where an unseen sub is. A hidden unit should count as free for the plan and the lay should then be interrupted like a move.
- **Mines are not capped by the engine.** Only the AI limits itself (`ai.json` weights.maxMines); a human can lay mines every turn, and each is a full unit in `state.units` that is scanned by every `unitAt`/`canSee` loop. Consider a per-player cap or a separate mine layer in state.
- **A mine is a `unit` with `done` forced on.** `economy.startTurn`, `makeUnit`, the renderer's "acted" wash and the info card each special-case `mine` to keep it inert and un-greyed. A first-class "inert" unit flag (or terrain-like objects) would remove those four places.
- **`submerged: true` is stored for permanently hidden units** (hunter sub, mines) so the renderer draws them dived; `canDive` guards the "comes up off deep water" rule. The renderer and `layerIdOf` still treat `submerged` as the source of truth, which is a second copy of "this unit's layer is hidden".
- **Supply and Heal are near-duplicates** (`supply.js`, `heal.js`, controller buttons, AI scores, messages, effects). A generic "support order" with a plan/resolve pair would collapse them, and `resupply` at a property is a third variant.
- **The SAM launcher's "one missile after moving" idea was not built.** It has 3 rounds and reloads fully when it stays still; firing after moving is unrestricted. The AI keeps armed units that see no valid targets with the army, which is a generic stand-in for real anti-air behaviour.
- **AI does not use the pre-move dive deliberately.** `surfaceToTravel` surfaces any sub with no enemy within 6 tiles and the normal end-of-move rule dives it again; it never hides first to approach. Troop transports and APCs are driven by the transport copter's drop rule and do not plan landings.
- **Sea-mine price and damage are flat** (600 credits, 4 HP); a ship at 4 HP or less dies to one mine. Nothing in the UI warns a human when a path may cross unseen water next to a laid mine.
- **Terrain move costs grew two columns** (`hover`, `amphibious_tread`) on all thirteen terrains by hand; a new terrain must remember both, and validation only reports the omission.
- **Gallery art modules moved** (`art-vehicles.js`, `art-fleet.js`, `art-support.js` now in `src/render/`) but `concept-art.js` still imports them to keep its merged tables; the gallery's concept path no longer needs those entries.


## Faction rework
- **Leader is not derived from faction.** `players[i].leader` is set separately from `faction`, so a map can pair any nation with any kit; tests must pass `leader` explicitly to get a leader's menu.
- **Marine keeps the `amphibious` category** only to stay off the standard menus; with the shipyard no longer building it, the category and the `amphibious` rule in `ai.json` are mostly vestigial (the AI builds marines only where a leader's barracks menu offers them).
- **Start-army balance is hand-tuned** against current costs; changing a unit price silently skews factions until the leaders test fails.

## Skirmish colours
- **Colour and leader are still two settings.** Picking a leader now sets the team's colour to the leader's nation (and a random leader brings theirs when rolled), but the nation lives only in `campaign.json`, so `applySkirmish` takes a `nationOf` map from the launcher. Putting the nation on the loadout (or in the registry) would remove that plumbing.
- **Four sea maps were missing barracks** (nothing checked for it); a test now requires one per player on every shipped map.

## Rules pass (infantry, shipyards, ammo)
- **A built unit ignores the terrain of its building:** a ship starts on the (land) shipyard and sails off. Nothing stops other code assuming a unit stands on terrain its move class can enter, so a ship on a shipyard is the one place that is not true.
- **Ship repair is a special case in `economy.startTurn`:** a unit next to an owned property it cannot enter (a ship beside its shipyard) is repaired like one standing on it. Resupply already works by range.
- **`moveFirePenalty` is now unused** by any shipped unit (the motorcycle lost it); the attribute and its combat code remain.
- **`ammo.cost` was removed**: replacing rounds is free except for rounds that stand for a unit (`deploy`, `layMines`), derived in `roundCost`.

## Maps and skirmish (latest pass)
- **The water maps were generated, not drawn.** `island_chain`, `sky_strait` and `four_seas` (and `iron_curtain`) came from throwaway scripts; they can now be opened and touched up in the map editor.
- **The AI never plans amphibious landings,** so every map still needs a land route between the HQs (the island map uses a causeway); real island-hopping play is human-only until the AI learns to use transports.
- **Skirmish no longer offers Random or No leader,** and a colour with no leader (none exist today) would play with the map's own units; `RANDOM_LEADER` and `resolveLeaders` remain in `src/data/skirmish.js` for map files and tests only.

- **Defence art lives in `src/render/art-defences.js`** (moved from the gallery) together with three concept defences only the gallery shows (gun turret, automated factory, land mine); its `footing`, `grass` and `footShadow` could move to `parts.js`. The wall drawing is in `src/render/walls.js`; the gallery re-exports both.
- **Wall drawing order matters.** A riser or elbow reaches a little into the tile above, so `drawWalls` paints row by row from the top, after the terrain and before units. A unit in the tile above a riser is drawn over it.
- **Brainstormed units overlap some existing ones on purpose** (technical vs recon, tank destroyer vs tank). The October 2026 ideas in `concepts.json` each come with a new mechanic (building in the field, guarding, smoke, EMP stun, wrecks and salvage, disguise, single-use attacks, liberation of assimilated units); none of these exist in the engine, and several (wrecks, smoke fog, disguise) touch fog of war and the AI's targeting.

## Fuel, ambush, double attacks (October 2026)
- **Fuel is a second resource tracked beside ammo with parallel code** (`fuel.js`, the fuel can next to the ammo bullet, the HUD chips, resupply and supply special cases). A generic "meter" abstraction (ammo, fuel, later morale or charge) would remove the duplicates; nothing else needs it yet.
- **Fuel burns per tile moved, never while idle, and never limits a move** (a flyer may fly on an empty tank; it only crashes if it starts its turn empty), and refuelling is automatic at turn start, so a plane parked on an airfield can never run dry. The Resupply order refuels too but is mostly redundant. There is no per-turn upkeep, so loitering aircraft (radar plane, drones) are free to hover forever.
- **The AI only turns back when it can no longer afford a full sortie** (`fuel <= distance home + move`); with no airfield or carrier it flies until it crashes (a few crashes per simulated game), and it does not plan routes through carriers or trucks that will have moved.
- **`attacksPerTurn` reuses `unit.halted`** (the interrupted-move state) to mean "attacked, may attack again from here"; code that reads `halted` as "was stopped by a hidden unit" (the sub's pre-move dive, undo) now also sees a unit mid-way through its attacks.
- **Ambush uses a `unit.ambush` flag set at turn start** for any hidden unit (the divers, spies and stealth air all get it; only the sniper and the submarines were nerfed). A unit that leaves cover during its turn keeps the bonus for that turn. The multiplier is a global rule (`rules.ambushMultiplier`), not per unit.
- **The marine's boarding rifle is a separate weapon with `fromTerrain`** rather than a general "attack from a boat" rule; `attackProblem` answers `wrong-terrain` but the controller shows the generic out-of-range hint.
- **Vex's basic infantry is the spy,** so her transports drop spies; `deploy.unit` (soldier) is only the fallback for a player with no leader.
- **Mine reveal timing is presentation only:** the engine still deletes the mine the moment it detonates, so the board shows it through a throw-away `show` effect rather than as a real unit.

## Walls, defences and fog of war (October 2026)
- **Neutral turrets and Vantor Reach look alike.** Neutral structures are drawn in charcoal (`rules.neutralUnitColors`) as asked, but Vantor Reach's team colour is slate grey, so on a map with Vantor the two are hard to tell apart at small sizes. A neutral marker (a hazard-striped footing, a badge) or a different Vantor colour would fix it.
- **Structures are units.** Turrets, the jammer and the cracked wall are units with the `structure` attribute (owner `null` when neutral), so a lot of code that loops over `state.units` now meets units that never move and may have no owner (victory, formations, the AI, the end-of-turn prompt, the controller each special-case them through `structures.js`). A first-class "fixture" list in the state would be cleaner if many more kinds arrive.
- **The cracked wall is drawn by the wall layer, not its sprite** (`render.inWall`): the renderer skips such units, and its sprite in `art-defences.js` is only for the gallery and the editor. Its destruction shows the hit and the rubble but no sprite falling apart.
- **Walls block aircraft** (like Advance Wars pipes, and as "impenetrable" asked). If flyers should cross them, give `wall` an `air` move cost; nothing else depends on it.
- **A breakable wall is always intact at the start.** The cracked wall is placed by the `wall_breach` terrain when the game starts, unless a unit is already there; a map cannot say "this section is already broken" other than by not using a breach. The editor removes a unit painted over a breach.
- **Turrets fire by themselves in `Game.endTurn`** (`structureFire`): the ending player's own turrets first, then neutral ones at that player's units, one shot each, picking targets by the AI's damage-times-price score (the owner has no say). The AI does not avoid turret reach when choosing where to stop, and the human only learns a turret's range from the threat preview of tapping it. Their shots are paced by a pause in the session, not animated per turret.
- **Fog sight is cached on `game.revision`.** Every Game method calls `touch()`; code that edits `game.state` directly (tests, a future campaign script, reinforcements) must call `game.touch()` or the cached sight goes stale.
- **Fog shapes are rebuilt every frame** (`Renderer.fogShape`: Path2Ds of every fogged tile on screen with rounded corners, notches and fillets; three pieces per layer while a change fades). Cheap at the current map sizes; cache them on `game.revision` and the camera range if big maps get slow. The fillets between pieces of a fading fog are approximate for the 0.4 s of the fade.
- **Units see every tile they could move to,** so in fog an ordinary unit can no longer bump into an enemy on its path; interrupted moves come only from hidden units (submarines, cloak) again.
- **Fog leaks a little:** a property seen before shows its current owner, not the one last seen (structures are remembered as last seen, properties are not); a computer unit that ends its move in sight is animated along its whole path, including the part in fog, and one that leaves sight simply vanishes; the shot of an unseen attacker at a unit in sight is drawn from where it stands (a fight with neither end in sight is not shown at all); the commentary's "outnumbered"/"dominant" counts include unseen units.
- **Undo is nearly gone in fog**, by design: any order that brings a tile into sight clears it, and most moves do.
- **Vision numbers are first guesses** (`rules.vision`, unit `vision`, mountain `visionBonus`); there are no fog-specific tests of balance, and no forest/reef hiding (in Advance Wars a unit in a forest is only seen from next to it).
- **The AI ignores fog** (as asked) and never goes out of its way to destroy jammers; it breaks cracked walls only when nothing better is in reach (`breakWall`) and does not reason about walls beyond the distance field.

## Map editor (October 2026)
- **No browser test.** The editor's model, palette, storage and screen wiring are unit-tested (tests/editor), but drawing, painting, pinch and the sheets were checked with a throwaway headless-Chromium script only.
- **The editor drives the game's `Renderer` with stand-ins** (a game made by `createState`, and stub effects and animator). If the renderer starts reading more of the session, the editor needs the same stubs; a small board-view interface would make the contract explicit.
- **Saved maps live in one browser** (localStorage, `pocketwars.editor.*`). Sharing a map means downloading the file and adding it to `data/maps/` by hand; skirmish lists saved maps under `my-<id>` so they never clash with shipped ids.
- **Legend glyphs for properties** in written files still come from the generic pool (terrain gets mnemonic glyphs: `.`, `F`, `M`, `~`, `W`, `X`...), so an edited map's legend is readable but not as tidy as a hand-written one.
- **Symmetry assumes the players sit in mirror order** (copy n of something owned by player p goes to player p + n x players/copies); maps whose HQs are laid out otherwise need the owners fixed by hand.
- **The editor redraws the whole board from a fresh `createState` after each change**; fine up to 64x64, but a very large map with many units would want incremental updates.

- **Remembered structures are only pictures.** A turret out of sight is drawn as last seen but cannot be tapped for its info card or targeted (artillery cannot shell a remembered turret in the fog any more).
- **Siege is a flag on weapons** (`siege: true`), and structures' damage skips armor, toughness and cover entirely; `rules.structureDamage` holds the two multipliers. Durability values and the 1.5 / 0.25 split are first guesses with no damage-baseline cases.

## Computer opponent (October 2026)
The review's points and where they stand, then what the new system leaves open. See docs/ai.md.
- **Addressed:** no turn-level plan (the strategist plans the turn: focus fire, kills first, re-plans around each fight); no benchmark
  harness (`npm run ai:arena`, seeded and repeatable, both seat orders); build lists ignoring the enemy (the strategist values each menu's
  units from their stats against what the enemy fields, so per-leader menus need no AI lists). The greedy engine is kept as it was, as a
  baseline to score against.
- **Turn speed** is better (a heap in the path searches, an occupant index in `computeReach`: identical results, verified on the greedy
  engine) but the strategist still takes 20-40 ms per turn on the big maps, mostly distance fields and reach searches. Deeper look-ahead
  needs cheaper move generation first (reachable tiles cached per unit and invalidated by position changes).
- **Look-ahead is one ply and approximate.** The threat map is where each enemy could move and fire next turn, worked out once per
  turn from the board at its start; it does not simulate the enemy's actual reply, re-plan the enemy's routes as our units block them, or
  search over orderings of our units. A real reply search (clone the state, play the enemy's best few answers to our top plans) is the
  next big step in strength, once turns are cheap enough.
- **Plans made earlier in a turn are trusted** when nothing fought near them (`stillGood` in strategist/index.js): in our own turn enemies
  only die or come to light, never move. If the rules ever let units react in the other side's turn, this assumption has to go.
- **Landings avoid defended shores rather than open them.** Carriers keep out of the threat map, so a well-guarded coast is never
  assaulted; there is no coordinated "bombard, then land, then escort" operation. Stalemates on island maps are judged at the day limit.
- **Tuning is noisy.** Each round plays a few dozen games; many are judged on worth at day 30 rather than finished, four-player maps are
  left out of the tuning pool by default, and in a free-for-all any seat of an engine winning counts for it. Short ratcheting sessions
  help; a cheaper engine would help more.
- **The AI still ignores fog of war** (as before): the strategist honours cloaking and submarines (what it cannot see it does not plan
  around) but sees through jammer fog.
- **Engine choice is not in the UI.** The game plays the data's default engine; a skirmish option to pick an opponent (or difficulty,
  for example a less-tuned profile) would be a small addition through `game.aiSetup`.
- **What the AI learns about the player lives in one browser** (`localStorage`), per engine rather than per player profile or campaign
  save. The campaign will want it in its save data.
- **Training maps sit outside the game** (`tools/ai/maps/`): Archipelago has HQs that cannot reach each other on foot, which the shipped-map
  tests forbid. Shipping a true islands map would mean relaxing that rule on purpose.
- **Tools import a test helper** (`tests/helpers/node-io.js` for reading data in Node), as the existing tools already did.
- **Fixed: the `unreachable` engine error (October 2026).** A hidden enemy submarine that was spotted, lost from sight (a spotter moved on)
  and spotted again was only news the first time: the strategist kept a cached plan routed through its tile once it became visible, and the
  engine refused the move. The plan cache is now cleared whenever a visible enemy appears or one that is still alive drops out of sight;
  two seeded regression tests in `tests/ai/tuning.test.js` replay the failing games. `stillGood` still trusts `wait` orders without a reach
  check, so any other way a route can change mid-turn would show up the same way (the arena logs it and counts a loss).

- **Short games are weak evidence.** At 8 days nearly every parameter value scores about 50%: an opening says little about the game.
  They are kept for cheap noise reduction and given little weight; if tuning still drifts toward fast openers, lower their weight or drop
  the short window (`--screen 0,5,0`).
- **`ai:evolve` has no covariance learning and judges itself on small samples.** Its checks between generations swing widely (40-67%
  for the same drift); the final pick among three means is made on one 22-game sample, so it is slightly optimistic. Validate a result
  on a bigger independent sample before shipping, and run it for hours before expecting more than a few points. Also, with 97 numbers
  and little signal, many of them random-walk: a pass that pulls irrelevant numbers back toward their defaults would be cleaner.
- **Leader balance (AI-played) shows real spread.** First run: vex 67%, ludwig 57% against rex 40%, ada 43% (each ±4 over 160 games). Part of it
  may be how well the strategist uses each kit rather than the kit itself; the unit trade report (`docs/balance.md`) is the check on the numbers.
- **Starting armies are uneven after the fighter price rise.** The leaders' start loadouts include fighters (vex, hiroshi, ludwig, lysandra) that now
  cost 13,000, so the cheapest and dearest start armies differ by 6,200 (the leaders test was loosened from 4,000 to 6,500 to allow it). Swapping
  some of those start units, or trimming the others', would restore the fairness check.
- **Fog movement rule is human-only.** A fogged player cannot move into tiles they have never seen; the computer is never fogged, so it
  still moves anywhere (and the AI still sees everything).
- **Fixed in part: copters and vintage bombers were valued without their fuel** (helicopters later lost their fuel altogether, round 4 of `docs/balance.md`).** Production and the attack goals treated a flier as able to
  reach any enemy, but a copter (fuel 4 then, move 5) can only fight about 10 tiles from where it refuels and a vintage bomber (fuel 3, move 4) about
  8. They were built to chase targets two turns away, turned for home before arriving, and struck on only 16% of their turns. Production now
  counts only enemies within the round trip of an own refuel spot (plus the enemy's two turns of advance) and the goals skip targets it could not
  get back from. 400-game A/B against the old valuation: 54% +-3, no map worse. Copters built 228 -> 147 per 60 games, strikes per copter 1.3 -> 1.6.
  Still open: about 55% of vintage bombers never strike (they only hit artillery and ships, which are often absent, and the enemy's
  *potential* builds count towards their worth), and 35% of copters never strike (fighters kill most of them).

- **Infantry concepts with no engine support (October 2026).** The Flame Trooper's "no counterattack" rule, the Royal Guard's guard aura and armour, the Scientist's armour-ignoring laser and the Fanatic's death blast are prose in `gallery/concepts.json` only. Shipping them needs three small engine pieces: a weapon flag for "never answered" (flame; `indirect` is close but also forbids moving and firing), an `onDeath` blast attribute (Fanatic, and the flame trooper's and flame walker's bursting tanks, which are the same mechanic and chain), and an adjacent-ally damage aura (guard). The Fanatic's chain explosions need a bounded loop so a cluster of them cannot recurse forever.
- **Concept stats are free text.** Costs, damage and armour for concepts live in the `mechanic` sentence, so nothing checks them against the damage baselines or the units they overlap (the laser at damage 40, armour 0.4 on the Royal Guard, the blast of 3 are guesses). A `stats` block in `concepts.json` that `catalog.js` can validate would let the balance tools include concepts.
- **Infantry drawing helpers are copied.** `gait`, `body` and `helmet` exist in both `src/render/art-infantry.js` and `gallery/concept-art-ideas.js` (and `rifle` is re-drawn inline in the Royal Guard). They belong in `src/render/parts.js` next to `legs`/`torso`/`head`; the new Scientist and Fanatic use the gallery copies.
- **The AI tuning is stale** (`npm run ai:tune -- --check`; it already was before the RPG range and motorcycle move changes). It is manual by design, so it needs a run on a spare machine before the next balance pass is judged by arena results.
- **Greedy AI keeps per-unit caps** (`data/ai.json` `rpg_trooper`, `motorcycle`), which the RPG range change does not account for; harmless for the baseline engine, but they contradict the "no per-unit weights" direction for the strategist.
- **The ghost-click guard is verified by unit tests and a source check, not on a touch device.** `src/ui/ghost-click.js` is tested as a plain class, but `Session`'s wiring (the document-level capture listeners and `onPointerUp` arming it) is only checked by a regex on `session.js`, and the original bug (the touch browser's click landing on the build row that opened under the finger) was not reproduced in a real browser. It is the `Session` has-no-automated-test gap again; a headless-browser smoke test using a touch-emulated tap on a factory would cover it. The root cause is that taps act on `pointerup` while the buttons act on `click`; moving the map's tap to the click event would be the alternative fix, but it changes how drags and holds end.

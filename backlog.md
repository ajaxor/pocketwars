# Backlog

Things to build, tune or decide: AI capability, balance, rules, content, presentation. Code-quality problems are in `tech-debt.md`.

Last sorted 9 October 2026.

## AI capability

- **Sniper cloak (`params.hide`)**: the strategist can now discount the threat on a tile that cloaks the unit. It defaults to 0: a 152-game mirror at 0.9 scored 50% (no measurable effect, snipers are rare), so it is off until a sweep says otherwise.
- **The AI builds the diver only when the enemy has ships** and does not steer divers into water on purpose; it moves them like any foot unit toward goals, and the diver's move class lets it swim where it can reach them.
- **AI does not use the pre-move dive deliberately.** `surfaceToTravel` surfaces any sub with no enemy within 6 tiles and the normal end-of-move rule dives it again; it never hides first to approach. Troop transports and APCs are driven by the transport copter's drop rule and do not plan landings.
- **Landings are planned, but not coordinated.** The strategist ferries troops across water (carriers, `landingTiles`), so island maps are no longer human-only; there is still no escort-and-bombard operation (see the computer opponent section).
- **Fuel turn-back margin.** Running dry only disarms a flier (it never crashes), so the turn-back rule is conservative on purpose. `params.fuelSlack` lets it stay out longer: a 152-game mirror at 1 turn of slack scored 51% (no measurable difference), so it stays at 0.
- **Look-ahead is one ply and approximate.** The threat map is where each enemy could move and fire next turn, worked out once per
  turn from the board at its start; it does not simulate the enemy's actual reply, re-plan the enemy's routes as our units block them, or
  search over orderings of our units. A real reply search (clone the state, play the enemy's best few answers to our top plans) is the
  next big step in strength, once turns are cheap enough.
- **Landings avoid defended shores rather than open them.** Carriers keep out of the threat map, so a well-guarded coast is never
  assaulted; there is no coordinated "bombard, then land, then escort" operation. Stalemates on island maps are judged at the day limit.
- **Tuning is noisy.** Each round plays a few dozen games; many are judged on worth at day 30 rather than finished, four-player maps are
  left out of the tuning pool by default, and in a free-for-all any seat of an engine winning counts for it. Short ratcheting sessions
  help; a cheaper engine would help more.
- **What the AI learns about the player lives in one browser** (`localStorage`), per engine rather than per player profile or campaign
  save. The campaign will want it in its save data.
- **Short games are weak evidence.** At 8 days nearly every parameter value scores about 50%: an opening says little about the game.
  They are kept for cheap noise reduction and given little weight; if tuning still drifts toward fast openers, lower their weight or drop
  the short window (`--screen 0,5,0`).
- **`ai:evolve` has no covariance learning and judges itself on small samples.** Its checks between generations swing widely (40-67%
  for the same drift); the final pick among three means is made on one 22-game sample, so it is slightly optimistic. Validate a result
  on a bigger independent sample before shipping, and run it for hours before expecting more than a few points. Also, with 97 numbers
  and little signal, many of them random-walk: a pass that pulls irrelevant numbers back toward their defaults would be cleaner.
- **AI tuning**: `npm run ai:tune -- --check` was stale after the balance changes. A 30-minute run (256 rounds, `--write`) found no variant that beat the shipped profile, so the profile stands and is stamped as checked on the current data. The sweeps agree: heal (0 to 6) is flat at 50-52%, and the four new parameters measured at 49-51% in mirrors. Tuning remains manual (there is no tuning workflow in `.github/workflows`; only `pages.yml`); a multi-hour run on a spare machine is the next step if the AI needs more strength.
- **Joining and fuel (strategist): tried, no measurable effect.** `params.join` makes two badly hurt units of a kind merge instead of both walking home; at 8 and 20 the 152-game mirrors scored 50% and 49%, so it stays 0 (off). The tests show the order is generated and accepted by the engine.
- **The AI's rebuild logic is simple.** A capturer treats an affordable ruin (funds at least 1.25x the price) like a neutral property of the building it becomes; it does not weigh a rebuild against saving for a unit, nor deny ruins to the enemy. `planCaptures` scans the whole grid for ruins every turn (cheap now, worth caching on huge maps).
- Reported: on Whiteout the blue computer player only kept building units and left them in its base. Found and fixed one cause: a unit that was
  already standing on one of its own factories or barracks was not discouraged from staying there (the penalty applied only to arriving on one),
  so idle support units (medics, supply trucks) parked on them and blocked builds while money piled up. Whether that was the whole of what
  was seen is not confirmed: in headless games the computer does leave its base and capture, so a second cause (for example how it reacts to a
  human's units it can see) is still possible.
- **Games at the day limit (looked at, not a bug).** Mirror games (strategist against strategist) end at the 30-day limit about 90% of the time and are mostly draws, which is what two equal players do. Against the greedy engine ~70% still reach the limit, but traced games show the strategist well ahead and at the enemy HQ: on Skyline Pass it had 29 units to 7 and a flamethrower with 15 of 20 capture points on the HQ when day 31 arrived. So it is a few days slow, not stuck. `params.finish` (go for the HQ once our worth is this many times theirs; default 4) did not change the number of finished games at 1.2, 1.8 or 3.0 against greedy (84% to 86%, within noise). It also keeps 10,000 or more in the bank in these games: factories are busy or nothing on the menu clears `minUtility`. Worth a look if games should finish faster.
  to finish games. Worth a look in the arena.
- Early-game capture race (October 2026): infantry that heal (medics) now take free properties before looking after the army, and ferries
  (transport copter, APC, troop transport) are also worth building for free cities a long walk from anything we hold, not only for islands.
  Captures by day 8 went up on most shipped maps (headless, computer vs computer). The race is still limited by how slow foot units are on rough
  ground (Whiteout's snow) and by one infantry per barracks per turn; no check yet that a ferry is built early enough to matter.

## Balance and tuning

- **RPG trooper has no weakness against infantry:** its armor piercing gives it full damage on everything; only its single round limits it.
- **Sea-mine price and damage are flat** (600 credits, 4 HP); a ship at 4 HP or less dies to one mine. Nothing in the UI warns a human when a path may cross unseen water next to a laid mine.
- **Start-army balance is hand-tuned** against current costs; changing a unit price silently skews factions until the leaders test fails.
- **Vision numbers are first guesses** (`rules.vision`, unit `vision`, mountain `visionBonus`); there are no fog-specific tests of balance, and no forest/reef hiding (in Advance Wars a unit in a forest is only seen from next to it).
- **Leader balance (AI-played) shows real spread.** First run: vex 67%, ludwig 57% against rex 40%, ada 43% (each ±4 over 160 games). Part of it
  may be how well the strategist uses each kit rather than the kit itself; the unit trade report (`docs/balance.md`) is the check on the numbers.
- **Starting armies are uneven after the fighter price rise.** The leaders' start loadouts include fighters (vex, hiroshi, ludwig, lysandra) that now
  cost 13,000, so the cheapest and dearest start armies differ by 6,200 (the leaders test was loosened from 4,000 to 6,500 to allow it). Swapping
  some of those start units, or trimming the others', would restore the fairness check.
- **Balance of the October units rests on one 720-game AI run**; hiroshi (43%) and ludwig (45%) still trail.
- **Rebuild costs (4000 city, 7000 factory) are untuned** (the soft ground that shared this note was removed in October 2026; see the wheeled-vehicle note below). No leader balance run has been done with ruins, and the nine new maps are single-pass layouts (mirrored left-right, no playtest beyond 12 AI days and a 30-day AI run that rebuilt 18 times on Burnt Offering).
- **Maps are missing building types, which skews leader balance.** No airfields on harbor_front, reef_raiders, twin_fleets; no shipyards on classic, dust_bowl, iron_curtain, river_run; no factory on river_run; tri_point gives only player 1 a factory. Every leader's kit assumes barracks, factory, airfield and shipyard, so a map without one hands an advantage to the leaders who need it least. A map-validation rule (every start owner has all four, or the map says it is restricted) and fixes to these maps are needed.
- **Carrier price pass-through (fixed 9 October 2026).** `rules.carrierCargoRate` was 0.5, so a leader whose basic infantry costs more than a soldier (Ada's commandos, Chase's motorcycles) paid only half the extra for a troop carrier, and cheap-infantry leaders (Dmitri) got only half the discount; it is now 1, so a carrier costs its listed price plus the full cost difference of every drop it holds, matching what reloading its troops costs. The AI's unit valuation (threat, balance of forces, attack gain) and the unit info card now use the owner's price too. Still open: the price does not drop when the carrier has used its drops (an empty carrier is worth and repairs as a full one), and the build-menu and gallery catalog numbers for the unit type show the listed price.
- **Wheeled vehicles are untuned after open ground started costing them 2** (9 October 2026: `plain` wheels 1 -> 2, a road stays 1). A recon (move 5) now covers two and a half tiles of open ground, and artillery and the other wheeled units lose the same share of their reach. Unit `move` values, costs, the AI's reach and fuel calculations and the leader balance (Chase, Ada and anyone built around wheels) have not been re-run; `npm run ai:tune -- --check` will report the profile stale.
- **The terrain rework changed how five maps play and none was playtested.** A cliff became a mountain (infantry can now climb the ridges on Ridgeback, Skyline Pass, Garden Maze, Frozen Canyon, Dune Sea, Atoll and Mudslide, where nothing on foot could before), rough ground, snowdrifts and dunes became plain, and mud became bare dirt ground on Mudslide. They load, validate and play 60 AI turns, but the chokepoints and the balance between leaders are unchecked. Dust Bowl, River Run, Four Corners and Tri-Point lost their rough ground, so their roads now matter more (wheels pay 2 everywhere else).

## Rules and engine features

- **Stealth tank still has no cloak.** The `cloak` attribute now exists (used by the stealth fighter/bomber); the stealth tank could adopt it with a data change, but it is untested for ground play.
- **Mechanic has no mines.** The concept's mine laying was not built; it is a repair/heal unit only.
- **Radar adds no fog sight.** Radar only finds cloaked units; the radar plane just has a long `vision` (6) in fog of war.
- **Heal order is all-or-nothing on adjacency:** it heals every eligible neighbour, with no way to choose one. The strategist's heal weight was swept (0 to 6, 136 games per value, all 50-52%): the AI is insensitive to it, so the missing funds-cost term in its heal score does not matter in practice.
- **Diver is infantry on land** (hit by ordinary rifles, healed by medics) and is only hidden in deep water; it cannot capture, and nothing lets it carry its harpoon's strength against ships onto shoals (shoals are not deep, so it surfaces there).
- **The rocket launcher is the first unit to need resupply outside the airfield.** Factories now resupply `vehicle` units, so every vehicle with an `ammo` attribute would use it; there is no supply truck yet (a concept). The AI builds at most one launcher and has no special logic to keep it fed. Damage baseline cases do not cover the rockets.
- **The SAM launcher's "one missile after moving" idea was not built.** It has 3 rounds and reloads fully when it stays still; firing after moving is unrestricted. The AI keeps armed units that see no valid targets with the army, which is a generic stand-in for real anti-air behaviour.
- **Mine reveal timing is presentation only:** the engine still deletes the mine the moment it detonates, so the board shows it through a throw-away `show` effect rather than as a real unit.
- **Fog leaks a little:** a property seen before shows its current owner, not the one last seen (structures are remembered as last seen, properties are not); a computer unit that ends its move in sight is animated along its whole path, including the part in fog, and one that leaves sight simply vanishes; the shot of an unseen attacker at a unit in sight is drawn from where it stands (a fight with neither end in sight is not shown at all); the commentary's "outnumbered"/"dominant" counts include unseen units.
- **Remembered structures are only pictures.** A turret out of sight is drawn as last seen but cannot be tapped for its info card or targeted (artillery cannot shell a remembered turret in the fog any more).
- **Join loses surplus HP with no refund**, and repair costs the full tenth of the unit price per HP (`rules.repairCostRate`); neither has been balanced (no leader run since the repair costs went in).
- **Rebuild on the minimap and campaign commentary.** The minimap and campaign commentary do not show or mention rebuilds; the minimap is drawn from the map, not the state.
- **Skirmish no longer offers Random or No leader,** and a colour with no leader (none exist today) would play with the map's own units; `RANDOM_LEADER` and `resolveLeaders` remain in `src/data/skirmish.js` for map files and tests only.
- **Turrets fire by themselves in `Game.endTurn`** (`structureFire`): the ending player's own turrets first, then neutral ones at that player's units, one shot each, picking targets by the AI's damage-times-price score (the owner has no say). The AI does not avoid turret reach when choosing where to stop, and the human only learns a turret's range from the threat preview of tapping it. Their shots are paced by a pause in the session, not animated per turret.

## Content: units, structures, maps, dialogue

- **Cramped maps.** On `classic` the formation pushes some units to odd spots (artillery ends up ahead); on `tri_point` properties on the row ahead displace five units. Naval fleets now come from the shipyard set, so they no longer vanish, but they are one default destroyer per shipyard rather than the map author's fleet. A map with no factories (`river_run`) gives only the HQ and airfield sets. Maps may need hand-authored formation hints.
- **Some situations are unused in battle.** Milestones now have dedicated situations (`first_blood`, `hq_threat`, `killing_spree`, ...), but `greeting`, `praise` and `tech` are still never used in battle, and milestone-to-situation links live in code rather than data.
- **Remaining concept units** (APC, mines, automated factory, carrier landing) are still prose/art only; the seventeen drafted units (incl. RPG trooper, stealth copter, conscript, diver and motorcycle) now ship; the spy lost its sabotage idea and is plain stealth infantry.
- **Some structures are still concept-only.** Labs, bunker, radar station, supply depot, the gun turret, watchtower and tank traps exist only as gallery art plus prose. Walls, cracked walls, the cannon/SAM/artillery turrets and the jammer are in the game (October 2026).
- **The drop pod is now filed under Air but is drawn hovering** (altitude 0.08, air shadow, legs out). Its mechanic (it lands, then stays on the board as a bunker) needs a landed pose or a second sprite; today it only shows the descent.
- **Six walkers, no engine support.** Strider, titan and the four new mechs (rocket, scout, flame, bulwark) are art plus prose in `concepts.json`; their stats are guesses and nothing checks them against damage baselines. The flame walker's explosion and the bulwark's frontal shield are not expressible with today's attributes. "Walker" is used to avoid confusion with the existing Mech infantry unit.
- **The water maps were generated, not drawn.** `island_chain`, `sky_strait` and `four_seas` (and `iron_curtain`) came from throwaway scripts; they can now be opened and touched up in the map editor.
- **Brainstormed units overlap some existing ones on purpose** (tank destroyer vs tank). The October 2026 ideas in `concepts.json` each come with a new mechanic (building in the field, guarding, smoke, EMP stun, wrecks and salvage, disguise, single-use attacks, liberation of assimilated units); none of these exist in the engine, and several (wrecks, smoke fog, disguise) touch fog of war and the AI's targeting.
- **Concept units still without engine support.** The Remote Technical (unmanned, shut down by jammers) and the guard aura / `onDeath` blast / Fanatic damage rule remain gallery concepts only.
- **Lysandra's transport copter is a stopgap** for losing the marine as her water-crossing infantry.
- **The faction-to-biome pairing is provisional, and uneven.** `data/tilesets.json -> factions` is a guess: temperate Lastholm and Highspire, tundra Deepmere and Vantor Reach, desert Ashmark and Skyreach, ruins Ironvale and Solace, islands Tidehaven (nine armies over five biomes; islands has one army). Armies that share a biome are meant to tell themselves apart by how their maps are laid out (one a wide desert, another a desert archipelago), and no such maps exist yet: Skyline Pass, Garden Maze and Frozen Canyon (the former highlands, royal and urban maps) were only moved into the biomes above. The campaign does not use `registry.homeTileset` yet, so nothing picks a tileset for a campaign battle; campaign maps need `"tileset"` set by hand.
- **Vex's basic infantry is the spy,** so her transports drop spies; `deploy.unit` (soldier) is only the fallback for a player with no leader.
- **Neutral turrets and Vantor Reach look alike.** Neutral structures are drawn in charcoal (`rules.neutralUnitColors`) as asked, but Vantor Reach's team colour is slate grey, so on a map with Vantor the two are hard to tell apart at small sizes. A neutral marker (a hazard-striped footing, a badge) or a different Vantor colour would fix it.
- **Diver and motorcycle art in the gallery is unit-sheet only:** the swim sprite ignores the `submerged` fade that submarines use, and the dive splash plays when a diver enters the sea.
- **Two armies per biome need their own maps.** The plan is that armies sharing a biome tell themselves apart by level design (one a wide open desert, the other a desert archipelago). Only the data side is done (`tilesets.json -> factions`); each shipped map is still one style per biome, and islands has a single army, because nine armies do not divide into five biomes. Decide whether to add biomes, move armies, or add armies.
- **Highlands was removed along with urban and royal** (the request said "maybe"). Skyreach lives in the desert biome now; the highlands art (heath ground, dark pines, granite) is gone from the data and could come back as a seventh biome.
- **Frozen Canyon, Garden Maze and Skyline Pass are re-skins, not redesigns** of the old urban, royal and highlands maps (`concrete_canyon`, `garden_maze`, `skyline_pass` keep their ids). Their descriptions were rewritten, but the layouts still read as a city grid, a hedge maze and a cliff moor.

## UI and presentation

- **Leaders are independent of team colour**; they could be tied together later.
- **The banner covers the bottom of the map** during opening cards and the computer's turn; it could move to the side of the screen away from the action, like the dock.
- **Portrait colours follow the leader's own faction**, while the banner accent and the units follow the team colour, so a leader can look mismatched with their army.
- **Eye drawing is parametric but 2D-flat:** expressions (angry, shock) only change brow and lid openness, not each style's eye shape.
- **Colour and leader are still two settings.** Picking a leader now sets the team's colour to the leader's nation (and a random leader brings theirs when rolled), but the nation lives only in `campaign.json`, so `applySkirmish` takes a `nationOf` map from the launcher. Putting the nation on the loadout (or in the registry) would remove that plumbing.
- **No tileset picker in the map editor.** The editor carries a map's `tileset` through (and draws palette icons in it) but a new map cannot choose one without editing the JSON. The palette lists every terrain and ground whatever the tileset.
- **Saved maps live in one browser** (localStorage, `pocketwars.editor.*`). Sharing a map means downloading the file and adding it to `data/maps/` by hand; skirmish lists saved maps under `my-<id>` so they never clash with shipped ids.
- **Symmetry assumes the players sit in mirror order** (copy n of something owned by player p goes to player p + n x players/copies); maps whose HQs are laid out otherwise need the owners fixed by hand.
- **Undo is still one level.** A build can now be taken back (the unit goes, the price returns, the property can build again), but building and then moving a unit replaces the build's snapshot, so only the move can be undone afterwards. A history list would fix it (see the single-level note in `Game`). In fog of war a build that reveals new tiles cannot be undone, like a move.
- **The movement overlay and the narrow roads were judged from headless PNG renders**, not on a phone: the blue tint, the drifting bands and the joined two-tone outline (also used for the red attack ring) of the reach area, and the road strip width (42% of a tile, `ROAD_WIDTH`). On a busy sea tile the tint is the weakest part, and the outline and bands carry it. A two-lane road draws as two separate strips with ground between them.
- **The technical (Recon)** lost its rust-coloured door patch; the dark team-colour bed rail and vision slit are still on it, in case "the colour patch" meant one of those.

## Design notes (how it works on purpose, not work items)

- **Walls block aircraft** (like Advance Wars pipes, and as "impenetrable" asked). If flyers should cross them, give `wall` an `air` move cost; nothing else depends on it.
- **A breakable wall is always intact at the start.** The cracked wall is placed by the `wall_breach` terrain when the game starts, unless a unit is already there; a map cannot say "this section is already broken" other than by not using a breach. The editor removes a unit painted over a breach.
- **Units see every tile they could move to,** so in fog an ordinary unit can no longer bump into an enemy on its path; interrupted moves come only from hidden units (submarines, cloak) again.
- **Undo is nearly gone in fog**, by design: any order that brings a tile into sight clears it, and most moves do.
- **The AI ignores fog** (as asked) and never goes out of its way to destroy jammers; it breaks cracked walls only when nothing better is in reach (`breakWall`) and does not reason about walls beyond the distance field.
- **Siege is a flag on weapons** (`siege: true`), and structures' damage skips armor, toughness and cover entirely; `rules.structureDamage` holds the two multipliers. Durability values and the 1.5 / 0.25 split are first guesses with no damage-baseline cases.
- **The AI still ignores fog of war** (as before): the strategist honours cloaking and submarines (what it cannot see it does not plan
  around) but sees through jammer fog.
  for example a less-tuned profile) would be a small addition through `game.aiSetup`.
- **Fog movement rule is human-only.** A fogged player cannot move into tiles they have never seen; the computer is never fogged, so it
  still moves anywhere (and the AI still sees everything).
- **Only the sniper is revealed by firing.** The always-cloaked units (spy, stealth fighter/bomber/copter) stay hidden after they shoot unless an enemy is adjacent or has radar; `cloak.revealedByFiring` exists if that should change.

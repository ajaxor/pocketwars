# The computer opponent

Several AI **engines** live side by side in `src/ai/`. Each plays the same game through the same rules, so a new one can be written next
to the old ones and **scored against them** in the arena before it becomes the default. Today there are two:

| Engine | What it is |
|---|---|
| `greedy` | The first opponent, kept unchanged as a baseline: each unit takes the order that looks best right now, by hand-set weights; production follows fixed lists. |
| `strategist` | The default. Plans the whole turn, reads the enemy's reply, handles islands and landings, values units from their stats, and plays one of many game plans that it changes when they fail. It tunes itself by playing games. |

`data/ai.json` holds one profile per engine and says which is the default:

```json
{ "default": "strategist", "engines": { "greedy": { "weights": {...}, "build": {...} }, "strategist": { "params": {...}, "unitBias": {...}, "strategyWeight": {...}, "tuned": {...} } } }
```

## How a computer turn runs

An engine's `turn(game, ctx)` is a generator that hands out **steps**, one at a time: an order (`game.act`), a submarine surfacing, a
carrier dropping troops, a build. The runner (`src/ai/runner.js`) carries each step out and sends the result back, and the engine reads the
board afresh before choosing the next. The UI (`src/ui/session.js`) uses the same runner and animates between steps; tests and tools call
`playTurn(game)`.

`ctx` gives the engine its profile, a seeded random generator, a memory object kept in `game.state.ai[player]` (saved with the game) and,
in the real game, what it has learned about the player across battles (`src/ai/history.js`).

Which engine plays whom: `game.aiSetup[player] = { engine, profile?, history? }`, or else the data's default.

## Adding an engine

1. Write `src/ai/<name>.js` (or a folder) exporting an object `{ id, name, description, turn, validateProfile? }`.
2. Register it in `ENGINES` in `src/ai/engines.js`, and give it a profile in `data/ai.json` (`engines.<id>`, even `{}`).
3. Score it: `npm run ai:arena -- <id> strategist`. Only make it the `default` once it wins.

## The strategist

`src/ai/strategist/`. Each turn:

1. **Strategy** (`selector.js`, `strategies.js`). On its first turn it rolls a game plan from `data/ai-strategies.json` among those that
   suit the map and its factories, nudges the plan's numbers a little (so the same plan never plays out quite the same way), and every
   few days checks its share of the total worth. A plan that has had its time and is failing is dropped for one not yet tried, preferring
   plans whose favourite units hurt what the enemy is actually fielding.
2. **Situation** (`situation.js`). Where every enemy could move and fire next turn: a **threat map**, read as "how much of this unit's
   value could the enemy take off it if it stopped here". This is the cheap one-move look-ahead. It also weighs the balance of forces:
   stronger, the army presses on; weaker, it is careful.
3. **Goals** (`goals.js`). Capturers are each given their own property to take. Carriers head for landing sites. Fighters head for tiles
   they can fire from, at what they hurt most; the plan decides whether that is the enemy army, their HQ, their properties, or a mix,
   and whether to mass first at a rally point. Everything is checked against the **landmasses** (`analysis.js`): a unit is only sent where
   its kind of movement can get.
4. **Orders** (`tactics.js`, `index.js`). Every tile a unit can reach is scored: progress toward its goal, cover, friends nearby, the
   threat there, and the best thing it can do from there (an attack's damage minus the counterattack, a kill, a hit the rest of the army
   can finish off, a capture, a heal...). The planner then carries out the strongest orders first (kills, then artillery, then other
   attacks, captures, support, and finally moves, front units first) and re-plans the units near each fight, so **focus fire** happens.
5. **Production** (`production.js`). No unit is named anywhere: each type on a factory's menu is valued from its **stats** against what
   the enemy has (and, less, what it could build), counting only enemies it can actually reach from that factory, plus the jobs that need
   doing (properties to capture on its landmass, land across the water for a carrier, units to heal). The plan's tastes, the tuned bias
   for the type and diminishing returns for duplicates multiply in. A **new unit or a balance change is understood at once**.

### Islands

- `analysis.js` splits the map into landmasses per kind of movement. A tank built on an island reaches nothing across the water, so its
  worth is zero and it is not built; once the enemy lands on the island, ground units are worth building again to throw them out.
- Ships and planes value targets they can get within range of: a cruiser can shell a coastal city from the sea.
- **Landings**: carriers (transport copter, troop transport, APC) are worth building when there is land worth taking that no walker of
  ours can reach. They head for tiles next to that land, close to a property, and drop their troops when the property is within a walk;
  the troops then capture. Island land and the enemy HQ come first. A flier only plans landings it can make and still fly home to refuel.
- Units that swim (marines, hover and amphibious tanks, divers) simply see the sea as passable and are valued accordingly.
- The `island_hopping`, `amphibious_assault` and `coastal_bombardment` plans lean into all of this.

### Not being exploitable

A fixed AI can be learned and beaten the same way every time. The strategist works against that in four ways:

- **Many plans** (19 today), each a different army and way of fighting, chosen per battle.
- **Jitter**: every plan's aggression, caution and so on is nudged by up to 12% per battle.
- **Switching**: a plan that is losing is replaced mid-battle, by one suited to what the enemy has built.
- **Memory**: the game keeps, in the browser, which plans have beaten this player and which they have seen (`src/ai/history.js`). Plans
  that worked are favoured, plans the player has seen less of get a novelty bonus, and last battle's plan is avoided.

## Strategies (`data/ai-strategies.json`)

A strategy is data. To add one, add an entry; `npm run validate` checks it.

```json
{
  "id": "tank_assault",
  "name": "Tank assault",
  "summary": "Mass tracked armour and roll over the front.",
  "when": ["groundRoute", "canBuild:tread"],
  "weight": 1,
  "build": { "moveClass": { "tread": 1.7 }, "category": { "aircraft": 0.6 }, "role": { "capture": 0.8 } },
  "tactics": { "target": "army", "aggression": 1.25, "caution": 0.8, "mass": 4 }
}
```

- `when`: every condition must hold (`!` negates). Named ones: `groundRoute` (infantry can walk to an enemy HQ), `islands` (it cannot),
  `bigMap`, `manyNeutrals`, `freeForAll`, `enemyAir`, `enemyNavy`. Open-ended: `canBuild:<x>` where x is a unit id, category, tag,
  move class, role or attribute, `|` for any of several (`canBuild:carrier|amphibious`). Add a named one to `CONDITIONS` in `strategies.js`.
- `weight`: how often it is picked, relative to the others (default 1).
- `build`: multipliers on how much it wants a unit type, matched by `unit`, `category`, `moveClass`, `tag`, `role` (capture, carrier,
  healer, supplier, layer, radar, indirect, combat), `attribute` (cloak, ...), or `fast` (move 6+), `heavy` (cost 10000+), `cheap`
  (3000 or less). Every match multiplies in. Prefer roles, tags and classes to unit ids, so the plan keeps working as units change.
- `tactics`: `target` (what the army marches on: `army`, `hq`, `properties`, `balanced`), `aggression` (attack value, and less caution),
  `caution` (weight of the threat map), `capture`, `mass` (fighting units to gather before advancing), `landing`, `retreat` (scales the
  HP at which units go home to repair).

## Tuning (`npm run ai:tune`)

Every number the strategist plays by is in `src/ai/strategist/params.js`, with the range the tuner may move it in. The tuned values live
in `data/ai.json` (`engines.strategist`): `params`, a `unitBias` per unit type (0 = none) and a `strategyWeight` per plan (1 = as written).

`tools/ai/tune.mjs` runs a (1+λ) evolution strategy: each round a few variants of the current champion (one to four numbers nudged)
play the champion on a few screening maps (both seat orders, same seeds). Only the best variant, if it scored well, plays a larger
fresh batch; if it holds up it becomes the champion. Rounds are cheap (about 12 s on two cores) and games stop at day 20 (judged on worth). At the end the champion has to beat the profile it started from over every map (the gate) before
anything is written.

**Scoring (`tools/ai/lib/graded.mjs`).** Games are not just won or lost: they are played to a time limit and scored on the material lead
held when it runs out (a 75% share of both armies' worth counts as a full win). There are three windows, short (8 days), medium (14) and
long (30), set with `--windows`. Short games are cheap, so more are played, but they carry the least weight (15%, against 40% and 45%):
a short window pays for early captures and must not teach the AI to spam infantry at the cost of its mid game. A profile is also
refused unless it is at least even in the medium and long games alone, however well it opens. A game that is actually won before the
limit scores 1 plus an early bonus, one lost scores 0 minus the same, and the confirmation of every new champion includes a long game,
so a profile that cannot finish games does not get through.

**It follows the game as it changes.** The search space is built from the data each time: a new unit gets a bias to tune, a new
strategy a weight. `data/ai.json` records a hash of what it was tuned on (units, weapons, leaders, rules, strategies, maps and the
strategist's code); `npm run ai:tune -- --check` says whether that is stale.

```
npm run ai:ratchet -- --sessions 6 --minutes 10 --commit --push   short sessions, each shipped on its own
npm run ai:tune -- --minutes 10 --write          one session; write data/ai.json if the result passes the gate
npm run ai:tune -- --check                        is the tuning stale? (exit 2 when it is)
npm run ai:ratchet -- --sessions 1 --minutes 15 --if-stale --commit --push   only when stale
```

Tuning is run by hand, on purpose: there is no workflow for it. Run it after changing units, strategies, maps or the AI's code (`--check`
says when it is stale), commit the resulting `data/ai.json`, and push.

## Tuning one number (`npm run ai:sweep`)

`npm run ai:sweep -- --param params.threat` (`--list` shows everything that can be swept: `params.*`, `unitBias.<unit>`,
`strategyWeight.<id>`) tries a spread of values across the number's whole range, then narrows around the best in two more passes, each on
a bigger sample, and checks the winner against the current profile on a fresh sample before it will keep it (`--write`). Every value in
a pass plays the same games, and the response curve is printed, so it shows how much the number matters at all. About 2 minutes on two
cores (`--plan`, `--passes`, `--points` change it).

## The arena (`npm run ai:arena`)

Plays engines (or profiles) against each other on every map, both seat orders per seed, random leaders from the seed (the same leaders
per slot when the seats swap), and reports wins, losses, draws and games judged at the day limit, per map.

```
npm run ai:arena -- strategist greedy                         the two engines' shipped profiles
npm run ai:arena -- strategist=tools/ai/out/strategist-tuned.json strategist   a candidate profile against the shipped one
options: --maps all|2p|shipped|id,id --seeds 4 --days 30 --leaders harlan,ada --no-leaders --workers N --json out.json --quiet
```

A game still going at the day limit is judged on **worth** (`src/ai/evaluate.js`): army value at its HP, five days of income, and money
in the bank up to three days of income; a player with 60% of the total wins it, otherwise it is a draw.

**Training maps** live in `tools/ai/maps/` and are included in `all` and `2p`: layouts the shipped maps do not have. `archipelago` is
two home islands and three islets with no land in common (the shipped maps all keep every HQ reachable on foot).

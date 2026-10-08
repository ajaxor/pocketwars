# Attributes

An attribute is a named special rule attached to a unit or terrain in JSON:

```json
"soldier": { "...": "...", "attributes": { "capture": true } }
```

The catalogue lives in `src/engine/attributes.js` (docs + config validation). Unknown attributes, or attributes on the
wrong kind of entity, fail validation.

## Unit attributes

| Attribute | Meaning | Tests |
|---|---|---|
| `capture` | Can capture properties it stands on; progress per action = current HP, plus `{ bonus }` when configured (the flamethrower: 5). | `tests/attributes/capture.test.js` |
| `indirect` | Cannot move and fire in the same turn; no counterattack either way. Every weapon needs `range[0] >= 2`. (Not the same as the `indirect_ground` target mode, which decides whether obstacles block a shot: see [combat.md](combat.md).) | `indirect.test.js` |
| `ignoresTerrainDefense` | Terrain defense does not reduce damage this unit takes. | `ignoresTerrainDefense.test.js` |
| `submerge` | Can dive (an order, after moving) on `submergible` terrain and surface again. Config `{ layer, move? }` names the layer while down (`move`: the speed while down, lower than the surface speed); a unit that has not moved can dive or surface for free first (`game.setSubmerged`), or after moving as an order; if that layer is `hidden`, enemies only see the unit when adjacent or in `sonar` range. Ending a move off deep water brings it up. With `auto: true` (the diver) there are no Submerge/Surface orders: the unit is down exactly while it stands on deep water. | `tests/engine/naval.test.js` |
| `sonar` | Detects hidden enemies within this many tiles (integer >= 2; adjacent units are always noticed). | `tests/engine/naval.test.js` |
| `moveFirePenalty` | Config `{ multiplier }`: the weapon does that share of its damage when the unit moved this turn before firing (the motorcycle: 0.5). Counterattacks are never reduced. | `tests/engine/new-infantry.test.js` |
| `cloak` | Hidden from other players unless one of their units is adjacent or has `radar` in range. Config `true`: everywhere. Config `{ terrain: [ids], revealedByFiring? }`: only on those terrains (the sniper in forest, rough and mountain); with `revealedByFiring` an attack reveals the unit until its owner's next turn starts. Keeps its own layer. Sonar does not find it. | `tests/attributes/cloak.test.js` |
| `radar` | Finds cloaked enemies within this many tiles (integer >= 2). | `tests/attributes/cloak.test.js` |
| `heal` | A Heal order (after moving, instead of Wait): every damaged friendly unit of the configured categories next to the unit regains HP, optionally for a share of its price. | `tests/attributes/heal.test.js` |
| `rest` | Recovers HP at turn start if it did not move the previous turn. | `tests/attributes/heal.test.js` |
| `terrainDefenseMultiplier` | Multiplies the terrain defense this unit gets (`2` doubles it; must be > 1). No effect on 0-defense terrain, and `ignoresTerrainDefense` still wins. | `terrainDefenseMultiplier.test.js` |
| `ammo` | `{max, low, cost?}`: a limited supply, tracked as `unit.ammo`. Weapons with an `ammo` cost spend it; a bullet shows on the tile (flashing at `low` or fewer, steady red at 0). Generic: any unit can have it. | `tests/attributes/ammo.test.js` |
| `fuel` | `{max, low}`: a flyer burns 1 per turn as its owner's turn ends, whether it moved or not (`unit.fuel`, floored at 0); the tank never limits a move. A fuel can shows bottom left of the tile (flashing yellow at `low` or fewer, steady red at 0). Refuelled for free at the start of its owner's turn on or next to their airfield, beside their aircraft carrier, or (units tagged `helicopter`) beside a supply truck (`supply.fuelTags`), and by Resupply/Supply orders. A flyer with an empty tank never crashes: it cannot attack, and loses its radar, until refuelled. All flyers; helicopters carry more (8) than planes (6 or fewer). | `tests/attributes/fuel.test.js` |
| `attacksPerTurn` | A whole number (2+): the unit's order does not end its turn until it has made that many attacks; between them it stays put (it is `halted`, like after an interrupted move). Dreadnought: 2. | `tests/attributes/attacksPerTurn.test.js` |
| `deploy` | `{unit, ammo?, basic?}`: a separate, factory-like action (before or after the carrier's own order, once per turn): a new `unit` is placed on the carrier's tile and ordered with the normal move-and-act order (it can attack; cancelling puts it back), spending `ammo` (default 1). Not on a just-built carrier. Requires `ammo`. Transport copter. | `tests/engine/transport.test.js` |
| `surfacesToFire` | A submerged unit that attacks is brought up by it and stays exposed until it dives again (missile sub). Requires `submerge`. | `tests/engine/gallery-units.test.js` |
| `supply` | `{categories, repair?, fuelTags?}`: a Supply order (after moving) refills the ammo of adjacent friendly units of those categories at the usual price per round, and repairs them `repair` HP for free (truck: no repair; carrier: aircraft, 2 HP). `autoRepair` (carrier) also repairs adjacent aircraft at the start of their owner's turn, paid like a building. | `gallery-units.test.js` |
| `reloads` | A unit that did not move last turn is fully reloaded for free at the start of its next turn (SAM launcher). Requires `ammo`. | `gallery-units.test.js` |
| `layMines` | `{unit, range}`: a Lay order (after moving) puts a `mine` unit on a free tile within `range` (range 1 = the four orthogonal neighbours; the mine layer uses 1) that the mine could enter, for its price (`mines.js`). | `gallery-units.test.js` |
| `mine` | `{damage, triggers}`: never acts; hidden; when an enemy move is interrupted by it and the mover's category is in `triggers` it detonates (damage can kill), vanishes, and cancels the rest of that move. Infantry only bump into it; aircraft and `ignoresMines` units pass over. | `gallery-units.test.js` |
| `ignoresMines` | Mines never go off under this unit (hover tank). | `gallery-units.test.js` |
| `structure` | `true` or `{ durability }`. A fixed defence or wall section placed by the map (turrets, jammer, cracked wall; `move` must be 0). It takes its own kind of damage: no armor, toughness or cover; weapon damage x `rules.structureDamage.siege` (1.5) for a weapon marked `siege` (artillery, bombs, missiles, rockets) or `.other` (0.25) for anything else, divided by the durability. Never built, captured, carried or healed; does not keep its owner in the game; kept by leader formations; may be neutral (`owner: null` in the map file, drawn dark grey), an enemy of everyone. Structures take no orders: at the end of each player's turn that player's armed structures fire at the enemy they would hurt most, then the armed neutral ones fire at that player's units (`structureFire` in `structures.js`). When its owner is knocked out it turns neutral. | `tests/engine/structures.test.js` |
| `wallSection` | A breakable piece of wall (cracked wall): drawn by the wall layer, never shot by turrets, broken by the AI only to open the way. Requires `structure`. | `structures.test.js` |
| `jammer` | While any unit with it is on the board, human players are in fog of war (`fog.js`); the computer never is. Lifted when the last jammer is destroyed. | `tests/engine/fog.test.js` |
| `blocksLineOfSight` | Like the terrain attribute: the unit is an obstacle for direct fire and for sight in fog, of this height, while it stands (cracked wall). | `structures.test.js` |

## Terrain attributes

| Attribute | Meaning | Tests |
|---|---|---|
| `property` | Ownable, capturable tile: `income`, `capturePoints`, `repair`, `repairs` (the unit categories it repairs at turn start, paid at `rules.repairCostRate` x unit cost / 10 per HP; ships must be beside a shipyard; ground buildings never repair aircraft), `builds` (unit categories), units are built on the property itself with a free move (see `fresh` in `game.js`); one build per property per turn. | `property.test.js` |
| `resupply` | `{range, categories}`: refills the ammo of its owner's units of those categories that stop within `range` tiles (1 = on or next to it); the Resupply action (offered in place of Wait) refills it for a price and ends its turn. Airfield: aircraft. Requires `property`. | `tests/attributes/ammo.test.js` |
| `blocksLineOfSight` | Obstacle for direct fire; the number is its height (forest 1, mountain and buildings 2). | `sight.test.js` |
| `vantage` | A firer standing here shoots over obstacles lower than this number (mountain 2). | `sight.test.js` |
| `submergible` | Deep water: `submerge` units can dive here. | `tests/engine/naval.test.js` |
| `wall` | A wall tile, drawn as linked pipes (`render/walls.js`). `true`: solid (give it null move costs: nothing crosses, aircraft included). `{ structure }`: a breakable section: a neutral unit of that type (the cracked wall) is put on it when the game starts; once destroyed the tile is rubble with its own move costs. | `structures.test.js` |
| `visionBonus` | Fog of war: a ground unit standing here sees this many tiles further (mountain 2). | `fog.test.js` |
| `ruin` | `{ becomes, cost }`: the shell of a building (ruined city, ruined factory). A unit with `capture` standing on it may Rebuild: the owner pays `cost`, the tile becomes the `becomes` terrain (a property) owned by the unit's owner at once, and the unit's turn ends. Kept in `state.terrain`, so Undo and Reset see it (`engine/rebuild.js`). | `tests/engine/rebuild.test.js` |
| `victoryOnCapture` | Capturing it knocks its owner out of the game (HQ): their units leave the board and their properties go neutral. The last player left wins. Requires `property`. | `capture.test.js`, `turns.test.js` |

## Other data-driven stats (not attributes)

Terrain `moveCost` per move class (`null` = impassable); unit `layer`, `weapons`, `toughness` and `armor`, and the weapons table
(damage, armor piercing, range, target modes, and `onlyTags`: the weapon can only hit units carrying one of those unit `tags`, the hunter sub's torpedoes vs `sub`): see [combat.md](combat.md); `layers`/`targetModes`/`moveClasses`/`maxHp` in
`rules.json`; AI tuning in `ai.json` (one profile per engine, see docs/ai.md). Layer and target-mode rules are covered by `tests/attributes/layers.test.js`.

## Adding an attribute

1. Add an entry to `UNIT_ATTRIBUTES` or `TERRAIN_ATTRIBUTES` (doc + `check`).
2. Enforce it in the relevant engine module.
3. Add `tests/attributes/<name>.test.js` using two fixture units that differ only in that attribute.
4. Assign it in `data/*.json`; `tests/data/shipped-data.test.js` pins which entities carry which attributes.


**Join:** a damaged unit may move onto a damaged friend of the same type (`src/engine/join.js`); HP adds up to the maximum, the lower ammo and fuel carry over, and the partner is spent for the turn.

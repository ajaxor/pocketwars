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
| `capture` | Can capture properties it stands on; progress per action = current HP. | `tests/attributes/capture.test.js` |
| `indirect` | Cannot move and fire in the same turn; no counterattack either way. Every weapon needs `range[0] >= 2`. (Not the same as the `indirect_ground` target mode, which decides whether obstacles block a shot: see [combat.md](combat.md).) | `indirect.test.js` |
| `ignoresTerrainDefense` | Terrain defense does not reduce damage this unit takes. | `ignoresTerrainDefense.test.js` |
| `submerge` | Can dive (an order, after moving) on `submergible` terrain and surface again. Config `{ layer }` names the layer while down; if that layer is `hidden`, enemies only see the unit when adjacent or in `sonar` range. Ending a move off deep water brings it up. With `auto: true` (the diver) there are no Submerge/Surface orders: the unit is down exactly while it stands on deep water. | `tests/engine/naval.test.js` |
| `sonar` | Detects hidden enemies within this many tiles (integer >= 2; adjacent units are always noticed). | `tests/engine/naval.test.js` |
| `moveFirePenalty` | Config `{ multiplier }`: the weapon does that share of its damage when the unit moved this turn before firing (the motorcycle: 0.5). Counterattacks are never reduced. | `tests/engine/new-infantry.test.js` |
| `cloak` | Hidden from other players unless one of their units is adjacent or has `radar` in range. Config `true`: everywhere. Config `{ terrain: [ids], revealedByFiring? }`: only on those terrains (the sniper in forest, rough and mountain); with `revealedByFiring` an attack reveals the unit until its owner's next turn starts. Keeps its own layer. Sonar does not find it. | `tests/attributes/cloak.test.js` |
| `radar` | Finds cloaked enemies within this many tiles (integer >= 2). | `tests/attributes/cloak.test.js` |
| `heal` | A Heal order (after moving, instead of Wait): every damaged friendly unit of the configured categories next to the unit regains HP, optionally for a share of its price. | `tests/attributes/heal.test.js` |
| `rest` | Recovers HP at turn start if it did not move the previous turn. | `tests/attributes/heal.test.js` |
| `terrainDefenseMultiplier` | Multiplies the terrain defense this unit gets (`2` doubles it; must be > 1). No effect on 0-defense terrain, and `ignoresTerrainDefense` still wins. | `terrainDefenseMultiplier.test.js` |
| `ammo` | `{max, low, cost?}`: a limited supply, tracked as `unit.ammo`. Weapons with an `ammo` cost spend it; a bullet shows on the tile (flashing at `low` or fewer, steady red at 0). Generic: any unit can have it. | `tests/attributes/ammo.test.js` |
| `deploy` | `{unit, ammo?}`: a separate, factory-like action (before or after the carrier's own order, once per turn): a new `unit` is placed on the carrier's tile and ordered with the normal move-and-act order (it can attack; cancelling puts it back), spending `ammo` (default 1). Not on a just-built carrier. Requires `ammo`. Transport copter. | `tests/engine/transport.test.js` |

## Terrain attributes

| Attribute | Meaning | Tests |
|---|---|---|
| `property` | Ownable, capturable tile: `income`, `capturePoints`, `repair`, `builds` (unit categories), units are built on the property itself with a free move (see `fresh` in `game.js`); one build per property per turn. | `property.test.js` |
| `resupply` | `{range, categories}`: refills the ammo of its owner's units of those categories that stop within `range` tiles (1 = on or next to it); the Resupply action (offered in place of Wait) refills it for a price and ends its turn. Airfield: aircraft. Requires `property`. | `tests/attributes/ammo.test.js` |
| `blocksLineOfSight` | Obstacle for direct fire; the number is its height (forest 1, mountain and buildings 2). | `sight.test.js` |
| `vantage` | A firer standing here shoots over obstacles lower than this number (mountain 2). | `sight.test.js` |
| `submergible` | Deep water: `submerge` units can dive here. | `tests/engine/naval.test.js` |
| `victoryOnCapture` | Capturing it knocks its owner out of the game (HQ): their units leave the board and their properties go neutral. The last player left wins. Requires `property`. | `capture.test.js`, `turns.test.js` |

## Other data-driven stats (not attributes)

Terrain `moveCost` per move class (`null` = impassable); unit `layer`, `weapons`, `toughness` and `armor`, and the weapons table
(damage, armor piercing, range, target modes): see [combat.md](combat.md); `layers`/`targetModes`/`moveClasses`/`maxHp` in
`rules.json`; AI weights and build rules in `ai.json`. Layer and target-mode rules are covered by `tests/attributes/layers.test.js`.

## Adding an attribute

1. Add an entry to `UNIT_ATTRIBUTES` or `TERRAIN_ATTRIBUTES` (doc + `check`).
2. Enforce it in the relevant engine module.
3. Add `tests/attributes/<name>.test.js` using two fixture units that differ only in that attribute.
4. Assign it in `data/*.json`; `tests/data/shipped-data.test.js` pins which entities carry which attributes.

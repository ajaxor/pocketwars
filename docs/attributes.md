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
| `terrainDefenseMultiplier` | Multiplies the terrain defense this unit gets (`2` doubles it; must be > 1). No effect on 0-defense terrain, and `ignoresTerrainDefense` still wins. | `terrainDefenseMultiplier.test.js` |

## Terrain attributes

| Attribute | Meaning | Tests |
|---|---|---|
| `property` | Ownable, capturable tile: `income`, `capturePoints`, `repair`, `builds` (unit categories). | `property.test.js` |
| `blocksLineOfSight` | Obstacle for direct fire; the number is its height (forest 1, mountain and buildings 2). | `sight.test.js` |
| `vantage` | A firer standing here shoots over obstacles lower than this number (mountain 2). | `sight.test.js` |
| `victoryOnCapture` | Capturing it wins the game (HQ). Requires `property`. | `property.test.js` |

## Other data-driven stats (not attributes)

Terrain `moveCost` per move class (`null` = impassable); unit `layer`, `weapons`, `toughness` and `armor`, and the weapons table
(damage, armor piercing, range, target modes): see [combat.md](combat.md); `layers`/`targetModes`/`moveClasses`/`maxHp` in
`rules.json`; AI weights and build rules in `ai.json`. Layer and target-mode rules are covered by `tests/attributes/layers.test.js`.

## Adding an attribute

1. Add an entry to `UNIT_ATTRIBUTES` or `TERRAIN_ATTRIBUTES` (doc + `check`).
2. Enforce it in the relevant engine module.
3. Add `tests/attributes/<name>.test.js` using two fixture units that differ only in that attribute.
4. Assign it in `data/*.json`; `tests/data/shipped-data.test.js` pins which entities carry which attributes.

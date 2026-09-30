# Units, weapons and targeting

Damage is computed from a few stats instead of a unit-versus-unit table, so adding a unit means giving it stats, not
filling in a row and a column.

## Data

`data/units.json` (per unit): `layer` (where it is: `ground`, `low_air`, `high_air`, `surface`, `underwater`, `structure`),
`weapons` (list of ids from `weapons.json`), `toughness`, `armor`.

| Stat | Meaning |
|---|---|
| `toughness` | Durability. All incoming damage is **divided** by it. `1` (the default) is the baseline and the softest value in use; `2` takes half. |
| `armor` | `0..1`. Cuts incoming damage by that fraction, less whatever the weapon pierces. Default `0`. |

`data/weapons.json` (per weapon): `damage`, `armorPiercing`, `range`, `targets`.

| Stat | Meaning |
|---|---|
| `damage` | Percent of a full-HP unit removed by a full-HP attacker at `toughness 1`, no armor, no terrain (60 = 6 HP). |
| `armorPiercing` | `0..1`, default `0`. The fraction of the defender's `armor` this weapon ignores. |
| `range` | `[min, max]` tiles (Manhattan). |
| `targets` | Target modes it can fire at, see below. |

```
damage (HP) = weapon.damage x (attackerHP / 10) x (1 - armor x (1 - armorPiercing)) / toughness
              x (1 - terrainStars x defenderHP / 100) / 10
```

Terrain stars: terrain `defense`, times the unit's `terrainDefenseMultiplier` if it has one, or 0 with `ignoresTerrainDefense`.
Results under 1 HP keep one decimal; otherwise they round to whole HP.

A unit can carry several weapons. When it attacks, the **first weapon in its list** whose target mode, range and line of
sight fit the defender from the tile it stands on is the one fired (and the one used for the damage preview and for the
counterattack check).

## Target modes

`rules.json -> targetModes`: each mode names a layer, and `lineOfSight: true` makes shots of that mode need a clear line.
A weapon lists the modes it can fire at.

| Mode | Hits | Line of sight |
|---|---|---|
| `direct_ground` | ground units | needed |
| `indirect_ground` | ground units | not needed (artillery, bombs) |
| `low_air`, `high_air` | air units on that layer | not needed |
| `surface`, `underwater` | ships / submarines (reserved, no such units yet) | not needed |
| `structure` | structures (reserved, see below) | not needed |

Adding a mode is a data change: a new entry in `targetModes`, pointing at a layer in `rules.layers`.

## Line of sight

A direct shot is a straight grid line between the two tiles (the same tiles both ways round). Terrain with the
`blocksLineOfSight` attribute is an obstacle; its number is its height.

- forest `1`, mountain `2`, every building `2`
- the two end tiles never block, neither does an adjacent target, and **units never block**
- a firer standing on terrain with `vantage` shoots over obstacles lower than that number: mountains have vantage `2`, so a
  unit on a mountain sees over forests, but not over other mountains or buildings
- indirect fire and air targets ignore all of it

The attack outline drawn on the map is the weapon's range; the enemies that can really be hit (line of sight included) are the
ones highlighted.

## Structures

Buildings are still terrain (`property`), which is why they carry `blocksLineOfSight`. The `structure` layer and target mode
are reserved for when structures become their own entities that can be damaged, repaired and built; nothing targets them yet.

## Retuning

`tests/data/damage-baseline.json` pins the damage of ~240 matchups. After a deliberate change to `units.json` or
`weapons.json`, run `node tools/regen-damage-baseline.mjs` and review the diff.

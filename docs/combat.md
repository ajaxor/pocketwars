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
| `targetMultipliers` | Optional `{ targetMode: factor }`. Scales `damage` when the defender is reached through that mode, so a weapon can be strong against one layer (flak `low_air: 1.9`). Modes not listed use `1`. Each key must be one of the weapon's `targets`. |
| `indirect` | Optional `true`. An artillery-style weapon: it can only fire if the unit has not moved this turn, is never answered by a counterattack and is never used to counter. Needs a minimum range of at least 2. The unit attribute `indirect` makes all of a unit's weapons so; this lets one unit carry both kinds (the battleship's long guns and its melee secondary guns). |
| `fromTerrain` | Optional list of terrain ids. The weapon can only be fired from a tile of one of those terrains (the marine's boarding rifle: `sea`, `shoals`). From elsewhere it is not a candidate, and the order is refused with `wrong-terrain` when nothing else reaches. |
| `range` | `[min, max]` tiles (Manhattan). |
| `targets` | Target modes it can fire at, see below. |

```
damage (HP) = weapon.damage x targetMultiplier x (attackerHP / 10) x (1 - armor x (1 - armorPiercing)) / toughness
              x (1 - terrainStars x defenderHP / 100) / 10
```

Terrain stars: terrain `defense`, times the unit's `terrainDefenseMultiplier` if it has one, or 0 with `ignoresTerrainDefense`.
Results under 1 HP keep one decimal; otherwise they round to whole HP.

**Ambush.** A unit that begins its owner's turn hidden (cloaked, submerged, a sniper on cover) carries `unit.ambush` for that turn and its attacks are multiplied by `rules.ambushMultiplier` (1.5). Counterattacks on the enemy's turn never get it.

A unit can carry several weapons. When it attacks, every weapon whose target mode, range and line of sight fit the defender from
the tile it stands on is a candidate, and the one that would do the **most damage** to that defender wins (ties go to the weapon
listed first). That weapon is fired, named in the damage preview, and used for the counterattack. A weapon can also set `fx`
(`torpedo`, `depth`, ...) to override the unit's `attackFx` animation.

## Target modes

`rules.json -> targetModes`: each mode names a layer, and `lineOfSight: true` makes shots of that mode need a clear line.
A weapon lists the modes it can fire at.

| Mode | Hits | Line of sight |
|---|---|---|
| `direct_ground` | ground units | needed |
| `indirect_ground` | ground units | not needed (artillery, bombs) |
| `low_air`, `high_air` | air units on that layer | not needed |
| `surface`, `underwater` | ships / submerged submarines | not needed |
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

Buildings are still terrain (`property`), which is why they carry `blocksLineOfSight`. Walls are terrain too (`wall`: impassable to every
unit, height 1 for line of sight). The destructible structures (cannon, SAM and artillery turrets, the jammer, the cracked wall) are units
with the `structure` attribute on the `ground` layer, so every anti-ground weapon can hit them and they answer back like any unit
(`src/engine/structures.js`). A neutral one (`owner: null`) is hostile to everyone. Turrets are never ordered: at the end of each player's turn that
player's turrets fire at the enemy they would hurt most (only at what the player can see), then the neutral turrets fire at that player's
units. The `structure` layer and target mode are still unused.

Structures take their own kind of damage instead of armor and toughness: `weapon.damage x targetMultiplier x (attackerHP / 10) x
kind / durability`, with `kind` = `rules.structureDamage.siege` (1.5) for a weapon marked `siege: true` (howitzers, rockets, bombs,
missiles, mortars, battleship guns) and `.other` (0.25) for everything else; terrain gives them no cover. So artillery takes about half a
turret's HP in one shot while a tank cannon barely scratches it.

| Structure | Weapon | Durability | Notes |
|---|---|---|---|
| Cannon turret | turret cannon, range 1-3, direct, ground and ships | 2.7 | |
| SAM turret | SAM battery, range 1-4, aircraft only | 2.2 | |
| Artillery turret | fixed howitzer (siege), range 2-5, indirect, ground and ships | 2.4 | |
| Jammer | none | 1.8 | fog of war while it stands (`fog.js`); vision 3 |
| Cracked wall | none | 3 | `wallSection`; blocks line of sight; leaves rubble |

## Fog of war

`src/engine/fog.js`. While a jammer is on the board, human players see only what is within their units' `vision` (unit `vision`, else
`rules.vision[category]`; a mountain adds `visionBonus`; vision is not stretched to match movement) along a clear line (the direct-fire
rules above, except that buildings do not block sight; aircraft see over everything), plus `rules.vision.property` tiles round their
properties. A fogged player cannot move a unit into, or through, a tile they have never seen (the black part of the board): a unit moves
into the unknown a step at a time (`computeReach`). `canSee` hides every enemy unit outside that (a structure stays known on explored
tiles), so planning, targeting, interrupts and the AI-turn animations all follow. Enemy structures out of sight are remembered as last seen
(`state.remembered`, `rememberedStructures`) and drawn still, even after they are destroyed, until the tile is in sight again. The computer is never fogged. Explored tiles are remembered
(`state.explored`) and drawn greyed out; unexplored ones are black. An order that brings a new tile into sight cannot be undone.

## Retuning

`tests/data/damage-baseline.json` pins the damage of ~240 matchups. After a deliberate change to `units.json` or
`weapons.json`, run `node tools/regen-damage-baseline.mjs` and review the diff.

## Hidden units and detection

The `underwater` layer is marked `hidden` in `rules.json`. A unit with the `submerge` attribute is on that layer while
`unit.submerged` is true. A hidden enemy is visible to a player only when one of that player's units is adjacent, or within
`sonar` tiles (destroyers: 3): see `src/engine/detection.js`. There is no memory, so a sub that is no longer noticed is hidden again.

What "invisible" means: not drawn, tapping the tile shows nothing, it cannot be targeted and the AI ignores it, and it does not
block a move that was *planned* by a player who cannot see it. Previewing never reveals anything (the engine is not involved);
only carrying the order out does. If the path runs into a hidden unit, `Game.act` stops the mover on the last free tile, emits
an `interrupt` event, marks `unit.halted`, and returns `interrupted` without carrying out the action; the caller then issues a
second order from where the unit stands. A halted unit cannot move again this turn.

// Diving. A unit with the `submerge` attribute can dive on a tile with the terrain attribute `submergible` (deep water) and
// surface again; both are orders that end the unit's turn, like Wait, and can follow a move. A unit that has not moved yet can also
// dive or surface first, for free (game.setSubmerged), so that it travels under water (slower: `submerge.move`) or on the surface (faster). While it is down the unit is on the
// layer the attribute names (rules.json -> layers -> underwater), so only weapons with a matching target mode can hit it, and that
// layer is `hidden`, which is what detection.js acts on. A unit whose move ends on a tile that is not submergible comes up by itself. With `auto` (the diver) there are no orders: the unit is down exactly while it stands on submergible terrain.

import { attributeConfig, hasAttribute } from './attributes.js';
import { terrainAt, unitDef } from './queries.js';

/** Can this kind of unit dive at all? */
export const canDive = (game, unit) => hasAttribute(unitDef(game, unit), 'submerge');

/** Does this unit dive by itself (`submerge: { auto: true }`: the diver is under whenever it is on deep water, never by order)? */
export const divesByItself = (game, unit) => attributeConfig(unitDef(game, unit), 'submerge')?.auto === true;

/** How far `unit` can move this turn: its `move`, or the `submerge.move` of a unit that is under water (a submarine creeps while down). (Fuel never limits a move: a flyer may fly on an empty tank, it just crashes if it starts its next turn there, see fuel.js.) */
export function moveOf(game, unit) {
  const def = unitDef(game, unit);
  return unit.submerged ? attributeConfig(def, 'submerge')?.move ?? def.move : def.move;
}

/** Does this unit come up when it fires (`surfacesToFire`)? */
export const surfacesToFire = (game, unit) => hasAttribute(unitDef(game, unit), 'surfacesToFire');

/** Is the tile deep enough to dive on? */
export const submergibleAt = (game, x, y) => hasAttribute(terrainAt(game, x, y), 'submergible');

/** Could `unit`, standing on (x, y), dive now? */
export const canSubmergeAt = (game, unit, x = unit.x, y = unit.y) => canDive(game, unit) && !divesByItself(game, unit) && !unit.submerged && submergibleAt(game, x, y);

/** Could `unit` surface now? */
export const canSurface = (game, unit) => !!unit.submerged && !divesByItself(game, unit);

// Sabotage. A unit with the `sabotage` attribute (the spy) can, instead of capturing, sabotage an enemy property it stands on.
// A sabotaged property pays half its income and cannot build until its owner's next turn is over (`state.sabotaged` holds the tile
// indexes). The effect ends when that owner ends their turn (game.js endTurn), when the property changes hands (capture.js) or when
// its owner is knocked out (victory.js). A property can only be sabotaged once at a time.

import { hasAttribute } from './attributes.js';
import { ownerAt, propertyAt, snapshotUnit, tileIndex, unitDef } from './queries.js';

/** Is the property at (x, y) sabotaged right now? */
export const isSabotaged = (game, x, y) => game.state.sabotaged.includes(tileIndex(game.map, x, y));

/** Could `unit`, standing on (x, y), sabotage that tile? It has to be a property that another player owns and that is not already sabotaged. */
export function canSabotage(game, unit, x = unit.x, y = unit.y) {
  const owner = ownerAt(game, x, y);
  return hasAttribute(unitDef(game, unit), 'sabotage') && !!propertyAt(game, x, y) && owner !== null && owner !== unit.owner && !isSabotaged(game, x, y);
}

/** Sabotage the property under `unit` (already validated). Returns a 'sabotage' event. */
export function resolveSabotage(game, unit) {
  const { x, y } = unit;
  game.state.sabotaged.push(tileIndex(game.map, x, y));
  return [{ type: 'sabotage', unit: snapshotUnit(unit), x, y, owner: ownerAt(game, x, y), income: propertyAt(game, x, y).income }];
}

/** Lift the sabotage on one tile (it changed hands). */
export function clearSabotageAt(game, x, y) {
  const k = tileIndex(game.map, x, y);
  game.state.sabotaged = game.state.sabotaged.filter((t) => t !== k);
}

/** Lift the sabotage on every tile `player` owns: their turn is over (or they are out of the game: call before the owners change). */
export function clearSabotageOwnedBy(game, player) {
  const { map, state } = game;
  state.sabotaged = state.sabotaged.filter((k) => state.owners[Math.floor(k / map.width)][k % map.width] !== player);
}

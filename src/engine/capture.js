// Capturing properties. Governed by the unit attribute `capture` and the terrain attribute `property`
// (capturePoints to flip owner) plus `victoryOnCapture` (capturing it knocks its owner out; the last player left wins).

import { hasAttribute } from './attributes.js';
import { ownerAt, propertyAt, snapshotUnit, terrainAt, unitDef } from './queries.js';
import { eliminate } from './victory.js';

/** Could `unit` capture the tile at (x, y) if it stood there? */
export function canCapture(game, unit, x = unit.x, y = unit.y) {
  return hasAttribute(unitDef(game, unit), 'capture') && !!propertyAt(game, x, y) && ownerAt(game, x, y) !== unit.owner;
}

/**
 * Add the unit's HP (rounded up) to its capture progress on its current tile; flip the owner when the
 * property's capturePoints are reached. Returns a 'capture' event, plus on an HQ an 'eliminated' event for the owner it was taken
 * from, or 'gameOver' when that leaves the capturer as the only player.
 * The caller is responsible for having reset `unit.capture` if the unit moved to this tile.
 */
export function resolveCapture(game, unit) {
  const { x, y } = unit;
  const property = propertyAt(game, x, y);
  const before = unit.capture;
  unit.capture += Math.ceil(unit.hp);
  const completed = unit.capture >= property.capturePoints;
  const events = [{
    type: 'capture', unit: snapshotUnit(unit), x, y, owner: unit.owner, completed,
    previousOwner: game.state.owners[y][x], hq: hasAttribute(terrainAt(game, x, y), 'victoryOnCapture'),   // who held it (null: nobody), and is it an HQ
    from: before / property.capturePoints, to: Math.min(1, unit.capture / property.capturePoints),
    progress: unit.capture, needed: property.capturePoints,
  }];
  if (completed) {
    const previous = game.state.owners[y][x];
    game.state.owners[y][x] = unit.owner;
    unit.capture = 0;
    if (hasAttribute(terrainAt(game, x, y), 'victoryOnCapture') && previous !== null && previous !== unit.owner) {
      events.push(...eliminate(game, previous, 'hq'));
    }
  }
  return events;
}

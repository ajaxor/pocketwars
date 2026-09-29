// Capturing properties. Governed by the unit attribute `capture` and the terrain attribute `property`
// (capturePoints to flip owner) plus `victoryOnCapture` (ends the game).

import { hasAttribute } from './attributes.js';
import { ownerAt, propertyAt, snapshotUnit, terrainAt, unitDef } from './queries.js';

/** Could `unit` capture the tile at (x, y) if it stood there? */
export function canCapture(game, unit, x = unit.x, y = unit.y) {
  return hasAttribute(unitDef(game, unit), 'capture') && !!propertyAt(game, x, y) && ownerAt(game, x, y) !== unit.owner;
}

/**
 * Add the unit's HP (rounded up) to its capture progress on its current tile; flip the owner when the
 * property's capturePoints are reached. Returns a single 'capture' event (plus 'gameOver' on an HQ).
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
    from: before / property.capturePoints, to: Math.min(1, unit.capture / property.capturePoints),
    progress: unit.capture, needed: property.capturePoints,
  }];
  if (completed) {
    game.state.owners[y][x] = unit.owner;
    unit.capture = 0;
    if (hasAttribute(terrainAt(game, x, y), 'victoryOnCapture')) {
      game.state.winner = unit.owner;
      events.push({ type: 'gameOver', winner: unit.owner, reason: 'hq' });
    }
  }
  return events;
}

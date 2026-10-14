// Transfer: infantry hops between cities. A unit with the `transfer` attribute that ends its move on a property its owner holds (the HQ, a city, any
// building) can be sent to any OTHER EMPTY CITY (a property with `hub` that is not the HQ) the same owner holds, however far away. It arrives with its
// turn spent, keeping its HP, ammo and fuel, and loses its capture progress. A just-built unit has only its free move, so it cannot be transferred
// on the turn it was built. This is what lets infantry made at the HQ and the cities (economy.js, `hub`) reach the front.

import { hasAttribute } from './attributes.js';
import { ownerAt, propertiesOwnedBy, propertyAt, snapshotUnit, terrainAt, unitAt, unitDef } from './queries.js';

/** Can this kind of unit be transferred at all? */
export const canTransferType = (game, unit) => hasAttribute(unitDef(game, unit), 'transfer');

/** Is the property at (x, y) a city a unit can be transferred to: a hub that is not the HQ? */
const isCity = (game, x, y) => !!propertyAt(game, x, y)?.hub && !terrainAt(game, x, y).attributes.victoryOnCapture;

/** The empty cities `unit`'s owner holds that it could be sent to from (fromX, fromY): [{ x, y }]. The tile it is leaving counts as empty. */
export function transferTargets(game, unit, fromX = unit.x, fromY = unit.y) {
  if (!canTransferType(game, unit)) return [];
  const out = [];
  for (const p of propertiesOwnedBy(game, unit.owner)) {
    if (!isCity(game, p.x, p.y) || (p.x === fromX && p.y === fromY)) continue;
    const there = unitAt(game, p.x, p.y);
    if (there && there !== unit) continue;
    out.push({ x: p.x, y: p.y });
  }
  return out;
}

/**
 * Why `unit`, ending its move at `from`, cannot be transferred to `at`, or null when it can: 'cannot-transfer' (not that kind of unit),
 * 'not-your-property' (it must stand on a property of its owner), 'bad-destination' (not an empty city of its owner, or the tile it stands on).
 */
export function transferProblem(game, unit, from, at) {
  if (!canTransferType(game, unit)) return 'cannot-transfer';
  if (!propertyAt(game, from.x, from.y) || ownerAt(game, from.x, from.y) !== unit.owner) return 'not-your-property';
  if (!at || !transferTargets(game, unit, from.x, from.y).some((t) => t.x === at.x && t.y === at.y)) return 'bad-destination';
  return null;
}

/** Could `unit` be transferred from (fromX, fromY) to somewhere right now? (The order menu's test.) */
export const canTransferFrom = (game, unit, fromX, fromY) => !unit.fresh && !!propertyAt(game, fromX, fromY) && ownerAt(game, fromX, fromY) === unit.owner && transferTargets(game, unit, fromX, fromY).length > 0;

/** Move the unit to `at` (already validated). Returns a 'transfer' event: { unit (as it is now), from, to }. */
export function resolveTransfer(game, unit, at) {
  const from = { x: unit.x, y: unit.y };
  unit.moved = true;
  unit.x = at.x;
  unit.y = at.y;
  unit.capture = 0;
  return [{ type: 'transfer', unit: snapshotUnit(unit), from, to: { x: at.x, y: at.y } }];
}

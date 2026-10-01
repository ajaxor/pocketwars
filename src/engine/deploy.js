// Dropping troops. A unit with the `deploy` attribute (the transport copter) carries units "as ammo": an order, after the move, puts
// a new unit of config.unit on a free tile next to where the carrier stopped and spends config.ammo (default 1) of its ammo.
// The dropped unit is the carrier's, at full HP, and cannot act until next turn (it already used its turn getting off).
// The carrier's turn is over, like any action. The tile has to be one the dropped unit could enter (a soldier cannot be put in the sea).

import { attributeConfig } from './attributes.js';
import { ammoOf, spendAmmo } from './ammo.js';
import { moveCostAt } from './movement.js';
import { DIRS, inBounds, snapshotUnit, unitDef } from './queries.js';
import { makeUnit } from './state.js';

/** `{ unit, ammo? }` for a unit that can drop troops, or undefined. */
export const deployConfig = (game, unit) => attributeConfig(unitDef(game, unit), 'deploy');
/** Ammo one drop costs. */
export const deployCost = (config) => config.ammo ?? 1;

/**
 * Free tiles next to (x, y) a dropped unit could stand on. (x, y) is where the carrier will be (it may not have moved yet), so the
 * carrier itself never blocks a tile: if it is leaving its own tile, that tile is free too.
 */
export function dropTiles(game, unit, x = unit.x, y = unit.y) {
  const cfg = deployConfig(game, unit);
  if (!cfg) return [];
  const def = game.registry.unit(cfg.unit);
  return DIRS.map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
    .filter((t) => inBounds(game.map, t.x, t.y)
      && moveCostAt(game, def.moveClass, t.x, t.y) != null
      && !game.state.units.some((u) => u !== unit && u.x === t.x && u.y === t.y));
}

/** Why `unit`, stopping on (x, y), cannot drop a unit on `at`, or null when it can. */
export function deployProblem(game, unit, x, y, at) {
  const cfg = deployConfig(game, unit);
  if (!cfg) return 'cannot-deploy';
  if (ammoOf(game, unit) < deployCost(cfg)) return 'out-of-ammo';
  if (!at || !dropTiles(game, unit, x, y).some((t) => t.x === at.x && t.y === at.y)) return 'invalid-deploy-tile';
  return null;
}

/** Could `unit`, stopping on (x, y), drop a unit somewhere (it has the ammo and there is room)? */
export function canDeploy(game, unit, x = unit.x, y = unit.y) {
  const cfg = deployConfig(game, unit);
  return !!cfg && ammoOf(game, unit) >= deployCost(cfg) && dropTiles(game, unit, x, y).length > 0;
}

/** Put the unit on `at` (already validated) and spend the ammo. Returns a 'deploy' event. */
export function resolveDeploy(game, unit, at) {
  const { state, registry, map } = game;
  const cfg = deployConfig(game, unit);
  spendAmmo(game, unit, deployCost(cfg));
  const dropped = makeUnit(registry, map, state.nextUnitId++, { type: cfg.unit, owner: unit.owner, x: at.x, y: at.y, done: true });
  state.units.push(dropped);
  return [{ type: 'deploy', unit: snapshotUnit(unit), dropped: snapshotUnit(dropped), ammo: ammoOf(game, unit) }];
}

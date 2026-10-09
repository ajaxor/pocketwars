// Deploying troops. A unit with the `deploy` attribute (the transport copter) carries units "as ammo", and deploys like a factory builds:
// Deploy is its own action, apart from the carrier's move-and-act order and not ending it. It puts a new unit of config.unit on the
// carrier's tile (`carriedBy` names the carrier) and spends config.ammo (default 1) of the carrier's ammo; the player then orders that
// unit like any other: it moves off the carrier's tile (it has to leave it) and may attack, capture or wait. The new unit is at full HP.
// If the player cancels before ordering it, `undoDeploy` puts it back in the carrier. A carrier deploys once per turn (`unit.deployed`,
// cleared when its owner's turn starts), may deploy before or after its own move, and cannot deploy on the turn it was built (`fresh`, then `builtNow`, which lasts the whole turn).
// A deploy needs somewhere to go: at least one tile the new unit could reach from the carrier's tile.

import { attributeConfig } from './attributes.js';
import { ammoOf, spendAmmo } from './ammo.js';
import { computeReach } from './movement.js';
import { deployedType, snapshotUnit, unitAt, unitById, unitDef } from './queries.js';
import { makeUnit } from './state.js';

/** `{ unit, ammo? }` for a unit that can drop troops, or undefined. */
export const deployConfig = (game, unit) => attributeConfig(unitDef(game, unit), 'deploy');
/** Ammo one drop costs. */
export const deployCost = (config) => config.ammo ?? 1;

/**
 * Where a unit deployed by `carrier` could land: the tiles its movement reaches from the carrier's tile, other than that tile and
 * any occupied one. Returns { reach, tiles } (`reach` knows the paths), or null when `carrier` cannot deploy anything at all.
 */
export function deployReach(game, carrier) {
  const cfg = deployConfig(game, carrier);
  if (!cfg) return null;
  const dropped = makeUnit(game.registry, game.map, -1, { type: deployedType(game, carrier), owner: carrier.owner, x: carrier.x, y: carrier.y });
  const reach = computeReach(game, dropped);
  const tiles = [...reach.tiles()].filter((t) => (t.x !== carrier.x || t.y !== carrier.y) && !unitAt(game, t.x, t.y)).map((t) => ({ x: t.x, y: t.y }));
  return { reach, tiles };
}

/** Why `carrier` cannot deploy, or null when it can: 'cannot-deploy', 'just-built', 'already-deployed', 'out-of-ammo', 'no-room'. */
export function deployProblem(game, carrier) {
  const cfg = deployConfig(game, carrier);
  if (!cfg) return 'cannot-deploy';
  if (carrier.fresh || carrier.builtNow) return 'just-built';   // built this turn: even after its free move it cannot drop anything until its owner's next turn
  if (carrier.deployed) return 'already-deployed';
  if (ammoOf(game, carrier) < deployCost(cfg)) return 'out-of-ammo';
  if (!deployReach(game, carrier).tiles.length) return 'no-room';
  return null;
}

/** Could `carrier` deploy right now? */
export const canDeploy = (game, carrier) => deployProblem(game, carrier) === null;

/** Put the new unit on the carrier's tile (already validated) and spend the ammo. Returns a 'deploy' event. */
export function resolveDeploy(game, carrier) {
  const { state, registry, map } = game;
  const cfg = deployConfig(game, carrier);
  spendAmmo(game, carrier, deployCost(cfg));
  carrier.deployed = true;
  const dropped = makeUnit(registry, map, state.nextUnitId++, { type: deployedType(game, carrier), owner: carrier.owner, x: carrier.x, y: carrier.y });
  dropped.carriedBy = carrier.id;
  state.units.push(dropped);
  return [{ type: 'deploy', unit: snapshotUnit(carrier), dropped: snapshotUnit(dropped), ammo: ammoOf(game, carrier) }];
}

/**
 * Put a deployed unit back in its carrier, if it has not been ordered yet (it still sits on the carrier's tile, with its order unused).
 * Returns an 'undeploy' event list, or null when it cannot be taken back.
 */
export function undoDeploy(game, unit) {
  const carrier = unit.carriedBy != null ? unitById(game, unit.carriedBy) : null;
  if (!carrier || unit.done || unit.halted || unit.x !== carrier.x || unit.y !== carrier.y) return null;
  const cfg = deployConfig(game, carrier);
  game.state.units = game.state.units.filter((u) => u !== unit);
  carrier.ammo = ammoOf(game, carrier) + deployCost(cfg);
  delete carrier.deployed;
  return [{ type: 'undeploy', unit: snapshotUnit(carrier), removed: unit.id }];
}

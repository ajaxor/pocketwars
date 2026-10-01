// Dropping troops. A unit with the `deploy` attribute (the transport copter) carries units "as ammo", and works like a factory in the
// air: Deploy is its own action, apart from the carrier's move-and-act order. Before or after it moves (and whenever it is not busy
// being built), the carrier puts a new unit of config.unit down by moving that unit, from the carrier's tile, to any tile within the new
// unit's own movement range (so a soldier lands up to 2 tiles of walking away). That costs config.ammo (default 1) of the carrier's
// ammo, and a carrier deploys once per turn (`unit.deployed`, cleared when its owner's turn starts). The new unit belongs to the
// carrier's player, is at full HP, and has used its move but not its action (`halted`): it may attack, capture or wait from where it
// landed, like a unit whose move was cut short. A carrier that was just built (`fresh`) cannot deploy.

import { attributeConfig } from './attributes.js';
import { ammoOf, spendAmmo } from './ammo.js';
import { computeReach } from './movement.js';
import { facingAlong, snapshotUnit, unitAt, unitDef } from './queries.js';
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
  const dropped = makeUnit(game.registry, game.map, -1, { type: cfg.unit, owner: carrier.owner, x: carrier.x, y: carrier.y });
  const reach = computeReach(game, dropped);
  const tiles = [...reach.tiles()].filter((t) => (t.x !== carrier.x || t.y !== carrier.y) && !unitAt(game, t.x, t.y)).map((t) => ({ x: t.x, y: t.y }));
  return { reach, tiles };
}

/** Why `carrier` cannot put a unit on `to`, or null when it can: 'cannot-deploy', 'just-built', 'already-deployed', 'out-of-ammo', 'invalid-deploy-tile'. */
export function deployProblem(game, carrier, to) {
  const cfg = deployConfig(game, carrier);
  if (!cfg) return 'cannot-deploy';
  if (carrier.fresh) return 'just-built';
  if (carrier.deployed) return 'already-deployed';
  if (ammoOf(game, carrier) < deployCost(cfg)) return 'out-of-ammo';
  if (!to || !deployReach(game, carrier).tiles.some((t) => t.x === to.x && t.y === to.y)) return 'invalid-deploy-tile';
  return null;
}

/** Could `carrier` deploy right now (the ammo, the turn's one drop, and somewhere to land)? */
export function canDeploy(game, carrier) {
  const cfg = deployConfig(game, carrier);
  return !!cfg && !carrier.fresh && !carrier.deployed && ammoOf(game, carrier) >= deployCost(cfg) && deployReach(game, carrier).tiles.length > 0;
}

/**
 * Put the unit on `to` (already validated) and spend the ammo. The new unit is in the game from here on; its slide from the carrier's
 * tile is a 'move' event, followed by a 'deploy' event.
 */
export function resolveDeploy(game, carrier, to) {
  const { state, registry, map } = game;
  const cfg = deployConfig(game, carrier);
  const path = deployReach(game, carrier).reach.pathTo(to.x, to.y);
  spendAmmo(game, carrier, deployCost(cfg));
  carrier.deployed = true;
  const dropped = makeUnit(registry, map, state.nextUnitId++, { type: cfg.unit, owner: carrier.owner, x: to.x, y: to.y });
  dropped.facing = facingAlong(path, dropped.facing);
  dropped.halted = { moved: true };   // its move is used; an action (attack, capture, wait) is left
  state.units.push(dropped);
  return [
    { type: 'move', unitId: dropped.id, path },
    { type: 'deploy', unit: snapshotUnit(carrier), dropped: snapshotUnit(dropped), ammo: ammoOf(game, carrier) },
  ];
}

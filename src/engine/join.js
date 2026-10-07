// Joining: two damaged units of the same kind and owner become one. A unit that moves onto a damaged friend of its own type (the Join order)
// adds its HP to that friend's, up to the maximum (the surplus is lost); the moving unit is used up. Ammo and fuel become the lower of the two,
// so joining never refills anything, and the joined unit has acted for the turn. Capture progress stays with the unit that was standing there.

import { round1, removeUnit, snapshotUnit, unitDef } from './queries.js';

/** Could `unit` join `other`? Same owner and type, neither at full HP, neither carrying or carried, and not the same unit. */
export function canJoin(game, unit, other) {
  const max = game.registry.rules.maxHp;
  return !!other && other !== unit && other.owner === unit.owner && other.type === unit.type
    && unit.hp < max && other.hp < max && !unit.carriedBy && !other.carriedBy && !unitDef(game, unit).attributes.structure;
}

/** The friend `unit` could join on tile (x, y), or null. */
export const joinPartner = (game, unit, x, y) => game.state.units.find((v) => v.x === x && v.y === y && canJoin(game, unit, v)) ?? null;

/** Carry out the join: `unit` (already on the tile of `other`) is merged into `other`. Returns the single 'join' event. */
export function resolveJoin(game, unit, other) {
  const max = game.registry.rules.maxHp;
  const from = other.hp;
  const total = round1(other.hp + unit.hp);
  other.hp = Math.min(max, total);
  const lost = round1(total - other.hp);
  if (unit.ammo !== undefined || other.ammo !== undefined) other.ammo = Math.min(unit.ammo ?? other.ammo, other.ammo ?? unit.ammo);
  if (unit.fuel !== undefined || other.fuel !== undefined) other.fuel = Math.min(unit.fuel ?? other.fuel, other.fuel ?? unit.fuel);
  other.done = true;
  other.halted = null;
  const event = { type: 'join', unit: snapshotUnit(other), joined: snapshotUnit(unit), from, to: other.hp, lost };
  removeUnit(game, unit);
  return [event];
}

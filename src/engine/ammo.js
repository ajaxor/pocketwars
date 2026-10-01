// Ammo: a limited supply that a unit spends and a friendly property refills. Nothing here knows about particular units.
//
//   unit attribute `ammo: { max, low }`   the unit starts full (`unit.ammo`); at `low` or fewer it is "low", at 0 it is "empty"
//   weapon field   `ammo: n`              firing costs n; a unit without n left cannot use that weapon (weapons without the field are free)
//   unit attribute `deploy`               dropping a unit costs ammo too (deploy.js)
//   terrain attribute `resupply: { range, categories }` on a property: refills the ammo of its owner's units of those categories
//
// WHEN A UNIT IS RESUPPLIED. (1) At the start of its owner's turn, if it stands in reach of such a property (economy.js startTurn).
// (2) When it ends an order with the Resupply action (game.js act; offered in place of Wait when it is short on ammo and next to such a
// property). Resupply is an order like Wait: it ends the unit's turn.
//
// RESUPPLY COSTS MONEY, like building the rounds: `resupplyCost` is the missing rounds times the price of a round, which is the unit's
// `ammo.cost` or, for a carrier, the price of the unit each round stands for (a transport copter pays for the soldiers it takes on).
// The owner pays it from their funds; without enough, nothing is refilled (the UI says "Not enough credits" and the order is a Wait).
// A cost of 0 (the default for units that carry plain ammunition) is free.
//
// A unit that has no `ammo` attribute has an unlimited supply, whatever its weapons say.

import { attributeConfig } from './attributes.js';
import { allProperties, distance, snapshotUnit, unitDef } from './queries.js';

/** `{ max, low }` for a unit type that carries a limited supply (a unit definition), or undefined. */
export const ammoConfigOf = (def) => attributeConfig(def, 'ammo');
/** The supply a new unit of this type starts with, or undefined when it has none to track. */
export const initialAmmo = (def) => ammoConfigOf(def)?.max;

export const ammoConfig = (game, unit) => ammoConfigOf(unitDef(game, unit));
export const usesAmmo = (game, unit) => !!ammoConfig(game, unit);
/** Rounds left, or null for a unit with an unlimited supply. */
export const ammoOf = (game, unit) => (usesAmmo(game, unit) ? unit.ammo ?? ammoConfig(game, unit).max : null);

/** Does `unit` have enough left to fire `weapon`? Always true for a weapon (or a unit) that does not use ammo. */
export const hasAmmoFor = (game, unit, weapon) => !weapon.ammo || !usesAmmo(game, unit) || ammoOf(game, unit) >= weapon.ammo;

/** Use up `amount` rounds (no-op for a unit with an unlimited supply). */
export function spendAmmo(game, unit, amount) {
  if (!amount || !usesAmmo(game, unit)) return;
  unit.ammo = Math.max(0, ammoOf(game, unit) - amount);
}

/** null (no limited supply), 'ok', 'low' (flashing bullet) or 'empty' (steady red bullet). */
export function ammoLevel(game, unit) {
  const cfg = ammoConfig(game, unit);
  if (!cfg) return null;
  const n = ammoOf(game, unit);
  return n <= 0 ? 'empty' : n <= cfg.low ? 'low' : 'ok';
}

/** What one round of `unit`'s ammo costs to replace: its `ammo.cost`, else the price of the unit each round of a carrier stands for, else 0. */
export function roundCost(game, unit) {
  const cfg = ammoConfig(game, unit);
  if (!cfg) return 0;
  if (cfg.cost != null) return cfg.cost;
  const drop = attributeConfig(unitDef(game, unit), 'deploy');
  return drop ? Math.round(game.registry.unit(drop.unit).cost / (drop.ammo ?? 1)) : 0;
}
/** The price of filling `unit` up from where it is. */
export const resupplyCost = (game, unit) => (usesAmmo(game, unit) ? Math.max(0, ammoConfig(game, unit).max - ammoOf(game, unit)) * roundCost(game, unit) : 0);

/** Could `unit`, stopping on (x, y), take on ammo there (it is short and a friendly property in reach resupplies it)? The 'resupply' action needs this. */
export const canResupplyAt = (game, unit, x, y) => usesAmmo(game, unit) && ammoOf(game, unit) < ammoConfig(game, unit).max && resupplySource(game, unit, x, y) !== null;

/** The friendly property that would refill `unit` if it stood on (x, y) (default: where it is), or null. */
export function resupplySource(game, unit, x = unit.x, y = unit.y) {
  if (!usesAmmo(game, unit)) return null;
  const category = unitDef(game, unit).category;
  for (const p of allProperties(game)) {
    const r = p.terrain.attributes.resupply;
    if (r && p.owner === unit.owner && r.categories.includes(category) && distance(x, y, p.x, p.y) <= r.range) return p;
  }
  return null;
}

/**
 * Refill `unit` (in reach of a property that resupplies it) and charge its owner `resupplyCost`. Returns a 'resupply' event, null when
 * nothing applies (full already, or nothing in reach), or a 'resupplyDenied' event when the owner cannot pay (nothing changes).
 */
export function resupply(game, unit) {
  const cfg = ammoConfig(game, unit);
  if (!cfg || ammoOf(game, unit) >= cfg.max) return null;
  const source = resupplySource(game, unit);
  if (!source) return null;
  const cost = resupplyCost(game, unit);
  if (cost > game.state.funds[unit.owner]) return { type: 'resupplyDenied', unit: snapshotUnit(unit), cost };
  game.state.funds[unit.owner] -= cost;
  const from = ammoOf(game, unit);
  unit.ammo = cfg.max;
  return { type: 'resupply', unit: snapshotUnit(unit), from, to: cfg.max, cost, source: { x: source.x, y: source.y } };
}

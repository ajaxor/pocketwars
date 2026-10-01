// Ammo: a limited supply that a unit spends and a friendly property refills. Nothing here knows about particular units.
//
//   unit attribute `ammo: { max, low }`   the unit starts full (`unit.ammo`); at `low` or fewer it is "low", at 0 it is "empty"
//   weapon field   `ammo: n`              firing costs n; a unit without n left cannot use that weapon (weapons without the field are free)
//   unit attribute `deploy`               dropping a unit costs ammo too (deploy.js)
//   terrain attribute `resupply: { range, categories }` on a property: refills the ammo of its owner's units of those categories
//
// WHEN A UNIT IS RESUPPLIED. (1) At the start of its owner's turn, if it stands in reach of such a property (economy.js startTurn).
// (2) When it ends an order with Wait in reach of one (game.js act): it is refilled and, as a pit stop, gets its move back: it is
// ready again, with a full move, from where it stopped. That only happens when something was actually refilled, and only after a Wait
// (an attack or a drop uses the unit's turn), so it cannot be repeated for free.
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
 * Refill `unit` if it is short and in reach of a property that resupplies it. Returns a 'resupply' event, or null when nothing
 * changed (full already, or nothing in reach). Does not touch the unit's turn: see game.js act for the pit stop.
 */
export function resupply(game, unit) {
  const cfg = ammoConfig(game, unit);
  if (!cfg || ammoOf(game, unit) >= cfg.max) return null;
  const source = resupplySource(game, unit);
  if (!source) return null;
  const from = ammoOf(game, unit);
  unit.ammo = cfg.max;
  return { type: 'resupply', unit: snapshotUnit(unit), from, to: cfg.max, source: { x: source.x, y: source.y } };
}

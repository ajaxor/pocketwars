// Fuel: a flyer burns one unit of fuel per TURN, whether it flies or sits still. Nothing here knows about particular units.
//
//   unit attribute `fuel: { max, low }`   the unit starts full (`unit.fuel`, in turns); at `low` or fewer it is "low", at 0 it is "empty"
//   every unit with a tank burns 1 as its owner's turn ends (burnFuel, called by game.endTurn); the tank never limits a move (the player does not
//   have to count tiles); at 0 the unit cannot attack or use radar (see RUNNING DRY)
//
// REFUELLING IS FREE AND AUTOMATIC. At the start of its owner's turn (economy.js startTurn) a unit is topped up when it stands where a source
// reaches it: a property of its owner whose `resupply` covers its category (an airfield: on or next to it), a friendly unit whose `supply`
// covers its category and is next to it (an aircraft carrier), or a friendly supply unit whose `supply.fuelTags` names one of its tags (the
// supply truck refuels helicopters, not planes). The Resupply order (ammo.js) and the Supply order (supply.js) fill the tank mid-turn too.
//
// RUNNING DRY. A flyer with an empty tank (fuel 0) is not lost: it can still move, but it cannot attack (so it does not counterattack
// either) and its radar is switched off, until a source refuels it (free, at the start of its owner's turn, or with a Resupply / Supply order).

import { attributeConfig } from './attributes.js';
import { distance, snapshotUnit, unitDef } from './queries.js';
import { allProperties } from './queries.js';

export const fuelConfigOf = (def) => attributeConfig(def, 'fuel');
export const fuelConfig = (game, unit) => fuelConfigOf(unitDef(game, unit));
export const usesFuel = (game, unit) => !!fuelConfig(game, unit);
/** The tank a new unit of this type starts with, or undefined. */
export const initialFuel = (def) => fuelConfigOf(def)?.max;
/** Fuel left, or null for a unit that does not use any. */
export const fuelOf = (game, unit) => (usesFuel(game, unit) ? unit.fuel ?? fuelConfig(game, unit).max : null);
/** Is the tank dry? A flyer with no fuel left can neither attack nor use its radar until it is refuelled (it never crashes). */
export const isOutOfFuel = (game, unit) => usesFuel(game, unit) && fuelOf(game, unit) <= 0;
/** Is the tank below full? */
export const needsFuel = (game, unit) => usesFuel(game, unit) && fuelOf(game, unit) < fuelConfig(game, unit).max;

/** null (no fuel to track), 'ok', 'low' (flashing can) or 'empty' (steady red can). */
export function fuelLevel(game, unit) {
  const cfg = fuelConfig(game, unit);
  if (!cfg) return null;
  const n = fuelOf(game, unit);
  return n <= 0 ? 'empty' : n <= cfg.low ? 'low' : 'ok';
}

/** Burn `amount` of fuel (no-op for a unit that uses none). */
export function spendFuel(game, unit, amount = 1) {
  if (!amount || !usesFuel(game, unit)) return;
  unit.fuel = Math.max(0, fuelOf(game, unit) - amount);
}

/** End of `player`'s turn: every unit of theirs with a tank burns one turn of fuel, moving or not. (Run after crashEmpty, so a unit that just ran dry gets its turn at 0.) */
export function burnFuel(game, player) {
  for (const u of game.state.units) if (u.owner === player) spendFuel(game, u, 1);
}

/** Fill the tank (and lift the crash sentence). */
export function refuel(game, unit) {
  if (!usesFuel(game, unit)) return;
  unit.fuel = fuelConfig(game, unit).max;
}

/** Does the supply unit `source` refuel `unit`? (It supplies the unit's category, and when it names `fuelTags`, the unit carries one.) */
export function refuelsUnit(game, source, unit) {
  const cfg = attributeConfig(unitDef(game, source), 'supply');
  const def = unitDef(game, unit);
  return !!cfg && cfg.categories.includes(def.category) && (!cfg.fuelTags || cfg.fuelTags.some((t) => def.tags?.includes(t)));
}

/** Could `unit`, standing on (x, y), be refuelled for free by a property, carrier or truck of its owner right there? */
export function fuelSourceAt(game, unit, x = unit.x, y = unit.y) {
  if (!usesFuel(game, unit)) return null;
  const category = unitDef(game, unit).category;
  for (const p of allProperties(game)) {
    const r = p.terrain.attributes.resupply;
    if (r && p.owner === unit.owner && r.categories.includes(category) && distance(x, y, p.x, p.y) <= r.range) return { x: p.x, y: p.y };
  }
  for (const v of game.state.units) {
    if (v !== unit && v.owner === unit.owner && distance(x, y, v.x, v.y) === 1 && refuelsUnit(game, v, unit)) return { x: v.x, y: v.y };
  }
  return null;
}

/** Where `unit` could refuel for free: the tiles of its owner's properties that resupply its category and of their units that refuel it, as [[x, y], ...]. */
export function fuelHomes(game, unit) {
  if (!usesFuel(game, unit)) return [];
  const category = unitDef(game, unit).category;
  const homes = allProperties(game).filter((p) => p.owner === unit.owner && p.terrain.attributes.resupply?.categories.includes(category)).map((p) => [p.x, p.y]);
  for (const v of game.state.units) if (v !== unit && v.owner === unit.owner && refuelsUnit(game, v, unit)) homes.push([v.x, v.y]);
  return homes;
}

/** Start of `player`'s turn: refuel every unit of theirs that a source reaches, mark the ones still empty. Returns the 'refuel' events. */
export function refuelAtTurnStart(game, player) {
  const events = [];
  for (const u of game.state.units) {
    if (u.owner !== player || !usesFuel(game, u)) continue;
    if (needsFuel(game, u)) {
      const source = fuelSourceAt(game, u);
      if (source) { const from = fuelOf(game, u); refuel(game, u); events.push({ type: 'refuel', unit: snapshotUnit(u), from, to: u.fuel, source }); }
    }
  }
  return events;
}

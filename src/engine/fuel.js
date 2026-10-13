// Fuel: every vehicle, ship and aircraft carries a tank, counted in TURNS. Nothing here knows about particular units.
//
//   unit attribute `fuel: { max, low, burn? }`   the unit starts full (`unit.fuel`, in turns); at `low` or fewer it is "low", at 0 it is "empty"
//   BURN. An aircraft burns 1 as its owner's turn ends, whether it flew or sat still (`burn` omitted). A vehicle or ship has `burn: "move"`: it
//   burns 1 only on a turn in which it changed tile, so a parked tank costs nothing and the fuel measures how long a push can go on
//   (burnFuel, called by game.endTurn). The tank never limits a single move (the player does not have to count tiles).
//   EMPTY. At 0 a unit is not lost, but it cannot attack (so it does not counterattack either), its radar is off, and its move is halved
//   (rounded down, at least 1; see moveOf in submerge.js), until a source refuels it.
//
// REFUELLING IS FREE AND AUTOMATIC. At the start of its owner's turn (economy.js startTurn) a unit is topped up when it stands where a source
// reaches it: a property of its owner whose `resupply` covers its category (a city or HQ for everyone, an airfield for aircraft, a factory for
// vehicles ...: on or next to it), a friendly unit whose `supply` covers its category and is next to it (a supply truck, an aircraft carrier, a
// radar plane for aircraft). A `supply` with `fuelTags` refuels only units carrying one of those tags. The Resupply order (ammo.js) and the
// Supply order (supply.js) fill the tank mid-turn too.

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
/** Is the tank dry? A unit with no fuel left can neither attack nor use its radar, and moves at half speed, until it is refuelled (it is never lost). */
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

/** Does this unit's tank only drain on turns it moves (`burn: "move"`: vehicles and ships), rather than every turn (aircraft)? */
export const burnsOnlyWhenMoving = (game, unit) => fuelConfig(game, unit)?.burn === 'move';

/** End of `player`'s turn: every unit of theirs with a tank burns one turn of fuel: always for an aircraft, only if it moved for a vehicle or ship. */
export function burnFuel(game, player) {
  for (const u of game.state.units) {
    if (u.owner !== player || !usesFuel(game, u)) continue;
    if (burnsOnlyWhenMoving(game, u) && !u.moved) continue;   // `moved` is set by game.js when the unit changes tile, and cleared at the start of its next turn (heal.js)
    spendFuel(game, u, 1);
  }
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

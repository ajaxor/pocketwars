// Fuel: a flyer burns one unit of fuel per tile it flies and cannot go further than it has left. Nothing here knows about particular units.
//
//   unit attribute `fuel: { max, low }`   the unit starts full (`unit.fuel`); at `low` or fewer it is "low", at 0 it is "empty"
//   a tile moved costs 1 fuel (game.js act), and moveOf (submerge.js) caps the move allowance at the fuel left
//
// REFUELLING IS FREE AND AUTOMATIC. At the start of its owner's turn (economy.js startTurn) a unit is topped up when it stands where a source
// reaches it: a property of its owner whose `resupply` covers its category (an airfield: on or next to it), a friendly unit whose `supply`
// covers its category and is next to it (an aircraft carrier), or a friendly supply unit whose `supply.fuelTags` names one of its tags (the
// supply truck refuels helicopters, not planes). The Resupply order (ammo.js) and the Supply order (supply.js) fill the tank mid-turn too.
//
// RUNNING DRY. A unit that is still empty after the turn-start refuel is marked `fuelOut`; if it is still empty when its owner ends that turn
// it crashes (crashEmpty, called by game.endTurn), unless a Resupply or Supply order filled it meanwhile.

import { attributeConfig } from './attributes.js';
import { distance, removeUnit, snapshotUnit, unitDef } from './queries.js';
import { allProperties } from './queries.js';

export const fuelConfigOf = (def) => attributeConfig(def, 'fuel');
export const fuelConfig = (game, unit) => fuelConfigOf(unitDef(game, unit));
export const usesFuel = (game, unit) => !!fuelConfig(game, unit);
/** The tank a new unit of this type starts with, or undefined. */
export const initialFuel = (def) => fuelConfigOf(def)?.max;
/** Fuel left, or null for a unit that does not use any. */
export const fuelOf = (game, unit) => (usesFuel(game, unit) ? unit.fuel ?? fuelConfig(game, unit).max : null);
/** Is the tank below full? */
export const needsFuel = (game, unit) => usesFuel(game, unit) && fuelOf(game, unit) < fuelConfig(game, unit).max;

/** null (no fuel to track), 'ok', 'low' (flashing can) or 'empty' (steady red can). */
export function fuelLevel(game, unit) {
  const cfg = fuelConfig(game, unit);
  if (!cfg) return null;
  const n = fuelOf(game, unit);
  return n <= 0 ? 'empty' : n <= cfg.low ? 'low' : 'ok';
}

/** Burn `tiles` of fuel (no-op for a unit that uses none). */
export function spendFuel(game, unit, tiles) {
  if (!tiles || !usesFuel(game, unit)) return;
  unit.fuel = Math.max(0, fuelOf(game, unit) - tiles);
}

/** Fill the tank (and lift the crash sentence). */
export function refuel(game, unit) {
  if (!usesFuel(game, unit)) return;
  unit.fuel = fuelConfig(game, unit).max;
  delete unit.fuelOut;
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
    delete u.fuelOut;
    if (needsFuel(game, u)) {
      const source = fuelSourceAt(game, u);
      if (source) { const from = fuelOf(game, u); refuel(game, u); events.push({ type: 'refuel', unit: snapshotUnit(u), from, to: u.fuel, source }); }
    }
    if (fuelOf(game, u) <= 0) u.fuelOut = true;
  }
  return events;
}

/** End of `player`'s turn: units that began it empty and are still empty crash. Returns the 'crash' events. */
export function crashEmpty(game, player) {
  const events = [];
  for (const u of [...game.state.units]) {
    if (u.owner !== player || !u.fuelOut || fuelOf(game, u) > 0) continue;
    removeUnit(game, u);
    events.push({ type: 'crash', unit: snapshotUnit(u) });
  }
  return events;
}

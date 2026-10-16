// Turn income, repair, resupply and unit production, all driven by the terrain `property` attribute.

import { attributeConfig } from './attributes.js';
import { isHidden } from './detection.js';
import { refuelAtTurnStart } from './fuel.js';
import { healAtTurnStart } from './heal.js';
import { costFor, DIRS, distance, isInertDef, inBounds, propertiesOwnedBy, propertyAt, ownerAt, terrainAt, terrainIdAt, round1, snapshotUnit, tileIndex, unitAt, unitCost, unitDef } from './queries.js';
import { makeUnit } from './state.js';

export const incomeFor = (game, player) => propertiesOwnedBy(game, player).reduce((sum, p) => sum + p.property.income, 0);

/**
 * Begin `player`'s turn: collect income, repair units standing on properties they own (+property.repair HP,
 * capped at maxHp), refill the ammo of units next to a property that resupplies them, and make all their units ready to act again
 * (a unit built last turn is no longer `fresh`). Every property may build again. Units that rested then heal
 * (heal.js).
 */
/** The property of `player` that repairs `unit` now: the one it stands on, or an owned one right next to it that the unit cannot enter (a ship beside its shipyard). */
function repairingProperty(game, unit, player) {
  const category = unitDef(game, unit).category;
  const serves = (p) => !p.repairs || p.repairs.includes(category);   // a property that names no categories repairs everyone
  const here = propertyAt(game, unit.x, unit.y);
  if (here && ownerAt(game, unit.x, unit.y) === player) return serves(here) ? here : null;
  const moveClass = unitDef(game, unit).moveClass;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = unit.x + dx;
    const y = unit.y + dy;
    if (!inBounds(game.map, x, y)) continue;
    const p = propertyAt(game, x, y);
    if (p && ownerAt(game, x, y) === player && terrainAt(game, x, y).moveCost[moveClass] == null && serves(p)) return p;
  }
  return null;
}

/** HP the start of `player`'s turn would repair on `unit`: its property's `repair` (see repairingProperty), or an adjacent friendly carrier's `supply.repair` with `autoRepair`; 0 if none. */
export function repairAmount(game, unit, player = unit.owner) {
  const property = repairingProperty(game, unit, player);
  if (property) return property.repair;
  const category = unitDef(game, unit).category;
  let best = 0;
  for (const v of game.state.units) {
    if (v === unit || v.owner !== player || distance(unit.x, unit.y, v.x, v.y) !== 1) continue;
    const cfg = attributeConfig(unitDef(game, v), 'supply');
    if (cfg?.autoRepair && cfg.categories.includes(category)) best = Math.max(best, cfg.repair);
  }
  return best;
}

export function startTurn(game, player) {
  const { state, registry } = game;
  const income = incomeFor(game, player);
  const incomes = propertiesOwnedBy(game, player).filter((p) => p.property.income > 0).map((p) => ({ x: p.x, y: p.y, amount: p.property.income }));
  state.funds[player] += income;
  state.builtThisTurn = [];
  const repaired = [];
  for (const u of state.units) {
    if (u.owner !== player) continue;
    u.done = isInertDef(unitDef(game, u));   // a mine never acts
    u.halted = null;
    delete u.attacks;
    delete u.fresh; delete u.builtNow;
    delete u.deployed;
    delete u.carriedBy;
  }
  for (const u of state.units) {   // repairs: after income (so it can pay) and in unit order; each HP costs a tenth of the unit's price
    if (u.owner !== player || u.hp >= registry.rules.maxHp) continue;
    const amount = repairAmount(game, u, player);
    if (!amount) continue;
    const perHp = Math.round(unitCost(game, u) * (registry.rules.repairCostRate ?? 1) / registry.rules.maxHp);
    let hp = Math.min(amount, round1(registry.rules.maxHp - u.hp));
    if (perHp > 0) hp = Math.min(hp, Math.floor(state.funds[player] / perHp));
    if (hp <= 0) continue;
    const from = u.hp;
    u.hp = Math.min(registry.rules.maxHp, round1(u.hp + hp));
    const cost = hp * perHp;
    state.funds[player] -= cost;
    repaired.push({ id: u.id, x: u.x, y: u.y, from, to: u.hp, cost });
  }
  for (const u of state.units) if (u.owner === player) delete u.revealed;
  for (const u of state.units) {   // a unit that begins its turn hidden (cloaked, submerged) strikes with the ambush bonus this turn
    if (u.owner !== player) continue;
    if (isHidden(game, u) && !isInertDef(unitDef(game, u))) u.ambush = true; else delete u.ambush;
  }
  const healed = healAtTurnStart(game, player);
  const refuelled = refuelAtTurnStart(game, player);
  return [{ type: 'turnStart', player, day: state.day, income, incomes, repaired, healed, refuelled }];
}

/** Where the labs are on this map: [{ x, y, upgrades }] (labs are terrain, so they never move; who owns one is read from the game). */
const labCache = new WeakMap();
function labsOf(game) {
  let labs = labCache.get(game.map);
  if (!labs) {
    labs = [];
    game.map.terrain.forEach((row, y) => row.forEach((t, x) => { const upgrades = game.registry.terrain[t].attributes.property?.upgrades; if (upgrades) labs.push({ x, y, upgrades }); }));
    labCache.set(game.map, labs);
  }
  return labs;
}

/** Does a tile next to (x, y) let a unit of `def` stand and move (water for a ship)? */
const touchesWater = (game, x, y, def) => DIRS.some(([dx, dy]) => inBounds(game.map, x + dx, y + dy) && terrainAt(game, x + dx, y + dy).moveCost[def.moveClass] != null);

/**
 * The infantry `player` has unlocked: the units named by `unlocks` on the buildings they hold (garage: mechanic, factory: AT infantry, airfield:
 * RPG trooper), limited to their leader's roster. The HQ and every city they hold build these (and the HQ the leader's own infantry).
 */
export function unlockedFor(game, player, kit) {
  if (player == null) return [];
  const ids = [];
  for (const p of propertiesOwnedBy(game, player)) for (const id of p.property.unlocks ?? []) if (!ids.includes(id)) ids.push(id);
  return kit.roster ? ids.filter((id) => kit.roster.includes(id)) : ids;
}

/**
 * The menu of the production building at (x, y) for `player`, cheapest first for that player (a troop carrier's price moves with their leader's
 * infantry, so the order is worked out here rather than kept in the data; ties keep the loadout's order):
 *   0. a shelved building (kept in the data, out of play) builds nothing;
 *   1. the HQ and the cities (`hub`) build the leader's own infantry and the infantry the player has unlocked (unlockedFor);
 *   2. any other building: the units the loadout lists for that kind of building (data/loadouts.json: the same for everyone),
 *      limited to the leader's `roster`: a leader builds only the units of their own faction,
 *   3. where the player holds a lab, each unit it upgrades is replaced by its upgrade (hover lab: tank -> hover tank), if the upgrade is on that menu too,
 *   4. minus a unit the building lists under `shore` when no water touches it.
 * A building the loadout says nothing about gives the same menu to everyone: the units of the categories its `builds` names, cheapest first.
 * No player (a neutral building) gets the standard menu, with no labs and nothing unlocked.
 */
export function menuFor(game, player, x, y) {
  const property = propertyAt(game, x, y);
  if (!property || property.shelved) return [];
  const { registry, map } = game;
  const terrainId = terrainIdAt(game, x, y);   // the terrain NOW: a rebuilt ruin builds what its new building builds
  const kit = registry.loadoutFor(player == null ? null : map.players[player].leader ?? null);
  const listed = kit.build[terrainId] ?? (property.hub ? [] : null);
  if (!listed) return menuByPrice(game, player, [...registry.unitsInCategories(property.builds)]);
  let ids;
  if (property.hub) ids = [...(terrainId === 'hq' ? [] : kit.build.hq ?? []), ...listed, ...unlockedFor(game, player, kit)];   // a city builds the leader's own infantry too (the HQ lists it itself)
  else {
    ids = kit.roster ? listed.filter((id) => kit.roster.includes(id)) : [...listed];
    if (player != null) {
      const labs = labsOf(game).filter((lab) => ownerAt(game, lab.x, lab.y) === player);
      if (labs.length) {
        const next = [];
        for (const id of ids) {
          const to = labs.map((lab) => lab.upgrades[id]).filter((u) => u && listed.includes(u));
          if (to.length) next.push(...to); else next.push(id);
        }
        ids = next;
      }
    }
  }
  const defs = [...new Set(ids)].map((id) => registry.unit(id)).filter((def) => !property.shore?.includes(def.id) || touchesWater(game, x, y, def));
  return menuByPrice(game, player, defs);
}

/** `defs` cheapest first for `player` (what each costs them, see costFor); units that cost the same keep their order. */
export const menuByPrice = (game, player, defs) => defs.map((def, i) => ({ def, i, cost: costFor(game, player, def.id) })).sort((a, b) => a.cost - b.cost || a.i - b.i).map((x) => x.def);

/** Unit definitions that the property at (x, y) can produce for the player who owns it, in menu order. */
export const buildOptions = (game, x, y) => menuFor(game, ownerAt(game, x, y), x, y);

/** Has the property at (x, y) already built a unit this turn? (Each property builds at most one.) */
export const builtThisTurn = (game, x, y) => !propertyAt(game, x, y)?.unlimitedBuilds && game.state.builtThisTurn.includes(tileIndex(game.map, x, y));

/**
 * Why a build request is invalid, or null when it is fine. The new unit appears on the property itself whatever the terrain
 * (a ship is built on the land of the shipyard and sails off it), so the tile has to be free (a unit that was built there last turn has to move
 * off first), and the property must not have built already this turn.
 */
export function buildProblem(game, player, x, y, typeId) {
  const { state, registry } = game;
  const def = registry.units[typeId];
  if (!def) return 'unknown-unit';
  const property = propertyAt(game, x, y);
  if (!property || ownerAt(game, x, y) !== player) return 'not-your-property';
  if (!menuFor(game, player, x, y).some((u) => u.id === typeId)) return 'cannot-build-here';
  if (unitAt(game, x, y)) return 'tile-occupied';
  if (builtThisTurn(game, x, y)) return 'already-built';
  if (state.funds[player] < costFor(game, player, typeId)) return 'not-enough-funds';
  return null;
}

/**
 * Produce a unit for `player` on the property at (x, y), whatever its terrain. It is ready at once but `fresh`: its one order can only be a move (and a
 * Wait), so it gets off the property that built it without attacking, capturing or diving.
 */
export function buildUnit(game, player, x, y, typeId) {
  const problem = buildProblem(game, player, x, y, typeId);
  if (problem) return { ok: false, error: problem, events: [] };
  const { state, registry } = game;
  const def = registry.unit(typeId);
  const cost = costFor(game, player, typeId);
  state.funds[player] -= cost;
  state.builtThisTurn.push(tileIndex(game.map, x, y));
  const unit = makeUnit(registry, game.map, state.nextUnitId++, { type: typeId, owner: player, x, y, fresh: true });
  state.units.push(unit);
  return { ok: true, events: [{ type: 'build', unit: snapshotUnit(unit), cost }] };
}

export const cheapestBuildableCost = (game, player) => {
  const costs = propertiesOwnedBy(game, player).flatMap((p) => menuFor(game, player, p.x, p.y).map((u) => costFor(game, player, u.id)));
  return costs.length ? Math.min(...costs) : Infinity;
};

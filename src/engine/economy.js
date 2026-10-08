// Turn income, repair, resupply and unit production, all driven by the terrain `property` attribute.

import { attributeConfig } from './attributes.js';
import { isHidden } from './detection.js';
import { refuelAtTurnStart } from './fuel.js';
import { healAtTurnStart } from './heal.js';
import { costFor, distance, inBounds, propertiesOwnedBy, propertyAt, ownerAt, terrainAt, terrainIdAt, round1, snapshotUnit, tileIndex, unitAt, unitCost, unitDef } from './queries.js';
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
    u.done = !!unitDef(game, u).attributes.mine;   // a mine never acts
    u.halted = null;
    delete u.attacks;
    delete u.fresh;
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
    if (isHidden(game, u) && !unitDef(game, u).attributes.mine) u.ambush = true; else delete u.ambush;
  }
  const healed = healAtTurnStart(game, player);
  const refuelled = refuelAtTurnStart(game, player);
  return [{ type: 'turnStart', player, day: state.day, income, incomes, repaired, healed, refuelled }];
}

/**
 * The menu of the production building at (x, y) for `player`: the units their leader's loadout lists for that kind of building
 * (data/loadouts.json), in the loadout's order (cheapest first: tools/sort-build-menus.mjs keeps the data so). A building the loadout says nothing
 * about (a lab, say) gives the same menu to everyone: the units of the categories its `builds` names, cheapest first. No player (a neutral building) gets the standard menu.
 */
export function menuFor(game, player, x, y) {
  const property = propertyAt(game, x, y);
  if (!property) return [];
  const { registry, map } = game;
  const leader = player == null ? null : map.players[player].leader ?? null;
  const ids = registry.loadoutFor(leader).build[terrainIdAt(game, x, y)];   // the terrain NOW: a rebuilt ruin builds what its new building builds
  return ids ? ids.map((id) => registry.unit(id)) : [...registry.unitsInCategories(property.builds)].sort((a, b) => a.cost - b.cost);   // the cheapest at the top, like every kit's menu
}

/** Unit definitions that the property at (x, y) can produce for the player who owns it, in menu order. */
export const buildOptions = (game, x, y) => menuFor(game, ownerAt(game, x, y), x, y);

/** Has the property at (x, y) already built a unit this turn? (Each property builds at most one.) */
export const builtThisTurn = (game, x, y) => game.state.builtThisTurn.includes(tileIndex(game.map, x, y));

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

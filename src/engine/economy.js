// Turn income, repair, resupply and unit production, all driven by the terrain `property` attribute.

import { resupply } from './ammo.js';
import { propertiesOwnedBy, propertyAt, ownerAt, round1, snapshotUnit, tileIndex, unitAt } from './queries.js';
import { makeUnit } from './state.js';

export const incomeFor = (game, player) => propertiesOwnedBy(game, player).reduce((sum, p) => sum + p.property.income, 0);

/**
 * Begin `player`'s turn: collect income, repair units standing on properties they own (+property.repair HP,
 * capped at maxHp), refill the ammo of units next to a property that resupplies them, and make all their units ready to act again
 * (a unit built last turn is no longer `fresh`). Every property may build again.
 */
export function startTurn(game, player) {
  const { state, registry } = game;
  const income = incomeFor(game, player);
  const incomes = propertiesOwnedBy(game, player).filter((p) => p.property.income > 0).map((p) => ({ x: p.x, y: p.y, amount: p.property.income }));
  state.funds[player] += income;
  state.builtThisTurn = [];
  const repaired = [];
  const resupplied = [];
  for (const u of state.units) {
    if (u.owner !== player) continue;
    u.done = false;
    u.halted = null;
    delete u.fresh;
    delete u.deployed;
    const property = propertyAt(game, u.x, u.y);
    if (property && ownerAt(game, u.x, u.y) === player && u.hp < registry.rules.maxHp) {
      const from = u.hp;
      u.hp = Math.min(registry.rules.maxHp, round1(u.hp + property.repair));
      if (u.hp !== from) repaired.push({ id: u.id, from, to: u.hp });
    }
    const filled = resupply(game, u);
    if (filled) resupplied.push({ id: u.id, x: u.x, y: u.y, from: filled.from, to: filled.to });
  }
  return [{ type: 'turnStart', player, day: state.day, income, incomes, repaired, resupplied }];
}

/** Unit definitions that a property tile owned by the current player can produce, in menu order. */
export function buildOptions(game, x, y) {
  const property = propertyAt(game, x, y);
  if (!property) return [];
  return game.registry.unitsInCategories(property.builds);
}

/** Has the property at (x, y) already built a unit this turn? (Each property builds at most one.) */
export const builtThisTurn = (game, x, y) => game.state.builtThisTurn.includes(tileIndex(game.map, x, y));

/**
 * Why a build request is invalid, or null when it is fine. The new unit appears on the property itself, so it has to be free
 * (a unit that was built there last turn has to move off first) and must not have built already this turn.
 */
export function buildProblem(game, player, x, y, typeId) {
  const { state, registry } = game;
  const def = registry.units[typeId];
  if (!def) return 'unknown-unit';
  const property = propertyAt(game, x, y);
  if (!property || ownerAt(game, x, y) !== player) return 'not-your-property';
  if (!property.builds.includes(def.category)) return 'cannot-build-here';
  if (unitAt(game, x, y)) return 'tile-occupied';
  if (builtThisTurn(game, x, y)) return 'already-built';
  if (state.funds[player] < def.cost) return 'not-enough-funds';
  return null;
}

/**
 * Produce a unit for `player` on the property at (x, y). It is ready at once but `fresh`: its one order can only be a move (and a
 * Wait), so it gets off the property that built it without attacking, capturing or diving.
 */
export function buildUnit(game, player, x, y, typeId) {
  const problem = buildProblem(game, player, x, y, typeId);
  if (problem) return { ok: false, error: problem, events: [] };
  const { state, registry } = game;
  const def = registry.unit(typeId);
  state.funds[player] -= def.cost;
  state.builtThisTurn.push(tileIndex(game.map, x, y));
  const unit = makeUnit(registry, game.map, state.nextUnitId++, { type: typeId, owner: player, x, y, fresh: true });
  state.units.push(unit);
  return { ok: true, events: [{ type: 'build', unit: snapshotUnit(unit), cost: def.cost }] };
}

export const cheapestBuildableCost = (game, player) => {
  const categories = new Set(propertiesOwnedBy(game, player).flatMap((p) => p.property.builds));
  const costs = game.registry.unitsInCategories([...categories]).map((u) => u.cost);
  return costs.length ? Math.min(...costs) : Infinity;
};

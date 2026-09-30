// Turn income, repair and unit production, all driven by the terrain `property` attribute.

import { propertiesOwnedBy, propertyAt, ownerAt, round1, snapshotUnit, unitAt } from './queries.js';

export const incomeFor = (game, player) => propertiesOwnedBy(game, player).reduce((sum, p) => sum + p.property.income, 0);

/**
 * Begin `player`'s turn: collect income, repair units standing on properties they own (+property.repair HP,
 * capped at the unit's max HP) and make all their units ready to act again.
 */
export function startTurn(game, player) {
  const { state, registry } = game;
  const income = incomeFor(game, player);
  state.funds[player] += income;
  const repaired = [];
  for (const u of state.units) {
    if (u.owner !== player) continue;
    u.done = false;
    const property = propertyAt(game, u.x, u.y);
    const max = registry.maxHpOf(u.type);
    if (property && ownerAt(game, u.x, u.y) === player && u.hp < max) {
      const from = u.hp;
      u.hp = Math.min(max, round1(u.hp + property.repair));
      if (u.hp !== from) repaired.push({ id: u.id, from, to: u.hp });
    }
  }
  return [{ type: 'turnStart', player, day: state.day, income, repaired }];
}

/** Unit definitions that a property tile owned by the current player can produce, in menu order. */
export function buildOptions(game, x, y) {
  const property = propertyAt(game, x, y);
  if (!property) return [];
  return game.registry.unitsInCategories(property.builds);
}

/** Why a build request is invalid, or null when it is fine. */
export function buildProblem(game, player, x, y, typeId) {
  const { state, registry } = game;
  const def = registry.units[typeId];
  if (!def) return 'unknown-unit';
  const property = propertyAt(game, x, y);
  if (!property || ownerAt(game, x, y) !== player) return 'not-your-property';
  if (!property.builds.includes(def.category)) return 'cannot-build-here';
  if (unitAt(game, x, y)) return 'tile-occupied';
  if (state.funds[player] < def.cost) return 'not-enough-funds';
  return null;
}

/** Produce a unit for `player` at (x, y). New units cannot act until next turn. */
export function buildUnit(game, player, x, y, typeId) {
  const problem = buildProblem(game, player, x, y, typeId);
  if (problem) return { ok: false, error: problem, events: [] };
  const { state, registry } = game;
  state.funds[player] -= registry.unit(typeId).cost;
  const unit = { id: state.nextUnitId++, type: typeId, owner: player, x, y, hp: registry.maxHpOf(typeId), done: true, capture: 0 };
  state.units.push(unit);
  return { ok: true, events: [{ type: 'build', unit: snapshotUnit(unit), cost: registry.unit(typeId).cost }] };
}

export const cheapestBuildableCost = (game, player) => {
  const categories = new Set(propertiesOwnedBy(game, player).flatMap((p) => p.property.builds));
  const costs = game.registry.unitsInCategories([...categories]).map((u) => u.cost);
  return costs.length ? Math.min(...costs) : Infinity;
};

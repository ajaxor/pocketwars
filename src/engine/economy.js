// Turn income, repair and unit production, all driven by the terrain `property` attribute.

import { moveCostAt } from './movement.js';
import { DIRS, facingToCentre, inBounds, propertiesOwnedBy, propertyAt, ownerAt, round1, snapshotUnit, unitAt } from './queries.js';

export const incomeFor = (game, player) => propertiesOwnedBy(game, player).reduce((sum, p) => sum + p.property.income, 0);

/**
 * Begin `player`'s turn: collect income, repair units standing on properties they own (+property.repair HP,
 * capped at maxHp) and make all their units ready to act again.
 */
export function startTurn(game, player) {
  const { state, registry } = game;
  const income = incomeFor(game, player);
  const incomes = propertiesOwnedBy(game, player).filter((p) => p.property.income > 0).map((p) => ({ x: p.x, y: p.y, amount: p.property.income }));
  state.funds[player] += income;
  const repaired = [];
  for (const u of state.units) {
    if (u.owner !== player) continue;
    u.done = false;
    u.halted = null;
    const property = propertyAt(game, u.x, u.y);
    if (property && ownerAt(game, u.x, u.y) === player && u.hp < registry.rules.maxHp) {
      const from = u.hp;
      u.hp = Math.min(registry.rules.maxHp, round1(u.hp + property.repair));
      if (u.hp !== from) repaired.push({ id: u.id, from, to: u.hp });
    }
  }
  return [{ type: 'turnStart', player, day: state.day, income, incomes, repaired }];
}

/** Unit definitions that a property tile owned by the current player can produce, in menu order. */
export function buildOptions(game, x, y) {
  const property = propertyAt(game, x, y);
  if (!property) return [];
  return game.registry.unitsInCategories(property.builds);
}

/**
 * The tiles a unit of type `def` built on the property at (x, y) could appear on. A property deploys `on` itself by default
 * (when it is free); one with `deploy: "adjacent"` (a shipyard) uses the free orthogonal neighbours the unit can enter.
 */
export function deployTiles(game, x, y, def) {
  const property = propertyAt(game, x, y);
  if (!property) return [];
  if (property.deploy !== 'adjacent') return unitAt(game, x, y) ? [] : [{ x, y }];
  return DIRS.map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
    .filter((t) => inBounds(game.map, t.x, t.y) && moveCostAt(game, def.moveClass, t.x, t.y) != null && !unitAt(game, t.x, t.y));
}

/** Why a build request is invalid, or null when it is fine. `at` (optional) is the chosen deploy tile; the first one is used without it. */
export function buildProblem(game, player, x, y, typeId, at = null) {
  const { state, registry } = game;
  const def = registry.units[typeId];
  if (!def) return 'unknown-unit';
  const property = propertyAt(game, x, y);
  if (!property || ownerAt(game, x, y) !== player) return 'not-your-property';
  if (!property.builds.includes(def.category)) return 'cannot-build-here';
  const tiles = deployTiles(game, x, y, def);
  if (!tiles.length) return property.deploy === 'adjacent' ? 'no-deploy-tile' : 'tile-occupied';
  if (at && !tiles.some((t) => t.x === at.x && t.y === at.y)) return 'invalid-deploy-tile';
  if (state.funds[player] < def.cost) return 'not-enough-funds';
  return null;
}

/** Produce a unit for `player` at (x, y). New units cannot act until next turn. */
export function buildUnit(game, player, x, y, typeId, at = null) {
  const problem = buildProblem(game, player, x, y, typeId, at);
  if (problem) return { ok: false, error: problem, events: [] };
  const { state, registry } = game;
  const spot = at || deployTiles(game, x, y, registry.unit(typeId))[0];
  state.funds[player] -= registry.unit(typeId).cost;
  const unit = { id: state.nextUnitId++, type: typeId, owner: player, x: spot.x, y: spot.y, hp: registry.rules.maxHp, done: true, capture: 0, submerged: false, halted: null, facing: facingToCentre(game.map, spot.x) };
  state.units.push(unit);
  return { ok: true, events: [{ type: 'build', unit: snapshotUnit(unit), cost: registry.unit(typeId).cost }] };
}

export const cheapestBuildableCost = (game, player) => {
  const categories = new Set(propertiesOwnedBy(game, player).flatMap((p) => p.property.builds));
  const costs = game.registry.unitsInCategories([...categories]).map((u) => u.cost);
  return costs.length ? Math.min(...costs) : Infinity;
};

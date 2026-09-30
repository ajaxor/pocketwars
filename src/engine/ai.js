// Computer-controlled player. Tuning (weights, build lists) lives in data/ai.json; this file only holds the logic.
//
//   chooseOrder(game, unit)  -> an order for game.act()   (one unit at a time so the UI can animate between them)
//   planBuild(game, x, y)    -> unit type id to build on that property, or null
//   buildPhase(game)         -> builds everything the profile wants; returns the events
//   playTurn(game)           -> whole turn synchronously (used by tests and headless simulation)

import { AI_CONDITIONS } from './ai-conditions.js';
import { attributeConfig, hasAttribute } from './attributes.js';
import { canCapture } from './capture.js';
import { calcDamage, canAttackFrom } from './combat.js';
import { buildProblem } from './economy.js';
import { computeReach, distanceField, canFireAfterMoving } from './movement.js';
import { allProperties, terrainAt, tileIndex, unitAt, unitDef } from './queries.js';

/**
 * Tiles worth walking toward: capturers head for properties they don't own, everyone else for enemy units.
 * With nothing to chase, units march on the enemy HQ (any victoryOnCapture property they don't own).
 */
function goalTiles(game, unit) {
  const { state, map } = game;
  if (hasAttribute(unitDef(game, unit), 'capture')) {
    const props = allProperties(game).filter((p) => p.owner !== unit.owner).map((p) => [p.x, p.y]);
    if (props.length) return props;
  }
  const enemies = state.units.filter((e) => e.owner !== unit.owner).map((e) => [e.x, e.y]);
  if (enemies.length) return enemies;
  const hqs = allProperties(game).filter((p) => p.owner !== unit.owner && hasAttribute(p.terrain, 'victoryOnCapture')).map((p) => [p.x, p.y]);
  if (hqs.length) return hqs;
  return [[Math.floor(map.width / 2), Math.floor(map.height / 2)]];
}

export function chooseOrder(game, unit, ai = game.registry.ai) {
  const { map, state } = game;
  const w = ai.weights;
  const def = unitDef(game, unit);
  const reach = computeReach(game, unit);
  const enemies = state.units.filter((e) => e.owner !== unit.owner);
  const field = distanceField(game, def.moveClass, goalTiles(game, unit));
  const mayFire = (moved) => !moved || canFireAfterMoving(game, unit);

  let best = null;
  for (const { x, y } of reach.tiles()) {
    const moved = x !== unit.x || y !== unit.y;
    const defense = terrainAt(game, x, y).defense * (attributeConfig(def, 'terrainDefenseMultiplier') ?? 1);
    let score = -(field.get(tileIndex(map, x, y)) ?? w.unreachableDistance) * w.distanceToGoal + defense * w.terrainDefense;
    let target = null;
    let capture = false;

    if (mayFire(moved)) {
      for (const e of enemies) {
        if (!canAttackFrom(game, unit, e, x, y)) continue;
        const dmg = calcDamage(game, unit, e, { x, y });
        if (dmg <= 0) continue;
        const value = (dmg * game.registry.unit(e.type).cost) / w.costUnit + (dmg >= e.hp ? w.killBonus : 0);
        if (!target || value > target.value) target = { e, value };
      }
    }
    if (target) {
      score = w.attackBase + target.value + defense;
    } else if (canCapture(game, unit, x, y)) {
      capture = true;
      const winsGame = hasAttribute(terrainAt(game, x, y), 'victoryOnCapture');
      score = w.captureBase + (winsGame ? w.victoryCaptureBonus : 0);
    }
    if (!best || score > best.score) best = { x, y, score, target, capture };
  }

  const action = best.target ? { type: 'attack', targetId: best.target.e.id } : best.capture ? { type: 'capture' } : { type: 'wait' };
  return { unitId: unit.id, to: { x: best.x, y: best.y }, action };
}

/** Which unit (if any) the profile wants built on the property at (x, y) for the current player. */
export function planBuild(game, x, y, ai = game.registry.ai) {
  const { state, registry } = game;
  const player = state.turn;
  const property = terrainAt(game, x, y).attributes.property;
  if (!property) return null;
  for (const category of property.builds) {
    for (const rule of ai.build[category] || []) {
      const owned = state.units.filter((u) => u.owner === player && u.type === rule.unit).length;
      if (owned >= rule.max) continue;
      if (rule.when && !AI_CONDITIONS[rule.when](game, player)) continue;
      if (buildProblem(game, player, x, y, rule.unit)) continue; // can't afford / tile not usable
      return rule.unit;
    }
  }
  return null;
}

/** Build on every free property the current player owns, in row-major order. */
export function buildPhase(game, ai = game.registry.ai) {
  const events = [];
  for (const p of allProperties(game)) {
    if (p.owner !== game.state.turn || !p.property.builds.length || unitAt(game, p.x, p.y)) continue;
    const type = planBuild(game, p.x, p.y, ai);
    if (type) events.push(...game.build(p.x, p.y, type).events);
  }
  return events;
}

/** Play the current player's whole turn (every unit, then production) and return all events. */
export function playTurn(game) {
  const player = game.state.turn;
  const events = [];
  for (const unit of game.state.units.filter((u) => u.owner === player)) {
    if (game.isOver) return events;
    if (!game.state.units.includes(unit)) continue; // died to a counterattack earlier this turn
    const result = game.act(chooseOrder(game, unit));
    if (!result.ok) throw new Error(`AI produced an invalid order: ${result.error}`);
    events.push(...result.events);
  }
  if (!game.isOver) events.push(...buildPhase(game));
  return events;
}

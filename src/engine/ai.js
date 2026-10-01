// Computer-controlled player. Tuning (weights, build lists) lives in data/ai.json; this file only holds the logic.
//
//   chooseOrder(game, unit)  -> an order for game.act()   (one unit at a time so the UI can animate between them)
//   planBuild(game, x, y)    -> unit type id to build on that property, or null
//   buildPhase(game)         -> builds everything the profile wants; returns the events
//   playTurn(game)           -> whole turn synchronously (used by tests and headless simulation)
//
// A turn goes: every unit moves, then production, then the units just built use their free move (they are `fresh`: a move and a
// Wait only, see game.js) so they leave the properties that built them.
//
// Carriers (the transport copter) fly toward properties they could have captured, drop their troops once close to one (`tryDeploy`, after
// the carrier's own move; the dropped unit is then ordered like any other), and go back to an airfield for more when empty and the owner
// can pay for it. Resupply is only chosen when the unit is low or empty and the money is there.

// The AI plays fair: it only plans around enemy units it can see (detection.js), and like a human it can have a move interrupted by a
// hidden one. When act() reports that, the unit is asked again (chooseOrder on a halted unit plans from where it stopped).

import { ammoLevel, canResupplyAt, resupplyCost } from './ammo.js';
import { AI_CONDITIONS } from './ai-conditions.js';
import { attributeConfig, hasAttribute } from './attributes.js';
import { canCapture } from './capture.js';
import { calcDamage, canAttackFrom } from './combat.js';
import { canSee } from './detection.js';
import { canDeploy, deployConfig, deployReach } from './deploy.js';
import { buildProblem } from './economy.js';
import { computeReach, distanceField, canFireAfterMoving, hasMovedAlready } from './movement.js';
import { allProperties, distance, ownerAt, propertyAt, terrainAt, tileIndex, unitDef } from './queries.js';
import { canSubmergeAt } from './submerge.js';

/**
 * Tiles worth walking toward: capturers head for properties they don't own, everyone else for enemy units.
 * With nothing to chase, units march on the enemy HQ (any victoryOnCapture property they don't own).
 */
function goalTiles(game, unit) {
  const { state, map } = game;
  // out of ammo (and able to pay for more): back to the property that refills it
  if (ammoLevel(game, unit) === 'empty' && resupplyCost(game, unit) <= state.funds[unit.owner]) {
    const category = unitDef(game, unit).category;
    const homes = allProperties(game).filter((p) => p.owner === unit.owner && p.terrain.attributes.resupply?.categories.includes(category)).map((p) => [p.x, p.y]);
    if (homes.length) return homes;
  }
  if (hasAttribute(unitDef(game, unit), 'capture') || deployConfig(game, unit)) {   // a carrier takes its troops where they can capture
    const props = allProperties(game).filter((p) => p.owner !== unit.owner).map((p) => [p.x, p.y]);
    if (props.length) return props;
  }
  const enemies = state.units.filter((e) => e.owner !== unit.owner && canSee(game, unit.owner, e)).map((e) => [e.x, e.y]);
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
  const enemies = state.units.filter((e) => e.owner !== unit.owner && canSee(game, unit.owner, e));
  const goals = goalTiles(game, unit);
  const field = distanceField(game, def.moveClass, goals);
  const movedAlready = hasMovedAlready(unit);   // an interrupted move counts: indirect weapons cannot fire after it
  const mayAct = !unit.fresh;                   // a freshly built unit only gets its free move: no attack, capture or dive
  const mayFire = (moved) => mayAct && (!(moved || movedAlready) || canFireAfterMoving(game, unit));
  // Where no route to a goal exists for this kind of unit (a ship whose enemy is inland), it still closes in as the crow flies.
  const fallback = (x, y) => w.unreachableDistance + Math.min(...goals.map(([gx, gy]) => distance(x, y, gx, gy))) * (w.crowFlies ?? .1);

  let best = null;
  for (const { x, y } of reach.tiles()) {
    const moved = x !== unit.x || y !== unit.y;
    if (unit.carriedBy && !moved) continue;   // a unit just deployed has to leave its carrier's tile
    // cover only matters to a unit that gets it (aircraft ignore it)
    const defense = hasAttribute(def, 'ignoresTerrainDefense') ? 0 : terrainAt(game, x, y).defense * (attributeConfig(def, 'terrainDefenseMultiplier') ?? 1);
    let score = -(field.get(tileIndex(map, x, y)) ?? fallback(x, y)) * w.distanceToGoal + defense * w.terrainDefense;
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
    } else if (mayAct && canCapture(game, unit, x, y)) {
      capture = true;
      const winsGame = hasAttribute(terrainAt(game, x, y), 'victoryOnCapture');
      score = w.captureBase + (winsGame ? w.victoryCaptureBonus : 0);
    } else if (propertyAt(game, x, y) && ownerAt(game, x, y) !== unit.owner) {
      // a unit parked on someone else's property keeps everyone from capturing it: leave those tiles to the units that can
      score -= w.blockCapture ?? 0;
    }
    if (!best || score > best.score) best = { x, y, score, target, capture };
  }

  // with nothing to shoot or capture, a submarine goes under (it cannot be hunted there without sonar, and it can still strike from there)
  const dive = mayAct && !best.target && !best.capture && canSubmergeAt(game, unit, best.x, best.y);
  const action = best.target ? { type: 'attack', targetId: best.target.e.id } : best.capture ? { type: 'capture' } : dive ? { type: 'submerge' } : canResupplyAt(game, unit, best.x, best.y) && ammoLevel(game, unit) !== 'ok' && resupplyCost(game, unit) <= game.state.funds[unit.owner] ? { type: 'resupply' } : { type: 'wait' };
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
    if (p.owner !== game.state.turn || !p.property.builds.length) continue;
    const type = planBuild(game, p.x, p.y, ai);
    if (type) events.push(...game.build(p.x, p.y, type).events);
  }
  return events;
}

/**
 * A carrier that has moved drops its troops once it is within `deployRange` tiles of something to capture or fight. Returns
 * `{ events, dropped }` (the dropped unit still has to be ordered), or null when it does not deploy.
 */
export function tryDeploy(game, unit, ai = game.registry.ai) {
  if (game.isOver || !game.state.units.includes(unit) || !canDeploy(game, unit)) return null;
  const range = ai.weights.deployRange ?? 8;
  if (Math.min(...goalTiles(game, unit).map(([gx, gy]) => distance(unit.x, unit.y, gx, gy))) > range) return null;
  if (!deployReach(game, unit).tiles.length) return null;
  const res = game.deploy({ unitId: unit.id });
  return res.ok ? { events: res.events, dropped: game.state.units.find((u) => u.id === res.deployed.unitId) } : null;
}

/** Give `unit` its order(s): a second one when the first was cut short by a hidden unit. */
function orderUnit(game, unit, events) {
  for (let step = 0; step < 2 && game.state.units.includes(unit) && !unit.done && !game.isOver; step++) {
    const result = game.act(chooseOrder(game, unit));
    if (!result.ok) throw new Error(`AI produced an invalid order: ${result.error}`);
    events.push(...result.events);
    if (!result.interrupted) break;
  }
}

/** Play the current player's whole turn (every unit, then production, then the new units' free moves) and return all events. */
export function playTurn(game) {
  const player = game.state.turn;
  const events = [];
  for (const unit of game.state.units.filter((u) => u.owner === player)) {
    orderUnit(game, unit, events);
    const drop = tryDeploy(game, unit);
    if (drop) { events.push(...drop.events); orderUnit(game, drop.dropped, events); }
  }
  if (game.isOver) return events;
  events.push(...buildPhase(game));
  for (const unit of game.state.units.filter((u) => u.owner === player && u.fresh)) orderUnit(game, unit, events);
  return events;
}

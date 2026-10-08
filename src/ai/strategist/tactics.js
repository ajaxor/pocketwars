// One unit's best order this turn. Every tile it can reach is scored on:
//   - getting closer to its goal (goals.js), along the distance field for its kind of movement
//   - cover there, friends nearby, and what the enemy could do to it there next turn (the threat map, situation.js)
//   - the best thing it can do from there: an attack (damage dealt, minus the counterattack, plus a bonus for a kill or for leaving a
//     target the rest of the army can finish), a capture, a heal or supply, laying a mine, diving, or a refill
// The strategy scales the parts (aggression, caution, capture), and the tuned parameters set their weights (params.js).
//
//   bestOrder(sit, unit) -> { order, score, kind: 'attack' | 'capture' | 'move', gain, goal } or null for a unit that cannot act

import { ammoLevel, ammoOf, canResupplyAt, resupplyCost, roundCost } from '../../engine/ammo.js';
import { attributeConfig, hasAttribute } from '../../engine/attributes.js';
import { canCapture } from '../../engine/capture.js';
import { canRebuild, ruinAt } from '../../engine/rebuild.js';
import { affordableRuin } from './goals.js';
import { canAttackFrom, forecastAttack } from '../../engine/combat.js';
import { canHealAt, healPlan, healsAutomatically } from '../../engine/heal.js';
import { isMine, layConfig, layTiles } from '../../engine/mines.js';
import { canFireAfterMoving, computeReach, hasMovedAlready } from '../../engine/movement.js';
import { distance, propertyAt, ownerAt, terrainAt, tileIndex, unitDef } from '../../engine/queries.js';
import { isNeutral } from '../../engine/structures.js';
import { canSubmergeAt } from '../../engine/submerge.js';
import { canSupplyAt, supplyPlan } from '../../engine/supply.js';
import { menuFor } from '../../engine/economy.js';
import { goalsFor } from './goals.js';
import { matchup, reachOf } from './knowledge.js';

const BREAK_WALL = 4;     // a cracked wall in the way is worth a shot when nothing better is in reach
const BLOCK_BUILD = 12;   // standing on one of our own factories keeps it from building this turn
const MAX_MINES = 4;

/** How much of `target`'s HP the units still waiting for orders (other than `except`) could take off it this turn, roughly. */
export function finishPotential(sit, target, except) {
  const { game } = sit;
  const stars = hasAttribute(unitDef(game, target), 'ignoresTerrainDefense') ? 0 : terrainAt(game, target.x, target.y).defense;
  const cover = Math.max(0, 1 - stars * target.hp / 100);
  let hp = 0;
  for (const v of sit.remaining) {
    if (v === except || v.done || v.fresh || !game.state.units.includes(v)) continue;
    const def = unitDef(game, v);
    const { min, max } = reachOf(game.registry, def);
    if (!max) continue;
    const d = distance(v.x, v.y, target.x, target.y);
    const ok = canFireAfterMoving(game, v) ? d <= def.move + max : d >= min && d <= max;
    if (ok) hp += matchup(game, v.type, target.type) * (v.hp / sit.maxHp) * cover;
  }
  return hp;
}

export function bestOrder(sit, unit) {
  const { game, params, tactics, player } = sit;
  const def = unitDef(game, unit);
  const reach = computeReach(game, unit);
  const at = unit.y * game.map.width + unit.x;
  let cached = sit.goalCache?.get(unit.id);
  if (!cached || cached.at !== at || cached.hp !== unit.hp) sit.goalCache?.set(unit.id, (cached = { at, hp: unit.hp, goal: goalsFor(sit, unit) }));
  const goal = cached.goal;
  const field = sit.field(def.moveClass, goal.tiles);
  const movedAlready = hasMovedAlready(unit);
  const mayAct = !unit.fresh;
  const mayFire = (moved) => mayAct && (!(moved || movedAlready) || canFireAfterMoving(game, unit));
  const aggression = tactics.aggression ?? 1;
  const caution = (tactics.caution ?? 1) / aggression * Math.min(2, Math.max(0.35, 1 / sit.strength) ** params.balance);
  const value = def.cost / 1000;
  const { max: range } = reachOf(game.registry, def);
  const fallback = (x, y) => params.unreachable + Math.min(...goal.tiles.map(([gx, gy]) => distance(x, y, gx, gy))) * 0.1;
  const targets = mayAct ? sit.enemies.filter((e) => game.state.units.includes(e) && distance(unit.x, unit.y, e.x, e.y) <= def.move + range + 1) : [];

  let best = null;
  for (const { x, y } of reach.tiles()) {
    const moved = x !== unit.x || y !== unit.y;
    if (unit.carriedBy && !moved && reach.size > 1) continue;   // a unit just dropped has to leave its carrier's tile
    const stars = hasAttribute(def, 'ignoresTerrainDefense') ? 0 : terrainAt(game, x, y).defense * (attributeConfig(def, 'terrainDefenseMultiplier') ?? 1);
    let base = -(field.get(tileIndex(game.map, x, y)) ?? fallback(x, y)) * params.distance + stars * params.terrain;
    base -= sit.threatAt(unit, x, y) * params.threat * caution;
    let friends = 0;
    for (const f of sit.mine) if (f !== unit && Math.abs(f.x - x) + Math.abs(f.y - y) <= 2 && ++friends >= 3) break;
    base += friends * params.guard;
    const prop = propertyAt(game, x, y);
    if (prop && ownerAt(game, x, y) === player && prop.builds?.length && menuFor(game, player, x, y).length) base -= BLOCK_BUILD;   // staying put blocks it as much as arriving

    let pick = { score: base, kind: 'move', action: { type: 'wait' }, gain: 0 };
    // attacks from here
    if (mayFire(moved)) {
      for (const e of targets) {
        if (!canAttackFrom(game, unit, e, x, y)) continue;
        if (isNeutral(e) && hasAttribute(unitDef(game, e), 'wallSection')) {
          if (base + BREAK_WALL > pick.score && pick.kind !== 'attack') pick = { score: base + BREAK_WALL, kind: 'wall', action: { type: 'attack', targetId: e.id }, gain: 0 };
          continue;
        }
        const f = forecastAttack(game, unit, e, { x, y });
        if (f.damage <= 0) continue;
        let gain = f.damage / sit.maxHp * unitDef(game, e).cost / 1000 * params.attack * aggression;
        if (f.destroyed) gain += params.kill;
        else if (e.hp - f.damage <= finishPotential(sit, e, unit)) gain += params.focus;
        gain -= (f.counter ?? 0) / sit.maxHp * value * params.attack * params.counter;
        if (gain <= 0) continue;
        const score = base + gain;
        if (score > pick.score) pick = { score, kind: 'attack', action: { type: 'attack', targetId: e.id }, gain, killed: f.destroyed ? e : null };
      }
    }
    // capture
    if (mayAct && pick.kind !== 'attack' && canCapture(game, unit, x, y)) {
      const p = propertyAt(game, x, y);
      const hq = hasAttribute(terrainAt(game, x, y), 'victoryOnCapture') && ownerAt(game, x, y) !== null;
      const gain = (params.capture + params.captureIncome * p.income / 1000 + (hq ? params.hqCapture : 0)) * (tactics.capture ?? 1);
      if (base + gain > pick.score) pick = { score: base + gain, kind: 'capture', action: { type: 'capture' }, gain };
    } else if (mayAct && pick.kind !== 'attack' && canRebuild(game, unit, x, y) && affordableRuin(game, player, ruinAt(game, x, y))) {
      // a ruin it can pay for: rebuilding is worth what taking the property it becomes would be
      const becomes = game.registry.terrainDef(ruinAt(game, x, y).becomes).attributes.property;
      const gain = (params.capture + params.captureIncome * becomes.income / 1000) * (tactics.capture ?? 1);
      if (base + gain > pick.score) pick = { score: base + gain, kind: 'capture', action: { type: 'rebuild' }, gain };
    } else if (prop && ownerAt(game, x, y) !== player && !canCapture(game, unit, x, y)) {
      pick.score -= params.blockCapture;   // parked on a property it cannot take: in the way of those that can
    }
    // heal, supply
    if (mayAct && pick.kind !== 'attack' && canHealAt(game, unit, x, y)) {
      const gain = healPlan(game, unit, x, y).reduce((a, h) => a + h.hp * unitDef(game, h.unit).cost / 1000, 0) * params.heal / sit.maxHp * 4;
      if (gain > 0 && base + gain > pick.score) pick = { score: base + gain, kind: 'support', action: { type: 'heal' }, gain };
    }
    if (mayAct && pick.kind !== 'attack' && canSupplyAt(game, unit, x, y)) {
      const gain = supplyPlan(game, unit, x, y).reduce((a, p) => a + (p.rounds * roundCost(game, p.unit) + p.hp * unitDef(game, p.unit).cost / sit.maxHp) / 1000, 0) * params.heal;
      if (gain > 0 && base + gain > pick.score) pick = { score: base + gain, kind: 'support', action: { type: 'supply' }, gain };
    }
    // a medic heals by itself after whatever it does (heal.auto): where it ends the order is worth what it would restore there, on top of the order
    if (healsAutomatically(game, unit)) {
      const gain = healPlan(game, unit, x, y).reduce((a, h) => a + h.hp * unitDef(game, h.unit).cost / 1000, 0) * params.heal / sit.maxHp * 4;
      if (gain > 0) pick = { ...pick, score: pick.score + gain, gain: pick.gain + gain, kind: pick.kind === 'move' ? 'support' : pick.kind };
    }
    if (!best || pick.score > best.score) best = { ...pick, x, y };
  }
  if (!best) return null;

  // with nothing better to do where it ends up: lay a mine, dive, or refill
  let action = best.action;
  if (best.kind === 'move' && mayAct) {
    action = layOrder(sit, unit, best, goal) ?? (canSubmergeAt(game, unit, best.x, best.y) ? { type: 'submerge' } : null)
      ?? (canResupplyAt(game, unit, best.x, best.y) && ammoLevel(game, unit) !== 'ok' && resupplyCost(game, unit) <= game.state.funds[player] ? { type: 'resupply' } : action);
  } else if (best.kind === 'move' && unit.fresh && canSubmergeAt(game, unit, best.x, best.y)) {
    action = { type: 'submerge' };
  }
  return { order: { unitId: unit.id, to: { x: best.x, y: best.y }, action }, score: best.score, kind: best.kind, gain: best.gain, killed: best.killed ?? null, goal };
}

/** A Lay order for a mine layer: the free tile in range nearest its goal, while it has mines and fewer than MAX_MINES are out. */
function layOrder(sit, unit, best, goal) {
  const { game } = sit;
  if (!layConfig(game, unit)) return null;
  const out = game.state.units.filter((u) => u.owner === unit.owner && isMine(game, u)).length;
  if (out >= MAX_MINES || (ammoOf(game, unit) ?? 1) < 1) return null;
  let pick = null;
  for (const t of layTiles(game, unit, best.x, best.y)) {
    const d = Math.min(...goal.tiles.map(([gx, gy]) => distance(t.x, t.y, gx, gy)));
    if (!pick || d < pick.d) pick = { t, d };
  }
  return pick ? { type: 'lay', at: pick.t } : null;
}

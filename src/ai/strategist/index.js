// The "strategist" engine. Each turn:
//   1. strategy   keep or change the game plan (selector.js, strategies from data/ai-strategies.json)
//   2. situation  read the board: enemy reach next turn (the threat map), capture assignments, landing sites (situation.js, goals.js)
//   3. orders     every unit's best order is scored (tactics.js); the planner then carries them out strongest first: kills, then other
//                 attacks (artillery before the units that would take a counterattack), then captures, support, and moves, front units
//                 first. After each order, the plans of units near what changed are worked out again, so later units see the result
//                 (a target already destroyed, a wounded one to finish off, a tile now taken). Carriers drop their troops at landing sites.
//   4. production what is worth building where (production.js), then the new units' free moves
// Its numbers live in data/ai.json engines.strategist (params.js), and tools/ai/tune.mjs tunes them by playing games.

import { canDeploy, deployReach } from '../../engine/deploy.js';
import { canSurface } from '../../engine/submerge.js';
import { canSee } from '../../engine/detection.js';
import { deployedType, distance, unitDef } from '../../engine/queries.js';
import { isStructure } from '../../engine/structures.js';
import { areaAt } from './analysis.js';
import { planCaptures } from './goals.js';
import { reachOf, roles } from './knowledge.js';
import { PARAMS, paramsOf, validateParams } from './params.js';
import { canBuildNow, planBuilds } from './production.js';
import { currentStrategy } from './selector.js';
import { Situation } from './situation.js';
import { isKnownCondition } from './strategies.js';
import { bestOrder } from './tactics.js';

/** Planner priority: lower tiers go first. */
function priority(c, game, unit) {
  if (c.kind === 'attack') return 4000 + (c.killed ? 1000 : 0) + (roles(unitDef(game, unit)).indirect ? 200 : 0) + c.gain;
  if (c.kind === 'capture') return 3000 + c.gain;
  if (c.kind === 'support') return 2000 + c.gain;
  if (c.kind === 'wall') return 1500;
  return c.score;   // moves: the unit nearest its goal (highest score) first, so it clears the way for those behind
}

/** A submerged submarine comes up to travel at surface speed unless an enemy it can see is close. */
function wantsSurface(game, unit) {
  if (game.isOver || unit.done || unit.halted || !canSurface(game, unit)) return false;
  return !game.state.units.some((e) => e.owner !== unit.owner && canSee(game, unit.owner, e) && distance(unit.x, unit.y, e.x, e.y) <= 6);
}

/** Should a carrier that has moved drop its troops now? When a property it was heading for is within their walk, on land they can step onto. */
function wantsDeploy(sit, carrier) {
  const { game } = sit;
  if (game.isOver || !game.state.units.includes(carrier) || !canDeploy(game, carrier)) return false;
  const targets = sit.landing?.get(carrier.id);
  if (!targets?.length) return false;
  const cargo = game.registry.unit(deployedType(game, carrier));
  const landing = deployReach(game, carrier).tiles;
  return targets.some((t) => distance(carrier.x, carrier.y, t.p.x, t.p.y) <= cargo.move + 2
    && landing.some((l) => areaAt(game, cargo.moveClass, l.x, l.y) === t.area));
}

/**
 * Is a plan made earlier this turn still good? In our own turn enemies only die, come to light or drop out of sight, never move, so a
 * route stays open; what can go wrong is a friend now standing on the tile, or the target gone or no longer seen. (Plans near anything
 * that changed are made again anyway.)
 */
function stillGood(game, unit, order) {
  const there = game.state.units.find((u) => u.x === order.to.x && u.y === order.to.y);
  if (there && there !== unit) return false;
  if (order.action.targetId != null) {   // the target must still be there, and still seen (whoever spotted it may have died)
    const target = game.state.units.find((u) => u.id === order.action.targetId);
    if (!target || !canSee(game, unit.owner, target)) return false;
  }
  // a heal, supply, lay... depends on who is around now; a move (wait) or attack must still have a legal route (a friend that moved into the
  // path, or a mine that came to light, can close it)
  return game.validateOrder(order).ok;
}

/** Units whose plans may have changed after something happened at these tiles. */
function invalidate(game, cache, units, tiles) {
  for (const u of units) {
    if (!cache.has(u.id)) continue;
    const def = unitDef(game, u);
    const r = def.move + reachOf(game.registry, def).max + 2;
    if (tiles.some(([x, y]) => distance(u.x, u.y, x, y) <= r)) cache.delete(u.id);
  }
}

/** Drop a carrier's troops and give them their order (they have to leave the carrier's tile). */
function* drop(sit, carrier, wants) {
  const { game } = sit;
  const res = yield { type: 'deploy', unitId: carrier.id };
  if (!res.ok) return;
  const dropped = game.state.units.find((u) => u.id === res.deployed.unitId);
  if (!dropped) return;
  sit.refresh();
  sit.remaining = [dropped];
  planCaptures(sit);
  for (let i = 0; i < 2 && wants(dropped); i++) {
    const d = bestOrder(sit, dropped);
    if (!d) break;
    const r = yield { type: 'order', order: d.order };
    if (!r.interrupted) break;
  }
}

export function* turn(game, ctx) {
  const { player } = ctx;
  const params = paramsOf(ctx.profile);
  const strategy = currentStrategy(game, ctx, params);
  const sit = new Situation(game, player, params, strategy);
  sit.profile = ctx.profile;
  planCaptures(sit);
  const wants = (u) => game.state.units.includes(u) && u.owner === player && !u.done && !isStructure(game, u);
  let pending = game.state.units.filter((u) => wants(u) && !u.fresh);
  const cache = new Map();
  const refused = new Map();   // unit id -> orders the engine turned down this turn: one is planned again, a second gives the unit up
  let sight = new Set(sit.enemies.map((e) => e.id));

  for (let guard = 0; guard < 500 && !game.isOver; guard++) {
    pending = pending.filter((u) => wants(u) && !u.fresh);
    if (!pending.length) break;
    sit.refresh();
    sit.remaining = pending;
    const now = new Set(sit.enemies.map((e) => e.id));
    // an enemy came to light, or one still alive dropped out of sight (a spotter moved away): routes and threats changed, so every plan
    // is made again (an enemy that died is handled by `invalidate`)
    if (sit.enemies.some((e) => !sight.has(e.id)) || [...sight].some((id) => !now.has(id) && game.state.units.some((u) => u.id === id))) cache.clear();
    sight = now;
    let best = null;
    for (const u of pending) {
      if (!cache.has(u.id)) cache.set(u.id, bestOrder(sit, u));
      const c = cache.get(u.id);
      const p = c ? priority(c, game, u) : -Infinity;
      if (!best || p > best.p) best = { u, c, p };
    }
    const { u: unit } = best;
    let c = best.c;
    if (!c) { pending = pending.filter((u) => u !== unit); continue; }
    if (!stillGood(game, unit, c.order)) {   // something moved into its way (or its target is gone) since it was planned
      c = bestOrder(sit, unit);
      if (!c || !game.validateOrder(c.order).ok) { pending = pending.filter((u) => u !== unit); continue; }
    }
    if (!unit.fresh && wantsSurface(game, unit)) {
      yield { type: 'surface', unitId: unit.id };
      cache.delete(unit.id);
      continue;   // plan again with the surface speed
    }
    // a carrier already where it wants to be drops its troops before it moves (then it can head home)
    if (roles(unitDef(game, unit)).carrier && c.goal?.kind === 'land' && !unit.fresh && wantsDeploy(sit, unit)) {
      yield* drop(sit, unit, wants);
      cache.delete(unit.id);
      continue;
    }
    const target = c.order.action.targetId != null ? game.state.units.find((e) => e.id === c.order.action.targetId) : null;
    const at = target ? [target.x, target.y] : null;
    const res = yield { type: 'order', order: c.order };
    cache.delete(unit.id);
    if (!res.ok && !res.interrupted) {   // the board changed under a plan stillGood trusted (a route now blocked): plan from scratch once, then let the unit be
      const n = (refused.get(unit.id) ?? 0) + 1;
      refused.set(unit.id, n);
      if (n > 1) pending = pending.filter((u) => u !== unit);
      continue;
    }
    // a move spoils no other plan (friends can be walked through; a taken tile is caught by stillGood); a fight changes what is
    // worth doing around the target, and a death changes where everyone is heading
    if (at) {
      invalidate(game, cache, pending, [at]);
      if (res.events.some((e) => e.type === 'strike' && e.destroyed)) sit.goalCache.clear();
    }
    if (res.interrupted) continue;   // stopped by a hidden unit: it is planned again from where it stands
    if (roles(unitDef(game, unit)).carrier && wantsDeploy(sit, unit)) yield* drop(sit, unit, wants);
  }
  if (game.isOver) return;

  // production
  for (let n = 0; n < 30; n++) {
    sit.refresh();
    const next = planBuilds(sit).find((o) => canBuildNow(game, player, o));
    if (!next) break;
    const res = yield { type: 'build', x: next.x, y: next.y, unit: next.unit };
    if (!res.ok) break;
  }
  // the units just built drive off their factories
  sit.refresh();
  for (const unit of game.state.units.filter((u) => u.owner === player && u.fresh && !u.done)) {
    if (game.isOver) return;
    sit.remaining = [];
    const c = bestOrder(sit, unit);
    if (c && game.validateOrder(c.order).ok) yield { type: 'order', order: c.order };
  }
}

export function validateProfile(profile, raw, problems, at) {
  validateParams(profile, raw.units, raw['ai-strategies']?.strategies, problems, at);
}

/** Check data/ai-strategies.json. */
export function validateStrategies(file, units, problems) {
  if (file === undefined) return;
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (!isObj(file) || !Array.isArray(file.strategies)) return problems.push('ai-strategies: must be { strategies: [...] }');
  const seen = new Set();
  const TARGETS = ['army', 'hq', 'properties', 'balanced'];
  const BUILD_KEYS = ['unit', 'category', 'moveClass', 'tag', 'role', 'attribute', 'fast', 'heavy', 'cheap'];
  file.strategies.forEach((s, i) => {
    const at = `ai-strategies[${i}]${s?.id ? ` (${s.id})` : ''}`;
    if (!isObj(s)) return problems.push(`${at}: must be an object`);
    if (typeof s.id !== 'string' || !s.id) problems.push(`${at}: id must be a non-empty string`);
    else if (seen.has(s.id)) problems.push(`${at}: duplicate id`);
    seen.add(s.id);
    if (typeof s.name !== 'string') problems.push(`${at}: name must be a string`);
    if (s.weight !== undefined && !(typeof s.weight === 'number' && s.weight >= 0)) problems.push(`${at}: weight must be a number of 0 or more`);
    if (s.when !== undefined && !Array.isArray(s.when)) problems.push(`${at}: when must be a list of conditions`);
    for (const c of s.when ?? []) if (typeof c !== 'string' || !isKnownCondition(c)) problems.push(`${at}: unknown condition "${c}"`);
    for (const [k, v] of Object.entries(s.build ?? {})) {
      if (!BUILD_KEYS.includes(k)) { problems.push(`${at}: build.${k}: unknown key (known: ${BUILD_KEYS.join(', ')})`); continue; }
      if (typeof v === 'number') continue;
      if (!isObj(v)) { problems.push(`${at}: build.${k} must be a number or an object of numbers`); continue; }
      for (const [kk, n] of Object.entries(v)) {
        if (typeof n !== 'number' || n < 0) problems.push(`${at}: build.${k}.${kk} must be a number of 0 or more`);
        if (k === 'unit' && !units?.[kk]) problems.push(`${at}: build.unit.${kk}: unknown unit`);
      }
    }
    const t = s.tactics ?? {};
    if (t.target !== undefined && !TARGETS.includes(t.target)) problems.push(`${at}: tactics.target must be one of ${TARGETS.join(', ')}`);
    for (const k of ['aggression', 'caution', 'capture', 'landing', 'retreat', 'mass']) if (t[k] !== undefined && !(typeof t[k] === 'number' && t[k] >= 0)) problems.push(`${at}: tactics.${k} must be a number of 0 or more`);
  });
}

export const strategist = {
  id: 'strategist',
  name: 'Strategist',
  description: 'Plans the whole turn: focus fire, the enemy\'s reply, captures shared out, landings across water, and production valued from unit stats, under a game plan picked from data/ai-strategies.json and changed when it fails.',
  turn,
  validateProfile,
  params: PARAMS,
};

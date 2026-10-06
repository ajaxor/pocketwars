// What to build. Nothing here names a unit: every type on a factory's menu is valued from its stats against what the enemy has (and,
// less, what the enemy could build), and from the jobs that need doing, so new units and balance changes are taken into account at once.
//
// A type's worth, in thousands, built at a given factory:
//   combat    the money it would take off the enemy per attack (matchup x price, over the enemy army), times `offense`,
//             minus what the enemy would take off it per attack, times `defense`, counting only enemies it can actually get at from
//             that factory (a tank on an island reaches nobody across the water) and that can get at it
//   roles     a capturer for properties it could still take on its landmass, a carrier for land worth taking that walkers cannot reach
//             (an island), a healer, supplier or radar for the units it would look after
// times the strategy's taste for it (strategies.js) and `sameType` for each one already owned. There is no preference for any unit by name:
// a type is worth what it does for its price, worked out from the data.
// Builds go to whichever (factory, type) pair is worth most for its price (worth / cost^costExponent), until the money or the
// worthwhile choices run out.

import { attributeConfig } from '../../engine/attributes.js';
import { buildProblem, menuFor } from '../../engine/economy.js';
import { builtThisTurn } from '../../engine/economy.js';
import { deployedType, distance, unitAt, unitDef } from '../../engine/queries.js';
import { isStructure } from '../../engine/structures.js';
import { areaAt } from './analysis.js';
import { areasAround, fuelSpots, roundTrip } from './goals.js';
import { inRangeOf } from './analysis.js';
import { matchup, reachOf, roles } from './knowledge.js';
import { buildTaste } from './strategies.js';

const canGet = (game, mc, ids, x, y, range) => [...ids].some((id) => inRangeOf(game, mc, id, x, y, range));

/** The enemy as weighted types: { type, weight, x, y, cost }: their army, plus what their factories could build at `potential` weight. */
function enemyMix(sit) {
  const { game, player, params } = sit;
  const mix = sit.army.map((e) => ({ type: e.type, weight: e.hp / sit.maxHp, x: e.x, y: e.y }));
  const could = new Map();
  for (const p of sit.properties) {
    if (p.owner === null || p.owner === player || !p.property.builds?.length) continue;
    for (const def of menuFor(game, p.owner, p.x, p.y)) if (!could.has(def.id)) could.set(def.id, p);
  }
  const share = could.size ? Math.max(1, mix.length) * params.potential / could.size : 0;
  for (const [type, p] of could) mix.push({ type, weight: share, x: p.x, y: p.y });
  return mix;
}

/** The worth of building `type` at (x, y) for the player, in thousands (before the price is taken into account). */
export function typeWorth(sit, type, x, y, ctx) {
  const { game, params, player } = sit;
  const def = game.registry.unit(type);
  const r = roles(def);
  const mc = def.moveClass;
  const ids = ctx.areas.get(mc) ?? ctx.areas.set(mc, areasAround(game, mc, x, y)).get(mc);
  const { max: range } = reachOf(game.registry, def);
  // a flier on a tank of fuel can only fight what lies within its round trip of a place it refuels, once the enemy has come a couple of
  // turns closer: worth nothing against the rest
  const trip = roundTrip(game, def);
  const spots = trip < Infinity ? (fuelSpots(sit, def).length ? fuelSpots(sit, def) : [[x, y]]) : [];
  let combat = 0;
  if (ctx.mix.length) {
    let dealt = 0;
    let taken = 0;
    let total = 0;
    for (const e of ctx.mix) {
      const ed = game.registry.unit(e.type);
      total += e.weight;
      const near = !spots.length || spots.some(([hx, hy]) => distance(e.x, e.y, hx, hy) <= trip + range + (ed.move ?? 0) * 2);
      if (range && near && canGet(game, mc, ids, e.x, e.y, range)) dealt += e.weight * Math.min(1, matchup(game, type, e.type) / sit.maxHp) * ed.cost;
      const er = reachOf(game.registry, ed).max;
      const theirs = areasAround(game, ed.moveClass, e.x, e.y);
      if (er && canGet(game, ed.moveClass, theirs, x, y, er + (ed.move ?? 0) * 2)) taken += e.weight * Math.min(1, matchup(game, e.type, type) / sit.maxHp) * def.cost;
    }
    if (total) combat = (params.offense * dealt - params.defense * taken) / total / 1000;
  }
  let role = 0;
  if (r.capture) {
    const open = sit.properties.filter((p) => p.owner !== player && canGet(game, mc, ids, p.x, p.y, 0)).length;
    const have = sit.mine.filter((u) => roles(unitDef(game, u)).capture && [...areasAround(game, unitDef(game, u).moveClass, u.x, u.y)].some((a) => ids.has(a))).length;
    role += params.captureNeed * Math.max(0, Math.min(4, open - have * 1.5));
  }
  if (r.carrier) {
    const cargo = game.registry.unit(deployedType(game, { ...ctx.phantom, type }) ?? type);
    if (roles(cargo).capture) {
      // land worth taking that no walker of ours can get to: across the water from everything we hold
      const home = new Set();
      for (const p of sit.properties) if (p.owner === player) for (const a of areasAround(game, cargo.moveClass, p.x, p.y)) home.add(a);
      const range = roundTrip(game, def);   // a flier must get there and back on its fuel
      const spots = range < Infinity ? fuelSpots(sit, def) : [];
      const islands = sit.properties.filter((p) => p.owner !== player && !home.has(areaAt(game, cargo.moveClass, p.x, p.y))
        && canGet(game, mc, ids, p.x, p.y, cargo.move + 1)
        && (range === Infinity || spots.some(([hx, hy]) => distance(p.x, p.y, hx, hy) <= range + cargo.move + 1))).length;
      const carriers = sit.mine.filter((u) => roles(unitDef(game, u)).carrier).length;
      role += params.carrierNeed * Math.min(4, islands) / (1 + carriers) ** 2;   // two or three carriers do the job; more just queue up
    }
  }
  if (r.healer || r.supplier || (r.radar && !r.combat)) {
    const cats = attributeConfig(def, 'heal')?.categories ?? attributeConfig(def, 'supply')?.categories ?? null;
    const served = sit.mine.filter((u) => !isStructure(game, u) && (!cats || cats.includes(unitDef(game, u).category))).length;
    const same = sit.mine.filter((u) => { const o = roles(unitDef(game, u)); return (r.healer && o.healer) || (r.supplier && o.supplier) || (r.radar && o.radar); }).length;
    role += params.support * Math.min(8, served) / 4 / (1 + same) ** 2;   // one or two look after an army
  }
  if (r.layer && sit.army.some((e) => unitDef(game, e).moveClass === mc)) role += params.support;
  const owned = sit.mine.filter((u) => u.type === type).length;
  const taste = buildTaste(sit.strategy, def, r);
  return (Math.max(0, combat) + role) * taste * params.sameType ** owned;
}

/** The builds to make this turn, best first: [{ x, y, unit }]. Each is checked again (and the money re-counted) as it is made. */
export function planBuilds(sit) {
  const { game, player, params } = sit;
  const ctx = { mix: enemyMix(sit), areas: null, phantom: { owner: player, x: 0, y: 0 } };
  const free = sit.properties.filter((p) => p.owner === player && p.property.builds?.length && !builtThisTurn(game, p.x, p.y) && !unitAt(game, p.x, p.y));
  const options = [];
  for (const p of free) {
    ctx.areas = new Map();
    for (const def of menuFor(game, player, p.x, p.y)) {
      const worth = typeWorth(sit, def.id, p.x, p.y, ctx);
      if (worth <= 0) continue;
      options.push({ x: p.x, y: p.y, unit: def.id, cost: def.cost, worth, score: worth / (def.cost / 1000) ** params.costExponent });
    }
  }
  options.sort((a, b) => b.score - a.score);
  return options.filter((o) => o.score >= params.minUtility);
}

/** Is the build still possible now (money, a free factory)? */
export const canBuildNow = (game, player, o) => !buildProblem(game, player, o.x, o.y, o.unit);

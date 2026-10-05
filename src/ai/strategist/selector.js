// Choosing a strategy, and changing it when it is not working.
//
// At the start of a game the strategist rolls one of the strategies that suit the map and its factories (strategies.js), weighted by:
//   - the strategy's own `weight`, and the tuned `strategyWeight` from the profile
//   - what it has learned about this opponent (ctx.history, kept by the game between battles: src/ai/history.js): strategies that have
//     beaten them before are favoured, ones they have seen less of get a novelty bonus (`novelty`), and last game's is avoided
// Every `reviewDays` days it checks its share of the total worth (evaluate.js). A strategy that has had `holdDays` and has dropped under
// `switchShare` is replaced, preferring strategies whose favourite units hurt what the enemy is actually fielding.
// The choice lives in ctx.memory (saved with the game): { strategy: { id, since, share, tactics }, tried: [id], reviewed }.

import { standings } from '../evaluate.js';
import { unitDef } from '../../engine/queries.js';
import { isStructure } from '../../engine/structures.js';
import { matchup } from './knowledge.js';
import { applicable, buildable, buildTaste, withJitter } from './strategies.js';

/** Used when the data has no strategies at all (or none fits): a plain balanced plan. */
export const FALLBACK = Object.freeze({ id: 'balanced', name: 'Balanced', summary: 'A bit of everything.', build: {}, tactics: { target: 'balanced' } });

const shareOf = (game, player) => standings(game).find((s) => s.player === player)?.share ?? 0;

function pick(items, rng) {
  const total = items.reduce((a, i) => a + i.weight, 0);
  if (!(total > 0)) return items[0]?.s ?? null;
  let r = rng() * total;
  for (const i of items) { r -= i.weight; if (r <= 0) return i.s; }
  return items[items.length - 1].s;
}

/** How well a strategy's tastes line up with beating what the enemy has on the board (about 1 for an average fit). */
function fitAgainst(game, player, strategies) {
  const enemy = game.state.units.filter((u) => u.owner !== player && u.owner !== null && !isStructure(game, u));
  const types = buildable(game, player);
  if (!enemy.length || !types.length) return new Map(strategies.map((s) => [s.id, 1]));
  const total = enemy.reduce((a, e) => a + unitDef(game, e).cost, 0);
  const quality = new Map(types.map((def) => [def.id,
    enemy.reduce((a, e) => a + Math.min(1, matchup(game, def.id, e.type) / game.registry.rules.maxHp) * unitDef(game, e).cost, 0) / total]));
  const raw = new Map(strategies.map((s) => {
    let num = 0;
    let den = 0;
    for (const def of types) { const t = buildTaste(s, def); num += t * quality.get(def.id); den += t; }
    return [s.id, den ? num / den : 0];
  }));
  const mean = [...raw.values()].reduce((a, v) => a + v, 0) / raw.size || 1;
  return new Map([...raw].map(([id, v]) => [id, (v / mean) ** 2]));
}

function weighted(game, ctx, params, candidates, { fit = null } = {}) {
  const h = ctx.history?.strategies ?? {};
  return candidates.map((s) => {
    const seen = h[s.id] ?? { games: 0, wins: 0 };
    let weight = (s.weight ?? 1) * (ctx.profile?.strategyWeight?.[s.id] ?? 1);
    if (ctx.history) {
      weight *= 2 * (seen.wins + 1) / (seen.games + 2);              // what has worked against this opponent
      weight *= 1 + params.novelty / Math.sqrt(1 + seen.games);       // what they have not seen much of
      if (ctx.history.last === s.id) weight *= 0.4;                   // not the same plan twice running
    }
    if (fit) weight *= fit.get(s.id) ?? 1;
    return { s, weight };
  });
}

/** The strategy for this turn: rolled on the first turn, reviewed every few days. Returns the (jittered) strategy object. */
export function currentStrategy(game, ctx, params) {
  const { memory, player } = ctx;
  const all = game.registry.aiStrategies ?? [];
  const byId = (id) => all.find((s) => s.id === id) ?? (id === FALLBACK.id ? FALLBACK : null);
  const day = game.state.day;
  let current = memory.strategy && byId(memory.strategy.id);

  if (!current) {
    const fits = all.filter((s) => applicable(game, player, s));
    current = (fits.length && pick(weighted(game, ctx, params, fits), ctx.rng)) || FALLBACK;
    adopt(game, ctx, current, day);
  } else if (day - (memory.reviewed ?? 0) >= params.reviewDays) {
    memory.reviewed = day;
    const share = shareOf(game, player);
    const s = memory.strategy;
    if (day - s.since >= params.holdDays && share < params.switchShare && share <= s.share) {
      const tried = new Set(memory.tried ?? []);
      let options = all.filter((o) => !tried.has(o.id) && applicable(game, player, o));
      if (!options.length) options = all.filter((o) => o.id !== s.id && applicable(game, player, o));
      if (options.length) {
        const next = pick(weighted(game, ctx, params, options, { fit: fitAgainst(game, player, options) }), ctx.rng);
        if (next) { current = next; adopt(game, ctx, current, day); }
      }
    }
  }
  return { ...current, tactics: memory.strategy.tactics };
}

function adopt(game, ctx, strategy, day) {
  const { memory, player } = ctx;
  const jittered = withJitter(strategy, ctx.rng);
  memory.strategy = { id: strategy.id, since: day, share: shareOf(game, player), tactics: jittered.tactics };
  memory.tried = [...new Set([...(memory.tried ?? []), strategy.id])];
  memory.reviewed = day;
  (memory.log ??= []).push({ id: strategy.id, day });
}

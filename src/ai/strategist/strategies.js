// Strategies: the strategist's plans, written as data in data/ai-strategies.json so new ones can be added without code. A strategy says
// when it makes sense (`when`), what it likes to build (`build`), and how its army behaves (`tactics`). See docs/ai.md for the format.
//
//   CONDITIONS          the named tests a strategy's `when` can use ("!name" negates; "canBuild:<unit|category|tag|moveClass>" is open-ended)
//   applicable(game, player, s)   does every condition hold?
//   buildTaste(strategy, def, roles)   the strategy's multiplier for a unit type
//   withJitter(strategy, rng)      a copy with its tactics nudged a little, so the same strategy does not play out the same way twice

import { hasAttribute } from '../../engine/attributes.js';
import { menuFor } from '../../engine/economy.js';
import { allProperties } from '../../engine/queries.js';
import { areaAt } from './analysis.js';
import { areasAround } from './goals.js';
import { roles } from './knowledge.js';

const isHq = (p) => hasAttribute(p.terrain, 'victoryOnCapture');

/** Every unit type the player's factories can build right now (or, before they own any, the standard menus of the map's buildings). */
export function buildable(game, player) {
  const out = new Map();
  for (const p of allProperties(game)) {
    if (p.owner !== player || !p.property.builds?.length) continue;
    for (const def of menuFor(game, player, p.x, p.y)) out.set(def.id, def);
  }
  return [...out.values()];
}

/** Does a unit type match a canBuild key: its id, category, a tag, its move class, or a role (capture, carrier, indirect...)? */
const matches = (def, key) => def.id === key || def.category === key || def.moveClass === key || def.tags?.includes(key) || roles(def)[key] === true || hasAttribute(def, key);

/** Can the player's infantry walk from their HQ to an enemy HQ? */
function groundRoute(game, player) {
  const infantry = game.registry.loadoutFor(game.map.players[player].leader ?? null).infantry;   // the leader's foot soldier
  const mc = infantry && game.registry.units[infantry] ? game.registry.unit(infantry).moveClass : 'foot';
  const hqs = allProperties(game).filter(isHq);
  const mine = hqs.filter((p) => p.owner === player);
  const theirs = hqs.filter((p) => p.owner !== player && p.owner !== null);
  if (!mine.length || !theirs.length) return true;
  const home = new Set(mine.flatMap((p) => [...areasAround(game, mc, p.x, p.y)]));
  return theirs.some((p) => home.has(areaAt(game, mc, p.x, p.y)));
}

export const CONDITIONS = {
  /** Infantry can walk to an enemy HQ. */
  groundRoute: (game, player) => groundRoute(game, player),
  /** No walking route to the enemy: islands, or a sea between. */
  islands: (game, player) => !groundRoute(game, player),
  /** The map is big (500 tiles or more). */
  bigMap: (game) => game.map.width * game.map.height >= 500,
  /** Lots of land to grab: at least 8 neutral properties. */
  manyNeutrals: (game) => allProperties(game).filter((p) => p.owner === null).length >= 8,
  /** More than two players. */
  freeForAll: (game) => game.map.players.length > 2,
  /** The enemy fields aircraft. */
  enemyAir: (game, player) => game.state.units.some((u) => u.owner !== player && u.owner !== null && game.registry.rules.layers[game.registry.unit(u.type).layer]?.airborne),
  /** The enemy fields ships. */
  enemyNavy: (game, player) => game.state.units.some((u) => u.owner !== player && u.owner !== null && game.registry.unit(u.type).moveClass === 'naval'),
};

export function holds(game, player, cond) {
  const negate = cond.startsWith('!');
  const name = negate ? cond.slice(1) : cond;
  let v;
  if (name.startsWith('canBuild:')) {
    const keys = name.slice(9).split('|');
    v = buildable(game, player).some((def) => keys.some((k) => matches(def, k)));
  } else {
    const f = CONDITIONS[name];
    if (!f) throw new Error(`unknown strategy condition "${name}"`);
    v = f(game, player);
  }
  return negate ? !v : v;
}

export const applicable = (game, player, s) => (s.when ?? []).every((c) => holds(game, player, c));

/** Names a `when` entry may use, for validation. */
export const isKnownCondition = (cond) => {
  const name = cond.startsWith('!') ? cond.slice(1) : cond;
  return name.startsWith('canBuild:') || !!CONDITIONS[name];
};

/** The strategy's multiplier for a unit type: every matching entry of its `build` multiplies in. */
export function buildTaste(strategy, def, r = roles(def)) {
  const b = strategy?.build;
  if (!b) return 1;
  let m = 1;
  m *= b.unit?.[def.id] ?? 1;
  m *= b.category?.[def.category] ?? 1;
  m *= b.moveClass?.[def.moveClass] ?? 1;
  for (const t of def.tags ?? []) m *= b.tag?.[t] ?? 1;
  for (const [role, on] of Object.entries(r)) if (on) m *= b.role?.[role] ?? 1;
  for (const [attr, f] of Object.entries(b.attribute ?? {})) if (hasAttribute(def, attr)) m *= f;
  if (b.fast && def.move >= 6) m *= b.fast;
  if (b.heavy && def.cost >= 10000) m *= b.heavy;
  if (b.cheap && def.cost <= 3000) m *= b.cheap;
  return m;
}

const NUMERIC_TACTICS = ['aggression', 'caution', 'capture', 'landing', 'retreat'];

/** A copy of the strategy with its tactics nudged by up to +-`amount` (a little personality, so it plays differently each time). */
export function withJitter(strategy, rng, amount = 0.12) {
  const tactics = { ...strategy.tactics };
  for (const k of NUMERIC_TACTICS) tactics[k] = (tactics[k] ?? 1) * (1 + (rng() * 2 - 1) * amount);
  if (tactics.mass) tactics.mass = Math.max(1, Math.round(tactics.mass + (rng() * 2 - 1) * 1.5));
  return { ...strategy, tactics };
}


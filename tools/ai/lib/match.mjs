// One headless game between AI engines, the way a skirmish is set up (random leaders, the map's funds), but every seat played by the
// computer. Used by the arena and the tuner, in worker threads (pool.mjs) or directly.
//
//   playMatch(registry, map, { seats, seed, maxDays, fog, margin }) -> { winner, days, adjudicated, error, shares, strategies, combat }
//     combat   per player, by unit type: { fielded, dealt, lost } in credits - what was built (and started with), the value of damage
//              the type did to the enemy (counterattacks included), and the value of it destroyed. Damage counts what it took off, not overkill
//     error    null, or { seat, message, stack } when an engine gave an invalid order: that seat loses the game (see below)
//     seats    one { engine, profile? } per player slot on the map
//     seed     makes the match repeatable: leaders are rolled from it and engines' random choices start from it. The same seed with the
//              seats swapped gives the same leaders to the same slots, so a pair of games is a fair test of the engines alone
//     maxDays  a game still going after this many days is judged on worth (src/ai/evaluate.js): the leader wins if their share is at
//              least `margin`, otherwise it is a draw
//     fog      false takes the jammers off (default: the map as it is)
//     startUnits  false: nobody starts with units (default true)
//     leaders  true: random leaders from the seed (default); false: none; or a list of leader ids, one per slot

import { Game } from '../../../src/engine/game.js';
import { applySkirmish } from '../../../src/data/skirmish.js';
import { playTurn } from '../../../src/ai/runner.js';
import { isStructureDef } from '../../../src/engine/structures.js';
import { leader, standings } from '../../../src/ai/evaluate.js';

export const DEFAULT_MAX_DAYS = 30;
export const DEFAULT_MARGIN = 0.6;

/** A seeded random function (mulberry32). */
export function seeded(seed) {
  let s = typeof seed === 'number' ? seed >>> 0 : [...String(seed)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function setupMatch(registry, map, { seats, seed = 1, fog = true, leaders = true, startUnits = true }) {
  if (seats.length !== map.players.length) throw new Error(`map "${map.id}" has ${map.players.length} slots, got ${seats.length} seats`);
  const settings = {
    mapId: map.id, funds: null, fog, startUnits,
    players: map.players.map((p, i) => ({ faction: p.faction, controller: 'ai', leader: Array.isArray(leaders) ? leaders[i] ?? null : leaders && registry.leaderIds.length ? 'random' : null })),
  };
  const game = new Game(registry, applySkirmish(map, settings, registry, seeded(`${seed}:leaders`)));
  game.aiSeed = seed;
  game.aiSetup = seats.map((s) => ({ engine: s.engine, profile: s.profile, history: s.history ?? null }));
  return game;
}

/** Credits of damage per unit type: who fielded what, who dealt how much, what was lost. Starts from the units on the map. */
function trackCombat(game) {
  const { registry } = game;
  const maxHp = registry.rules.maxHp;
  const players = game.map.players.map(() => ({}));
  const row = (p, type) => (players[p][type] ??= { fielded: 0, dealt: 0, lost: 0, units: 0, struck: 0 });
  const strikers = new Set();   // ids of the units that ever attacked: a unit that never does was bought for nothing
  const typeOf = new Map();
  for (const u of game.state.units) {
    if (players[u.owner] && !isStructureDef(registry.unit(u.type))) { row(u.owner, u.type).fielded += registry.unit(u.type).cost * u.hp / maxHp; row(u.owner, u.type).units++; typeOf.set(u.id, [u.owner, u.type]); }
  }
  return {
    players,
    add(events) {
      for (const e of events) {
        if (e.type === 'build' && players[e.unit.owner]) { row(e.unit.owner, e.unit.type).fielded += e.cost; row(e.unit.owner, e.unit.type).units++; typeOf.set(e.unit.id, [e.unit.owner, e.unit.type]); }
        else if (e.type === 'strike' && players[e.attacker.owner] && players[e.defender.owner] && e.attacker.owner !== e.defender.owner) {
          const hp = e.destroyed ? e.damage + e.defender.hp : e.damage;   // the snapshot is taken after the hit: a destroyed unit's HP is what was left over
          const credits = Math.max(0, hp) * registry.unit(e.defender.type).cost / maxHp;
          row(e.attacker.owner, e.attacker.type).dealt += credits;
          const own = typeOf.get(e.attacker.id);
          if (own && !strikers.has(e.attacker.id)) { strikers.add(e.attacker.id); row(own[0], own[1]).struck++; }
          row(e.defender.owner, e.defender.type).lost += credits;
        }
      }
    },
  };
}

export function playMatch(registry, map, { seats, seed = 1, maxDays = DEFAULT_MAX_DAYS, fog = true, margin = DEFAULT_MARGIN, leaders = true, startUnits = true }) {
  const game = setupMatch(registry, map, { seats, seed, fog, leaders, startUnits });
  const combat = trackCombat(game);
  const t0 = performance.now();
  let turns = 0;
  let error = null;
  try {
    while (!game.isOver && game.state.day <= maxDays) {
      combat.add(playTurn(game));
      turns++;
      if (!game.isOver) game.endTurn();
    }
  } catch (e) {
    // an engine that breaks loses the game (in a duel; a draw with more players), so one bug does not stop a long run. The error is
    // reported with the result, and the arena and tuner print it.
    error = { seat: game.state.turn, message: e.message, stack: e.stack };
  }
  const adjudicated = !game.isOver && !error;
  const winner = error ? (game.map.players.length === 2 ? 1 - error.seat : null)
    : adjudicated ? leader(game, margin) : (game.state.winner === 'draw' ? null : game.state.winner);
  return {
    map: map.id, seed, winner, adjudicated, error, days: game.state.day, turns,
    msPerTurn: (performance.now() - t0) / Math.max(1, turns),
    shares: Object.fromEntries(standings(game).map((s) => [s.player, s.share])),
    leaders: game.map.players.map((p) => p.leader ?? null),
    combat: combat.players,
    strategies: game.map.players.map((_, i) => game.state.ai?.[i]?.strategy?.id ?? null),
  };
}

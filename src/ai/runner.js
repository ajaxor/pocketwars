// Runs an AI engine's turn (see engines.js). Headless code (tests, the arena) calls playTurn; the UI drives startTurn itself so it can
// animate between steps:
//
//   const turn = startTurn(game);
//   for (let step = turn.next(); step; step = turn.next(result)) { ...; result = applyStep(game, step); ... }
//
// An engine that gives an order the game refuses has a bug: applyStep throws rather than let the turn hang.

import { setupFor } from './engines.js';

/** The per-player memory an engine keeps between turns: game.state.ai[player], created on first use (plain data, saved with the game). */
export function memoryOf(game, player) {
  const { state } = game;
  state.ai ??= {};
  state.ai[player] ??= {};
  return state.ai[player];
}

/**
 * A seeded random function whose state lives in `memory.rng` (so it continues across turns and saves). The first seed is
 * game.aiSeed (the arena sets it, for repeatable matches) mixed with the player, or a random one.
 */
export function rngFor(game, player, memory) {
  if (memory.rng == null) memory.rng = game.aiSeed != null ? hashSeed(game.aiSeed, player) : (Math.random() * 2 ** 32) >>> 0;
  return () => {   // mulberry32
    memory.rng = (memory.rng + 0x6d2b79f5) >>> 0;
    let t = memory.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hashSeed = (seed, player) => {
  let h = 2166136261 ^ player;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
};

/** Start the current player's turn with their engine. Returns { engine, next(result) -> step | null }. */
export function startTurn(game) {
  const player = game.state.turn;
  const { engine, profile, history } = setupFor(game, player);
  let rng = null;
  const ctx = {   // memory and rng are made on first use, so an engine that needs neither leaves the state as it was
    player, profile, history,
    get memory() { return memoryOf(game, player); },
    get rng() { return (rng ??= rngFor(game, player, memoryOf(game, player))); },
  };
  const gen = engine.turn(game, ctx);
  let started = false;
  return {
    engine,
    next(result) {
      if (game.isOver) return null;
      const r = started ? gen.next(result) : gen.next();
      started = true;
      return r.done ? null : r.value;
    },
  };
}

/** Carry out one step on the game. Returns the game's { ok, events, ... } result; throws when an order is refused. */
export function applyStep(game, step) {
  let res;
  if (step.type === 'order') res = game.act(step.order);
  else if (step.type === 'surface') res = game.setSubmerged({ unitId: step.unitId, submerged: false });
  else if (step.type === 'deploy') res = game.deploy({ unitId: step.unitId });
  else if (step.type === 'build') res = game.build(step.x, step.y, step.unit);
  else throw new Error(`AI produced an unknown step "${step.type}"`);
  if (!res.ok && step.type === 'order') throw new Error(`AI produced an invalid order: ${res.error}`);
  return res;
}

/** Play the current player's whole turn synchronously and return all its events (tests, headless games). */
export function playTurn(game) {
  const turn = startTurn(game);
  const events = [];
  let result;
  for (let step = turn.next(); step; step = turn.next(result)) {
    result = applyStep(game, step);
    events.push(...result.events);
  }
  return events;
}

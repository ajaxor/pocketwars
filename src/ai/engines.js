// Computer opponents ("AI engines") side by side. Each engine is a module with the same interface, so a new one can be written next to
// the old ones and scored against them (tools/ai/arena.mjs) before it becomes the default.
//
//   engine = {
//     id, name, description,
//     turn(game, ctx)          a generator that plays the current player's turn as STEPS, one at a time:
//                                { type: 'order',   order }          game.act(order)
//                                { type: 'surface', unitId }         a submarine comes up before it moves (game.setSubmerged)
//                                { type: 'deploy',  unitId }         a carrier drops a unit (game.deploy)
//                                { type: 'build',   x, y, unit }     production (game.build)
//                              The runner (runner.js) carries each step out and sends the result back into the generator, which reads
//                              the game afresh before choosing the next one. The UI uses the same runner and animates between steps.
//     validateProfile?(profile, raw, problems)   checks its section of data/ai.json
//   }
//   ctx = { player, profile, memory, rng, history }
//     profile   the engine's settings: data/ai.json engines.<id>, or an override (the arena and tuner pass candidates this way)
//     memory    a plain object kept in game.state.ai[player] between turns (saved with the game), for plans that span turns
//     rng       a seeded random function () => [0, 1); its state lives in memory, so a game replays the same way from a save
//     history   optional, what this engine has learned about the opponent across games (see strategist/selector.js)
//
// Which engine plays a player: game.aiSetup?.[player] = { engine, profile?, history? } when set (the arena, a skirmish choice),
// otherwise data/ai.json `default` with its own profile.

import { greedy } from './greedy.js';
import { strategist } from './strategist/index.js';

export const ENGINES = Object.freeze({ greedy, strategist });
export const engineIds = Object.keys(ENGINES);

/** The engine for an id; throws for an unknown one. */
export function engineById(id) {
  const e = ENGINES[id];
  if (!e) throw new Error(`Unknown AI engine "${id}" (known: ${engineIds.join(', ')})`);
  return e;
}

/** { engine, profile, history } for the player: their aiSetup entry, or the data's default engine. */
export function setupFor(game, player) {
  const s = game.aiSetup?.[player] ?? {};
  const id = s.engine ?? game.registry.ai.default;
  return { engine: engineById(id), profile: s.profile ?? game.registry.ai.engines[id] ?? {}, history: s.history ?? null };
}

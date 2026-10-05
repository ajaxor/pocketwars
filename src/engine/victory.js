// Win conditions. Capturing a property with `victoryOnCapture` (an HQ) knocks its owner out of the game (see capture.js); a
// player is also defeated when they have no units and cannot afford to build any (structures do not count: a turret cannot win the
// game). The last player left wins.

import { cheapestBuildableCost } from './economy.js';
import { countsForDefeat } from './structures.js';

export function isDefeated(game, player) {
  if (game.state.units.some((u) => u.owner === player && countsForDefeat(game, u))) return false;
  return game.state.funds[player] < cheapestBuildableCost(game, player);
}

/**
 * Knock `player` out of the game: their units leave the board, and their properties and structures become neutral. If that leaves one player,
 * the game is over and that player has won. Returns the events: 'gameOver' then, else a single 'eliminated'.
 */
export function eliminate(game, player, reason) {
  const { state, map } = game;
  state.defeated[player] = true;
  state.units = state.units.filter((u) => u.owner !== player || !countsForDefeat(game, u));
  for (const u of state.units) if (u.owner === player) { u.owner = null; u.done = false; }   // their turrets stay, hostile to everyone
  for (const row of state.owners) row.forEach((o, x) => { if (o === player) row[x] = null; });
  const alive = map.players.map((_, p) => p).filter((p) => !state.defeated[p]);
  if (alive.length <= 1) {
    state.winner = alive.length === 1 ? alive[0] : 'draw';
    return [{ type: 'gameOver', winner: state.winner, reason }];
  }
  return [{ type: 'eliminated', player, reason }];
}

/** Re-evaluate who is still in the game; sets state.defeated / state.winner and returns 'gameOver' events. */
export function evaluateVictory(game) {
  const { state, map } = game;
  if (state.winner !== null) return [];
  map.players.forEach((_, p) => {
    if (state.defeated[p] || !isDefeated(game, p)) return;
    state.defeated[p] = true;
    for (const u of state.units) if (u.owner === p) { u.owner = null; u.done = false; }   // all that is left are structures: they go neutral
  });
  const alive = map.players.map((_, p) => p).filter((p) => !state.defeated[p]);
  if (alive.length > 1) return [];
  state.winner = alive.length === 1 ? alive[0] : 'draw';
  return [{ type: 'gameOver', winner: state.winner, reason: 'elimination' }];
}

// Win conditions. Capturing a property with `victoryOnCapture` wins immediately (see capture.js).
// Otherwise a player is defeated when they have no units and cannot afford to build any.

import { cheapestBuildableCost } from './economy.js';

export function isDefeated(game, player) {
  if (game.state.units.some((u) => u.owner === player)) return false;
  return game.state.funds[player] < cheapestBuildableCost(game, player);
}

/** Re-evaluate who is still in the game; sets state.defeated / state.winner and returns 'gameOver' events. */
export function evaluateVictory(game) {
  const { state, map } = game;
  if (state.winner !== null) return [];
  map.players.forEach((_, p) => { if (!state.defeated[p] && isDefeated(game, p)) state.defeated[p] = true; });
  const alive = map.players.map((_, p) => p).filter((p) => !state.defeated[p]);
  if (alive.length > 1) return [];
  state.winner = alive.length === 1 ? alive[0] : 'draw';
  return [{ type: 'gameOver', winner: state.winner, reason: 'elimination' }];
}

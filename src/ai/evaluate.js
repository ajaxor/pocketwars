// How well each player is doing, in money: what their army is worth now (price x HP left), what their properties will earn over the
// next `incomeDays` days, and some of the money they have (see worth). Used to judge a game that hit the arena's day limit, and by engines to tell whether a plan is working.
//
//   worth(game, player)          one player's worth
//   standings(game)              [{ player, worth, share }] for every player still in it (share of the total worth, 0..1)
//   leader(game, margin)         the player whose share is at least `margin` (e.g. 0.6 in a duel), or null for "too close to call"

import { incomeFor } from '../engine/economy.js';
import { isStructure } from '../engine/structures.js';
import { allProperties, unitDef } from '../engine/queries.js';
import { hasAttribute } from '../engine/attributes.js';

export const INCOME_DAYS = 5;

export function worth(game, player, { incomeDays = INCOME_DAYS } = {}) {
  const max = game.registry.rules.maxHp;
  let army = 0;
  for (const u of game.state.units) {
    if (u.owner !== player || isStructure(game, u)) continue;
    army += unitDef(game, u).cost * u.hp / max;
  }
  // an HQ half captured is worth less: losing it loses the game
  let threat = 0;
  for (const p of allProperties(game)) {
    if (p.owner !== player || !hasAttribute(p.terrain, 'victoryOnCapture')) continue;
    const capturer = game.state.units.find((u) => u.x === p.x && u.y === p.y && u.owner !== player && u.owner !== null && u.capture > 0);
    if (capturer) threat += (army + incomeFor(game, player) * incomeDays) * 0.5 * Math.min(1, capturer.capture / p.property.capturePoints);
  }
  // money in the bank counts at half, and only up to three days' income: a hoard there is no time or factory to spend is no threat
  const income = incomeFor(game, player);
  return Math.max(0, army + income * incomeDays + Math.min(game.state.funds[player], income * 3) * 0.5 - threat);
}

export function standings(game) {
  const alive = game.map.players.map((_, i) => i).filter((p) => !game.state.defeated[p]);
  const ws = alive.map((p) => ({ player: p, worth: worth(game, p) }));
  const total = ws.reduce((a, w) => a + w.worth, 0) || 1;
  return ws.map((w) => ({ ...w, share: w.worth / total }));
}

export function leader(game, margin) {
  const top = standings(game).sort((a, b) => b.share - a.share)[0];
  return top && top.share >= margin ? top.player : null;
}

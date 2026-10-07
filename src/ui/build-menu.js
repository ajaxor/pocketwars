// The data behind the build menu: what a property can build, what it costs and what the player can afford right now.
// Pure (no DOM); the window that shows it is in hud.js.

import { buildOptions } from '../engine/economy.js';
import { costFor, terrainAt } from '../engine/queries.js';
import { unitStats } from './info.js';

/**
 * @returns {{title:string, funds:number, options:object[]}}  options are unit stats plus `affordable` and `missing` (funds
 *          still needed), in menu order
 */
export function buildMenuModel(game, player, x, y) {
  const funds = game.state.funds[player];
  return {
    title: terrainAt(game, x, y).name,
    funds,
    options: buildOptions(game, x, y).map((def) => {
      const cost = costFor(game, player, def.id);   // a troop carrier costs more or less by the infantry its leader loads it with
      return { ...unitStats(game, def), cost, affordable: funds >= cost, missing: Math.max(0, cost - funds) };
    }),
  };
}

/** The option the menu starts on: the first one the player can afford, else the first one. */
export function defaultChoice(options) {
  return (options.find((o) => o.affordable) || options[0] || { id: null }).id;
}

// What the human may see of the computer's turn. Something the computer does out of sight (a submarine moving or diving under water
// nobody is watching, a fight deep in the fog, a mine going down) must not show up as an animation, a ripple or a message, or it would
// give it away. Pure functions of the game and the viewing player, so they can be tested without a screen.

import { canSee } from '../engine/detection.js';
import { isFogged, tileVisible } from '../engine/fog.js';
import { unitById } from '../engine/queries.js';

/** Can `viewer` see tile (x, y)? Everything is visible without fog of war. */
export function seesTile(game, viewer, x, y) {
  return !isFogged(game, viewer) || (x >= 0 && y >= 0 && x < game.map.width && y < game.map.height && tileVisible(game, viewer, x, y));
}

/**
 * The part of an order's events `viewer` may see. `wasVisible`: the acting unit could be seen before the order, so a move or dive it
 * made is still shown (it then fades away).
 */
export function visibleEvents(game, viewer, events, wasVisible = false) {
  const seen = (id) => { const u = unitById(game, id); return !u || wasVisible || canSee(game, viewer, u); };
  const tile = (x, y) => seesTile(game, viewer, x, y);
  return events.filter((ev) => {
    if (ev.type === 'move' || ev.type === 'interrupt') return seen(ev.unitId);
    if (ev.type === 'dive' || ev.type === 'surface') return seen(ev.unit.id);
    if (ev.type === 'lay') return false;   // nobody sees a mine go down
    if (ev.type === 'capture' || ev.type === 'rebuild') return tile(ev.x, ev.y);   // no flag raised over a property in the fog
    if (ev.type === 'strike') return tile(ev.attacker.x, ev.attacker.y) || tile(ev.defender.x, ev.defender.y);   // a fight deep in the fog is not shown
    return true;
  });
}

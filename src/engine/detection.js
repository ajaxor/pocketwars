// Hidden units and who can see them.
//
// A layer marked `hidden` in rules.json (the one a submerged unit is on) is invisible to every player except its owner, with two
// exceptions: any unit standing NEXT to it notices it, and a unit with the `sonar` attribute notices it up to that many tiles away.
// "Invisible" means three things, all enforced here and in the modules that call canSee:
//   - it is not drawn, and tapping its tile shows nothing (ui/controller.js, render/renderer.js)
//   - it cannot be picked as a target, and the AI does not plan around it (movement.js targetsFrom, game.js, ai.js)
//   - it does not block a move PLANNED by a player who cannot see it; the move is only found out when it is carried out, and the
//     mover is stopped on the tile before it (game.js act). See `computeReach` in movement.js.
// None of this is ever computed from a move that is only being previewed: the engine has not moved anything yet.
//
// Sight is a property of the current state. There is no memory: a hidden unit that stops being noticed is hidden again.

import { attributeConfig } from './attributes.js';
import { distance, layerIdOf, unitDef } from './queries.js';

/** Units this close (in tiles) to a hidden unit always notice it, sonar or not. */
export const ADJACENT = 1;

/** Is `unit` on a hidden layer right now (submerged)? Says nothing about who can see it: see canSee. */
export const isHidden = (game, unit) => game.registry.rules.layers[layerIdOf(game, unit)].hidden === true;

/** Does any unit of `player` notice `unit`: one of them next to it, or within range of a sonar? */
export function isDetectedBy(game, unit, player) {
  return game.state.units.some((u) => {
    if (u.owner !== player) return false;
    const d = distance(u.x, u.y, unit.x, unit.y);
    if (d <= ADJACENT) return true;
    const sonar = attributeConfig(unitDef(game, u), 'sonar');
    return sonar !== undefined && d <= sonar;
  });
}

/** Can `player` see `unit`? Their own units and everything that is not hidden: always. A hidden enemy: only when detected. */
export function canSee(game, player, unit) {
  if (unit.owner === player || !isHidden(game, unit)) return true;
  return isDetectedBy(game, unit, player);
}

/** The units of other players that `player` cannot see right now (ids). */
export function hiddenFrom(game, player) {
  return game.state.units.filter((u) => u.owner !== player && !canSee(game, player, u)).map((u) => u.id);
}

// Hidden units and who can see them.
//
// A layer marked `hidden` in rules.json (the one a submerged unit is on) is invisible to every player except its owner, with two
// exceptions: any unit standing NEXT to it notices it, and a unit with the `sonar` attribute notices it up to that many tiles away (a sea mine
// is the exception to the exception: only a unit next to it finds it).
// A unit with the `cloak: true` attribute is hidden the same way wherever it is (`cloak: { terrain }`: only on that terrain; a unit that fired is revealed for a turn) (it keeps its own layer, so what can shoot it does not
// change), and is noticed by an adjacent unit or by a `radar` in range. Sonar finds submerged units, radar finds cloaked ones.
// "Invisible" means three things, all enforced here and in the modules that call canSee:
//   - it is not drawn, and tapping its tile shows nothing (ui/controller.js, render/renderer.js)
//   - it cannot be picked as a target, and the AI does not plan around it (movement.js targetsFrom, game.js, ai.js)
//   - it does not block a move PLANNED by a player who cannot see it; the move is only found out when it is carried out, and the
//     mover is stopped on the tile before it (game.js act). See `computeReach` in movement.js.
// None of this is ever computed from a move that is only being previewed: the engine has not moved anything yet.
//
// Sight is a property of the current state. There is no memory: a hidden unit that stops being noticed is hidden again.
// Fog of war (fog.js) adds a second rule on top: in fog a player cannot see what is out of their units' sight at all.

import { attributeConfig, hasAttribute } from './attributes.js';
import { distance, inBounds, layerIdOf, ownerAt, terrainIdAt, tileIndex, unitDef } from './queries.js';
import { isFogged, tileVisible } from './fog.js';
import { isOutOfFuel } from './fuel.js';

/** Does a unit lift its cloak when it fires (`cloak: { revealedByFiring }`)? */
export const revealsWhenFiring = (game, unit) => attributeConfig(unitDef(game, unit), 'cloak')?.revealedByFiring === true;

/** Units this close (in tiles) to a hidden unit always notice it, sonar or not. */
export const ADJACENT = 1;

/** Is `unit` on a hidden layer right now (submerged)? */
export const isSubmerged = (game, unit) => game.registry.rules.layers[layerIdOf(game, unit)].hidden === true;
/**
 * Is `unit` cloaked right now? `cloak: true` always; `cloak: { terrain }` only on those terrains; a unit that fired and has
 * `revealedByFiring` is not (`unit.revealed`, cleared when its owner's next turn starts). Nothing hides on an enemy's building: a spy or
 * stealth unit standing on a property another player owns is in plain sight.
 */
export function isCloaked(game, unit) {
  const cfg = attributeConfig(unitDef(game, unit), 'cloak');
  if (!cfg || unit.revealed) return false;
  const owner = ownerAt(game, unit.x, unit.y);
  if (owner !== null && owner !== undefined && owner !== unit.owner) return false;
  return cfg === true || cfg.terrain.includes(terrainIdAt(game, unit.x, unit.y));
}
/** Is `unit` hidden (submerged or cloaked)? Says nothing about who can see it: see canSee. */
export const isHidden = (game, unit) => isSubmerged(game, unit) || isCloaked(game, unit);

/** Does `observer` notice `unit`: next to it, or within range of a sonar (a submerged unit) or a radar (a cloaked one)? */
const notices = (game, observer, unit) => {
  const d = distance(observer.x, observer.y, unit.x, unit.y);
  if (d <= ADJACENT) return true;
  const def = unitDef(game, observer);
  const sonar = isSubmerged(game, unit) && !hasAttribute(unitDef(game, unit), 'mine') ? attributeConfig(def, 'sonar') : undefined;   // sonar hears ships, not mines
  const radar = isCloaked(game, unit) && !isOutOfFuel(game, observer) ? attributeConfig(def, 'radar') : undefined;   // a dry radar plane sees nothing
  return (sonar !== undefined && d <= sonar) || (radar !== undefined && d <= radar);
};

/** Does any unit of `player` notice `unit`: one of them next to it, or within range of a sonar? */
export const isDetectedBy = (game, unit, player) => game.state.units.some((u) => u.owner === player && notices(game, u, unit));

/**
 * Is `unit` exposed, as far as `viewer` can tell: does an enemy that `viewer` can itself see notice it? (An enemy the viewer cannot
 * see does not count, so the answer never gives away a hidden unit next to one's own.) With no viewer every enemy counts.
 */
export const isExposed = (game, unit, viewer = null) => game.state.units.some((u) =>
  u.owner !== unit.owner && (viewer === null || canSee(game, viewer, u)) && notices(game, u, unit));

/**
 * Can `player` see `unit`? Their own units: always. In fog of war (fog.js; human players only, while a jammer stands) nothing on a tile out of
 * their sight. Then everything that is not hidden, and a hidden enemy
 * only when detected.
 */
export function canSee(game, player, unit) {
  if (unit.owner === player) return true;
  if (isFogged(game, player) && !tileVisible(game, player, unit.x, unit.y)) return false;   // (a structure out of sight is drawn as remembered: fog.js)
  if (!isHidden(game, unit)) return true;
  return isDetectedBy(game, unit, player);
}

/** The units of other players that `player` cannot see right now (ids). */
export function hiddenFrom(game, player) {
  return game.state.units.filter((u) => u.owner !== player && !canSee(game, player, u)).map((u) => u.id);
}

/**
 * The tiles a unit's sonar covers from (x, y): every tile within its `sonar` range except its own, as a Set of tile indexes. null when the
 * unit has no sonar, or only the 1 tile every unit senses. The board draws it as an overlay while such a unit is selected.
 */
export function sonarTiles(game, unit, x = unit.x, y = unit.y) {
  const range = attributeConfig(unitDef(game, unit), 'sonar');
  if (range === undefined || range <= ADJACENT) return null;   // sensing only the next tile is what every unit does anyway: nothing to show
  const out = new Set();
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      if ((!dx && !dy) || Math.abs(dx) + Math.abs(dy) > range || !inBounds(game.map, x + dx, y + dy)) continue;
      out.add(tileIndex(game.map, x + dx, y + dy));
    }
  }
  return out;
}

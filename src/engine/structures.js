// Structures: fixed defences (turrets, the jammer) and breakable wall sections (the cracked wall). They are units with the `structure`
// attribute, placed by the map, so damage, targeting, counterattacks, the info card and the AI's target choice all work as for any unit.
// What sets them apart:
//   - they never move (move 0), are never built, captured, carried, healed or supplied
//   - they do not keep a player in the game (victory.js asks `countsForDefeat`), and leader formations keep them (formation.js)
//   - turrets are always controlled by the game, never by their owner: at the end of each player's turn that player's turrets fire, then the
//     neutral ones fire at that player's units (structureFire, called by Game.endTurn)
//   - one may have NO owner (`owner: null`, drawn dark grey): a neutral structure is an enemy of every player
//   - a wall tile with `wall: { structure }` (terrain) gets a neutral unit of that type placed on it when the game starts
//     (`wallStructures`); once destroyed, the tile is open rubble. Walls themselves are terrain (impassable, see terrain.json).

import { attributeConfig, hasAttribute } from './attributes.js';
import { calcDamage, canAttackFrom, resolveAttack } from './combat.js';
import { canSee } from './detection.js';
import { unitDef } from './queries.js';

/** Is `unit` (or a unit definition) a structure? */
export const isStructure = (game, unit) => hasAttribute(unitDef(game, unit), 'structure');
export const isStructureDef = (def) => hasAttribute(def, 'structure');
/** Does nobody own `unit`? (Only structures can be neutral.) */
export const isNeutral = (unit) => unit.owner === null || unit.owner === undefined;
/** Does `unit` keep its owner in the game? Everything but a structure does. */
export const countsForDefeat = (game, unit) => !isStructure(game, unit);

/**
 * The structures a map's wall tiles add when a game starts: one neutral unit of the `wall.structure` type on every such tile that the
 * map has not already put a unit on. Returns unit setups ({ type, owner: null, x, y }) for createState.
 */
export function wallStructures(map, registry) {
  const taken = new Set(map.units.map((u) => `${u.x},${u.y}`));
  const out = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const type = attributeConfig(registry.terrainDef(map.terrain[y][x]), 'wall')?.structure;
      if (type && !taken.has(`${x},${y}`)) out.push({ type, owner: null, x, y });
    }
  }
  return out;
}

/**
 * Turrets are never ordered by hand: they fire by themselves when a turn ends (called by Game.endTurn for the player whose turn it was).
 *   1. Every armed structure of `player` fires at the enemy in its reach it would hurt most (a neutral cracked wall is never worth a shot). A human
 *      player's turret only fires at what that player can see (fog of war, hidden units).
 *   2. Then every armed neutral structure fires at the unit of `player` in its reach it would hurt most.
 * "Hurt most" is the AI's measure: damage times the target's price, plus a bonus for a kill. One shot per turret; the target may answer back as
 * usual. Returns the 'strike' events (attack, then any counterattack), all marked `auto: true` (and `neutral: true` for a neutral turret's).
 */
export function structureFire(game, player) {
  const events = [];
  const armed = (u) => isStructure(game, u) && unitDef(game, u).weapons.length > 0;
  const own = game.state.units.filter((u) => u.owner === player && armed(u));
  const wild = game.state.units.filter((u) => isNeutral(u) && armed(u));
  const isWall = (e) => isNeutral(e) && hasAttribute(unitDef(game, e), 'fragile');
  for (const gun of own) events.push(...fire(game, gun, (e) => e.owner !== player && !isWall(e) && canSee(game, player, e)));
  for (const gun of wild) events.push(...fire(game, gun, (e) => e.owner === player).map((ev) => ({ ...ev, neutral: true })));
  return events;
}

/** `gun` fires at the unit passing `ok` that it would hurt most, if any. Returns the strike events, marked `auto`. */
function fire(game, gun, ok) {
  if (!game.state.units.includes(gun) || game.state.winner !== null) return [];   // knocked out by an earlier counterattack, or the game is over
  const { costUnit = 1000, killBonus = 4 } = game.registry.ai?.weights ?? {};
  let best = null;
  for (const e of game.state.units) {
    if (e === gun || !ok(e) || !canAttackFrom(game, gun, e, gun.x, gun.y)) continue;
    const dmg = calcDamage(game, gun, e);
    if (dmg <= 0) continue;
    const value = dmg * unitDef(game, e).cost / costUnit + (dmg >= e.hp ? killBonus : 0);
    if (!best || value > best.value) best = { e, value };
  }
  return best ? resolveAttack(game, gun, best.e).map((ev) => ({ ...ev, auto: true })) : [];
}

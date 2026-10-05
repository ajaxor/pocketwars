// Structures: fixed defences (turrets, the jammer) and breakable wall sections (the cracked wall). They are units with the `structure`
// attribute, placed by the map, so damage, targeting, counterattacks, the info card and the AI's target choice all work as for any unit.
// What sets them apart:
//   - they never move (move 0), are never built, captured, carried, healed or supplied
//   - they do not keep a player in the game (victory.js asks `countsForDefeat`), and leader formations keep them (formation.js)
//   - one may have NO owner (`owner: null`, drawn dark grey): a neutral structure is an enemy of every player. An armed neutral structure
//     fires once at the end of each player's turn at one unit of that player in its reach (neutralFire, called by Game.endTurn), picking
//     what it would hurt most, the way the AI picks a target. The unit hit may answer back as usual.
//   - a wall tile with `wall: { structure }` (terrain) gets a neutral unit of that type placed on it when the game starts
//     (`wallStructures`); once destroyed, the tile is open rubble. Walls themselves are terrain (impassable, see terrain.json).

import { attributeConfig, hasAttribute } from './attributes.js';
import { calcDamage, canAttackFrom, resolveAttack } from './combat.js';
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
 * Every armed neutral structure fires at the units of `player`: each picks, among that player's units it can hit from where it stands,
 * the one it would do the most harm to (damage times the unit's price, plus a bonus for a kill), and shoots it. Returns the 'strike'
 * events (attack, then any counterattack), in the structures' order on the board.
 */
export function neutralFire(game, player) {
  const events = [];
  const { costUnit = 1000, killBonus = 4 } = game.registry.ai?.weights ?? {};
  const shooters = game.state.units.filter((u) => isNeutral(u) && isStructure(game, u) && unitDef(game, u).weapons.length);
  for (const gun of shooters) {
    if (!game.state.units.includes(gun) || game.state.winner !== null) continue;   // knocked out by an earlier counterattack
    let best = null;
    for (const e of game.state.units) {
      if (e.owner !== player || !canAttackFrom(game, gun, e, gun.x, gun.y)) continue;
      const dmg = calcDamage(game, gun, e);
      if (dmg <= 0) continue;
      const value = dmg * unitDef(game, e).cost / costUnit + (dmg >= e.hp ? killBonus : 0);
      if (!best || value > best.value) best = { e, value };
    }
    if (best) events.push(...resolveAttack(game, gun, best.e).map((ev) => ({ ...ev, neutral: true })));
  }
  return events;
}

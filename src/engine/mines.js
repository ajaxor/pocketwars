// Mines and laying them.
//
//   unit attribute `mine: { damage, triggers }`      the unit is a mine: it never acts (it stays `done`), it sits on a hidden layer (visible
//       only to an enemy next to it), and when an enemy move is interrupted by it (game.js act) it may detonate: `damage` HP off the mover
//       (which can kill it), the mine is gone, and the rest of the mover's move is cancelled where it stands. It only detonates for a mover
//       whose category is in `triggers` (ships and vehicles; infantry just bump into it, which reveals it), and never for a mover with
//       `ignoresMines` or one that flies (an airborne layer): those pass over it, though they cannot stop on its tile.
//   unit attribute `layMines: { unit, range }`       the Lay order (after moving, instead of Wait): a new `unit` on an empty tile within
//       `range` of where the layer stands that the mine itself could enter (sea, for a sea mine) and that is not a property. It costs a round
//       of the layer's ammo (bought back at the mine's price when it resupplies next to a shipyard), and ends the layer's turn.

import { attributeConfig, hasAttribute } from './attributes.js';
import { ammoOf, spendAmmo } from './ammo.js';
import { distance, inBounds, layerIdOf, propertyAt, removeUnit, round1, snapshotUnit, terrainAt, unitAt, unitDef } from './queries.js';
import { makeUnit } from './state.js';

export const mineConfigOf = (def) => attributeConfig(def, 'mine');
export const isMine = (game, unit) => !!mineConfigOf(unitDef(game, unit));

const flies = (game, unit) => game.registry.rules.layers[layerIdOf(game, unit)].airborne === true;

/** Does `mover` go over `blocker` instead of being stopped by it: a mine, and the mover flies or has `ignoresMines`? */
export const passesOverMines = (game, mover, blocker) => isMine(game, blocker) && (flies(game, mover) || hasAttribute(unitDef(game, mover), 'ignoresMines'));

/** Would `mine` go off when `mover` runs into it? (Not for infantry and the like, not for a flyer or a mine-proof unit.) */
export function triggersMine(game, mover, mine) {
  const cfg = mineConfigOf(unitDef(game, mine));
  return !!cfg && !passesOverMines(game, mover, mine) && cfg.triggers.includes(unitDef(game, mover).category);
}

/** The mine goes off under `mover`: HP off it (it may die), the mine removed. Returns the 'detonate' event. */
export function detonate(game, mine, mover) {
  const cfg = mineConfigOf(unitDef(game, mine));
  mover.hp = round1(mover.hp - cfg.damage);
  const destroyed = mover.hp <= 0;
  removeUnit(game, mine);
  if (destroyed) removeUnit(game, mover);
  return { type: 'detonate', mine: snapshotUnit(mine), unit: snapshotUnit(mover), damage: cfg.damage, destroyed };
}

/** `{ unit, range }` for a unit that lays mines, or undefined. */
export const layConfig = (game, unit) => attributeConfig(unitDef(game, unit), 'layMines');

/** Tiles where `unit`, standing on (x, y), could lay a mine now: [{ x, y }]. */
export function layTiles(game, unit, x = unit.x, y = unit.y) {
  const cfg = layConfig(game, unit);
  if (!cfg) return [];
  const mineDef = game.registry.unit(cfg.unit);
  const out = [];
  for (let dy = -cfg.range; dy <= cfg.range; dy++) {
    for (let dx = -cfg.range; dx <= cfg.range; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      if (!dx && !dy) continue;
      if (Math.abs(dx) + Math.abs(dy) > cfg.range || !inBounds(game.map, tx, ty)) continue;
      if (terrainAt(game, tx, ty).moveCost[mineDef.moveClass] == null || propertyAt(game, tx, ty) || unitAt(game, tx, ty)) continue;
      out.push({ x: tx, y: ty });
    }
  }
  return out;
}

/** Why `unit`, standing on (x, y), cannot lay a mine on `at`, or null when it can: 'cannot-lay', 'bad-lay-tile', 'out-of-mines'. */
export function layProblem(game, unit, x, y, at) {
  const cfg = layConfig(game, unit);
  if (!cfg) return 'cannot-lay';
  if (!at || !layTiles(game, unit, x, y).some((t) => t.x === at.x && t.y === at.y)) return 'bad-lay-tile';
  if ((ammoOf(game, unit) ?? 1) < 1) return 'out-of-mines';
  return null;
}

/** Put the mine down (already validated). The mine belongs to the layer's owner and is inert from the start. Returns the 'lay' event. */
export function resolveLay(game, unit, at) {
  const cfg = layConfig(game, unit);
  const def = game.registry.unit(cfg.unit);
  spendAmmo(game, unit, 1);
  const mine = makeUnit(game.registry, game.map, game.state.nextUnitId++, { type: cfg.unit, owner: unit.owner, x: at.x, y: at.y });
  game.state.units.push(mine);
  return [{ type: 'lay', unit: snapshotUnit(unit), at: { x: at.x, y: at.y }, mineId: mine.id }];
}

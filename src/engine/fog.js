// Fog of war. It is switched on by the board itself: while any unit with the `jammer` attribute is in play (whoever owns it), every HUMAN
// player only sees what their own units and properties see. Destroy every jammer and the fog lifts for good. Computer players are never
// fogged, so fog is strictly a handicap for the human.
//
// What a player sees (`visibleTiles`):
//   - every tile within each of their units' vision (Manhattan distance), where the line from the unit to the tile is clear: forests,
//     mountains, walls and standing cracked walls block (the line-of-sight rules of direct fire, sight.js), but BUILDINGS (properties) do not;
//     the end tiles never block; a unit on a mountain looks over forests. Aircraft see over everything.
//   - every tile within `rules.vision.property` of a property they own.
// Vision: the unit's own `vision`, else `rules.vision[<category>]`, else `rules.vision.default`; plus the `visionBonus` of the terrain a
// ground unit stands on (a mountain). Vision is NOT stretched to match movement: instead a fogged player cannot move a unit into, or through,
// a tile they have never seen (the black part of the board; movement.js computeReach), so a unit moves into the unknown a step at a time.
//
// What a player has seen (`state.explored[player]`, one 0/1 per tile) only ever grows: Game calls `explore` after every change. The board
// draws unexplored tiles black and explored ones that are not in sight greyed out (renderer.js). Enemy structures are remembered too
// (`state.remembered[player]`, see rememberedStructures): out of sight, the board shows them still, as last seen, even after they are gone.
//
// How it is enforced: detection.js `canSee` says no to any enemy unit on a tile the player cannot see, so everything that already respects hidden submarines (movement plans, targeting, the info cards, the
// AI-turn animations, interrupted moves) respects fog too. An order that brings a tile into sight cannot be undone (game.js).
//
// Visibility is cached per game and per player, keyed on `game.revision` (bumped by every Game method that changes the state). Code that
// edits the state directly goes through `game.edit(fn)` (or calls `game.touch()` afterwards).

import { attributeConfig, hasAttribute } from './attributes.js';
import { tilesBetween } from './sight.js';
import { inBounds, layerInfo, terrainAt, tileIndex, unitAt, unitDef } from './queries.js';

const cache = new WeakMap();   // game -> { revision, active, tiles: Map<player, Uint8Array> }

function entry(game) {
  let e = cache.get(game);
  if (!e || e.revision !== game.revision || game.revision === undefined) {
    e = { revision: game.revision, active: null, tiles: new Map() };
    cache.set(game, e);
  }
  return e;
}

/** Is any jammer on the board (so human players are in fog)? */
export function fogActive(game) {
  const e = entry(game);
  if (e.active === null) e.active = game.state.units.some((u) => hasAttribute(unitDef(game, u), 'jammer'));
  return e.active;
}

/** Does `player` play in fog right now? Only a human player, and only while a jammer stands. */
export const isFogged = (game, player) => player !== null && player !== undefined && game.map.players[player]?.controller === 'human' && fogActive(game);

/** How far `unit` sees from where it stands. */
export function visionOf(game, unit) {
  const def = unitDef(game, unit);
  const v = game.registry.rules.vision ?? {};
  const base = def.vision ?? v[def.category] ?? v.default ?? 2;
  const airborne = !!layerInfo(game, unit).airborne;
  return base + (airborne ? 0 : attributeConfig(terrainAt(game, unit.x, unit.y), 'visionBonus') ?? 0);
}

/** Can an eye on tile `from` (airborne or not) see tile `to`? The line-of-sight rule of direct fire, with a structure that blocks sight counting too, except that buildings never block sight. */
function clearSight(game, from, to, airborne) {
  if (airborne) return true;
  const vantage = attributeConfig(terrainAt(game, from.x, from.y), 'vantage') ?? 0;
  return tilesBetween(from, to).every(({ x, y }) => {
    const there = unitAt(game, x, y);
    const tile = terrainAt(game, x, y);
    const height = Math.max(tile.attributes.property ? 0 : attributeConfig(tile, 'blocksLineOfSight') ?? 0, (there && attributeConfig(unitDef(game, there), 'blocksLineOfSight')) ?? 0);
    return height === 0 || vantage > height;
  });
}

/** Mark on `out` every tile within `range` of (x, y) that the eye there can see. */
function look(game, out, x, y, range, airborne) {
  const { map } = game;
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      const tx = x + dx, ty = y + dy;
      if (Math.abs(dx) + Math.abs(dy) > range || !inBounds(map, tx, ty)) continue;
      const k = tileIndex(map, tx, ty);
      if (out[k]) continue;
      if (Math.abs(dx) + Math.abs(dy) <= 1 || clearSight(game, { x, y }, { x: tx, y: ty }, airborne)) out[k] = 1;
    }
  }
}

/** The tiles `player` can see right now, one 0/1 per tile (row-major). Without fog for them, every tile. Do not modify the result. */
export function visibleTiles(game, player) {
  const e = entry(game);
  let tiles = e.tiles.get(player);
  if (tiles) return tiles;
  const { map, state } = game;
  tiles = new Uint8Array(map.width * map.height);
  if (!isFogged(game, player)) tiles.fill(1);
  else {
    for (const u of state.units) {
      if (u.owner !== player) continue;
      look(game, tiles, u.x, u.y, visionOf(game, u), !!layerInfo(game, u).airborne);
    }
    const reach = game.registry.rules.vision?.property ?? 0;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) if (state.owners[y][x] === player && terrainAt(game, x, y).attributes.property) look(game, tiles, x, y, reach, false);
    }
  }
  e.tiles.set(player, tiles);
  return tiles;
}

/** Can `player` see tile (x, y)? */
export const tileVisible = (game, player, x, y) => visibleTiles(game, player)[tileIndex(game.map, x, y)] === 1;

/** Has `player` ever seen tile (x, y)? Always true without fog for them. */
export function tileExplored(game, player, x, y) {
  if (!isFogged(game, player)) return true;
  const seen = game.state.explored?.[player];
  return !seen || seen[tileIndex(game.map, x, y)] === 1 || tileVisible(game, player, x, y);
}

/** Add what every fogged player sees now to what they have seen (state.explored). Called by Game after each change. */
export function explore(game) {
  const { state, map } = game;
  map.players.forEach((_, p) => {
    if (!isFogged(game, p)) return;
    state.explored ??= map.players.map(() => null);
    const seen = state.explored[p] ??= new Array(map.width * map.height).fill(0);
    const now = visibleTiles(game, p);
    for (let k = 0; k < now.length; k++) if (now[k]) seen[k] = 1;
    // what they last saw of enemy structures: kept as it was while out of sight (a turret destroyed in the fog stays on their map)
    state.remembered ??= map.players.map(() => null);
    const memo = state.remembered[p] ??= {};
    for (const [id, m] of Object.entries(memo)) if (now[tileIndex(map, m.x, m.y)]) delete memo[id];   // in sight again: the truth replaces it
    for (const u of state.units) {
      if (u.owner === p || !hasAttribute(unitDef(game, u), 'structure') || !now[tileIndex(map, u.x, u.y)]) continue;
      memo[u.id] = { id: u.id, type: u.type, owner: u.owner, x: u.x, y: u.y, hp: u.hp };
    }
  });
}

/**
 * The enemy structures `player` remembers on tiles out of their sight, as they last saw them ({ id, type, owner, x, y, hp }; the real one may
 * have been damaged or destroyed since). The board draws these, still, in the fog. Empty without fog.
 */
export function rememberedStructures(game, player) {
  if (!isFogged(game, player)) return [];
  const memo = game.state.remembered?.[player];
  return memo ? Object.values(memo).filter((m) => !tileVisible(game, player, m.x, m.y)) : [];
}

/** Would `player` see any tile in `after` that they could not see in `before`? (Both from visibleTiles; an order that does cannot be undone.) */
export function revealsNew(before, after) {
  for (let k = 0; k < after.length; k++) if (after[k] && !before[k]) return true;
  return false;
}

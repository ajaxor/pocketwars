// Pocket Wars map files (`*.map.json`), format "pocketwars-map" version 1. See docs/map-format.md.
//
//   parseMap(raw, registry)  -> GameMap (validated, immutable) or throws MapError listing every problem
//   serializeMap(gameMap)    -> plain object ready for JSON.stringify (inverse of parseMap)
//
// A map file never mentions engine behaviour: it names terrain/unit/faction ids from the registry and
// lays them out. Everything about *how* those behave lives in the entity JSON (data/*.json).

import { hasAttribute } from '../engine/attributes.js';

/** The id of the tileset a map is drawn in: its own, or the registry's default (null when the data has no tilesets). */
export const tilesetOf = (map, registry) => map.tileset ?? registry.defaultTileset ?? null;

export const MAP_FORMAT = 'pocketwars-map';
export const MAP_VERSION = 1;
export const CONTROLLERS = ['human', 'ai'];
const MAX_SIZE = 64;
const MAX_PLAYERS = 4;

export class MapError extends Error {
  constructor(id, problems) {
    super(`Invalid map "${id}":\n - ${problems.join('\n - ')}`);
    this.name = 'MapError';
    this.problems = problems;
  }
}

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * @typedef {{faction:string, controller:'human'|'ai', funds:number, leader?:string}} PlayerSetup
 * @typedef {{type:string, owner:number|null, x:number, y:number, hp?:number}} UnitSetup   owner null: a neutral structure
 * @typedef {{id:string,name:string,description:string,width:number,height:number,
 *   tileset?:string, terrain:string[][], ground:(string|null)[][], owners:(number|null)[][], players:PlayerSetup[], units:UnitSetup[],
 *   legend:Object<string,{terrain:string,owner?:number}>}} GameMap
 */

export function parseMap(raw, registry) {
  const id = isObj(raw) && typeof raw.id === 'string' ? raw.id : '(unnamed)';
  const problems = [];
  const err = (m) => problems.push(m);

  if (!isObj(raw)) throw new MapError(id, ['map file must be a JSON object']);
  if (raw.format !== MAP_FORMAT) err(`format must be "${MAP_FORMAT}"`);
  if (raw.version !== MAP_VERSION) err(`unsupported version ${JSON.stringify(raw.version)} (this game reads version ${MAP_VERSION})`);
  if (typeof raw.id !== 'string' || !/^[a-z0-9_-]+$/.test(raw.id)) err('id must be a lowercase slug (a-z, 0-9, _ and -)');
  if (typeof raw.name !== 'string' || !raw.name) err('name is required');

  // players
  const players = [];
  if (!Array.isArray(raw.players) || raw.players.length < 2 || raw.players.length > MAX_PLAYERS) {
    err(`players must be an array of 2 to ${MAX_PLAYERS} entries`);
  } else {
    const seen = new Set();
    raw.players.forEach((p, i) => {
      const w = `players[${i}]`;
      if (!isObj(p)) return err(`${w} must be an object`);
      if (!registry.factions[p.faction]) err(`${w}: unknown faction "${p.faction}"`);
      else if (seen.has(p.faction)) err(`${w}: faction "${p.faction}" is used by more than one player`);
      seen.add(p.faction);
      if (!CONTROLLERS.includes(p.controller)) err(`${w}: controller must be one of ${CONTROLLERS.join(', ')}`);
      if (!Number.isInteger(p.funds) || p.funds < 0) err(`${w}: funds must be a non-negative integer`);
      // leader (optional): whose loadout this player fights with (build menus; see data/loadouts.json). Without one, the standard menus apply.
      const hasLeader = p.leader !== undefined && p.leader !== null;
      if (hasLeader && !registry.leaderIds.includes(p.leader)) err(`${w}: unknown leader "${p.leader}"`);
      players.push({ faction: p.faction, controller: p.controller, funds: p.funds, ...(hasLeader && { leader: p.leader }) });
    });
  }
  const playerCount = Array.isArray(raw.players) ? raw.players.length : 0;

  // legend
  const legend = {};
  if (!isObj(raw.legend) || !Object.keys(raw.legend).length) err('legend must be a non-empty object');
  else {
    for (const [glyph, entry] of Object.entries(raw.legend)) {
      const w = `legend "${glyph}"`;
      if ([...glyph].length !== 1) { err(`${w}: glyphs must be exactly one character`); continue; }
      if (!isObj(entry)) { err(`${w} must be an object`); continue; }
      const t = registry.terrain[entry.terrain];
      if (!t) { err(`${w}: unknown terrain "${entry.terrain}"`); continue; }
      if (entry.owner !== undefined) {
        if (!Number.isInteger(entry.owner) || entry.owner < 0 || entry.owner >= playerCount) err(`${w}: owner ${JSON.stringify(entry.owner)} is not a player index (0..${playerCount - 1})`);
        else if (!hasAttribute(t, 'property')) err(`${w}: terrain "${entry.terrain}" is not a property, so it cannot have an owner`);
      }
      legend[glyph] = entry.owner === undefined ? { terrain: entry.terrain } : { terrain: entry.terrain, owner: entry.owner };
    }
  }

  // tiles
  const terrain = [];
  const owners = [];
  let width = 0;
  const height = Array.isArray(raw.tiles) ? raw.tiles.length : 0;
  if (!Array.isArray(raw.tiles) || !height) err('tiles must be a non-empty array of row strings');
  else {
    width = typeof raw.tiles[0] === 'string' ? [...raw.tiles[0]].length : 0;
    if (!width) err('tiles[0] must be a non-empty string');
    if (width > MAX_SIZE || height > MAX_SIZE) err(`maps may be at most ${MAX_SIZE}x${MAX_SIZE} tiles`);
    raw.tiles.forEach((row, y) => {
      if (typeof row !== 'string') return err(`tiles[${y}] must be a string`);
      const chars = [...row];
      if (chars.length !== width) err(`tiles[${y}] has ${chars.length} tiles but tiles[0] has ${width} (rows must be equal length)`);
      const tRow = [];
      const oRow = [];
      chars.forEach((ch, x) => {
        const entry = legend[ch];
        if (!entry) { if (raw.legend && !(ch in raw.legend)) err(`tiles[${y}][${x}]: glyph "${ch}" is not in the legend`); tRow.push(null); oRow.push(null); return; }
        tRow.push(entry.terrain);
        oRow.push(entry.owner ?? null);
      });
      terrain.push(tRow);
      owners.push(oRow);
    });
  }

  // tileset (optional): the look of the land (data/tilesets.json). A tileset may also name the ground tiles take when the map paints none.
  if (raw.tileset !== undefined && !(typeof raw.tileset === 'string' && registry.tilesets?.[raw.tileset])) err(`unknown tileset ${JSON.stringify(raw.tileset)}${registry.tilesetIds?.length ? ` (known: ${registry.tilesetIds.join(', ')})` : ''}`);
  const tileset = typeof raw.tileset === 'string' && registry.tilesets?.[raw.tileset] ? raw.tileset : null;   // absent: the registry's default tileset (see tilesetOf)

  // ground (optional): a second grid under the terrain, with its own legend. Anything it does not cover is the default ground.
  const dflt = registry.tilesetDef?.(tileset)?.ground ?? registry.defaultGround ?? null;
  const ground = terrain.map((row) => row.map(() => dflt));
  if (raw.ground !== undefined || raw.groundLegend !== undefined) {
    const gl = {};
    if (!isObj(raw.groundLegend)) err('groundLegend must be an object (glyph -> ground id) when ground is given');
    else {
      for (const [glyph, gid] of Object.entries(raw.groundLegend)) {
        if ([...glyph].length !== 1) err(`groundLegend "${glyph}": glyphs must be exactly one character`);
        else if (!registry.ground?.[gid]) err(`groundLegend "${glyph}": unknown ground "${gid}"`);
        else gl[glyph] = gid;
      }
    }
    if (!Array.isArray(raw.ground) || raw.ground.length !== height) err(`ground must be an array of ${height} row strings, like tiles`);
    else raw.ground.forEach((row, y) => {
      const chars = typeof row === 'string' ? [...row] : [];
      if (chars.length !== width) return err(`ground[${y}] must be a string of ${width} tiles`);
      chars.forEach((ch, x) => { if (!gl[ch]) err(`ground[${y}][${x}]: glyph "${ch}" is not in groundLegend`); else ground[y][x] = gl[ch]; });
    });
  }

  // units
  const units = [];
  if (!Array.isArray(raw.units)) err('units must be an array (use [] for none)');
  else {
    const taken = new Map();
    raw.units.forEach((u, i) => {
      const w = `units[${i}]`;
      if (!isObj(u)) return err(`${w} must be an object`);
      const def = registry.units[u.type];
      if (!def) err(`${w}: unknown unit type "${u.type}"`);
      const neutral = u.owner === null;   // only a structure (a turret, a cracked wall) may belong to nobody
      if (neutral) { if (def && !hasAttribute(def, 'structure')) err(`${w}: only a structure can have no owner (owner null); ${def.name} needs a player index`); }
      else if (!Number.isInteger(u.owner) || u.owner < 0 || u.owner >= playerCount) err(`${w}: owner must be a player index (0..${playerCount - 1}), or null for a neutral structure`);
      const inBounds = Number.isInteger(u.x) && Number.isInteger(u.y) && u.x >= 0 && u.y >= 0 && u.x < width && u.y < height;
      if (!inBounds) err(`${w}: position (${u.x}, ${u.y}) is outside the ${width}x${height} map`);
      if (u.hp !== undefined && !(Number.isInteger(u.hp) && u.hp >= 1 && u.hp <= registry.rules.maxHp)) err(`${w}: hp must be an integer 1..${registry.rules.maxHp}`);
      if (def && inBounds && terrain[u.y] && terrain[u.y][u.x]) {
        const cost = registry.terrain[terrain[u.y][u.x]].moveCost[def.moveClass];
        if (cost === null) err(`${w}: ${def.name} cannot stand on ${registry.terrain[terrain[u.y][u.x]].name} at (${u.x}, ${u.y})`);
        const key = `${u.x},${u.y}`;
        if (taken.has(key)) err(`${w}: tile (${u.x}, ${u.y}) is already occupied by units[${taken.get(key)}]`);
        else taken.set(key, i);
      }
      const unit = { type: u.type, owner: u.owner, x: u.x, y: u.y };
      if (u.hp !== undefined) unit.hp = u.hp;
      units.push(unit);
    });
  }

  if (problems.length) throw new MapError(id, problems);
  return deepFreeze({
    id: raw.id, name: raw.name, description: typeof raw.description === 'string' ? raw.description : '',
    ...(tileset && { tileset }), width, height, terrain, ground, owners, players, units, legend,
  });
}

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); }
  return o;
}

const GLYPH_POOL = '.FMr~cobkvOBKVabdefghijlmnpqstuwxyzACDEGHIJLNPQRSTUWXYZ0123456789';
/** Glyphs a new legend entry tries first, so a written map stays readable: the shipped maps' habits for the common terrain. */
const PREFERRED = { plain: '.', forest: 'F', mountain: 'M', rough: ':', road: 'r', sea: '~', shoals: '*', wall: 'W', wall_breach: 'X', city: 'c' };

/**
 * Inverse of parseMap. Reuses the map's legend glyphs and assigns new ones for any new (terrain, owner) pair. `defaultGround` (the registry's)
 * lets a map that is all one other ground (all dirt) keep it; without it, a map with a single ground writes none.
 */
export function serializeMap(map, { defaultGround, defaultTileset } = {}) {
  const key = (t, o) => `${t}|${o ?? ''}`;
  const glyphFor = new Map(Object.entries(map.legend || {}).map(([g, e]) => [key(e.terrain, e.owner), g]));
  const used = new Set(glyphFor.values());
  const legend = {};
  const tiles = map.terrain.map((row, y) => row.map((t, x) => {
    const owner = map.owners[y][x];
    const k = key(t, owner);
    if (!glyphFor.has(k)) {
      const g = [...(owner === null && PREFERRED[t] ? PREFERRED[t] : ''), ...GLYPH_POOL, ...'#$%&+=?@^_|'].find((c) => !used.has(c));
      if (!g) throw new Error('serializeMap: ran out of legend glyphs');
      used.add(g);
      glyphFor.set(k, g);
    }
    const g = glyphFor.get(k);
    legend[g] = owner === null ? { terrain: t } : { terrain: t, owner };
    return g;
  }).join(''));
  const out = {
    format: MAP_FORMAT, version: MAP_VERSION, id: map.id, name: map.name, description: map.description,
    ...(map.tileset && map.tileset !== defaultTileset && { tileset: map.tileset }),   // `defaultTileset` (the registry's): a map in it need not say so
    players: map.players.map((p) => ({ ...p })), legend, tiles, units: map.units.map((u) => ({ ...u })),
  };
  // ground is only written when some tile is not the default ground (the first id in the grid's most common value)
  const ids = [...new Set((map.ground || []).flat().filter((g) => g != null))];
  if (ids.length > 1 || (ids.length === 1 && defaultGround !== undefined && ids[0] !== defaultGround)) {
    const glyphs = new Map();
    for (const id of ids) glyphs.set(id, [...id, ...'0123456789'].find((c) => ![...glyphs.values()].includes(c)));
    out.groundLegend = Object.fromEntries([...glyphs].map(([id, g]) => [g, id]));
    out.ground = map.ground.map((row) => row.map((g) => glyphs.get(g)).join(''));
  }
  return out;
}

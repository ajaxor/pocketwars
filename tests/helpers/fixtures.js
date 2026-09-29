// Synthetic game data for tests. Tests build tiny rulesets so that each attribute can be proven in
// isolation: two units that differ ONLY in the attribute under test must behave differently.
//
//   const game = makeGame({
//     units: { attacker: { attributes: { capture: true } }, victim: {} },
//     rows: ['a.b'],                                  // map rows (see LEGEND)
//     units_on_map: [['attacker', 0, 0, 0], ['victim', 1, 1, 0]],   // [type, owner, x, y]
//   });

import { createRegistry } from '../../src/data/registry.js';
import { parseMap } from '../../src/data/map-format.js';
import { Game } from '../../src/engine/game.js';

const property = (builds = [], extra = {}) => ({ income: 1000, capturePoints: 20, repair: 2, builds, ...extra });
const flat = { foot: 1, wheel: 1, air: 1 };

export const BASE_TERRAIN = {
  plain:    { name: 'Plain',    defense: 1, moveCost: { ...flat }, attributes: {}, render: { base: '#86b95c' } },
  road:     { name: 'Road',     defense: 0, moveCost: { ...flat }, attributes: {}, render: { base: '#cdbb8f' } },
  forest:   { name: 'Forest',   defense: 2, moveCost: { foot: 1, wheel: 2, air: 1 }, attributes: {}, render: { base: '#86b95c' } },
  mountain: { name: 'Mountain', defense: 4, moveCost: { foot: 2, wheel: null, air: 1 }, attributes: {}, render: { base: '#86b95c' } },
  sea:      { name: 'Sea',      defense: 0, moveCost: { foot: null, wheel: null, air: 1 }, attributes: {}, render: { base: '#3d7ec7' } },
  city:     { name: 'City',     defense: 3, moveCost: { ...flat }, attributes: { property: property() }, render: { base: '#86b95c' } },
  base:     { name: 'Base',     defense: 3, moveCost: { ...flat }, attributes: { property: property(['ground']) }, render: { base: '#86b95c' } },
  hq:       { name: 'HQ',       defense: 4, moveCost: { ...flat }, attributes: { property: property(), victoryOnCapture: true }, render: { base: '#86b95c' } },
};

export const BASE_UNIT = {
  name: 'Unit', category: 'ground', cost: 1000, move: 3, moveClass: 'foot', range: [1, 1], layer: 'ground',
  targetLayers: ['ground'], attributes: {}, render: { sprite: 'infantry', attackFx: 'shot' },
};

/** Legend used by makeMap / makeGame rows. Owners: a/H/1 belong to player 0, b/h/2 to player 1. */
export const LEGEND = {
  '.': { terrain: 'plain' }, r: { terrain: 'road' }, F: { terrain: 'forest' }, M: { terrain: 'mountain' }, '~': { terrain: 'sea' },
  c: { terrain: 'city' },
  a: { terrain: 'base', owner: 0 }, b: { terrain: 'base', owner: 1 },
  H: { terrain: 'hq', owner: 0 }, h: { terrain: 'hq', owner: 1 },
};

/**
 * Raw data bundle. `units` are specs merged over BASE_UNIT; `hits` (default 50) is expanded into a full
 * damage table over every unit the spec's targetLayers allows, then `damage` entries override it.
 */
export function makeData({ units = { a: {}, b: {} }, terrain = {}, ai, rules } = {}) {
  const merged = {};
  for (const [id, spec] of Object.entries(units)) merged[id] = { ...structuredClone(BASE_UNIT), ...structuredClone(spec) };
  for (const [id, u] of Object.entries(merged)) {
    const hits = u.hits ?? 50;
    delete u.hits;
    const table = {};
    for (const [tid, t] of Object.entries(merged)) if (u.targetLayers.includes(t.layer)) table[tid] = hits;
    u.damage = { ...table, ...(u.damage || {}) };
    for (const k of Object.keys(u.damage)) if (u.damage[k] === null) delete u.damage[k];
  }
  return {
    rules: rules || {
      maxHp: 10, neutralColor: '#999999', moveClasses: ['foot', 'wheel', 'air'],
      layers: { ground: { label: null }, sky: { label: 'sky', airborne: true } },
    },
    factions: {
      red: { name: 'Red', color: '#ff0000', dark: '#800000' },
      blue: { name: 'Blue', color: '#0000ff', dark: '#000080' },
      green: { name: 'Green', color: '#00ff00', dark: '#008000' },
    },
    terrain: { ...structuredClone(BASE_TERRAIN), ...structuredClone(terrain) },
    units: merged,
    ai: ai || {
      weights: { distanceToGoal: 2, unreachableDistance: 60, terrainDefense: 0.4, attackBase: 60, killBonus: 4, captureBase: 50, victoryCaptureBonus: 100, costUnit: 1000 },
      build: {},
    },
  };
}

export const makeRegistry = (opts) => createRegistry(makeData(opts));

export function rawMap({ rows = ['...'], unitsOnMap = [], players, legend = LEGEND } = {}) {
  return {
    format: 'pocketwars-map', version: 1, id: 'test', name: 'Test', description: '',
    players: players || [{ faction: 'red', controller: 'human', funds: 5000 }, { faction: 'blue', controller: 'human', funds: 5000 }],
    legend, tiles: rows,
    units: unitsOnMap.map(([type, owner, x, y, hp]) => (hp === undefined ? { type, owner, x, y } : { type, owner, x, y, hp })),
  };
}

/** Build a Game from a compact description. `unitsOnMap` entries are [type, owner, x, y, hp?]. */
export function makeGame({ units, terrain, ai, rules, rows = ['.....'], unitsOnMap = [], players, legend } = {}) {
  const registry = makeRegistry({ units, terrain, ai, rules });
  const map = parseMap(rawMap({ rows, unitsOnMap, players, legend }), registry);
  return new Game(registry, map);
}

/** Convenience: the n-th unit placed on the map. */
export const unitN = (game, n) => game.state.units[n];
export const ordersFor = (game, n, to, action = { type: 'wait' }) => ({ unitId: game.state.units[n].id, to, action });

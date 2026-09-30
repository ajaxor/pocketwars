// Synthetic game data for tests. Tests build tiny rulesets so that each attribute can be proven in
// isolation: two units that differ ONLY in the attribute under test must behave differently.
//
//   const game = makeGame({
//     units: { attacker: { attributes: { capture: true } }, victim: {} },   // each unit gets one weapon of its own, see makeData
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
  forest:   { name: 'Forest',   defense: 2, moveCost: { foot: 1, wheel: 2, air: 1 }, attributes: { blocksLineOfSight: 1 }, render: { base: '#86b95c' } },
  mountain: { name: 'Mountain', defense: 4, moveCost: { foot: 2, wheel: null, air: 1 }, attributes: { blocksLineOfSight: 2, vantage: 2 }, render: { base: '#86b95c' } },
  sea:      { name: 'Sea',      defense: 0, moveCost: { foot: null, wheel: null, air: 1 }, attributes: {}, render: { base: '#3d7ec7' } },
  city:     { name: 'City',     defense: 3, moveCost: { ...flat }, attributes: { property: property(), blocksLineOfSight: 2 }, render: { base: '#86b95c' } },
  base:     { name: 'Base',     defense: 3, moveCost: { ...flat }, attributes: { property: property(['ground']), blocksLineOfSight: 2 }, render: { base: '#86b95c' } },
  hq:       { name: 'HQ',       defense: 4, moveCost: { ...flat }, attributes: { property: property(), victoryOnCapture: true, blocksLineOfSight: 2 }, render: { base: '#86b95c' } },
};

export const BASE_UNIT = {
  name: 'Unit', category: 'ground', cost: 1000, move: 3, moveClass: 'foot', layer: 'ground',
  attributes: {}, render: { sprite: 'soldier', attackFx: 'shot' },
};

/** Legend used by makeMap / makeGame rows. Owners: a/H/1 belong to player 0, b/h/2 to player 1. */
export const LEGEND = {
  '.': { terrain: 'plain' }, r: { terrain: 'road' }, F: { terrain: 'forest' }, M: { terrain: 'mountain' }, '~': { terrain: 'sea' },
  c: { terrain: 'city' },
  a: { terrain: 'base', owner: 0 }, b: { terrain: 'base', owner: 1 },
  H: { terrain: 'hq', owner: 0 }, h: { terrain: 'hq', owner: 1 },
};

/**
 * Raw data bundle. A unit spec is merged over BASE_UNIT, and its weapon fields become a weapon of the same id:
 *   hits (weapon damage, default 50), range ([1, 1]), targets (target modes, default ['direct_ground']), armorPiercing (0).
 * `targetLayers: ['ground', 'sky']` is shorthand for targets: ['direct_ground', 'sky'] ("ground" means direct fire at ground units).
 * The rest of the spec (toughness, armor, layer, attributes...) goes on the unit.
 */
export function makeData({ units = { a: {}, b: {} }, terrain = {}, ai, rules, weapons: extraWeapons = {} } = {}) {
  const merged = {};
  const weapons = {};
  for (const [id, spec] of Object.entries(units)) {
    const u = { ...structuredClone(BASE_UNIT), ...structuredClone(spec) };
    const targets = u.targets ?? (u.targetLayers ? u.targetLayers.map((l) => (l === 'ground' ? 'direct_ground' : l)) : ['direct_ground']);
    weapons[id] = { name: `${id} gun`, damage: u.hits ?? 50, armorPiercing: u.armorPiercing ?? 0, range: u.range ?? [1, 1], targets, ...(u.targetMultipliers && { targetMultipliers: u.targetMultipliers }) };
    for (const k of ['hits', 'range', 'targets', 'targetLayers', 'armorPiercing']) delete u[k];
    if (!u.weapons) u.weapons = [id];
    merged[id] = u;
  }
  return {
    rules: rules || {
      maxHp: 10, neutralColor: '#999999', moveClasses: ['foot', 'wheel', 'air'],
      layers: { ground: { label: null }, sky: { label: 'sky', airborne: true } },
      targetModes: { direct_ground: { layer: 'ground', lineOfSight: true }, indirect_ground: { layer: 'ground' }, sky: { layer: 'sky' } },
    },
    factions: {
      red: { name: 'Red', color: '#ff0000', dark: '#800000' },
      blue: { name: 'Blue', color: '#0000ff', dark: '#000080' },
      green: { name: 'Green', color: '#00ff00', dark: '#008000' },
    },
    terrain: { ...structuredClone(BASE_TERRAIN), ...structuredClone(terrain) },
    weapons: { ...weapons, ...structuredClone(extraWeapons) },
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
export function makeGame({ units, terrain, ai, rules, weapons, rows = ['.....'], unitsOnMap = [], players, legend } = {}) {
  const registry = makeRegistry({ units, terrain, ai, rules, weapons });
  const map = parseMap(rawMap({ rows, unitsOnMap, players, legend }), registry);
  return new Game(registry, map);
}

/** Convenience: the n-th unit placed on the map. */
export const unitN = (game, n) => game.state.units[n];
export const ordersFor = (game, n, to, action = { type: 'wait' }) => ({ unitId: game.state.units[n].id, to, action });

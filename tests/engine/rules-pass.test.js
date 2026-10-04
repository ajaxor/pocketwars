// Rules settled in one pass: infantry speed and rough ground, docks, diving on the build turn, mines versus sonar, spies on enemy buildings.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry } from '../../src/data/loader.js';
import { parseMap } from '../../src/data/map-format.js';
import { rawMap } from '../helpers/fixtures.js';
import { Game } from '../../src/engine/game.js';
import { computeReach } from '../../src/engine/movement.js';
import { canSee, isCloaked, sonarTiles } from '../../src/engine/detection.js';
import { startTurn } from '../../src/engine/economy.js';

const registry = await loadRegistry(readData);
const legend = {
  '~': { terrain: 'sea' }, '.': { terrain: 'plain' }, ':': { terrain: 'rough' }, M: { terrain: 'mountain' },
  H: { terrain: 'hq', owner: 0 }, h: { terrain: 'hq', owner: 1 }, Y: { terrain: 'shipyard', owner: 0 }, Z: { terrain: 'shipyard', owner: 1 },
};
const players = [{ faction: 'ashmark', controller: 'human', funds: 30000 }, { faction: 'vantor_reach', controller: 'human', funds: 30000 }];
const world = (rows, unitsOnMap) => new Game(registry, parseMap(rawMap({ rows, unitsOnMap, players, legend }), registry));

test('every infantry unit except the motorcycle moves 2', () => {
  for (const id of registry.unitIds) {
    const u = registry.unit(id);
    if (u.category === 'infantry' || u.category === 'amphibious') assert.equal(u.move, id === 'motorcycle' ? 5 : 2, id);
  }
});

test('rough ground costs infantry nothing extra, a mountain still does', () => {
  const g = world(['H.:.:.h', 'M:M....'], [['sniper', 0, 1, 0]]);
  const reach = computeReach(g, g.state.units[0]);
  assert.ok(reach.has(3, 0), 'two tiles across the rough');
  assert.equal(registry.terrainDef('mountain').moveCost.foot, 2);
  assert.equal(registry.terrainDef('rough').moveCost.foot, 1);
});

test('a shipyard is land: a ship is built on it and sails off, cannot sail back onto it, and are repaired from the water next to it', () => {
  const g = world(['H~~~~~h', '.Y~~~~Z'], [['destroyer', 0, 3, 1], ['recon', 1, 6, 0]]);
  const ship = g.state.units[0];
  assert.equal(registry.terrainDef('shipyard').moveCost.naval, null);
  assert.equal(computeReach(g, ship).has(1, 1), false);
  assert.equal(g.build(1, 1, 'cruiser').ok, true, 'a ship can still be built there');
  const next = g.state.units.find((u) => u.type === 'cruiser');
  assert.deepEqual([next.x, next.y], [1, 1], 'built on the shipyard itself');
  ship.x = 2; ship.hp = 5;
  startTurn(g, 0);
  assert.ok(ship.hp > 5, 'next to its own shipyard it is repaired');
});

test('a submarine can dive on the turn it is built', () => {
  const g = world(['H~~~~~h', '.Y~~~~Z'], [['recon', 1, 6, 0]]);
  assert.equal(g.build(1, 1, 'submarine').ok, true);
  const sub = g.state.units.find((u) => u.type === 'submarine');
  const res = g.act({ unitId: sub.id, to: { x: 3, y: 1 }, action: { type: 'submerge' } });
  assert.equal(res.ok, true, res.error);
  assert.equal(sub.submerged, true);
  assert.equal(g.act({ unitId: g.state.units.find((u) => u.type === 'recon').id, to: { x: 6, y: 0 }, action: { type: 'wait' } }).error, 'not-your-turn');
});

test('a sea mine is never found by sonar, only by a unit next to it', () => {
  const g = world(['H~~~~~h', '.......'], [['destroyer', 1, 5, 0], ['sea_mine', 0, 2, 0], ['submarine', 0, 3, 0]]);
  const mine = g.state.units.find((u) => u.type === 'sea_mine');
  const sub = g.state.units.find((u) => u.type === 'submarine');
  sub.submerged = true;
  assert.equal(canSee(g, 1, sub), true, 'sonar (range 3) hears the submarine two tiles off');
  assert.equal(canSee(g, 1, mine), false, 'but not the mine three tiles off');
  g.state.units.find((u) => u.type === 'destroyer').x = 1;   // now beside it
  assert.equal(canSee(g, 1, mine), true, 'next to it, the mine is found');
});

test('sonar marks only show for a sonar longer than 1', () => {
  const g = world(['H~~~~~h'], [['destroyer', 0, 3, 0], ['recon', 1, 6, 0]]);
  assert.ok(sonarTiles(g, g.state.units[0]).size > 3);
  g.state.units[0].type = 'tank';
  assert.equal(sonarTiles(g, g.state.units[0]), null);
});

test('a spy or stealth unit standing on an enemy building is in plain sight', () => {
  const g = world(['H.....h'], [['spy', 0, 3, 0], ['soldier', 1, 6, 0]]);
  const spy = g.state.units[0];
  assert.equal(isCloaked(g, spy), true);
  spy.x = 6; spy.y = 0;   // the enemy HQ
  assert.equal(isCloaked(g, spy), false);
  assert.equal(canSee(g, 1, spy), true);
  spy.x = 0;   // its own HQ
  assert.equal(isCloaked(g, spy), true);
});

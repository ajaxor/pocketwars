// Game.spawn: a unit arriving from outside the rules (campaign reinforcements) goes through the game, so sight, undo and events stay honest.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry } from '../../src/data/loader.js';
import { parseMap } from '../../src/data/map-format.js';
import { rawMap } from '../helpers/fixtures.js';
import { Game } from '../../src/engine/game.js';
import { unitAt } from '../../src/engine/queries.js';

const registry = await loadRegistry(readData);
const legend = { '.': { terrain: 'plain' }, '~': { terrain: 'sea' }, H: { terrain: 'hq', owner: 0 }, h: { terrain: 'hq', owner: 1 } };
const players = [{ faction: 'ashmark', controller: 'human', funds: 0 }, { faction: 'vantor_reach', controller: 'human', funds: 0 }];
const world = () => new Game(registry, parseMap(rawMap({ rows: ['H.~~.h'], unitsOnMap: [['soldier', 0, 1, 0], ['soldier', 1, 4, 0]], players, legend }), registry));

test('a spawned unit appears ready to act, costs nothing, and comes with a spawn event', () => {
  const g = world();
  const res = g.spawn({ type: 'tank', owner: 0, x: 0, y: 0 });
  assert.equal(res.ok, true);
  assert.equal(res.events[0].type, 'spawn');
  const tank = unitAt(g, 0, 0);
  assert.equal(tank.type, 'tank');
  assert.equal(tank.done, false);
  assert.equal(g.state.funds[0], 0);
});

test('a spawn cannot go on an occupied tile, off the map, on ground the unit cannot stand on, or be an unknown unit', () => {
  const g = world();
  assert.equal(g.spawn({ type: 'tank', owner: 0, x: 1, y: 0 }).error, 'tile-occupied');
  assert.equal(g.spawn({ type: 'tank', owner: 0, x: 9, y: 0 }).error, 'out-of-bounds');
  assert.equal(g.spawn({ type: 'tank', owner: 0, x: 2, y: 0 }).error, 'bad-terrain');
  assert.equal(g.spawn({ type: 'no_such_unit', owner: 0, x: 0, y: 0 }).error, 'unknown-unit');
});

test('a spawn clears the undo history, and the sight cache sees the new unit', () => {
  const g = world();
  const before = g.revision;
  g.spawn({ type: 'recon', owner: 0, x: 0, y: 0 });
  assert.equal(g.undoSnapshot, null);
  assert.ok(g.revision > before);
});

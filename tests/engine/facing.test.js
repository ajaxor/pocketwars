// Units face the way they last moved sideways (and the map centre at first). Infantry never turn: data says render.facing is false.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry } from '../../src/data/loader.js';
import { parseMap } from '../../src/data/map-format.js';
import { Game } from '../../src/engine/game.js';
import { rawMap } from '../helpers/fixtures.js';
import { facingToCentre } from '../../src/engine/queries.js';

const registry = await loadRegistry(readData);
const players = [{ faction: 'orange_star', controller: 'human', funds: 10000 }, { faction: 'violet_nebula', controller: 'human', funds: 10000 }];
const legend = { '.': { terrain: 'plain' }, H: { terrain: 'hq', owner: 0 }, h: { terrain: 'hq', owner: 1 } };
const game = (rows, unitsOnMap) => new Game(registry, parseMap(rawMap({ rows, unitsOnMap, players, legend }), registry));

test('units start facing the middle of the map', () => {
  const g = game(['H.......h', '.........'], [['tank', 0, 1, 0], ['tank', 1, 7, 0], ['tank', 1, 4, 1]]);
  assert.deepEqual(g.state.units.map((u) => u.facing), [1, -1, 1]);
  assert.equal(facingToCentre(g.map, 4), 1, 'the middle column faces right');
});

test('a unit turns to the way it last moved sideways; a vertical move keeps its facing', () => {
  const g = game(['H.......h', '.........', '.........'], [['tank', 0, 1, 0], ['tank', 1, 8, 2]]);
  const tank = g.state.units[0];
  assert.equal(g.act({ unitId: tank.id, to: { x: 1, y: 2 }, action: { type: 'wait' } }).ok, true);
  assert.equal(tank.facing, 1, 'only moved down: still facing right');
  tank.done = false;
  g.state.units[0].done = false;
  const r2 = g.act({ unitId: tank.id, to: { x: 0, y: 2 }, action: { type: 'wait' } }); assert.equal(r2.ok, true, String(r2.error));
  assert.equal(tank.facing, -1, 'moved left');
  tank.done = false;
  assert.equal(g.act({ unitId: tank.id, to: { x: 1, y: 1 }, action: { type: 'wait' } }).ok, true);
  assert.equal(tank.facing, 1, 'the last sideways step was to the right');
});

test('infantry do not turn (render.facing is false in the data); everything else does', () => {
  for (const id of registry.unitIds) {
    const infantry = ['infantry', 'amphibious'].includes(registry.unit(id).category);   // foot soldiers, marines included
    assert.equal(registry.unit(id).render.facing === false, infantry, id);
  }
});

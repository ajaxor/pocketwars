import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame } from '../helpers/fixtures.js';
import { computeReach, distanceField, attackTiles } from '../../src/engine/movement.js';

const tilesOf = (reach) => [...reach.tiles()].map(({ x, y }) => `${x},${y}`).sort();
const reachOf = (game, n) => computeReach(game, game.state.units[n]);

test('move classes use their own terrain costs: forest is cheap for foot, dear for wheels, free-flowing for air', () => {
  const units = { walker: { move: 3, moveClass: 'foot' }, roller: { move: 3, moveClass: 'wheel' }, flyer: { move: 3, moveClass: 'air', layer: 'sky', targetLayers: ['ground', 'sky'] } };
  const rows = ['.FF..'];
  const cost = (type) => { const g = makeGame({ units, rows, unitsOnMap: [[type, 0, 0, 0]] }); return reachOf(g, 0); };
  assert.equal(cost('walker').costAt(2, 0), 2, 'two forests at cost 1 each');
  assert.equal(cost('walker').has(3, 0), true);
  assert.equal(cost('roller').costAt(1, 0), 2, 'forest costs wheels 2');
  assert.equal(cost('roller').has(2, 0), false, 'a second forest exceeds the budget');
  assert.equal(cost('flyer').has(3, 0), true);
});

test('null moveCost is impassable: mountains block wheels, sea blocks foot, air crosses both', () => {
  const units = { walker: { move: 9 }, roller: { move: 9, moveClass: 'wheel' }, flyer: { move: 9, moveClass: 'air', layer: 'sky', targetLayers: ['ground', 'sky'] } };
  const rows = ['.M~.'];
  const at = (type) => { const g = makeGame({ units, rows, unitsOnMap: [[type, 0, 0, 0]] }); return reachOf(g, 0); };
  assert.equal(at('roller').has(1, 0), false);
  assert.equal(at('walker').has(1, 0), true, 'foot climbs the mountain');
  assert.equal(at('walker').has(3, 0), false, 'but the sea beyond it blocks foot');
  assert.equal(at('flyer').has(3, 0), true);
});

test('movement budget: a unit with move 2 reaches exactly the tiles within cost 2', () => {
  const game = makeGame({ units: { walker: { move: 2 } }, rows: ['.....', '.....', '.....', '.....', '.....'], unitsOnMap: [['walker', 0, 2, 2]] });
  assert.equal(reachOf(game, 0).size, 13, 'diamond of radius 2 on open ground');
  const corner = makeGame({ units: { walker: { move: 2 } }, rows: ['...', '...', '...'], unitsOnMap: [['walker', 0, 0, 0]] });
  assert.equal(reachOf(corner, 0).size, 6, 'clipped by the map edge');
});

test('enemy units block movement; friendly units can be crossed but not stopped on', () => {
  const game = makeGame({
    units: { walker: { move: 5 } }, rows: ['.....'],
    unitsOnMap: [['walker', 0, 0, 0], ['walker', 0, 1, 0], ['walker', 1, 3, 0]],
  });
  const reach = reachOf(game, 0);
  assert.equal(reach.has(1, 0), false, 'cannot end on a friend');
  assert.equal(reach.has(2, 0), true, 'can pass through a friend');
  assert.equal(reach.has(3, 0), false, 'cannot enter an enemy tile');
  assert.equal(reach.has(4, 0), false, 'an enemy in a corridor blocks everything behind it');
});

test('pathTo returns the origin-to-destination path (through friends), null when unreachable', () => {
  const game = makeGame({ units: { walker: { move: 5 } }, rows: ['....'], unitsOnMap: [['walker', 0, 0, 0], ['walker', 0, 1, 0]] });
  const reach = reachOf(game, 0);
  assert.deepEqual(reach.pathTo(3, 0), [[0, 0], [1, 0], [2, 0], [3, 0]]);
  assert.deepEqual(reach.pathTo(0, 0), [[0, 0]]);
  const blocked = makeGame({ units: { walker: { move: 1 } }, rows: ['...'], unitsOnMap: [['walker', 0, 0, 0]] });
  assert.equal(reachOf(blocked, 0).pathTo(2, 0), null);
});

test('the search chooses the cheapest route, detouring around expensive terrain', () => {
  const game = makeGame({ units: { roller: { move: 6, moveClass: 'wheel' } }, rows: ['.FFF.', '.....'], unitsOnMap: [['roller', 0, 0, 0]] });
  const reach = reachOf(game, 0);
  assert.equal(reach.costAt(4, 0), 6, 'around (1+4+1) beats through three forests (2+2+2+1)');
  assert.ok(reach.pathTo(4, 0).every(([, y], i, p) => i === 0 || i === p.length - 1 || y === 1), 'path runs along the bottom row');
});

test('distanceField: cost from goals outward using the move class, impassable tiles excluded', () => {
  const game = makeGame({ units: { walker: {} }, rows: ['.M.~.'], unitsOnMap: [['walker', 0, 0, 0]] });
  const field = distanceField(game, 'foot', [[0, 0]]);
  assert.equal(field.get(0), 0);
  assert.equal(field.get(1), 2, 'mountain costs foot 2');
  assert.equal(field.get(2), 3);
  assert.equal(field.has(3), false, 'sea is impassable for foot');
  assert.equal(field.has(4), false, 'and blocks the way');
});

test('attackTiles: direct units include their own tile; ranges clip at the map edge', () => {
  const game = makeGame({ units: { walker: {} }, rows: ['...', '...'], unitsOnMap: [['walker', 0, 0, 0]] });
  const tiles = attackTiles(game, game.state.units[0]);
  assert.deepEqual([...tiles].sort(), [0, 1, 3], 'own tile, east and south only');
});

test('tilesOf helper sanity', () => {
  const game = makeGame({ units: { walker: { move: 1 } }, rows: ['...'], unitsOnMap: [['walker', 0, 1, 0]] });
  assert.deepEqual(tilesOf(reachOf(game, 0)), ['0,0', '1,0', '2,0']);
});

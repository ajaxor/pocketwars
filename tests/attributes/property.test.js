// Terrain attribute: `property` (income, repair, builds, ownership)
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame } from '../helpers/fixtures.js';
import { incomeFor, startTurn, buildOptions, buildProblem } from '../../src/engine/economy.js';

test('property: income is the sum over owned properties only (city income 1000 each, neutral/enemy excluded)', () => {
  const game = makeGame({ rows: ['acHbch.c'] });
  // player 0 owns a (base) and H (hq): 2000. Player 1 owns b and h: 2000. c tiles are neutral.
  assert.equal(incomeFor(game, 0), 2000);
  assert.equal(incomeFor(game, 1), 2000);
  game.state.owners[0][1] = 0; // capture a neutral city
  assert.equal(incomeFor(game, 0), 3000);
});

test('property: income value comes from the data (income: 250 pays 250)', () => {
  const game = makeGame({
    terrain: { city: { name: 'Village', defense: 1, moveCost: { foot: 1, wheel: 1, air: 1 }, attributes: { property: { income: 250, capturePoints: 20, repair: 0, builds: [] } }, render: { base: '#000000' } } },
    rows: ['cc'],
  });
  game.state.owners[0][0] = 0;
  game.state.owners[0][1] = 0;
  game.state.funds[0] = 0;
  startTurn(game, 0);
  assert.equal(game.state.funds[0], 500);
});

test('property: units on an OWNED property are repaired at turn start, capped at max HP', () => {
  const game = makeGame({ rows: ['a.b'], unitsOnMap: [['a', 0, 0, 0, 5], ['a', 0, 1, 0, 5], ['a', 1, 2, 0, 5]] });
  const [onOwn, onPlain, onEnemyOwned] = game.state.units;
  startTurn(game, 0);
  assert.equal(onOwn.hp, 7, '+2 on an owned base');
  assert.equal(onPlain.hp, 5, 'no repair on plain');
  startTurn(game, 1);
  assert.equal(onEnemyOwned.hp, 7, 'player 1 repairs on its own base');
  onOwn.hp = 9;
  startTurn(game, 0);
  assert.equal(onOwn.hp, 10, 'capped at max HP');
});

test('property: an enemy-owned or neutral property does NOT repair', () => {
  const game = makeGame({ rows: ['ac'], unitsOnMap: [['a', 1, 0, 0, 4], ['a', 1, 1, 0, 4]] });
  startTurn(game, 1);
  assert.deepEqual(game.state.units.map((u) => u.hp), [4, 4]);
});

test('property: repair amount is data-driven (repair: 5)', () => {
  const game = makeGame({
    terrain: { base: { name: 'Depot', defense: 1, moveCost: { foot: 1, wheel: 1, air: 1 }, attributes: { property: { income: 0, capturePoints: 20, repair: 5, builds: [] } }, render: { base: '#000000' } } },
    rows: ['a'], unitsOnMap: [['a', 0, 0, 0, 2]],
  });
  startTurn(game, 0);
  assert.equal(game.state.units[0].hp, 7);
});

test('property: starting a turn readies that player\'s units (done -> false)', () => {
  const game = makeGame({ rows: ['..'], unitsOnMap: [['a', 0, 0, 0], ['a', 1, 1, 0]] });
  game.state.units.forEach((u) => { u.done = true; });
  startTurn(game, 0);
  assert.deepEqual(game.state.units.map((u) => u.done), [false, true]);
});

test('property: builds lists the unit categories a property can produce (empty for cities/HQs)', () => {
  const game = makeGame({
    units: { walker: { category: 'ground' }, flyer: { category: 'air', layer: 'sky', moveClass: 'air', targetLayers: ['ground', 'sky'] } },
    rows: ['acH'],
  });
  assert.deepEqual(buildOptions(game, 0, 0).map((u) => u.id), ['walker'], 'base builds ground units only');
  assert.deepEqual(buildOptions(game, 1, 0), [], 'city builds nothing');
  assert.deepEqual(buildOptions(game, 2, 0), [], 'hq builds nothing');
});

test('property: building spends funds, needs a free owned tile of the right category, and new units cannot act', () => {
  const game = makeGame({
    units: { walker: { category: 'ground', cost: 1500 }, flyer: { category: 'air', cost: 100, layer: 'sky', moveClass: 'air', targetLayers: ['ground', 'sky'] } },
    rows: ['a.b'], players: [{ faction: 'red', controller: 'human', funds: 2000 }, { faction: 'blue', controller: 'human', funds: 0 }],
  });
  assert.equal(buildProblem(game, 0, 0, 0, 'flyer'), 'cannot-build-here');
  assert.equal(buildProblem(game, 0, 1, 0, 'walker'), 'not-your-property');
  assert.equal(buildProblem(game, 0, 2, 0, 'walker'), 'not-your-property', 'enemy base');
  assert.equal(buildProblem(game, 1, 2, 0, 'walker'), 'not-enough-funds');
  const built = game.build(0, 0, 'walker');
  assert.equal(built.ok, true);
  assert.equal(game.state.funds[0], 500);
  assert.equal(game.state.units[0].done, true);
  assert.equal(game.build(0, 0, 'walker').error, 'tile-occupied');
});

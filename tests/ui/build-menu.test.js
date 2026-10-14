import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry, loadMap } from '../../src/data/loader.js';
import { Game } from '../../src/engine/game.js';
import { allProperties } from '../../src/engine/queries.js';
import { buildMenuModel, defaultChoice } from '../../src/ui/build-menu.js';

const registry = await loadRegistry(readData);
const classic = await loadMap(readData, registry, 'classic');
const factory = (game) => allProperties(game).find((p) => p.owner === 0 && p.terrain.id === 'factory');

test('a factory lists its units cheapest first with what the player can and cannot pay', () => {
  const game = new Game(registry, classic);
  const f = factory(game);
  game.state.funds[0] = 6500;
  const m = buildMenuModel(game, 0, f.x, f.y);
  assert.equal(m.title, 'Factory');
  assert.equal(m.funds, 6500);
  assert.deepEqual(m.options.map((o) => o.id), ['flak', 'artillery', 'tank'], 'cheapest first (flak and artillery cost the same, so the menu order decides)');
  assert.deepEqual(m.options.map((o) => o.affordable), [true, true, false]);
  const tank = m.options.find((o) => o.id === 'tank');
  assert.equal(tank.missing, 500);
  assert.equal(m.options[0].missing, 0);
});

test('the menu starts on the first unit that can be afforded, or the first one when none can', () => {
  const game = new Game(registry, classic);
  const f = factory(game);
  game.state.funds[0] = 5000;
  assert.equal(defaultChoice(buildMenuModel(game, 0, f.x, f.y).options), 'flak', 'nothing affordable at 5,000: the first row');
  game.state.funds[0] = 100;
  assert.equal(defaultChoice(buildMenuModel(game, 0, f.x, f.y).options), 'flak', 'nothing affordable: first row');
  assert.equal(defaultChoice([]), null);
});

test('a tile that builds nothing gives an empty menu', () => {
  const game = new Game(registry, classic);
  const city = allProperties(game).find((p) => p.terrain.id === 'city');
  assert.deepEqual(buildMenuModel(game, 0, city.x, city.y).options, []);
});

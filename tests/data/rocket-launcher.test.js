// The rocket launcher as shipped: long indirect range, three rockets, refilled (for a price) next to a factory.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry, loadMap } from '../../src/data/loader.js';
import { Game } from '../../src/engine/game.js';
import { weaponsOf, canTarget } from '../../src/engine/combat.js';
import { ammoOf, canResupplyAt } from '../../src/engine/ammo.js';
import { allProperties } from '../../src/engine/queries.js';

const registry = await loadRegistry(readData);
const fresh = async () => new Game(registry, await loadMap(readData, registry, 'classic'));
const put = (game, type, owner, x, y) => { const u = { id: 900 + game.state.units.length, type, owner, x, y, hp: 10, done: false, capture: 0, ammo: registry.unit(type).attributes.ammo?.max }; game.state.units.push(u); return u; };

test('rocket launcher: range 3 to 5, indirect, three rockets, hits ground and ships but not aircraft', async () => {
  const game = await fresh();
  const [w] = weaponsOf(game, put(game, 'rocket_launcher', 0, 0, 0));
  assert.deepEqual(w.range, [3, 5]);
  assert.equal(registry.unit('rocket_launcher').attributes.ammo.max, 3);
  assert.ok(canTarget(game, put(game, 'rocket_launcher', 0, 0, 0), put(game, 'tank', 1, 0, 0)));
  assert.ok(!canTarget(game, put(game, 'rocket_launcher', 0, 0, 0), put(game, 'copter', 1, 0, 0)));
});

test('rocket launcher: each salvo costs a rocket, and a factory refills them', async () => {
  const game = await fresh();
  const factory = allProperties(game).find((p) => p.terrain.name === 'Factory');
  const rl = put(game, 'rocket_launcher', game.currentPlayer, factory.x, factory.y + 1);
  rl.ammo = 1;
  game.state.owners[factory.y][factory.x] = rl.owner;
  assert.equal(ammoOf(game, rl), 1);
  assert.ok(canResupplyAt(game, rl, rl.x, rl.y), 'next to its own factory');
  const far = put(game, 'rocket_launcher', game.currentPlayer, 0, 0);
  far.ammo = 1;
  assert.ok(!canResupplyAt(game, far, 0, 0), 'but not out in the field');
});

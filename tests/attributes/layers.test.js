// Unit `layer` + `targetLayers` (which layers a unit may attack) and rules.layers[*].airborne.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, makeData, ordersFor } from '../helpers/fixtures.js';
import { createRegistry } from '../../src/data/registry.js';
import { DataError } from '../../src/data/validate.js';
import { canTarget } from '../../src/engine/combat.js';
import { targetsFrom } from '../../src/engine/movement.js';

const AIR = { layer: 'sky', moveClass: 'air', category: 'air' };

test('targetLayers: a unit can only attack layers it lists', () => {
  const game = makeGame({
    units: {
      soldier: { targetLayers: ['ground'] },
      aa: { targetLayers: ['ground', 'sky'] },
      jet: { ...AIR, targetLayers: ['sky'] },
    },
    rows: ['.....'],
    unitsOnMap: [['soldier', 0, 0, 0], ['aa', 0, 1, 0], ['jet', 1, 2, 0]],
  });
  const [soldier, aa, jet] = game.state.units;
  assert.equal(canTarget(game, soldier, jet), false, 'ground-only unit cannot hit air');
  assert.equal(canTarget(game, aa, jet), true);
  assert.equal(canTarget(game, jet, soldier), false, 'air-only fighter cannot hit ground');
  assert.equal(canTarget(game, jet, aa), false);
});

test('targetLayers: illegal attacks are rejected by the order validator', () => {
  const game = makeGame({
    units: { soldier: { targetLayers: ['ground'] }, jet: { ...AIR, targetLayers: ['ground', 'sky'] } },
    rows: ['..'], unitsOnMap: [['soldier', 0, 0, 0], ['jet', 1, 1, 0]],
  });
  const r = game.act(ordersFor(game, 0, { x: 0, y: 0 }, { type: 'attack', targetId: game.state.units[1].id }));
  assert.equal(r.error, 'cannot-target');
});

test('targetLayers: enemies of the wrong layer never appear in the list of targets', () => {
  const game = makeGame({
    units: { soldier: { targetLayers: ['ground'] }, jet: { ...AIR, targetLayers: ['ground', 'sky'] }, grunt: {} },
    rows: ['...'], unitsOnMap: [['soldier', 0, 1, 0], ['jet', 1, 0, 0], ['grunt', 1, 2, 0]],
  });
  assert.deepEqual(targetsFrom(game, game.state.units[0]).map((u) => u.type), ['grunt']);
});

test('data validation: every targetable unit must have a damage entry, and damage may not exceed targetLayers', () => {
  const missing = makeData({ units: { a: { damage: { b: null } }, b: {} } });
  assert.throws(() => createRegistry(missing), (e) => e instanceof DataError && /no damage entry vs "b"/.test(e.message));
  const extra = makeData({ units: { a: { targetLayers: ['ground'] }, s: { ...AIR } } });
  extra.units.a.damage.s = 10;
  assert.throws(() => createRegistry(extra), /cannot target layer "sky"/);
});

test('rules.layers[*].airborne marks which layers count as air (used by the AI condition enemyHasAirborne)', async () => {
  const { AI_CONDITIONS } = await import('../../src/engine/ai-conditions.js');
  const game = makeGame({ units: { soldier: {}, jet: { ...AIR, targetLayers: ['ground', 'sky'] } }, rows: ['..'], unitsOnMap: [['soldier', 0, 0, 0], ['jet', 1, 1, 0]] });
  assert.equal(AI_CONDITIONS.enemyHasAirborne(game, 0), true, 'player 0 sees an enemy jet');
  assert.equal(AI_CONDITIONS.enemyHasAirborne(game, 1), false, 'player 1 only sees a soldier');
});

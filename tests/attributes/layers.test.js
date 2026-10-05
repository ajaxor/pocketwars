// Unit `layer`, weapon `targets` (the target modes a weapon can fire at; each mode is a layer) and rules.layers[*].airborne.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, makeData, ordersFor } from '../helpers/fixtures.js';
import { createRegistry } from '../../src/data/registry.js';
import { DataError } from '../../src/data/validate.js';
import { canTarget } from '../../src/engine/combat.js';
import { targetsFrom } from '../../src/engine/movement.js';

const AIR = { layer: 'sky', moveClass: 'air', category: 'air' };
const GROUND_ONLY = ['direct_ground'];
const GROUND_AND_AIR = ['direct_ground', 'sky'];

test('targets: a weapon can only hit the layers its target modes cover', () => {
  const game = makeGame({
    units: {
      soldier: { targets: GROUND_ONLY },
      aa: { targets: GROUND_AND_AIR },
      jet: { ...AIR, targets: ['sky'] },
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

test('targets: direct and indirect ground fire both hit ground units', () => {
  const game = makeGame({
    units: { rifle: { targets: ['direct_ground'] }, mortar: { targets: ['indirect_ground'] }, foe: {} },
    rows: ['...'], unitsOnMap: [['rifle', 0, 0, 0], ['mortar', 0, 1, 0], ['foe', 1, 2, 0]],
  });
  const [rifle, mortar, foe] = game.state.units;
  assert.ok(canTarget(game, rifle, foe) && canTarget(game, mortar, foe));
});

test('targets: a unit with several weapons can hit whatever any of them can', () => {
  const game = makeGame({
    units: { gun: { targets: ['direct_ground'] }, missile: { targets: ['sky'] }, both: { weapons: ['gun', 'missile'] }, jet: { ...AIR, targets: ['sky'] }, foe: {} },
    rows: ['....'], unitsOnMap: [['both', 0, 0, 0], ['jet', 1, 1, 0], ['foe', 1, 2, 0]],
  });
  const [both, jet, foe] = game.state.units;
  assert.ok(canTarget(game, both, jet) && canTarget(game, both, foe));
});

test('targets: illegal attacks are rejected by the order validator', () => {
  const game = makeGame({
    units: { soldier: { targets: GROUND_ONLY }, jet: { ...AIR, targets: GROUND_AND_AIR } },
    rows: ['..'], unitsOnMap: [['soldier', 0, 0, 0], ['jet', 1, 1, 0]],
  });
  const r = game.act(ordersFor(game, 0, { x: 0, y: 0 }, { type: 'attack', targetId: game.state.units[1].id }));
  assert.equal(r.error, 'cannot-target');
});

test('targets: enemies of the wrong layer never appear in the list of targets', () => {
  const game = makeGame({
    units: { soldier: { targets: GROUND_ONLY }, jet: { ...AIR, targets: GROUND_AND_AIR }, grunt: {} },
    rows: ['...'], unitsOnMap: [['soldier', 0, 1, 0], ['jet', 1, 0, 0], ['grunt', 1, 2, 0]],
  });
  assert.deepEqual(targetsFrom(game, game.state.units[0]).map((u) => u.type), ['grunt']);
});

test('the layers a mode names, like the structure layer, are reserved even when no unit uses them', async () => {
  const shipped = await import('../helpers/node-io.js');
  const { loadRegistry } = await import('../../src/data/loader.js');
  const registry = await loadRegistry(shipped.readData);
  assert.ok(registry.rules.layers.structure && registry.rules.targetModes.structure.layer === 'structure');
  assert.equal(registry.unitIds.filter((id) => registry.unit(id).layer === 'structure').length, 0);
});

test('data validation: a weapon may only list known target modes, and a unit only known layers', () => {
  const bad = makeData({ units: { a: {} } }); bad.weapons.a.targets = ['underwater_sky'];
  assert.throws(() => createRegistry(bad), (e) => e instanceof DataError && /known target modes/.test(e.message));
  const layer = makeData({ units: { a: {} } }); layer.units.a.layer = 'orbit';
  assert.throws(() => createRegistry(layer), /unknown layer "orbit"/);
});

test('rules.layers[*].airborne marks which layers count as air (used by the AI condition enemyHasAirborne)', async () => {
  const { AI_CONDITIONS } = await import('../../src/ai/conditions.js');
  const game = makeGame({ units: { soldier: {}, jet: { ...AIR, targets: GROUND_AND_AIR } }, rows: ['..'], unitsOnMap: [['soldier', 0, 0, 0], ['jet', 1, 1, 0]] });
  assert.equal(AI_CONDITIONS.enemyHasAirborne(game, 0), true, 'player 0 sees an enemy jet');
  assert.equal(AI_CONDITIONS.enemyHasAirborne(game, 1), false, 'player 1 only sees a soldier');
});

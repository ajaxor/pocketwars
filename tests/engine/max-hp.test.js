// A unit type may have its own `maxHp` (below rules.maxHp): it starts, heals and is built at that value.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, makeData, makeRegistry, rawMap } from '../helpers/fixtures.js';
import { validateData } from '../../src/data/validate.js';
import { parseMap, MapError } from '../../src/data/map-format.js';

const units = { frail: { maxHp: 6 }, sturdy: {} };

test('maxHpOf: a unit type\'s own value, else rules.maxHp', () => {
  const registry = makeRegistry({ units });
  assert.equal(registry.maxHpOf('frail'), 6);
  assert.equal(registry.maxHpOf('sturdy'), 10);
});

test('units placed on a map start at their own max HP unless the map says otherwise', () => {
  const game = makeGame({ units, rows: ['...'], unitsOnMap: [['frail', 0, 0, 0], ['sturdy', 0, 1, 0], ['frail', 1, 2, 0, 3]] });
  assert.deepEqual(game.state.units.map((u) => u.hp), [6, 10, 3]);
});

test('repair on an owned property stops at the unit\'s own max HP', () => {
  const game = makeGame({ units, rows: ['.bb'], unitsOnMap: [['frail', 0, 0, 0], ['frail', 1, 1, 0, 5], ['sturdy', 1, 2, 0, 9]] });
  game.endTurn();   // player 1's turn starts: +2 HP on the properties it owns
  assert.deepEqual(game.state.units.map((u) => u.hp), [6, 6, 10]);
});

test('a newly built unit starts at its own max HP', () => {
  const game = makeGame({ units, rows: ['a..'], unitsOnMap: [['sturdy', 1, 2, 0]] });
  assert.equal(game.build(0, 0, 'frail').ok, true);
  assert.equal(game.state.units.find((u) => u.type === 'frail').hp, 6);
});

test('a map cannot start a unit above its own max HP', () => {
  const registry = makeRegistry({ units });
  assert.throws(() => parseMap(rawMap({ rows: ['...'], unitsOnMap: [['frail', 0, 0, 0, 7]] }), registry), (e) => e instanceof MapError && /hp must be an integer 1\.\.6/.test(e.message));
  assert.doesNotThrow(() => parseMap(rawMap({ rows: ['...'], unitsOnMap: [['frail', 0, 0, 0, 6], ['sturdy', 1, 1, 0, 10]] }), registry));
});

test('a unit\'s maxHp must be an integer no higher than rules.maxHp', () => {
  for (const bad of [0, 11, 2.5, '8']) {
    const d = makeData({ units }); d.units.frail.maxHp = bad;
    assert.ok(validateData(d).some((p) => /unit "frail": maxHp/.test(p)), `rejects ${JSON.stringify(bad)}`);
  }
  assert.deepEqual(validateData(makeData({ units })), []);
});

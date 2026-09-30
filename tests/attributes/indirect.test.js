// Attribute: unit `indirect` (artillery-style fire)
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, ordersFor } from '../helpers/fixtures.js';
import { bestAttackTile, computeReach, attackTiles } from '../../src/engine/movement.js';
import { canCounter } from '../../src/engine/combat.js';

const gun = (attributes) => ({ range: [2, 3], attributes, hits: 60 });
const attack = (game, n, to, targetN) => game.act(ordersFor(game, n, to, { type: 'attack', targetId: game.state.units[targetN].id }));

test('indirect: cannot move and fire in the same turn; the same unit without the attribute can', () => {
  for (const [attributes, allowed] of [[{ indirect: true }, false], [{}, true]]) {
    const game = makeGame({ units: { gun: gun(attributes), foe: {} }, rows: ['.....'], unitsOnMap: [['gun', 0, 0, 0], ['foe', 1, 4, 0]] });
    const result = attack(game, 0, { x: 1, y: 0 }, 1); // move 1 tile, then shoot 3 tiles away
    assert.equal(result.ok, allowed, `attributes=${JSON.stringify(attributes)}`);
    if (!allowed) assert.equal(result.error, 'cannot-move-and-fire');
  }
});

test('indirect: fires from its own tile at range, but never at adjacent targets (minimum range)', () => {
  const game = makeGame({ units: { gun: gun({ indirect: true }), foe: {} }, rows: ['....'], unitsOnMap: [['gun', 0, 0, 0], ['foe', 1, 1, 0], ['foe', 1, 3, 0]] });
  assert.equal(attack(game, 0, { x: 0, y: 0 }, 2).ok, true, 'range 3');
  const game2 = makeGame({ units: { gun: gun({ indirect: true }), foe: {} }, rows: ['....'], unitsOnMap: [['gun', 0, 0, 0], ['foe', 1, 1, 0]] });
  assert.equal(attack(game2, 0, { x: 0, y: 0 }, 1).error, 'out-of-range', 'range 1 is inside the minimum range');
});

test('indirect: the attack outline excludes tiles inside the minimum range', () => {
  const game = makeGame({ units: { gun: gun({ indirect: true }) }, rows: ['.....'], unitsOnMap: [['gun', 0, 2, 0]] });
  const tiles = attackTiles(game, game.state.units[0]);
  assert.equal(tiles.has(2), false, 'own tile');
  assert.equal(tiles.has(1), false, 'adjacent tile');
  assert.equal(tiles.has(0), true);
  assert.equal(tiles.has(4), true);
});

test('indirect: an indirect ATTACKER is never counterattacked; a direct one is', () => {
  for (const [attributes, expectCounter] of [[{ indirect: true }, false], [{}, true]]) {
    const game = makeGame({
      units: { gun: { range: [2, 2], attributes, hits: 50 }, foe: { range: [1, 2], hits: 50 } },
      rows: ['...'], unitsOnMap: [['gun', 0, 0, 0], ['foe', 1, 2, 0]],
    });
    const [gunUnit, foe] = game.state.units;
    assert.equal(canCounter(game, foe, gunUnit), expectCounter);
    const { events } = attack(game, 0, { x: 0, y: 0 }, 1);
    assert.equal(events.filter((e) => e.type === 'strike' && e.counter).length, expectCounter ? 1 : 0);
  }
});

test('indirect: an indirect DEFENDER never counterattacks; a direct one does', () => {
  for (const [attributes, expectCounter] of [[{ indirect: true }, false], [{}, true]]) {
    const game = makeGame({
      units: { shooter: { range: [2, 2], hits: 50 }, gun: { range: [2, 2], attributes, hits: 50 } },
      rows: ['...'], unitsOnMap: [['shooter', 0, 0, 0], ['gun', 1, 2, 0]],
    });
    const { events } = attack(game, 0, { x: 0, y: 0 }, 1);
    assert.equal(events.filter((e) => e.type === 'strike' && e.counter).length, expectCounter ? 1 : 0);
  }
});

test('indirect: only its current tile is considered when choosing where to attack from', () => {
  for (const [attributes, staysPut] of [[{ indirect: true }, true], [{}, false]]) {
    const game = makeGame({ units: { gun: { range: [2, 2], attributes, hits: 60 }, foe: {} }, rows: ['.....'], unitsOnMap: [['gun', 0, 2, 0], ['foe', 1, 4, 0]] });
    const [unit, foe] = game.state.units;
    const spot = bestAttackTile(game, unit, foe, computeReach(game, unit));
    assert.deepEqual(spot, [2, 0], 'staying put is always preferred when it is in range');
    // Move the foe out of range from the current tile: a direct unit may reposition, an indirect one may not.
    foe.x = 0;
    foe.y = 0;
    foe.x = 4;
    const far = makeGame({ units: { gun: { range: [2, 2], attributes, hits: 60 }, foe: {} }, rows: ['......'], unitsOnMap: [['gun', 0, 0, 0], ['foe', 1, 5, 0]] });
    const [g2, f2] = far.state.units;
    const repositioned = bestAttackTile(far, g2, f2, computeReach(far, g2));
    if (staysPut) assert.equal(repositioned, null, 'indirect units never reposition to fire');
    else assert.ok(repositioned && repositioned[0] === 3, 'a direct unit walks to a tile at range 2');
  }
});

test('indirect: attribute requires a minimum range of at least 2 (data validation)', async () => {
  const { createRegistry } = await import('../../src/data/registry.js');
  const { makeData } = await import('../helpers/fixtures.js');
  assert.throws(() => createRegistry(makeData({ units: { bad: { range: [1, 3], attributes: { indirect: true } } } })), /requires every weapon to have a minimum range of at least 2/);
});

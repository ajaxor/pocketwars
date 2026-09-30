// Line of sight for direct fire: which terrain blocks, what a high position changes, and that indirect fire ignores all of it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, ordersFor } from '../helpers/fixtures.js';
import { tilesBetween } from '../../src/engine/sight.js';
import { attackProblem, calcDamage, canAttackFrom, canCounter, weaponFor } from '../../src/engine/combat.js';
import { bestAttackTile, computeReach, targetsFrom } from '../../src/engine/movement.js';

// One shooter (player 0, unit 0) and one foe (player 1, unit 1) on a map made of `rows`. Terrain glyphs: . plain, F forest,
// M mountain, c city (a building), r road. `mode` is the weapon's target mode.
const scene = (rows, from, to, mode = 'direct_ground', extra = []) => makeGame({
  units: { shooter: { range: [1, 4], targets: [mode], hits: 60 }, foe: { range: [1, 4], hits: 60 }, bystander: {} },
  rows, unitsOnMap: [['shooter', 0, ...from], ['foe', 1, ...to], ...extra],
});
const clear = (rows, from, to, mode) => { const g = scene(rows, from, to, mode); return canAttackFrom(g, g.state.units[0], g.state.units[1], from[0], from[1]); };

test('tilesBetween: the tiles strictly between two tiles, the same whichever way round', () => {
  const key = (l) => l.map((t) => `${t.x},${t.y}`).join(' ');
  assert.deepEqual(tilesBetween({ x: 0, y: 0 }, { x: 1, y: 0 }), [], 'neighbours have nothing between them');
  assert.deepEqual(tilesBetween({ x: 0, y: 0 }, { x: 1, y: 1 }), [], 'a diagonal step has nothing between');
  assert.equal(key(tilesBetween({ x: 0, y: 0 }, { x: 3, y: 0 })), '1,0 2,0');
  assert.equal(key(tilesBetween({ x: 2, y: 1 }, { x: 2, y: 4 })), '2,2 2,3');
  for (const [a, b] of [[[0, 0], [3, 1]], [[4, 2], [0, 0]], [[1, 4], [3, 0]], [[0, 3], [2, 2]], [[5, 5], [2, 1]]]) {
    const p = { x: a[0], y: a[1] }, q = { x: b[0], y: b[1] };
    assert.equal(key(tilesBetween(p, q)), key(tilesBetween(q, p)), `${a} <-> ${b} cross the same tiles`);
    for (const t of tilesBetween(p, q)) assert.ok(!(t.x === p.x && t.y === p.y) && !(t.x === q.x && t.y === q.y), 'never includes the ends');
  }
});

test('direct fire: an open line is fine; forests, mountains and buildings in between block it', () => {
  assert.equal(clear(['...'], [0, 0], [2, 0]), true);
  assert.equal(clear(['.F.'], [0, 0], [2, 0]), false, 'forest');
  assert.equal(clear(['.M.'], [0, 0], [2, 0]), false, 'mountain');
  assert.equal(clear(['.c.'], [0, 0], [2, 0]), false, 'building');
  assert.equal(clear(['.r.'], [0, 0], [2, 0]), true, 'road does not block');
  assert.equal(clear(['..F.'], [0, 0], [3, 0]), false, 'any tile in between');
});

test('direct fire: the tiles at either end never block, and neither does an adjacent target', () => {
  assert.equal(clear(['F.F'], [0, 0], [2, 0]), true, 'shooter and target both in forest');
  assert.equal(clear(['M.M'], [0, 0], [2, 0]), true);
  assert.equal(clear(['c.c'], [0, 0], [2, 0]), true, 'shooter and target on buildings');
  assert.equal(clear(['FF'], [0, 0], [1, 0]), true);
});

test('direct fire: units never block a shot', () => {
  for (const owner of [0, 1]) {
    const g = scene(['...'], [0, 0], [2, 0], 'direct_ground', [['bystander', owner, 1, 0]]);
    assert.equal(canAttackFrom(g, g.state.units[0], g.state.units[1], 0, 0), true, `a unit of player ${owner} in between`);
  }
});

test('vantage: a unit on a mountain sees over forests, but not over mountains or buildings', () => {
  assert.equal(clear(['MF.'], [0, 0], [2, 0]), true, 'mountain over forest');
  assert.equal(clear(['MM.'], [0, 0], [2, 0]), false, 'mountain over mountain');
  assert.equal(clear(['Mc.'], [0, 0], [2, 0]), false, 'mountain over building');
  assert.equal(clear(['FF.'], [0, 0], [2, 0]), false, 'a unit in a forest gets no vantage');
  assert.equal(clear(['cF.'], [0, 0], [2, 0]), false, 'nor does a unit on a building');
  assert.equal(clear(['.F.'], [0, 0], [2, 0]), false, 'nor one on plain');
});

test('vantage only helps the shooter: a target on a mountain is not hidden and does not see over forests either', () => {
  assert.equal(clear(['.FM'], [0, 0], [2, 0]), false, 'plain shooter, forest between, target on a mountain');
  assert.equal(clear(['MF.'], [2, 0], [0, 0]), false, 'the same line fired the other way from plain is blocked');
});

test('a line that bends around the obstacle in two dimensions uses the tiles it crosses', () => {
  assert.equal(clear(['...', '.F.', '...'], [0, 0], [2, 2]), false, 'the diagonal crosses the middle forest');
  assert.equal(clear(['...', 'F..', '...'], [0, 0], [2, 2]), true, 'a forest off the diagonal does not matter');
});

test('indirect fire ignores obstacles', () => {
  assert.equal(clear(['.F.'], [0, 0], [2, 0], 'indirect_ground'), true);
  assert.equal(clear(['.M.'], [0, 0], [2, 0], 'indirect_ground'), true);
  assert.equal(clear(['.c.'], [0, 0], [2, 0], 'indirect_ground'), true);
});

test('attackProblem tells a blocked shot apart from one that is out of range or not allowed', () => {
  const g = scene(['.F.....'], [0, 0], [2, 0]);
  const [shooter, foe] = g.state.units;
  assert.equal(attackProblem(g, shooter, foe, 0, 0), 'no-line-of-sight');
  assert.equal(attackProblem(g, shooter, foe, 3, 0), null, 'from the far side the line is clear');
  assert.equal(attackProblem(g, shooter, foe, 7, 0), 'out-of-range', 'five tiles away, and the weapon reaches four');
});

test('an order that shoots through an obstacle is refused with no-line-of-sight', () => {
  const g = scene(['.F.'], [0, 0], [2, 0]);
  const r = g.act(ordersFor(g, 0, { x: 0, y: 0 }, { type: 'attack', targetId: g.state.units[1].id }));
  assert.equal(r.error, 'no-line-of-sight');
  const indirect = scene(['.F.'], [0, 0], [2, 0], 'indirect_ground');
  assert.equal(indirect.act(ordersFor(indirect, 0, { x: 0, y: 0 }, { type: 'attack', targetId: indirect.state.units[1].id })).ok, true);
});

test('targetsFrom only lists targets that can actually be hit from that tile', () => {
  const g = scene(['.F...'], [0, 0], [2, 0]);
  assert.deepEqual(targetsFrom(g, g.state.units[0], 0, 0), []);
  assert.equal(targetsFrom(g, g.state.units[0], 3, 0).length, 1, 'from the other side of the forest');
});

test('a blocked defender cannot counterattack either', () => {
  const g = scene(['.F.'], [0, 0], [2, 0]);
  const [shooter, foe] = g.state.units;
  assert.equal(canCounter(g, foe, shooter), false);
  const open = scene(['...'], [0, 0], [2, 0]);
  assert.equal(canCounter(open, open.state.units[1], open.state.units[0]), true);
});

test('bestAttackTile finds a tile with a clear line, not just one in range', () => {
  const g = makeGame({
    units: { shooter: { move: 4, range: [2, 2], hits: 60 }, foe: {} },
    rows: ['.F.....', '.......'], unitsOnMap: [['shooter', 0, 0, 0], ['foe', 1, 2, 0]],   // the second row is the way round the foe
  });
  const [shooter, foe] = g.state.units;
  const spot = bestAttackTile(g, shooter, foe, computeReach(g, shooter));
  assert.ok(spot, 'there is a way to hit it');
  assert.ok(canAttackFrom(g, shooter, foe, spot[0], spot[1]));
  assert.notDeepEqual(spot, [0, 0], 'standing behind the forest will not do');
});

test('damage is computed with the weapon fired from the tile the attacker will stand on', () => {
  const g = makeGame({
    units: { mixed: { weapons: ['gun', 'mortar'] }, foe: {} },
    weapons: {
      gun: { name: 'Gun', damage: 40, range: [1, 1], targets: ['direct_ground'] },
      mortar: { name: 'Mortar', damage: 100, range: [2, 3], targets: ['indirect_ground'] },
    },
    rows: ['....'], unitsOnMap: [['mixed', 0, 0, 0], ['foe', 1, 1, 0]],
  });
  const [mixed, foe] = g.state.units;
  assert.equal(weaponFor(g, mixed, foe)?.name, 'Gun', 'adjacent: the first weapon that fits');
  assert.equal(weaponFor(g, mixed, foe, { x: 3, y: 0 })?.name, 'Mortar', 'from range 2 the mortar is the only one that fits');
  assert.equal(calcDamage(g, mixed, foe), 4, '40 * 0.9 / 10 (plain has 1 star in the fixtures)');
  assert.equal(calcDamage(g, mixed, foe, { x: 3, y: 0 }), 9, '100 * 0.9 / 10');
  assert.equal(weaponFor(g, mixed, foe, { x: 0, y: 5 }), null, 'out of reach of both');
  assert.equal(calcDamage(g, mixed, foe, { x: 0, y: 5 }), 0);
});

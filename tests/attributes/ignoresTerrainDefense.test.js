// Attribute: unit `ignoresTerrainDefense`
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame } from '../helpers/fixtures.js';
import { calcDamage } from '../../src/engine/combat.js';

const damageOn = (glyph, attributes) => {
  const game = makeGame({
    units: { hitter: { hits: 60 }, target: { attributes } },
    rows: [`.${glyph}`], unitsOnMap: [['hitter', 0, 0, 0], ['target', 1, 1, 0]],
  });
  const [hitter, target] = game.state.units;
  return calcDamage(game, hitter, target);
};

test('ignoresTerrainDefense: terrain stars reduce damage to a normal unit', () => {
  // 60 * 10/10 * (1 - stars*10/100) / 10
  assert.equal(damageOn('.', {}), 5, 'plain = 1 star -> 5.4 -> 5');
  assert.equal(damageOn('F', {}), 5, 'forest = 2 stars -> 4.8 -> 5');
  assert.equal(damageOn('M', {}), 4, 'mountain = 4 stars -> 3.6 -> 4');
  assert.equal(damageOn('r', {}), 6, 'road = 0 stars -> 6');
});

test('ignoresTerrainDefense: the attribute removes the reduction on every terrain', () => {
  for (const glyph of ['.', 'F', 'M', 'r']) assert.equal(damageOn(glyph, { ignoresTerrainDefense: true }), 6, `terrain ${glyph}`);
});

test('ignoresTerrainDefense: identical units differ ONLY by the attribute on defensive terrain', () => {
  assert.ok(damageOn('M', { ignoresTerrainDefense: true }) > damageOn('M', {}));
});

test('ignoresTerrainDefense: applies to the DEFENDER only (an attacker on a mountain is unaffected)', () => {
  const game = makeGame({
    units: { hitter: { hits: 60, attributes: { ignoresTerrainDefense: true } }, target: {} },
    rows: ['M.'], unitsOnMap: [['hitter', 0, 0, 0], ['target', 1, 1, 0]],
  });
  const [hitter, target] = game.state.units;
  assert.equal(calcDamage(game, hitter, target), 5, 'target on plain (1 star) still gets its bonus');
});

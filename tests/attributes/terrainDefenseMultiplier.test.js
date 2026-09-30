// Attribute: unit `terrainDefenseMultiplier`
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, makeData } from '../helpers/fixtures.js';
import { calcDamage, terrainStars } from '../../src/engine/combat.js';
import { validateData } from '../../src/data/validate.js';

const setup = (glyph, attributes) => {
  const game = makeGame({
    units: { hitter: { hits: 60 }, target: { attributes } },
    rows: [`.${glyph}`], unitsOnMap: [['hitter', 0, 0, 0], ['target', 1, 1, 0]],
  });
  const [hitter, target] = game.state.units;
  return { game, hitter, target };
};
const damageOn = (glyph, attributes) => { const { game, hitter, target } = setup(glyph, attributes); return calcDamage(game, hitter, target); };

test('terrainDefenseMultiplier: doubles the terrain stars the unit gets', () => {
  assert.equal(terrainStars(setup('F', {}).game, setup('F', {}).target), 2);
  const { game, target } = setup('F', { terrainDefenseMultiplier: 2 });
  assert.equal(terrainStars(game, target), 4, 'forest 2 -> 4');
  const m = setup('M', { terrainDefenseMultiplier: 2 });
  assert.equal(terrainStars(m.game, m.target), 8, 'mountain 4 -> 8');
});

test('terrainDefenseMultiplier: cuts damage on defensive terrain, compared with an identical unit without it', () => {
  // 60 * (1 - stars*10/100) / 10
  assert.equal(damageOn('F', {}), 5, 'forest 2 stars -> 4.8');
  assert.equal(damageOn('F', { terrainDefenseMultiplier: 2 }), 4, 'forest 4 stars -> 3.6');
  assert.equal(damageOn('M', {}), 4, 'mountain 4 stars -> 3.6');
  assert.equal(damageOn('M', { terrainDefenseMultiplier: 2 }), 1, 'mountain 8 stars -> 1.2');
});

test('terrainDefenseMultiplier: does nothing where the terrain gives no defense', () => {
  assert.equal(damageOn('r', { terrainDefenseMultiplier: 2 }), damageOn('r', {}), 'road = 0 stars');
});

test('terrainDefenseMultiplier: ignoresTerrainDefense still wins', () => {
  assert.equal(damageOn('M', { terrainDefenseMultiplier: 2, ignoresTerrainDefense: true }), 6);
});

test('terrainDefenseMultiplier: applies to the DEFENDER only', () => {
  const game = makeGame({
    units: { hitter: { hits: 60, attributes: { terrainDefenseMultiplier: 2 } }, target: {} },
    rows: ['M.'], unitsOnMap: [['hitter', 0, 0, 0], ['target', 1, 1, 0]],
  });
  const [hitter, target] = game.state.units;
  assert.equal(calcDamage(game, hitter, target), 5, 'the target on plain (1 star) gets its normal bonus; the multiplier belongs to whoever defends');
});

test('terrainDefenseMultiplier: must be a number greater than 1', () => {
  for (const bad of [true, 1, 0.5, 'two', -2]) {
    const d = makeData(); d.units.a.attributes.terrainDefenseMultiplier = bad;
    assert.ok(validateData(d).some((p) => /terrainDefenseMultiplier/.test(p)), `rejects ${JSON.stringify(bad)}`);
  }
  const ok = makeData(); ok.units.a.attributes.terrainDefenseMultiplier = 2;
  assert.deepEqual(validateData(ok), []);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeData } from '../helpers/fixtures.js';
import { validateData, DataError } from '../../src/data/validate.js';
import { createRegistry } from '../../src/data/registry.js';

const problemsOf = (mutate, opts) => { const d = makeData(opts); mutate(d); return validateData(d); };
const has = (problems, re) => assert.ok(problems.some((p) => re.test(p)), `expected a problem matching ${re}, got:\n${problems.join('\n')}`);

test('the fixture bundle is valid', () => assert.deepEqual(validateData(makeData()), []));

test('unknown attributes are rejected on units and terrain', () => {
  has(problemsOf((d) => { d.units.a.attributes.teleports = true; }), /teleports/);
  has(problemsOf((d) => { d.terrain.plain.attributes.lava = true; }), /lava/);
});

test('attributes that belong to the other kind of entity are rejected', () => {
  has(problemsOf((d) => { d.units.a.attributes.property = {}; }), /property/);
  has(problemsOf((d) => { d.terrain.plain.attributes.capture = true; }), /capture/);
});

test('terrain must give a move cost (or null) for every move class', () => {
  has(problemsOf((d) => { delete d.terrain.plain.moveCost.air; }), /missing move class "air"/);
  has(problemsOf((d) => { d.terrain.plain.moveCost.hover = 1; }), /unknown move class "hover"/);
  has(problemsOf((d) => { d.terrain.plain.moveCost.foot = 0; }), /positive number or null/);
});

test('property attribute config is checked', () => {
  has(problemsOf((d) => { d.terrain.city.attributes.property.capturePoints = 0; }), /property/);
  has(problemsOf((d) => { d.terrain.base.attributes.property.builds = ['nonexistent']; }), /unknown unit category "nonexistent"/);
});

test('victoryOnCapture requires the property attribute', () => {
  has(problemsOf((d) => { d.terrain.plain.attributes.victoryOnCapture = true; }), /victoryOnCapture/);
});

test('units: unknown moveClass and layer', () => {
  has(problemsOf((d) => { d.units.a.moveClass = 'swim'; }), /unknown moveClass "swim"/);
  has(problemsOf((d) => { d.units.a.layer = 'space'; }), /unknown layer "space"/);
});

test('units: weapons must exist; toughness and armor must be in range', () => {
  has(problemsOf((d) => { d.units.a.weapons = ['ghost']; }), /unit "a": weapons must be a list of weapon ids/);
  has(problemsOf((d) => { d.units.a.weapons = 'a'; }), /weapons must be a list/);
  has(problemsOf((d) => { d.units.a.toughness = 0; }), /toughness must be a positive number/);
  has(problemsOf((d) => { d.units.a.armor = 1.5; }), /armor must be a number from 0 to 1/);
  has(problemsOf((d) => { d.units.a.armor = -0.1; }), /armor must be a number from 0 to 1/);
  assert.deepEqual(problemsOf((d) => { d.units.a.weapons = []; d.units.a.toughness = 2.5; d.units.a.armor = 1; }), [], 'an unarmed, very tough unit is fine');
});

test('weapons: damage, armorPiercing, range and target modes are checked', () => {
  has(problemsOf((d) => { d.weapons.a.damage = 0; }), /weapon "a": damage must be a positive number/);
  has(problemsOf((d) => { d.weapons.a.name = ''; }), /weapon "a": name is required/);
  has(problemsOf((d) => { d.weapons.a.armorPiercing = 1.2; }), /armorPiercing must be a number from 0 to 1/);
  has(problemsOf((d) => { d.weapons.a.range = [3, 1]; }), /weapon "a": range/);
  has(problemsOf((d) => { d.weapons.a.range = [0, 1]; }), /weapon "a": range/);
  has(problemsOf((d) => { d.weapons.a.targets = []; }), /targets must be a non-empty list of known target modes/);
  has(problemsOf((d) => { d.weapons.a.targets = ['moon']; }), /known: direct_ground, indirect_ground, sky/);
  assert.deepEqual(problemsOf((d) => { delete d.weapons.a.armorPiercing; }), [], 'armorPiercing is optional');
});

test('rules: every target mode needs a known layer', () => {
  has(problemsOf((d) => { d.rules.targetModes.weird = { layer: 'nowhere' }; }), /target mode "weird" refers to unknown layer "nowhere"/);
  has(problemsOf((d) => { d.rules.targetModes.weird = { layer: 'ground', lineOfSight: 'yes' }; }), /lineOfSight must be a boolean/);
  has(problemsOf((d) => { delete d.rules.targetModes; }), /targetModes must be a non-empty object/);
});

test('terrain: blocksLineOfSight and vantage must be positive numbers', () => {
  for (const name of ['blocksLineOfSight', 'vantage']) {
    has(problemsOf((d) => { d.terrain.plain.attributes[name] = 0; }), new RegExp(`${name}" must be a positive number`));
    has(problemsOf((d) => { d.terrain.plain.attributes[name] = true; }), new RegExp(`${name}" must be a positive number`));
    assert.deepEqual(problemsOf((d) => { d.terrain.plain.attributes[name] = 3; }), []);
  }
});

test('ai profile: unknown unit, wrong category, unknown condition, bad max', () => {
  const build = (rule) => (d) => { d.ai.build = { ground: [rule] }; };
  has(problemsOf(build({ unit: 'ghost', max: 1 })), /unknown unit "ghost"/);
  has(problemsOf(build({ unit: 'a', max: 0 })), /max/);
  has(problemsOf(build({ unit: 'a', max: 1, when: 'moonIsFull' })), /unknown condition "moonIsFull"/);
  has(problemsOf((d) => { d.ai.build = { sky: [{ unit: 'a', max: 1 }] }; }), /category "ground", not "sky"/);
});

test('every problem is reported at once, not just the first', () => {
  const problems = problemsOf((d) => {
    d.units.a.moveClass = 'swim';
    d.terrain.plain.moveCost.foot = -1;
    d.rules.maxHp = 0;
  });
  assert.ok(problems.length >= 3, problems.join('\n'));
});

test('createRegistry throws a DataError listing the problems, and returns frozen data when valid', () => {
  const bad = makeData(); bad.units.a.attributes.nope = true;
  assert.throws(() => createRegistry(bad), (e) => e instanceof DataError && e.problems.length >= 1 && /nope/.test(e.message));
  const reg = createRegistry(makeData());
  assert.ok(Object.isFrozen(reg));
  assert.throws(() => { 'use strict'; reg.unit('a').cost = 1; }, TypeError);
});

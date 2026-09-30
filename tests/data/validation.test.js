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

test('terrain render.height is optional but must be between 0 and 1', () => {
  assert.deepEqual(problemsOf((d) => { d.terrain.plain.render.height = 0.5; }), []);
  has(problemsOf((d) => { d.terrain.plain.render.height = 2; }), /render\.height/);
  has(problemsOf((d) => { d.terrain.plain.render.height = 'tall'; }), /render\.height/);
});

test('victoryOnCapture requires the property attribute', () => {
  has(problemsOf((d) => { d.terrain.plain.attributes.victoryOnCapture = true; }), /victoryOnCapture/);
});

test('units: unknown moveClass, layer, and bad range', () => {
  has(problemsOf((d) => { d.units.a.moveClass = 'swim'; }), /unknown moveClass "swim"/);
  has(problemsOf((d) => { d.units.a.layer = 'space'; }), /unknown layer "space"/);
  has(problemsOf((d) => { d.units.a.range = [3, 1]; }), /range/);
});

test('damage table must agree with targetLayers', () => {
  has(problemsOf((d) => { delete d.units.a.damage.b; }), /no damage entry vs "b"/);
  has(problemsOf((d) => { d.units.a.damage.ghost = 10; }), /unknown unit "ghost"/);
  has(problemsOf((d) => { d.units.a.damage.b = 0; }), /positive number/);
  has(problemsOf((d) => { d.units.a.targetLayers = ['sky']; }), /cannot target layer "ground"/);
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

// The shipped rules of the drafted units that are not covered by an attribute test of their own.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry } from '../../src/data/loader.js';
import { canFireAfterMoving } from '../../src/engine/movement.js';
import { hasAttribute } from '../../src/engine/attributes.js';

const registry = await loadRegistry(readData);
const unit = (id) => registry.unit(id);
const weaponsOf = (id) => unit(id).weapons.map((w) => registry.weapons[w]);

test('the spy is stealth infantry that captures: expensive, fragile, with a weak pistol, and no special orders', () => {
  const spy = unit('spy');
  assert.ok(hasAttribute(spy, 'cloak') && hasAttribute(spy, 'capture'));
  assert.ok(!hasAttribute(spy, 'heal'));
  assert.ok(spy.cost > unit('soldier').cost && spy.cost >= unit('mech').cost, 'dearer than the soldier');
  assert.ok(weaponsOf('spy')[0].damage < registry.weapons.rifle.damage, 'weaker than a rifle');
});

test('the medic has a weak attack, the mechanic is unarmed, and both heal by order', () => {
  assert.ok(hasAttribute(unit('medic'), 'heal') && hasAttribute(unit('mechanic'), 'heal'));
  assert.equal(unit('mechanic').weapons.length, 0);
  assert.equal(weaponsOf('medic').length, 1);
  assert.ok(weaponsOf('medic')[0].damage <= registry.weapons.pistol.damage);
});

test('the RPG trooper is anti-vehicle infantry: one rocket, range 2-3, can move and fire, hits low aircraft, captures', () => {
  const rpg = unit('rpg_trooper');
  assert.equal(rpg.attributes.ammo.max, 1);
  assert.deepEqual(weaponsOf('rpg_trooper')[0].range, [2, 3]);
  assert.equal(weaponsOf('rpg_trooper')[0].armorPiercing, 1);
  assert.ok(hasAttribute(rpg, 'capture') && !hasAttribute(rpg, 'indirect'));
  assert.ok(canFireAfterMoving({ registry }, { type: 'rpg_trooper' }), 'a single rocket is no reason to stand still');
  assert.ok(weaponsOf('rpg_trooper')[0].targets.includes('low_air'));
});

test('the stealth copter is a cloaked copter with a copter\'s weapon and less toughness', () => {
  const sc = unit('stealth_copter'), copter = unit('copter');
  assert.ok(hasAttribute(sc, 'cloak'));
  assert.deepEqual(sc.weapons, copter.weapons);
  assert.equal(sc.layer, copter.layer);
  assert.ok(sc.toughness < copter.toughness);
});

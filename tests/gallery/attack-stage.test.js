// The gallery's Attacks tab: which target each weapon is shown against, and the look each weapon has.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry } from '../../src/data/loader.js';
import { attackStage, attackList } from '../../gallery/attack-stage.js';
import { attackSpec, ATTACK_FX_NAMES } from '../../src/render/attack-fx.js';

const registry = await loadRegistry(readData);

test('anti-air weapons are shown against a plane, torpedoes and ship guns against a ship, the rest against a tank', () => {
  assert.equal(attackStage(registry, 'sam_launcher', 'sam').target, 'fighter');
  assert.equal(attackStage(registry, 'flak', 'flak_cannon').target, 'tank', 'flak also hits the ground');
  assert.equal(attackStage(registry, 'submarine', 'torpedoes').target, 'destroyer');
  assert.equal(attackStage(registry, 'destroyer', 'depth_charges').target, 'submarine');
  assert.equal(attackStage(registry, 'soldier', 'rifle').target, 'tank');
  assert.equal(attackStage(registry, 'artillery', 'howitzer').distance, 3, 'long range is shown at three tiles, not the full range');
  assert.equal(attackStage(registry, 'soldier', 'rifle').distance, 1);
  assert.ok(attackStage(registry, 'destroyer', 'deck_gun').attackerWater);
});

test('every armed unit in the game is listed, with a stage per weapon, and a known look for each', () => {
  const { armed, unarmed } = attackList(registry);
  const listed = new Set([...armed, ...unarmed].map((u) => u.id));
  for (const id of registry.unitIds) if (!registry.unit(id).render.inWall) assert.ok(listed.has(id), `${id} is not in the Attacks tab`);
  for (const u of armed) {
    assert.equal(u.stages.length, registry.unit(u.id).weapons.length, `${u.id}: one stage per weapon`);
    for (const s of u.stages) assert.ok(ATTACK_FX_NAMES.includes(registry.weapon(s.weapon).fx), `${s.weapon}: attack look`);
  }
  assert.ok(unarmed.some((u) => u.id === 'supply_truck'));
});

test('attackSpec: each look has a duration and lands its blow before it ends; unknown names fall back to a bullet', () => {
  for (const name of ATTACK_FX_NAMES) { const s = attackSpec(name); assert.ok(s.hit > 0 && s.hit <= s.d, name); }
  assert.equal(attackSpec('nonsense').name, 'bullet');
  assert.equal(attackSpec('arc').name, 'shell');
  assert.equal(attackSpec('slash').lunge, true);
});

test('automatic weapons fire bursts, and an air-to-air missile drops from the wing before it flies', () => {
  for (const w of ['machine_gun', 'commando_rifle', 'marine_rifle', 'bike_rifle', 'boat_mg', 'wing_guns']) assert.equal(registry.weapon(w).fx, 'burst', w);
  for (const w of ['air_missiles', 'stealth_missiles']) assert.equal(registry.weapon(w).fx, 'air_missile', w);
  assert.equal(registry.weapon('tank_missiles').fx, 'missile', 'ground-launched missiles still climb first');
});

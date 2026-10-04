// A weapon with `fromTerrain` can only be fired from those terrains: the marine's boarding rifle hits ships, but only from the water.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame } from '../helpers/fixtures.js';
import { attackProblem, weaponFor } from '../../src/engine/combat.js';

const rules = { maxHp: 10, neutralColor: '#999999', moveClasses: ['foot', 'wheel', 'air'], layers: { ground: { label: null }, surface: { label: null } }, targetModes: { direct_ground: { layer: 'ground', lineOfSight: true }, surface: { layer: 'surface' } } };
const terrain = { sea: { name: 'Sea', defense: 0, moveCost: { foot: 1, wheel: 1, air: 1 }, attributes: {}, render: { base: '#3d7ec7', water: true } } };
const units = { marine: { weapons: ['boarding'] }, ship: { layer: 'surface', hits: 1 } };
const weapons = { boarding: { name: 'Boarding', damage: 40, armorPiercing: 0, range: [1, 1], targets: ['surface'], fromTerrain: ['sea'] } };
const game = (rows) => makeGame({ units, terrain, rules, weapons, rows, unitsOnMap: [['marine', 0, 1, 0], ['ship', 1, 2, 0]] });

test('fromTerrain: the weapon fires from the water but not from the land', () => {
  const wet = game(['H~~~h']), dry = game(['H.~~h']);
  assert.ok(weaponFor(wet, wet.state.units[0], wet.state.units[1]), 'a marine afloat can board a ship');
  assert.equal(weaponFor(dry, dry.state.units[0], dry.state.units[1]), null, 'ashore it cannot');
  assert.equal(attackProblem(dry, dry.state.units[0], dry.state.units[1]), 'wrong-terrain');
  assert.equal(attackProblem(wet, wet.state.units[0], wet.state.units[1]), null);
});

test('fromTerrain: moving into the water makes the attack possible in one order', () => {
  const g = game(['H.~~h']);
  const [m, ship] = g.state.units;
  assert.equal(g.act({ unitId: m.id, to: { x: 1, y: 0 }, action: { type: 'attack', targetId: ship.id } }).ok, false);
  const wet = game(['H~~~h']);
  assert.equal(wet.act({ unitId: wet.state.units[0].id, to: { x: 1, y: 0 }, action: { type: 'attack', targetId: wet.state.units[1].id } }).ok, true);
});

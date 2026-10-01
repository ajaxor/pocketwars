// Unit attribute `ammo` and terrain attribute `resupply`: a limited supply, spent by weapons and refilled next to a friendly airfield.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame } from '../helpers/fixtures.js';
import { ammoLevel, ammoOf, resupplySource } from '../../src/engine/ammo.js';
import { startTurn } from '../../src/engine/economy.js';
import { attackTiles } from '../../src/engine/movement.js';
import { weaponFor } from '../../src/engine/combat.js';

const flat = { foot: 1, wheel: 1, air: 1 };
const airfield = { name: 'Airfield', defense: 3, moveCost: flat, attributes: { property: { income: 0, capturePoints: 20, repair: 0, builds: [] }, resupply: { range: 1, categories: ['air'] } }, render: { base: '#000000' } };
const gun = { name: 'Bombs', damage: 50, armorPiercing: 0, range: [1, 1], targets: ['direct_ground'], ammo: 1 };
// 'A' is a player-0 airfield, built from the standard legend plus this entry
const legend = { '.': { terrain: 'plain' }, A: { terrain: 'airfield', owner: 0 }, B: { terrain: 'airfield', owner: 1 }, h: { terrain: 'hq', owner: 1 }, H: { terrain: 'hq', owner: 0 } };
const game = (rows, unitsOnMap, max = 2, low = 1) => makeGame({
  units: { flyer: { category: 'air', moveClass: 'air', layer: 'ground', move: 3, attributes: { ammo: { max, low } } }, grunt: {} },
  weapons: { flyer: gun }, terrain: { airfield }, legend, rows, unitsOnMap,
});

test('ammo: a unit starts full, and its level is ok / low / empty by the configured threshold', () => {
  const g = game(['H...h'], [['flyer', 0, 1, 0], ['grunt', 1, 4, 0]], 3, 1);
  const u = g.state.units[0];
  assert.equal(ammoOf(g, u), 3);
  assert.equal(ammoLevel(g, u), 'ok');
  u.ammo = 2; assert.equal(ammoLevel(g, u), 'ok');
  u.ammo = 1; assert.equal(ammoLevel(g, u), 'low');
  u.ammo = 0; assert.equal(ammoLevel(g, u), 'empty');
  assert.equal(ammoLevel(g, g.state.units[1]), null, 'a unit without the attribute has no ammo to show');
});

test('ammo: a weapon with an ammo cost spends it, and a unit that is out cannot attack', () => {
  const g = game(['H...h'], [['flyer', 0, 1, 0], ['grunt', 1, 2, 0], ['grunt', 1, 4, 0]], 2, 1);
  const [u, foe] = g.state.units;
  assert.equal(g.act({ unitId: u.id, to: { x: 1, y: 0 }, action: { type: 'attack', targetId: foe.id } }).ok, true);
  assert.equal(u.ammo, 1);
  u.done = false; u.ammo = 0;
  assert.equal(weaponFor(g, u, foe), null, 'no ammo, no weapon');
  assert.equal(attackTiles(g, u).size, 0, 'and nothing to show as attackable');
  assert.equal(g.act({ unitId: u.id, to: { x: 1, y: 0 }, action: { type: 'attack', targetId: foe.id } }).ok, false);
});

test('resupply: the Resupply action next to a friendly airfield refills the unit and ends its turn; Wait takes on nothing', () => {
  const g = game(['H.A..h'], [['flyer', 0, 4, 0, 10], ['grunt', 1, 5, 0]], 3, 1);
  const u = g.state.units[0];
  u.ammo = 0;
  assert.equal(resupplySource(g, u, 3, 0).x, 2, 'next to the airfield');
  assert.equal(g.act({ unitId: u.id, to: { x: 3, y: 0 }, action: { type: 'wait' } }).ok, true);
  assert.equal(u.ammo, 0, 'a plain Wait takes on nothing');
  u.done = false;
  const res = g.act({ unitId: u.id, to: { x: 3, y: 0 }, action: { type: 'resupply' } });
  assert.equal(res.ok, true);
  assert.equal(u.ammo, 3, 'refilled');
  assert.equal(u.done, true, 'and that is its turn: no refreshed movement');
  assert.equal(res.refreshed, undefined);
  assert.ok(res.events.some((e) => e.type === 'resupply' && e.from === 0 && e.to === 3));
});

test('resupply: not from an enemy airfield, from a far one, or when already full', () => {
  const g = game(['H.A.B.h'], [['flyer', 0, 4, 0], ['flyer', 0, 0, 0], ['grunt', 1, 6, 0]], 3, 1);
  const [near, far] = g.state.units;
  near.ammo = 0; far.ammo = 0;
  assert.equal(resupplySource(g, near, 3, 0).owner, 0, 'the friendly one, not the enemy one next to it');
  assert.equal(resupplySource(g, far, 0, 0), null, 'too far');
  assert.equal(g.act({ unitId: far.id, to: { x: 0, y: 0 }, action: { type: 'resupply' } }).error, 'cannot-resupply', 'nothing in reach');
  near.ammo = 3;
  assert.equal(g.act({ unitId: near.id, to: { x: 3, y: 0 }, action: { type: 'resupply' } }).error, 'cannot-resupply', 'already full: nothing to take on');
});

test('resupply: an attack uses the turn, so it cannot be a pit stop', () => {
  const g = game(['H.A.h'], [['flyer', 0, 1, 0], ['grunt', 1, 3, 0], ['grunt', 1, 4, 0]], 3, 1);
  const [u, foe] = g.state.units;
  u.ammo = 1;
  const res = g.act({ unitId: u.id, to: { x: 2, y: 0 }, action: { type: 'attack', targetId: foe.id } });
  assert.equal(res.ok, true);
  assert.equal(u.done, true);
  assert.equal(u.ammo, 0);
});

test('resupply: nothing is refilled automatically at the start of a turn', () => {
  const g = game(['H.A..h'], [['flyer', 0, 3, 0], ['grunt', 1, 5, 0]], 3, 1);
  const u = g.state.units[0];
  u.ammo = 0;
  const [ev] = startTurn(g, 0);
  assert.equal(u.ammo, 0);
  assert.equal(ev.resupplied, undefined);
});

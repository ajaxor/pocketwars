// Unit attribute `fuel`: a flyer burns a unit of fuel per tile, cannot go further than it has left, refuels for free at a friendly airfield,
// carrier or (helicopters) supply truck at the start of its owner's turn, and crashes when it begins a turn empty and is still dry at its end.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame } from '../helpers/fixtures.js';
import { fuelLevel, fuelOf } from '../../src/engine/fuel.js';
import { computeReach } from '../../src/engine/movement.js';

const flat = { foot: 1, wheel: 1, air: 1 };
const airfield = { name: 'Airfield', defense: 3, moveCost: flat, attributes: { property: { income: 0, capturePoints: 20, repair: 0, builds: [] }, resupply: { range: 1, categories: ['air'] } }, render: { base: '#000000' } };
const legend = { '.': { terrain: 'plain' }, A: { terrain: 'airfield', owner: 0 }, B: { terrain: 'airfield', owner: 1 }, h: { terrain: 'hq', owner: 1 }, H: { terrain: 'hq', owner: 0 } };
const units = {
  flyer: { category: 'air', moveClass: 'air', move: 6, attributes: { fuel: { max: 8, low: 3 } } },
  copter: { category: 'air', moveClass: 'air', move: 6, tags: ['helicopter'], attributes: { fuel: { max: 8, low: 3 } } },
  truck: { category: 'ground', move: 3, attributes: { supply: { categories: ['ground', 'air'], fuelTags: ['helicopter'] } } },
  grunt: {},
};
const game = (rows, unitsOnMap) => makeGame({ units, terrain: { airfield }, legend, rows, unitsOnMap });

test('fuel: a flyer starts full, burns a unit per TURN (flying or idle) and its level is ok / low / empty', () => {
  const g = game(['H.......h'], [['flyer', 0, 1, 0], ['grunt', 1, 8, 0]]);
  const u = g.state.units[0];
  assert.equal(fuelOf(g, u), 8);
  assert.equal(fuelLevel(g, u), 'ok');
  assert.equal(g.act({ unitId: u.id, to: { x: 5, y: 0 }, action: { type: 'wait' } }).ok, true);
  assert.equal(u.fuel, 8, 'flying costs nothing by itself');
  g.endTurn();
  assert.equal(u.fuel, 7, 'the turn ending burns one');
  u.fuel = 3; assert.equal(fuelLevel(g, u), 'low');
  u.fuel = 0; assert.equal(fuelLevel(g, u), 'empty');
  assert.equal(fuelLevel(g, g.state.units[1]), null, 'a unit without the attribute has no tank');
});

test('fuel: an idle flyer burns fuel too, and only its owner\'s turn ends burn it', () => {
  const g = game(['H.......h'], [['flyer', 0, 0, 0], ['flyer', 1, 4, 0]]);
  const [mine, theirs] = g.state.units;
  g.endTurn();
  assert.equal(mine.fuel, 7, 'never moved, still burned');
  assert.equal(theirs.fuel, 8, 'the other player\'s flyer has not had its turn end yet');
  g.endTurn();
  assert.equal(theirs.fuel, 7);
});

test('fuel: the tank never limits a move; a flyer can fly on empty, and the tank bottoms out at 0', () => {
  const g = game(['H.......h'], [['flyer', 0, 0, 0], ['grunt', 1, 8, 0]]);
  const u = g.state.units[0];
  u.fuel = 2;
  assert.equal(computeReach(g, u).has(5, 0), true, 'move 6 is all there is to count');
  u.fuel = 0;
  assert.equal(computeReach(g, u).has(6, 0), true, 'even a dry flyer moves');
  assert.equal(g.act({ unitId: u.id, to: { x: 4, y: 0 }, action: { type: 'wait' } }).ok, true);
  assert.equal(u.fuel, 0);
});

test('fuel: refuelled for free at the start of the owner\'s turn next to their airfield, not next to an enemy one or far away', () => {
  const g = game(['HA....B.h'], [['flyer', 0, 1, 0], ['flyer', 0, 2, 0], ['flyer', 0, 4, 0], ['grunt', 1, 8, 0]]);
  const [onField, nextToOwn, far] = g.state.units;
  for (const u of g.state.units.slice(0, 3)) u.fuel = 2;
  g.endTurn();
  const res = g.endTurn();
  assert.equal(onField.fuel, 8, 'on its own airfield');
  assert.equal(nextToOwn.fuel, 8, 'next to it');
  assert.equal(far.fuel, 1, 'burned one while idle; two tiles from its own airfield (the one beside it is the enemy\'s)');
  const start = res.events.find((e) => e.type === 'turnStart');
  assert.equal(start.refuelled.length, 2);
});

test('fuel: an enemy airfield does not refuel', () => {
  const g = game(['H....B..h'], [['flyer', 0, 4, 0], ['grunt', 1, 8, 0]]);
  g.state.units[0].fuel = 2;
  g.endTurn(); g.endTurn();
  assert.equal(g.state.units[0].fuel, 1, 'no refuel, just the two burns');
});

test('fuel: a flyer that begins its turn empty crashes when the turn ends; one that is refuelled meanwhile does not', () => {
  const g = game(['H.......h'], [['flyer', 0, 3, 0], ['flyer', 0, 5, 0], ['truck', 0, 4, 0], ['grunt', 1, 8, 0]]);
  const [doomed, saved, truck] = g.state.units;
  doomed.fuel = 0; saved.fuel = 0;
  g.endTurn();
  g.endTurn();   // player 0 again: both begin dry
  assert.equal(doomed.fuelOut, true);
  assert.equal(g.act({ unitId: doomed.id, to: { x: 3, y: 0 }, action: { type: 'wait' } }).ok, true);
  const res = g.endTurn();
  assert.deepEqual(res.events.filter((e) => e.type === 'crash').map((e) => e.unit.id), [doomed.id, saved.id], 'a truck does not refuel a plane (no fuelTags match), so both crash');
  assert.ok(!g.state.units.includes(doomed));
  assert.ok(truck && g.state.units.includes(truck));
});

test('fuel: a supply truck refuels helicopters (and only those), mid-turn and at the start of the turn', () => {
  const g = game(['H.......h'], [['copter', 0, 3, 0], ['flyer', 0, 5, 0], ['truck', 0, 4, 0], ['grunt', 1, 8, 0]]);
  const [copter, plane, truck] = g.state.units;
  copter.fuel = 0; plane.fuel = 0;
  g.endTurn(); g.endTurn();
  assert.equal(copter.fuel, 8, 'refuelled by the truck beside it at turn start');
  assert.equal(plane.fuel, 0, 'a plane is not');
  assert.equal(plane.fuelOut, true);
  // and by the Supply order, when the truck drives up to a dry helicopter
  copter.fuel = 1;
  assert.equal(g.act({ unitId: truck.id, to: { x: 4, y: 0 }, action: { type: 'supply' } }).ok, true);
  assert.equal(copter.fuel, 8);
  assert.equal(plane.fuel, 0);
});

// Unit attribute `fuel`: a flyer burns a unit of fuel per tile, cannot go further than it has left, refuels for free at a friendly airfield,
// carrier or (helicopters) supply truck at the start of its owner's turn, and when the tank is dry it cannot attack or use radar (it never crashes).
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame } from '../helpers/fixtures.js';
import { fuelLevel, fuelOf } from '../../src/engine/fuel.js';
import { computeReach } from '../../src/engine/movement.js';
import { canSee } from '../../src/engine/detection.js';

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

test('fuel: a flyer with an empty tank does not crash: it still moves, but cannot attack (or counterattack) until it is refuelled', () => {
  const g = game(['H.......h'], [['flyer', 0, 3, 0], ['grunt', 1, 4, 0], ['grunt', 1, 8, 0]]);
  const [dry, foe] = g.state.units;
  dry.fuel = 0;
  const before = foe.hp;
  assert.equal(g.act({ unitId: dry.id, to: { x: 3, y: 0 }, action: { type: 'attack', targetId: foe.id } }).ok, false, 'no attack on an empty tank');
  assert.equal(g.act({ unitId: dry.id, to: { x: 1, y: 0 }, action: { type: 'wait' } }).ok, true, 'but it can fly');
  const res = g.endTurn();
  assert.deepEqual(res.events.filter((e) => e.type === 'crash'), [], 'and it does not crash');
  assert.ok(g.state.units.includes(dry));
  assert.equal(foe.hp, before);
  g.state.units[0].fuel = 8;
  assert.equal(g.validateOrder({ unitId: dry.id, to: { x: 2, y: 0 }, action: { type: 'wait' } }).ok, g.currentPlayer === 0);
});

test('fuel: a dry radar plane loses its radar (it stops finding cloaked units)', () => {
  const cloaked = { category: 'ground', attributes: { cloak: true } };
  const radarFlyer = { category: 'air', moveClass: 'air', move: 6, attributes: { fuel: { max: 8, low: 3 }, radar: 3 } };
  const g = makeGame({ units: { ...units, cloaked, radarFlyer }, terrain: { airfield }, legend, rows: ['H.......h'], unitsOnMap: [['radarFlyer', 0, 1, 0], ['cloaked', 1, 3, 0], ['grunt', 1, 8, 0]] });
  const [radar, hidden] = g.state.units;
  assert.equal(canSee(g, 0, hidden), true, 'the radar finds it');
  radar.fuel = 0; g.touch();
  assert.equal(canSee(g, 0, hidden), false, 'a dry radar plane finds nothing');
});

test('fuel: a supply truck refuels helicopters (and only those), mid-turn and at the start of the turn', () => {
  const g = game(['H.......h'], [['copter', 0, 3, 0], ['flyer', 0, 5, 0], ['truck', 0, 4, 0], ['grunt', 1, 8, 0]]);
  const [copter, plane, truck] = g.state.units;
  copter.fuel = 0; plane.fuel = 0;
  g.endTurn(); g.endTurn();
  assert.equal(copter.fuel, 8, 'refuelled by the truck beside it at turn start');
  assert.equal(plane.fuel, 0, 'a plane is not');
  // and by the Supply order, when the truck drives up to a dry helicopter
  copter.fuel = 1;
  assert.equal(g.act({ unitId: truck.id, to: { x: 4, y: 0 }, action: { type: 'supply' } }).ok, true);
  assert.equal(copter.fuel, 8);
  assert.equal(plane.fuel, 0);
});

// Supply lines (October 2026): cities and the HQ resupply and repair every kind of unit, every fighting unit carries ammo, every vehicle, ship and
// aircraft carries fuel (vehicles and ships burn it only on turns they move), an empty tank halves the move and disarms, the supply truck refuels
// ground units, and the radar plane refuels aircraft (and nothing else, with no ammunition).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry } from '../../src/data/loader.js';
import { parseMap } from '../../src/data/map-format.js';
import { rawMap } from '../helpers/fixtures.js';
import { Game } from '../../src/engine/game.js';
import { ammoConfig, ammoOf, shotCost } from '../../src/engine/ammo.js';
import { fuelConfig, fuelOf, isOutOfFuel } from '../../src/engine/fuel.js';
import { computeReach } from '../../src/engine/movement.js';

const registry = await loadRegistry(readData);
const legend = { '.': { terrain: 'plain' }, r: { terrain: 'road' }, '~': { terrain: 'sea' }, H: { terrain: 'hq', owner: 0 }, h: { terrain: 'hq', owner: 1 }, c: { terrain: 'city', owner: 0 }, C: { terrain: 'city', owner: 1 } };
const players = [{ faction: 'ashmark', controller: 'human', funds: 50000 }, { faction: 'vantor_reach', controller: 'human', funds: 50000 }];
// an enemy soldier stands at the far end of the top row (keeping player 1 alive), just inside the enemy HQ
const world = (rows, unitsOnMap) => new Game(registry, parseMap(rawMap({ rows, unitsOnMap: [...unitsOnMap, ['soldier', 1, rows[0].length - 2, 0]], players, legend }), registry));
const turnOf = (g) => { g.endTurn(); g.endTurn(); };   // the other player passes, then player 0's turn starts again

test('cities and the HQ resupply every kind of unit and are not picky about who they repair', () => {
  for (const id of ['city', 'hq']) {
    const t = registry.terrain[id];
    assert.deepEqual([...t.attributes.resupply.categories].sort(), ['aircraft', 'amphibious', 'infantry', 'naval', 'vehicle'], `${id} resupplies every category`);
    assert.equal(t.attributes.resupply.range, 1, `${id}: on or next to it`);
    assert.equal(t.attributes.property.repairs, undefined, `${id} repairs everyone`);
  }
  const categories = new Set(registry.unitIds.map((u) => registry.unit(u).category).filter((c) => !['structure', 'mine'].includes(c)));
  for (const c of categories) assert.ok(registry.terrain.city.attributes.resupply.categories.includes(c), `a city serves ${c}`);
});

test('repair: a unit of any kind that starts its turn on a city is repaired, and a ship beside a coastal city too', () => {
  const g = world(['Hccc~~...h'], [['tank', 0, 1, 0, 5], ['missile_copter', 0, 2, 0, 5], ['soldier', 0, 3, 0, 5], ['destroyer', 0, 4, 0, 5]]);
  turnOf(g);
  for (const u of g.state.units.slice(0, 4)) assert.equal(u.hp, 7, `${u.type} repaired by the city it stands on or beside`);
});

test('resupply: next to a city every kind of unit takes on ammo and fuel for free, and it ends its turn', () => {
  for (const [type, x] of [['soldier', 1], ['tank', 1], ['missile_copter', 1], ['fighter', 1], ['destroyer', 3], ['submarine', 3]]) {
    const g = world(['H.c~~...h'], [[type, 0, x, 0]]);
    const u = g.state.units[0], funds = g.state.funds[0];
    u.ammo = 0; if (u.fuel !== undefined) u.fuel = 0;
    const res = g.act({ unitId: u.id, to: { x, y: 0 }, action: { type: 'resupply' } });
    assert.equal(res.ok, true, type);
    assert.equal(ammoOf(g, u), ammoConfig(g, u).max, `${type}: ammo refilled`);
    if (fuelConfig(g, u)) assert.equal(fuelOf(g, u), fuelConfig(g, u).max, `${type}: tank refilled`);
    assert.equal(g.state.funds[0], funds, `${type}: plain ammunition and fuel are free`);
    assert.equal(u.done, true, `${type}: Resupply ends the turn`);
  }
});

test('resupply: not from a city that is two tiles away or belongs to the enemy', () => {
  const g = world(['H...c.C...h'], [['tank', 0, 2, 0], ['tank', 0, 7, 0]]);
  for (const u of g.state.units.slice(0, 2)) {
    u.ammo = 0;
    assert.equal(g.act({ unitId: u.id, to: { x: u.x, y: 0 }, action: { type: 'resupply' } }).ok, false, `no friendly city in reach at x=${u.x}: the order is refused`);
    assert.equal(u.ammo, 0, `and nothing was refilled at x=${u.x}`);
  }
});

test('ammo: every fighting unit spends a round per shot and per counterattack, and a unit with none left cannot attack', () => {
  const g = world(['H.......h.'], [['soldier', 0, 1, 0], ['soldier', 1, 2, 0]]);
  const [a, d] = g.state.units;
  assert.equal(ammoOf(g, a), 9);
  assert.equal(g.act({ unitId: a.id, to: { x: 1, y: 0 }, action: { type: 'attack', targetId: d.id } }).ok, true);
  assert.equal(ammoOf(g, a), 8, 'the shot');
  assert.equal(ammoOf(g, d), 8, 'and the counterattack');
  const h = world(['H.......h.'], [['tank', 0, 1, 0], ['soldier', 1, 2, 0]]);
  h.state.units[0].ammo = 0;
  assert.equal(h.act({ unitId: h.state.units[0].id, to: { x: 1, y: 0 }, action: { type: 'attack', targetId: h.state.units[1].id } }).ok, false, 'an empty tank does not fire');
});

test('ammo: a carrier keeps its rounds for the troops it carries, so its own gun is free', () => {
  const g = world(['H.......h.'], [['apc', 0, 1, 0], ['soldier', 1, 2, 0]]);
  const [apc, d] = g.state.units;
  assert.equal(shotCost(g, apc, registry.weapon('machine_gun')), 0);
  assert.equal(shotCost(g, g.state.units[1], registry.weapon('machine_gun')), 1, 'the same gun costs a round on a recon');
  const before = ammoOf(g, apc);
  assert.equal(g.act({ unitId: apc.id, to: { x: 1, y: 0 }, action: { type: 'attack', targetId: d.id } }).ok, true);
  assert.equal(ammoOf(g, apc), before, 'still full of troops');
});

test('fuel: a vehicle or ship burns a turn of fuel only on a turn it moves; an aircraft burns one every turn', () => {
  const g = world(['H.........', '~~~~~~~~~~'], [['tank', 0, 1, 0], ['tank', 0, 2, 0], ['missile_copter', 0, 5, 0], ['destroyer', 0, 7, 1], ['destroyer', 0, 8, 1]]);
  const [mover, parked, copter, ship, anchored] = g.state.units;
  assert.equal(g.act({ unitId: mover.id, to: { x: 3, y: 0 }, action: { type: 'wait' } }).ok, true);
  g.endTurn();
  assert.equal(fuelOf(g, mover), 8, 'it moved: one turn of fuel');
  assert.equal(fuelOf(g, parked), 9, 'it sat still: nothing burned');
  assert.equal(fuelOf(g, copter), 7, 'an aircraft burns whether it flies or not');
  g.endTurn();
  assert.equal(g.act({ unitId: ship.id, to: { x: 4, y: 1 }, action: { type: 'wait' } }).ok, true);
  g.endTurn();
  assert.equal(fuelOf(g, ship), 9, 'a ship that sailed burns one');
  assert.equal(fuelOf(g, anchored), 10, 'one at anchor burns none');
  assert.equal(fuelOf(g, parked), 9, 'turns of rest cost nothing');
});

test('fuel: an empty tank halves the move (rounded down, at least 1) and disarms, until it is refuelled', () => {
  const g = world(['H.........', 'rrrrrrrrrr'], [['tank', 0, 1, 0], ['recon', 0, 0, 1], ['soldier', 0, 5, 0]]);
  const [tank, recon, soldier] = g.state.units;
  assert.equal(computeReach(g, tank).has(4, 0), true, 'a full tank: move 3');
  tank.fuel = 0; recon.fuel = 0;
  assert.ok(isOutOfFuel(g, tank));
  assert.equal(computeReach(g, tank).has(2, 0), true, 'move 3 becomes 1: one tile');
  assert.equal(computeReach(g, tank).has(3, 0), false);
  assert.equal(computeReach(g, recon).has(2, 1), true, 'recon: move 5 becomes 2');
  assert.equal(computeReach(g, recon).has(3, 1), false);
  assert.equal(computeReach(g, soldier).has(7, 0), true, 'infantry have no tank to run dry, and move as always');
  const fight = world(['H.........', '..........'], [['tank', 0, 1, 0], ['soldier', 1, 2, 0]]);
  const [dry, victim] = fight.state.units;
  dry.fuel = 0;
  assert.equal(fight.act({ unitId: dry.id, to: { x: 1, y: 0 }, action: { type: 'attack', targetId: victim.id } }).ok, false, 'an empty tank cannot fire');
  dry.fuel = 4;
  assert.equal(fight.act({ unitId: dry.id, to: { x: 1, y: 0 }, action: { type: 'attack', targetId: victim.id } }).ok, true, 'a low one can');
});

test('fuel: an empty vehicle beside a friendly city is refuelled for free at the start of its turn', () => {
  const g = world(['H.c.......'], [['tank', 0, 3, 0], ['recon', 0, 7, 0]]);
  const [near, far] = g.state.units;
  near.fuel = 0; far.fuel = 0;
  turnOf(g);
  assert.equal(fuelOf(g, near), 9, 'the city beside it filled the tank');
  assert.equal(fuelOf(g, far), 0, 'the one in the field stays dry (a parked unit burns nothing more)');
});

test('supply truck: refuels ground units (and anything else it supplies), at the start of the turn and with the Supply order', () => {
  const g = world(['H.........', '..........'], [['supply_truck', 0, 2, 0], ['tank', 0, 3, 0], ['soldier', 0, 1, 0], ['missile_copter', 0, 2, 1]]);
  const [truck, tank, soldier, copter] = g.state.units;
  tank.fuel = 0; copter.fuel = 0; tank.ammo = 0;
  turnOf(g);
  assert.equal(fuelOf(g, tank), 9, 'a tank beside the truck is refuelled at turn start');
  assert.equal(fuelOf(g, copter), 8, 'and so is a helicopter (no tag filter any more)');
  assert.equal(soldier.fuel, undefined, 'infantry have no tank');
  assert.equal(tank.ammo, 0, 'ammunition comes with the Supply order, not for free at turn start');
  tank.fuel = 0;
  assert.equal(g.act({ unitId: truck.id, to: { x: 2, y: 0 }, action: { type: 'supply' } }).ok, true);
  assert.equal(fuelOf(g, tank), 9);
  assert.equal(ammoOf(g, tank), 8, 'the Supply order tops up the ammo too');
});

test('radar plane: refuels the aircraft beside it (fuel only, never ammo or vehicles), with a long tank of its own', () => {
  const g = world(['H.........', '..........'], [['radar_plane', 0, 3, 0], ['fighter', 0, 4, 0], ['tank', 0, 3, 1], ['bomber', 0, 8, 1]]);
  const [radar, fighter, tank, far] = g.state.units;
  assert.equal(fuelConfig(g, radar).max, 12);
  fighter.fuel = 0; fighter.ammo = 0; tank.fuel = 0; far.fuel = 0;
  assert.equal(g.act({ unitId: radar.id, to: { x: 3, y: 0 }, action: { type: 'supply' } }).ok, true, 'Supply is offered when an aircraft beside it needs fuel');
  assert.equal(fuelOf(g, fighter), fuelConfig(g, fighter).max, 'the fighter has a full tank');
  assert.equal(fighter.ammo, 0, 'but the radar plane carries no ammunition');
  assert.equal(fuelOf(g, tank), 0, 'a tank is not an aircraft');
  assert.equal(fuelOf(g, far), 0, 'and one out of reach stays dry');
  g.endTurn(); g.endTurn();
  fighter.fuel = 1;
  g.endTurn(); g.endTurn();
  assert.equal(fuelOf(g, fighter), fuelConfig(g, fighter).max, 'also for free at the start of the turn');
  assert.equal(fuelOf(g, radar) < 12, true, 'the radar plane does not refuel itself');
});

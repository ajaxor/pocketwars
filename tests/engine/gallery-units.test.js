// The twelve units drafted from the gallery (supply truck, hover tank, amphibious tank, SAM launcher, rocket buggy, APC, mine layer and sea mine,
// aircraft carrier, dreadnought, troop transport, missile sub, hunter sub) and the rules they brought: diving before a move, surfacing to fire,
// tag-restricted torpedoes, mines, supplying, reloading. Shipped data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry } from '../../src/data/loader.js';
import { parseMap } from '../../src/data/map-format.js';
import { rawMap } from '../helpers/fixtures.js';
import { Game } from '../../src/engine/game.js';
import { computeReach } from '../../src/engine/movement.js';
import { canResupplyAt, ammoOf, resupplyCost } from '../../src/engine/ammo.js';
import { canSee, sonarTiles } from '../../src/engine/detection.js';
import { canTarget, calcDamage } from '../../src/engine/combat.js';
import { canDeploy, deployReach } from '../../src/engine/deploy.js';
import { triggersMine } from '../../src/engine/mines.js';
import { startTurn } from '../../src/engine/economy.js';
import { layTiles } from '../../src/engine/mines.js';
import { canSupplyAt } from '../../src/engine/supply.js';
import { chooseOrder, surfaceToTravel } from '../../src/ai/greedy.js';
import { unitAt } from '../../src/engine/queries.js';

const registry = await loadRegistry(readData);
const legend = {
  '~': { terrain: 'sea' }, o: { terrain: 'shoals' }, '.': { terrain: 'plain' }, M: { terrain: 'mountain' },
  H: { terrain: 'hq', owner: 0 }, h: { terrain: 'hq', owner: 1 }, Y: { terrain: 'shipyard', owner: 0 }, F: { terrain: 'factory', owner: 0 },
};
const players = [{ faction: 'ashmark', controller: 'human', funds: 20000 }, { faction: 'vantor_reach', controller: 'human', funds: 20000 }];
const world = (rows, unitsOnMap) => new Game(registry, parseMap(rawMap({ rows, unitsOnMap, players, legend }), registry));
const first = (g, type, owner = 0) => g.state.units.find((u) => u.type === type && u.owner === owner);

// ---- diving ------------------------------------------------------------------------------------------------------------------

test('a submarine can dive for free before it moves, and then travels slower under water', () => {
  const g = world(['H~~~~~~~~~~~~h'], [['submarine', 0, 1, 0], ['recon', 1, 13, 0]]);
  const sub = first(g, 'submarine');
  const up = computeReach(g, sub).size;
  const res = g.setSubmerged({ unitId: sub.id, submerged: true });
  assert.equal(res.ok, true);
  assert.equal(sub.submerged, true);
  assert.equal(sub.done, false, 'diving first is not the unit\'s order');
  const down = computeReach(g, sub).size;
  assert.ok(down < up, `under water it reaches less (${down} < ${up})`);
  assert.equal(registry.unit('submarine').attributes.submerge.move, 3);
  assert.equal(g.act({ unitId: sub.id, to: { x: 4, y: 0 } }).ok, true);
  assert.equal(sub.submerged, true, 'it stays down through the move');
  assert.equal(g.act({ unitId: sub.id, to: { x: 4, y: 0 } }).error, 'unit-already-acted');
});

test('surfacing first gives the surface speed back, and a unit that has moved or acted cannot toggle', () => {
  const g = world(['H~~~~~~~~~~~~h'], [['submarine', 0, 1, 0], ['recon', 1, 13, 0]]);
  const sub = first(g, 'submarine');
  assert.equal(g.setSubmerged({ unitId: sub.id, submerged: false }).error, 'cannot-surface', 'already up');
  g.setSubmerged({ unitId: sub.id, submerged: true });
  assert.equal(g.setSubmerged({ unitId: sub.id, submerged: true }).error, 'cannot-submerge', 'already down');
  assert.equal(g.setSubmerged({ unitId: sub.id, submerged: false }).ok, true);
  assert.equal(computeReach(g, sub).has(6, 0), true, 'five tiles at the surface');
  sub.halted = { moved: false };
  assert.equal(g.setSubmerged({ unitId: sub.id, submerged: true }).error, 'unit-already-moved');
  sub.halted = null;
  g.act({ unitId: sub.id, to: { x: 1, y: 0 } });
  assert.equal(g.setSubmerged({ unitId: sub.id, submerged: true }).error, 'unit-already-acted');
});

test('the computer surfaces a submerged submarine to travel when no enemy is near, and leaves it down when one is', () => {
  const far = world(['H~~~~~~~~~~~~~~~~~h'], [['submarine', 0, 1, 0], ['recon', 1, 18, 0]]);
  first(far, 'submarine').submerged = true;
  assert.equal(surfaceToTravel(far, first(far, 'submarine')).length, 1);
  assert.equal(first(far, 'submarine').submerged, false);
  const near = world(['H~~~~~~~~~~~~~~~~~h'], [['submarine', 0, 1, 0], ['destroyer', 1, 5, 0]]);
  first(near, 'submarine').submerged = true;
  near.state.units.find((u) => u.type === 'destroyer').x = 5;
  assert.deepEqual(surfaceToTravel(near, first(near, 'submarine')), []);
});

// ---- missile sub -------------------------------------------------------------------------------------------------------------

test('a missile sub fires from under water and is forced up by it', () => {
  const g = world(['H~~~~~~.h', '.........'], [['missile_sub', 0, 1, 0], ['tank', 1, 5, 1]]);
  const sub = first(g, 'missile_sub');
  g.setSubmerged({ unitId: sub.id, submerged: true });
  assert.equal(canSee(g, 1, sub), false, 'hidden while down');
  const tank = first(g, 'tank', 1);
  const res = g.act({ unitId: sub.id, to: { x: 1, y: 0 }, action: { type: 'attack', targetId: tank.id } });
  assert.equal(res.ok, true);
  assert.equal(sub.submerged, false, 'it came up');
  assert.ok(res.events.some((e) => e.type === 'surface' && e.forced), 'with a forced surface event');
  assert.equal(canSee(g, 1, sub), true, 'and the enemy sees it now');
  assert.equal(ammoOf(g, sub), 2);
  assert.ok(tank.hp < 10);
});

test('an ordinary submarine stays down after firing', () => {
  const g = world(['H~~~~h'], [['submarine', 0, 1, 0], ['destroyer', 1, 2, 0]]);
  const sub = first(g, 'submarine');
  g.setSubmerged({ unitId: sub.id, submerged: true });
  g.act({ unitId: sub.id, to: { x: 1, y: 0 }, action: { type: 'attack', targetId: first(g, 'destroyer', 1).id } });
  assert.equal(sub.submerged, true);
});

test('a missile sub reloads at a shipyard', () => {
  const g = world(['HY~~~h'], [['missile_sub', 0, 2, 0]]);
  const sub = first(g, 'missile_sub');
  sub.ammo = 1;
  assert.equal(canResupplyAt(g, sub, 2, 0), true);
});

// ---- hunter sub --------------------------------------------------------------------------------------------------------------

test('a hunter sub is always under water, and only its own kind can be hit by its torpedoes', () => {
  const g = world(['H~~~~~~~~~~~h'], [['hunter_sub', 0, 1, 0], ['destroyer', 1, 9, 0], ['submarine', 1, 10, 0]]);
  const hunter = first(g, 'hunter_sub');
  assert.equal(canSee(g, 1, hunter), false, 'hidden from the start');
  assert.equal(canTarget(g, hunter, first(g, 'destroyer', 1)), false, 'a destroyer is not a submarine');
  const sub = first(g, 'submarine', 1);
  assert.equal(canTarget(g, hunter, sub), true, 'a submarine on the surface');
  sub.submerged = true;
  assert.equal(canTarget(g, hunter, sub), true, 'and one that is down');
  sub.submerged = false;
  const missile = world(['H~~~~~~~h'], [['hunter_sub', 0, 1, 0], ['missile_sub', 1, 2, 0]]);
  assert.equal(canTarget(missile, first(missile, 'hunter_sub'), first(missile, 'missile_sub', 1)), true, 'a surfaced missile sub is a sub too');
});

test('a hunter sub hits another sub very hard, and moves faster than a submerged submarine', () => {
  const g = world(['H~~~~~~~h'], [['hunter_sub', 0, 1, 0], ['submarine', 1, 2, 0]]);
  const sub = first(g, 'submarine', 1);
  sub.submerged = true;
  const hunter = first(g, 'hunter_sub');
  assert.ok(calcDamage(g, hunter, sub) >= 8, 'nearly a kill');
  assert.ok(registry.unit('hunter_sub').move > registry.unit('submarine').attributes.submerge.move);
});

test('the hunter sub does not wander off after targets it cannot hit', () => {
  const g = world(['H~~~~~~~~~~~~h', '..............'], [['hunter_sub', 0, 1, 0], ['recon', 1, 12, 1], ['destroyer', 1, 11, 0]]);
  g.state.turn = 0;
  const order = chooseOrder(g, first(g, 'hunter_sub'));
  assert.notEqual(order.action.type, 'attack');
});

// ---- sonar overlay -----------------------------------------------------------------------------------------------------------

test('sonarTiles covers the tiles within the sonar range of a unit with sonar and nothing for one without', () => {
  const g = world(['H~~~~~~~h'], [['destroyer', 0, 4, 0], ['tank', 1, 8, 0]]);
  const tiles = sonarTiles(g, first(g, 'destroyer'));
  assert.equal(tiles.size, 6, 'three tiles each way along a one-row map');
  assert.equal(tiles.has(7), true);
  assert.equal(tiles.has(4), false, 'its own tile is left out');
  assert.equal(sonarTiles(g, first(g, 'tank', 1)), null);
});

// ---- mines -------------------------------------------------------------------------------------------------------------------

const harbour = (extra = []) => world(['H~~~~~~~~~~h', '.o~~~~~~~~..'], [['mine_layer', 0, 4, 0], ['recon', 1, 11, 1], ...extra]);

test('a mine layer lays a mine on any free sea tile next to it (up and down, left and right, not diagonally), using a round of ammo', () => {
  const g = harbour();
  const layer = first(g, 'mine_layer');
  const tiles = layTiles(g, layer);
  assert.deepEqual(tiles.map((t) => `${t.x},${t.y}`).sort(), ['3,0', '4,1', '5,0'], 'only the orthogonal neighbours: nothing diagonal, nothing two away');
  const before = g.state.funds[0];
  assert.equal(g.act({ unitId: layer.id, to: { x: 4, y: 0 }, action: { type: 'lay', at: { x: 5, y: 0 } } }).ok, true);
  assert.equal(g.state.funds[0], before, 'laying costs no money');
  assert.equal(layer.ammo, registry.unit('mine_layer').attributes.ammo.max - 1);
  const mine = unitAt(g, 5, 0);
  assert.equal(mine.type, 'sea_mine');
  assert.equal(mine.owner, 0);
  assert.equal(mine.done, true, 'a mine never acts');
  assert.equal(layer.done, true);
  assert.equal(g.act({ unitId: layer.id, to: { x: 4, y: 0 }, action: { type: 'lay', at: { x: 3, y: 0 } } }).error, 'unit-already-acted');
});

test('a mine cannot be laid on land, on a unit, out of range, or without mines left', () => {
  const g = harbour([['destroyer', 0, 5, 0]]);
  const layer = first(g, 'mine_layer');
  const lay = (at) => g.act({ unitId: layer.id, to: { x: 4, y: 0 }, action: { type: 'lay', at } }).error;
  assert.equal(lay({ x: 5, y: 0 }), 'bad-lay-tile', 'a unit is there');
  assert.equal(lay({ x: 6, y: 0 }), 'bad-lay-tile', 'two away is out of range');
  assert.equal(lay({ x: 5, y: 1 }), 'bad-lay-tile', 'a diagonal is out of range');
  assert.equal(lay({ x: 4, y: 0 }), 'bad-lay-tile', 'not its own tile');
  layer.ammo = 0;
  assert.equal(lay({ x: 3, y: 0 }), 'out-of-mines');
});

test('a mine is hidden from the enemy until one of their units is next to it, and survives the owner\'s next turn start unspent', () => {
  const g = harbour([['cruiser', 1, 10, 0]]);
  g.act({ unitId: first(g, 'mine_layer').id, to: { x: 4, y: 0 }, action: { type: 'lay', at: { x: 5, y: 0 } } });
  const mine = unitAt(g, 5, 0);
  assert.equal(canSee(g, 1, mine), false);
  assert.equal(canSee(g, 0, mine), true);
  startTurn(g, 0);
  assert.equal(mine.done, true, 'still inert after turn start');
});

test('a hidden enemy submarine on a lay tile is not given away by the highlights; laying there is interrupted and lays nothing', () => {
  const g = harbour([['submarine', 1, 5, 0]]);
  const sub = first(g, 'submarine', 1);
  g.setSubmerged?.({ unitId: sub.id, submerged: true });
  sub.submerged = true;
  const layer = first(g, 'mine_layer');
  layer.x = 2;   // two tiles from the sub: the layer plans to sail up beside it and lay
  assert.equal(canSee(g, 0, sub), false, 'the layer cannot see it');
  assert.ok(layTiles(g, layer, 4, 0).some((t) => t.x === 5 && t.y === 0), 'its tile is offered like any free one');
  const res = g.act({ unitId: layer.id, to: { x: 4, y: 0 }, action: { type: 'lay', at: { x: 5, y: 0 } } });
  assert.equal(res.ok, true);
  assert.equal(res.events[0].type, 'interrupt');
  assert.equal(g.state.units.filter((u) => u.type === 'sea_mine').length, 0, 'no mine was laid');
  assert.equal(layer.ammo, registry.unit('mine_layer').attributes.ammo.max, 'and no round was spent');
  assert.equal(layer.done, false, 'the layer has used its move but may still act');
});

test('a player may only have rules.maxMinesPerPlayer mines out at once', () => {
  const g = harbour();
  const cap = registry.rules.maxMinesPerPlayer;
  assert.ok(cap >= 1);
  for (let i = 0; i < cap; i++) g.state.units.push({ ...first(g, 'mine_layer'), id: 900 + i, type: 'sea_mine', x: 8, y: 1 - (i % 2), done: true });
  const layer = first(g, 'mine_layer');
  assert.equal(g.act({ unitId: layer.id, to: { x: 4, y: 0 }, action: { type: 'lay', at: { x: 5, y: 0 } } }).error, 'too-many-mines');
});

function mined(moverType, moverAt = [1, 0], mineAt = [4, 0]) {
  const g = world(['H~~~~~~~~~~h', '............'], [[moverType, 1, ...moverAt], ['sea_mine', 0, ...mineAt]]);
  g.state.turn = 1;
  return g;
}

test('a ship that runs into a hidden mine takes its damage, the mine is gone and the rest of the move is cancelled', () => {
  const g = mined('cruiser');
  const ship = first(g, 'cruiser', 1);
  const res = g.act({ unitId: ship.id, to: { x: 6, y: 0 } });
  assert.equal(res.ok, true);
  const boom = res.events.find((e) => e.type === 'detonate');
  assert.ok(boom, 'a detonate event');
  assert.equal(ship.hp, 10 - registry.unit('sea_mine').attributes.mine.damage);
  assert.equal(unitAt(g, 4, 0), undefined, 'the mine is spent');
  assert.deepEqual([ship.x, ship.y], [3, 0], 'it stopped on the tile before the mine');
  assert.ok(res.interrupted, 'the move was interrupted');
  assert.equal(ship.done, false, 'it can still act where it stands');
  assert.equal(res.events.findIndex((e) => e.type === 'interrupt') < res.events.findIndex((e) => e.type === 'detonate'), true);
});

test('a mine can finish off a damaged ship (it has no never-kill limit)', () => {
  const g = mined('cruiser');
  const ship = first(g, 'cruiser', 1);
  ship.hp = 3;
  const res = g.act({ unitId: ship.id, to: { x: 6, y: 0 } });
  assert.equal(res.events.find((e) => e.type === 'detonate').destroyed, true);
  assert.equal(g.state.units.includes(ship), false);
  assert.equal(res.interrupted, undefined);
});

test('a submerged submarine sets a mine off too', () => {
  const g = mined('submarine');
  const sub = first(g, 'submarine', 1);
  sub.submerged = true;
  const res = g.act({ unitId: sub.id, to: { x: 4, y: 0 } });
  assert.ok(res.events.some((e) => e.type === 'detonate'));
  assert.equal(sub.hp, 10 - registry.unit('sea_mine').attributes.mine.damage);
});

test('infantry do not set a mine off, but ships and vehicles do (the mine\'s `triggers`)', () => {
  const g = world(['H~~~~~~~~~~h'], [['sea_mine', 0, 4, 0], ['marine', 1, 1, 0], ['diver', 1, 2, 0], ['cruiser', 1, 3, 0], ['amphibious_tank', 1, 5, 0], ['hover_tank', 1, 6, 0], ['copter', 1, 7, 0]]);
  const mine = first(g, 'sea_mine');
  const hits = (type) => triggersMine(g, first(g, type, 1), mine);
  assert.deepEqual(['marine', 'diver'].map(hits), [false, false]);
  assert.deepEqual(['cruiser', 'amphibious_tank'].map(hits), [true, true]);
  assert.deepEqual(['hover_tank', 'copter'].map(hits), [false, false], 'floating and flying units go over it');
});

test('an amphibious tank sets a mine off; a hover tank floats over it and a helicopter flies over', () => {
  const amph = mined('amphibious_tank', [1, 0], [3, 0]);
  const t = first(amph, 'amphibious_tank', 1);
  const res = amph.act({ unitId: t.id, to: { x: 3, y: 0 } });
  assert.ok(res.events.some((e) => e.type === 'detonate'));
  assert.deepEqual([t.x, t.y], [2, 0]);
  const hover = mined('hover_tank');
  const h = first(hover, 'hover_tank', 1);
  const r = hover.act({ unitId: h.id, to: { x: 5, y: 0 } });
  assert.equal(r.ok, true);
  assert.equal(r.interrupted, undefined);
  assert.deepEqual([h.x, h.y], [5, 0], 'it crossed the mine');
  assert.equal(unitAt(hover, 4, 0).type, 'sea_mine', 'which is untouched');
  const air = mined('copter');
  const c = first(air, 'copter', 1);
  assert.equal(air.act({ unitId: c.id, to: { x: 6, y: 0 } }).interrupted, undefined);
  assert.deepEqual([c.x, c.y], [6, 0]);
});

test('a hover tank or a plane cannot end its move on a hidden mine', () => {
  const g = mined('copter');
  const c = first(g, 'copter', 1);
  const res = g.act({ unitId: c.id, to: { x: 4, y: 0 } });
  assert.ok(res.interrupted);
  assert.deepEqual([c.x, c.y], [3, 0]);
  assert.equal(res.events.some((e) => e.type === 'detonate'), false);
});

test('the mine layer\'s own side pass through its mines but cannot stop on them', () => {
  const g = world(['H~~~~~~~~~~h'], [['destroyer', 0, 1, 0], ['sea_mine', 0, 3, 0]]);
  const reach = computeReach(g, first(g, 'destroyer'));
  assert.equal(reach.has(3, 0), false);
  assert.equal(reach.has(5, 0), true);
});

// ---- supply and reload -------------------------------------------------------------------------------------------------------

test('a supply truck refills the ammo of friends next to it for free, and nobody else', () => {
  const g = world(['H.....h'], [['supply_truck', 0, 2, 0], ['rocket_buggy', 0, 3, 0], ['rocket_buggy', 1, 6, 0], ['tank', 0, 1, 0]]);
  const truck = first(g, 'supply_truck');
  const buggy = first(g, 'rocket_buggy');
  const enemy = first(g, 'rocket_buggy', 1);
  buggy.ammo = 0; enemy.ammo = 0;
  assert.equal(canSupplyAt(g, truck, 2, 0), true);
  const before = g.state.funds[0];
  const res = g.act({ unitId: truck.id, to: { x: 2, y: 0 }, action: { type: 'supply' } });
  assert.equal(res.ok, true);
  assert.equal(buggy.ammo, registry.unit('rocket_buggy').attributes.ammo.max);
  assert.equal(before, g.state.funds[0], 'plain ammunition costs nothing');
  assert.equal(enemy.ammo, 0, 'an enemy is not supplied');
  assert.equal(truck.done, true);
});

test('Supply is only offered when somebody next to the unit needs it', () => {
  const g = world(['H.....h'], [['supply_truck', 0, 2, 0], ['rocket_buggy', 0, 3, 0]]);
  assert.equal(g.act({ unitId: first(g, 'supply_truck').id, to: { x: 2, y: 0 }, action: { type: 'supply' } }).error, 'cannot-supply');
});

test('an aircraft carrier refuels, rearms and repairs friendly aircraft next to it', () => {
  const g = world(['H.~~~~~h'], [['aircraft_carrier', 0, 2, 0], ['transport_copter', 0, 3, 0, 5], ['tank', 0, 1, 0, 5]]);
  const carrier = first(g, 'aircraft_carrier');
  const copter = first(g, 'transport_copter');
  copter.ammo = 0;
  const res = g.act({ unitId: carrier.id, to: { x: 2, y: 0 }, action: { type: 'supply' } });
  assert.equal(res.ok, true);
  assert.equal(copter.ammo, registry.unit('transport_copter').attributes.ammo.max);
  assert.equal(copter.hp, 7, 'repaired 2');
  assert.equal(first(g, 'tank').hp, 5, 'a tank is not an aircraft');
});

test('a SAM launcher reloads fully if it sat out its last turn, and not if it moved', () => {
  const g = world(['H.....h'], [['sam_launcher', 0, 2, 0], ['sam_launcher', 0, 3, 0]]);
  const [still, moved] = g.state.units;
  still.ammo = 0; moved.ammo = 0; moved.moved = true;
  startTurn(g, 0);
  assert.equal(still.ammo, 3);
  assert.equal(moved.ammo, 0);
});

// ---- transports --------------------------------------------------------------------------------------------------------------

test('an APC starts with two soldiers\' worth of ammo and drops them one at a time', () => {
  const g = world(['H.....h'], [['apc', 0, 2, 0]]);
  const apc = first(g, 'apc');
  assert.equal(ammoOf(g, apc), 2);
  assert.equal(canDeploy(g, apc), true);
  const res = g.deploy({ unitId: apc.id });
  assert.equal(res.ok, true);
  assert.equal(ammoOf(g, apc), 1);
  assert.equal(res.events[0].dropped.type, 'soldier');
});

test('a troop transport unloads soldiers onto the land next to it, not into the sea', () => {
  const g = world(['H~~~.h', '~~~~~~'], [['troop_transport', 0, 3, 0]]);
  const boat = first(g, 'troop_transport');
  assert.equal(ammoOf(g, boat), 2);
  const tiles = deployReach(g, boat).tiles;
  assert.ok(tiles.some((t) => t.x === 4 && t.y === 0), 'the beach');
  assert.ok(tiles.every((t) => t.y === 0 && t.x >= 3), 'and nothing out at sea');
  assert.equal(g.deploy({ unitId: boat.id }).ok, true);
});

// ---- the land vehicles -------------------------------------------------------------------------------------------------------

test('the amphibious tank is tougher than a tank but no faster, and swims; the hover tank hits as hard as a tank', () => {
  const tank = registry.unit('tank');
  const amph = registry.unit('amphibious_tank');
  assert.ok(amph.toughness > tank.toughness && amph.move <= tank.move);
  const g = world(['H~~~~~h'], [['amphibious_tank', 0, 0, 0], ['tank', 1, 6, 0]]);
  assert.equal(computeReach(g, first(g, 'amphibious_tank')).has(2, 0), true, 'two sea tiles at 1.5 each fit in 3 moves');
  assert.equal(computeReach(g, first(g, 'amphibious_tank')).has(3, 0), false);
  assert.ok(registry.weapon(registry.unit('hover_tank').weapons[0]).damage >= registry.weapon(tank.weapons[0]).damage);
  assert.equal(registry.unit('hover_tank').moveClass, 'hover');
});

test('a SAM launcher fires far, has a minimum range and hits aircraft only', () => {
  const sam = registry.weapon('sam');
  assert.deepEqual(sam.range, [3, 7]);
  assert.deepEqual([...sam.targets].sort(), ['high_air', 'low_air']);
  assert.ok(sam.range[1] > registry.weapon('aa_battery').range[1]);
});

test('the rocket buggy costs more than the concept, has limited ammo and pierces armour a bit', () => {
  const buggy = registry.unit('rocket_buggy');
  assert.ok(buggy.cost > 3500);
  assert.ok(buggy.attributes.ammo.max <= 3);
  assert.ok(registry.weapon('buggy_rockets').armorPiercing > 0);
});

test('the dreadnought has a weak weapon for close range, and nothing against air or submarines', () => {
  const dread = registry.unit('dreadnought');
  const modes = dread.weapons.flatMap((w) => registry.weapon(w).targets);
  assert.ok(!modes.some((m) => m === 'low_air' || m === 'high_air' || m === 'underwater'));
  const [main, side] = dread.weapons.map((w) => registry.weapon(w));
  assert.ok(main.range[0] >= 2 && side.range[0] === 1 && side.damage < main.damage);
  assert.equal(main.indirect, true);
});

test('a mine layer pays for the mines it takes on at a shipyard, and plain ammunition is free', () => {
  const g = world(['H~~~~~~~~~~h', '.Y~~~~~~~~..'], [['mine_layer', 0, 2, 1], ['recon', 1, 11, 1]]);
  const layer = first(g, 'mine_layer');
  layer.ammo = 0;
  const before = g.state.funds[0];
  assert.equal(resupplyCost(g, layer), 3 * registry.unit('sea_mine').cost);
  assert.equal(g.act({ unitId: layer.id, to: { x: 2, y: 1 }, action: { type: 'resupply' } }).ok, true);
  assert.equal(layer.ammo, 3);
  assert.equal(before - g.state.funds[0], 3 * registry.unit('sea_mine').cost);
});

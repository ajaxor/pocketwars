// Marine (amphibious infantry that rides a dinghy) and the transport copter (drops soldiers, which it carries as ammo), on the shipped data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry } from '../../src/data/loader.js';
import { parseMap } from '../../src/data/map-format.js';
import { rawMap } from '../helpers/fixtures.js';
import { Game } from '../../src/engine/game.js';
import { computeReach } from '../../src/engine/movement.js';
import { ammoLevel } from '../../src/engine/ammo.js';
import { canDeploy, deployReach } from '../../src/engine/deploy.js';
import { chooseOrder, playTurn } from '../../src/engine/ai.js';
import { unitAt } from '../../src/engine/queries.js';

const registry = await loadRegistry(readData);
const legend = {
  '~': { terrain: 'sea' }, o: { terrain: 'shoals' }, '.': { terrain: 'plain' }, M: { terrain: 'mountain' },
  H: { terrain: 'hq', owner: 0 }, h: { terrain: 'hq', owner: 1 }, Y: { terrain: 'shipyard', owner: 0 }, A: { terrain: 'airfield', owner: 0 },
};
const players = [{ faction: 'orange_star', controller: 'human', funds: 20000 }, { faction: 'violet_nebula', controller: 'human', funds: 20000 }];
const world = (rows, unitsOnMap) => new Game(registry, parseMap(rawMap({ rows, unitsOnMap, players, legend }), registry));

test('a marine walks on land, crosses shoals and sea, and captures like a soldier', () => {
  const g = world(['H.o~~h'], [['marine', 0, 1, 0]]);
  const marine = g.state.units[0];
  const reach = computeReach(g, marine);
  assert.ok(reach.has(2, 0) && reach.has(3, 0), 'shoals and sea');
  assert.equal(reach.has(4, 0), false, 'out of range, not out of bounds');
  assert.equal(registry.unit('marine').attributes.capture, true);
});

test('a marine is built at a shipyard and can swim off it', () => {
  const g = world(['H.Y~~h'], [['recon', 1, 5, 0]]);
  assert.ok(g.state.funds[0] >= registry.unit('marine').cost);
  assert.equal(g.build(2, 0, 'marine').ok, true);
  const marine = unitAt(g, 2, 0);
  assert.equal(marine.fresh, true);
  assert.equal(g.act({ unitId: marine.id, to: { x: 4, y: 0 }, action: { type: 'wait' } }).ok, true, 'a free move across the water');
});

test('a transport copter deploys like a factory: the soldier moves from the copter to a tile in its own range, and the copter keeps its order', () => {
  const g = world(['H....h', '......'], [['transport_copter', 0, 1, 0], ['recon', 1, 5, 1]]);
  const copter = g.state.units[0];
  assert.equal(copter.ammo, 2);
  assert.equal(ammoLevel(g, copter), 'ok');
  assert.equal(canDeploy(g, copter), true);
  const { tiles } = deployReach(g, copter);
  assert.ok(tiles.some((t) => t.x === 3 && t.y === 0), 'two tiles of walking away');
  assert.ok(!tiles.some((t) => t.x === 1 && t.y === 0), 'not the copter\'s own tile');
  assert.ok(!tiles.some((t) => t.x === 4 && t.y === 0), 'but not beyond a soldier\'s move');
  const res = g.deploy({ unitId: copter.id, to: { x: 3, y: 0 } });
  assert.equal(res.ok, true);
  const soldier = unitAt(g, 3, 0);
  assert.equal(soldier.type, 'soldier');
  assert.equal(soldier.owner, 0);
  assert.equal(soldier.done, false, 'it has an action left');
  assert.equal(soldier.fresh, undefined, 'it is not limited like a unit just built');
  assert.deepEqual(soldier.halted, { moved: true }, 'its move is used: attack, capture or wait from where it landed');
  assert.equal(copter.ammo, 1);
  assert.equal(copter.done, false, 'deploying is not part of the copter\'s own order');
  assert.deepEqual(res.events.map((e) => e.type), ['move', 'deploy']);
  assert.equal(g.act({ unitId: copter.id, to: { x: 2, y: 1 }, action: { type: 'wait' } }).ok, true, 'it can still move afterwards');
});

test('a copter can deploy after it has moved and waited, but only once a turn, and not when it was just built', () => {
  const g = world(['H....h', '......'], [['transport_copter', 0, 1, 0], ['recon', 1, 5, 1]]);
  const copter = g.state.units[0];
  g.act({ unitId: copter.id, to: { x: 2, y: 1 }, action: { type: 'wait' } });
  assert.equal(copter.done, true);
  assert.equal(g.deploy({ unitId: copter.id, to: { x: 2, y: 0 } }).ok, true, 'after its move');
  assert.equal(g.deploy({ unitId: copter.id, to: { x: 3, y: 1 } }).error, 'already-deployed');
  assert.equal(canDeploy(g, copter), false);
  g.endTurn(); g.endTurn();
  assert.equal(copter.deployed, undefined, 'a new turn, a new drop');
  assert.equal(canDeploy(g, copter), true);
  copter.fresh = true;
  assert.equal(g.deploy({ unitId: copter.id, to: { x: 3, y: 1 } }).error, 'just-built');
});

test('a deployed soldier can attack at once', () => {
  const g = world(['H....h', '......'], [['transport_copter', 0, 1, 0], ['recon', 1, 3, 1]]);
  const copter = g.state.units[0], foe = g.state.units[1];
  const { deployed } = g.deploy({ unitId: copter.id, to: { x: 2, y: 1 } });
  const soldier = g.state.units.find((u) => u.id === deployed.unitId);
  const hit = g.act({ unitId: soldier.id, to: { x: 2, y: 1 }, action: { type: 'attack', targetId: foe.id } });
  assert.equal(hit.ok, true);
  assert.ok(foe.hp < 10);
});

test('a landing needs a tile the soldier can reach and stand on, and ammo', () => {
  const g = world(['H.~~~h', '..~~~.'], [['transport_copter', 0, 3, 0], ['recon', 1, 5, 1]]);
  const copter = g.state.units[0];
  assert.equal(g.deploy({ unitId: copter.id, to: { x: 2, y: 0 } }).error, 'invalid-deploy-tile', 'a soldier cannot be put in the sea');
  assert.equal(g.deploy({ unitId: copter.id, to: { x: 3, y: 0 } }).error, 'invalid-deploy-tile', 'nor on the copter\'s own tile');
  assert.equal(g.deploy({ unitId: copter.id, to: { x: 5, y: 5 } }).error, 'invalid-deploy-tile', 'nor out of the soldier\'s reach');
  const out = world(['H....h', '......'], [['transport_copter', 0, 1, 0], ['recon', 1, 5, 1]]);
  out.state.units[0].ammo = 0;
  assert.equal(ammoLevel(out, out.state.units[0]), 'empty');
  assert.equal(out.deploy({ unitId: out.state.units[0].id, to: { x: 2, y: 1 } }).error, 'out-of-ammo');
});

test('a transport copter next to an airfield can Resupply and then move on', () => {
  const g = world(['H.A....h', '........'], [['transport_copter', 0, 5, 0], ['recon', 1, 7, 1]]);
  const copter = g.state.units[0];
  copter.ammo = 0;
  assert.equal(g.act({ unitId: copter.id, to: { x: 5, y: 0 }, action: { type: 'resupply' } }).error, 'cannot-resupply', 'too far from the airfield');
  const stop = g.act({ unitId: copter.id, to: { x: 3, y: 0 }, action: { type: 'resupply' } });
  assert.equal(stop.ok, true);
  assert.equal(copter.ammo, 2, 'refilled beside the airfield');
  assert.equal(copter.done, false, 'and ready to move again');
  assert.equal(g.deploy({ unitId: copter.id, to: { x: 4, y: 1 } }).ok, true);
});

test('the AI builds marines at a shipyard, and plays a whole turn with them and the free moves', () => {
  const g = world(['H.Y~~~h', '.......'], [['recon', 1, 6, 1]]);
  g.state.turn = 0;
  const events = playTurn(g);
  assert.ok(events.some((e) => e.type === 'build'), 'it built something');
  for (const u of g.state.units.filter((x) => x.owner === 0)) assert.equal(u.fresh, undefined, `${u.type} used its free move`);
  assert.ok(chooseOrder(g, g.state.units[0]));
});

test('forecastAttack previews the blow and the counter without changing anything', async () => {
  const { forecastAttack } = await import('../../src/engine/combat.js');
  const g = world(['H....h', '......'], [['soldier', 0, 1, 0], ['soldier', 1, 2, 0], ['recon', 1, 5, 1]]);
  const [a, d] = g.state.units;
  const f = forecastAttack(g, a, d);
  assert.ok(f.damage > 0 && f.counter > 0 && !f.destroyed);
  assert.equal(a.hp, 10); assert.equal(d.hp, 10);
  const real = g.act({ unitId: a.id, to: { x: 1, y: 0 }, action: { type: 'attack', targetId: d.id } });
  const [hit, back] = real.events.filter((e) => e.type === 'strike');
  assert.deepEqual([f.damage, f.counter], [hit.damage, back.damage], 'the preview matches what happens');
  d.hp = 1;
  assert.equal(forecastAttack(g, g.state.units[0], d).destroyed, true);
  assert.equal(forecastAttack(g, g.state.units[0], d).counter, null, 'a dead defender does not answer');
});

// Marine (amphibious infantry that rides a dinghy) and the transport copter (drops soldiers, which it carries as ammo), on the shipped data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry } from '../../src/data/loader.js';
import { parseMap } from '../../src/data/map-format.js';
import { rawMap } from '../helpers/fixtures.js';
import { Game } from '../../src/engine/game.js';
import { computeReach } from '../../src/engine/movement.js';
import { ammoLevel, resupplyCost } from '../../src/engine/ammo.js';
import { canDeploy, deployReach } from '../../src/engine/deploy.js';
import { chooseOrder } from '../../src/ai/greedy.js';
import { playTurn } from '../../src/ai/runner.js';
import { unitAt } from '../../src/engine/queries.js';

const registry = await loadRegistry(readData);
const legend = {
  '~': { terrain: 'sea' }, o: { terrain: 'shoals' }, '.': { terrain: 'plain' }, M: { terrain: 'mountain' },
  H: { terrain: 'hq', owner: 0 }, h: { terrain: 'hq', owner: 1 }, Y: { terrain: 'shipyard', owner: 0 }, B: { terrain: 'barracks', owner: 0 }, A: { terrain: 'airfield', owner: 0 },
};
const players = [{ faction: 'ashmark', controller: 'human', funds: 20000 }, { faction: 'vantor_reach', controller: 'human', funds: 20000 }];
const world = (rows, unitsOnMap) => {
  const g = new Game(registry, parseMap(rawMap({ rows, unitsOnMap, players, legend }), registry));
  g.aiSetup = [{ engine: 'greedy' }, { engine: 'greedy' }];   // the AI checks here are about the greedy engine (see tests/ai for the strategist)
  return g;
};

test('a marine walks on land, crosses shoals and sea, and captures like a soldier', () => {
  const g = world(['H.o~~h'], [['marine', 0, 1, 0]]);
  const marine = g.state.units[0];
  const reach = computeReach(g, marine);
  assert.ok(reach.has(2, 0) && reach.has(3, 0), 'shoals and sea');
  assert.equal(reach.has(4, 0), false, 'out of range, not out of bounds');
  assert.equal(registry.unit('marine').attributes.capture, true);
});

test('a marine is built at a barracks (by a leader whose kit has it) and can swim off it', () => {
  const g = new Game(registry, parseMap(rawMap({ rows: ['H.B~~h'], unitsOnMap: [['recon', 1, 5, 0]], players: [{ faction: 'tidehaven', controller: 'human', funds: 20000, leader: 'rex' }, players[1]], legend }), registry));
  assert.ok(g.state.funds[0] >= registry.unit('marine').cost);
  assert.equal(g.build(2, 0, 'marine').ok, true);
  const marine = unitAt(g, 2, 0);
  assert.equal(marine.fresh, true);
  assert.equal(g.act({ unitId: marine.id, to: { x: 4, y: 0 }, action: { type: 'wait' } }).ok, true, 'a free move across the water');
});

test('a transport copter deploys like a factory: the soldier appears on the copter and then moves out with a normal order', () => {
  const g = world(['H....h', '......'], [['transport_copter', 0, 1, 0], ['recon', 1, 5, 1]]);
  const copter = g.state.units[0];
  assert.equal(copter.ammo, 2);
  assert.equal(ammoLevel(g, copter), 'ok');
  assert.equal(canDeploy(g, copter), true);
  const { tiles } = deployReach(g, copter);
  assert.ok(tiles.some((t) => t.x === 3 && t.y === 0), 'two tiles of walking away');
  assert.ok(!tiles.some((t) => t.x === 1 && t.y === 0), 'not the copter\'s own tile');
  assert.ok(!tiles.some((t) => t.x === 4 && t.y === 0), 'but not beyond a soldier\'s move');
  const res = g.deploy({ unitId: copter.id });
  assert.equal(res.ok, true);
  assert.deepEqual(res.events.map((e) => e.type), ['deploy']);
  const soldier = g.state.units.find((u) => u.id === res.deployed.unitId);
  assert.equal(soldier.type, 'soldier');
  assert.equal(soldier.owner, 0);
  assert.deepEqual([soldier.x, soldier.y], [1, 0], 'on the copter\'s tile');
  assert.equal(soldier.done, false);
  assert.equal(soldier.fresh, undefined, 'it is not limited like a unit just built');
  assert.equal(copter.ammo, 1);
  assert.equal(copter.done, false, 'deploying is not part of the copter\'s own order');
  assert.equal(g.act({ unitId: soldier.id, to: { x: 1, y: 0 }, action: { type: 'wait' } }).ok, false, 'it has to leave the copter\'s tile');
  assert.equal(g.act({ unitId: soldier.id, to: { x: 3, y: 0 }, action: { type: 'wait' } }).ok, true);
  assert.equal(soldier.carriedBy, undefined, 'ordered: it can no longer be put back');
  assert.equal(g.cancelDeploy({ unitId: soldier.id }).error, 'cannot-cancel-deploy');
  assert.equal(g.act({ unitId: copter.id, to: { x: 2, y: 1 }, action: { type: 'wait' } }).ok, true, 'the copter can still move afterwards');
});

test('cancelling a deploy puts the unit back in the copter and gives the ammo back', () => {
  const g = world(['H....h', '......'], [['transport_copter', 0, 1, 0], ['recon', 1, 5, 1]]);
  const copter = g.state.units[0];
  const { deployed } = g.deploy({ unitId: copter.id });
  assert.equal(g.state.units.length, 3);
  const res = g.cancelDeploy({ unitId: deployed.unitId });
  assert.equal(res.ok, true);
  assert.equal(g.state.units.length, 2);
  assert.equal(copter.ammo, 2);
  assert.equal(copter.deployed, undefined);
  assert.equal(canDeploy(g, copter), true, 'free to deploy again');
});

test('a copter can deploy after it has moved and waited, but only once a turn, and not when it was just built', () => {
  const g = world(['H....h', '......'], [['transport_copter', 0, 1, 0], ['recon', 1, 5, 1]]);
  const copter = g.state.units[0];
  g.act({ unitId: copter.id, to: { x: 2, y: 1 }, action: { type: 'wait' } });
  assert.equal(copter.done, true);
  assert.equal(g.deploy({ unitId: copter.id }).ok, true, 'after its move');
  assert.equal(g.deploy({ unitId: copter.id }).error, 'already-deployed');
  assert.equal(canDeploy(g, copter), false);
  g.endTurn(); g.endTurn();
  assert.equal(copter.deployed, undefined, 'a new turn, a new drop');
  assert.equal(canDeploy(g, copter), true);
  copter.fresh = true;
  assert.equal(g.deploy({ unitId: copter.id }).error, 'just-built');
});

test('a deployed soldier can move and attack in one order', () => {
  const g = world(['H....h', '......'], [['transport_copter', 0, 1, 0], ['recon', 1, 3, 1]]);
  const copter = g.state.units[0], foe = g.state.units[1];
  const { deployed } = g.deploy({ unitId: copter.id });
  const hit = g.act({ unitId: deployed.unitId, to: { x: 2, y: 1 }, action: { type: 'attack', targetId: foe.id } });
  assert.equal(hit.ok, true);
  assert.ok(foe.hp < 10);
});

test('a landing needs a tile the soldier could stand on, and ammo', () => {
  const g = world(['H.~~~h', '..~~~.'], [['transport_copter', 0, 3, 0], ['recon', 1, 5, 1]]);
  assert.equal(deployReach(g, g.state.units[0]).tiles.length, 0, 'nowhere to walk from over the sea');
  assert.equal(g.deploy({ unitId: g.state.units[0].id }).error, 'no-room');
  const out = world(['H....h', '......'], [['transport_copter', 0, 1, 0], ['recon', 1, 5, 1]]);
  out.state.units[0].ammo = 0;
  assert.equal(ammoLevel(out, out.state.units[0]), 'empty');
  assert.equal(out.deploy({ unitId: out.state.units[0].id }).error, 'out-of-ammo');
});

test('Resupply costs money like building the units, ends the turn, and can be undone', () => {
  const g = world(['H.A....h', '........'], [['transport_copter', 0, 3, 0], ['recon', 1, 7, 1]]);
  const copter = g.state.units[0];
  copter.ammo = 0;
  assert.equal(resupplyCost(g, copter), 2000, 'two soldiers at 1,000 each');
  const before = g.state.funds[0];
  const res = g.act({ unitId: copter.id, to: { x: 3, y: 0 }, action: { type: 'resupply' } });
  assert.equal(res.ok, true);
  assert.equal(copter.ammo, 2);
  assert.equal(copter.done, true);
  assert.equal(g.state.funds[0], before - 2000);
  assert.equal(res.events.find((e) => e.type === 'resupply').cost, 2000);
  assert.equal(g.undo(), true);
  assert.equal(g.state.funds[0], before, 'the money comes back');
  assert.equal(g.state.units[0].ammo, 0);
});

test('Resupply without the money is just a Wait, with a resupplyDenied event', () => {
  const g = world(['H.A....h', '........'], [['transport_copter', 0, 3, 0], ['recon', 1, 7, 1]]);
  const copter = g.state.units[0];
  copter.ammo = 0;
  g.state.funds[0] = 1500;
  const res = g.act({ unitId: copter.id, to: { x: 3, y: 0 }, action: { type: 'resupply' } });
  assert.equal(res.ok, true);
  assert.ok(res.events.some((e) => e.type === 'resupplyDenied'));
  assert.equal(copter.ammo, 0);
  assert.equal(copter.done, true);
  assert.equal(g.state.funds[0], 1500);
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

test('the AI flies a transport copter toward enemy property, drops a soldier there and orders it', () => {
  const g = world(['H.....h', '.......'], [['transport_copter', 0, 1, 0], ['recon', 1, 6, 1]]);
  const copter = g.state.units[0];
  const events = playTurn(g);
  assert.ok(events.some((e) => e.type === 'deploy'), 'it dropped troops');
  const soldier = g.state.units.find((u) => u.type === 'soldier');
  assert.ok(soldier && soldier.done, 'and the soldier was ordered');
  assert.notDeepEqual([soldier.x, soldier.y], [copter.x, copter.y], 'off the copter\'s tile');
  assert.equal(copter.ammo, 1);
});

test('the AI sends an empty transport copter to an airfield and resupplies it when it can pay', () => {
  const g = world(['H.A.....h', '.........'], [['transport_copter', 0, 7, 0], ['recon', 1, 8, 1]]);
  const copter = g.state.units[0];
  copter.ammo = 0;
  let paid = 0;
  for (let i = 0; i < 4 && !paid; i++) {
    paid = playTurn(g).filter((e) => e.type === 'resupply').reduce((n, e) => n + e.cost, 0);
    g.endTurn(); g.endTurn();
  }
  assert.equal(paid, 2000, 'it flew to the airfield and paid for two soldiers');
});

test('the AI does not buy ammo it cannot pay for', () => {
  const g = world(['H.A.....h', '.........'], [['transport_copter', 0, 3, 0], ['recon', 1, 8, 1]]);
  const copter = g.state.units[0];
  copter.ammo = 0;
  g.state.funds[0] = 500;
  const order = chooseOrder(g, copter);
  assert.equal(order.action.type, 'wait');
});

// The strategist engine: what it builds when it is stuck on an island, how it lands troops across the water, focus fire, sharing out
// captures, and keeping out of the enemy's reach.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { makeGame, rawMap } from '../helpers/fixtures.js';
import { loadRegistry } from '../../src/data/loader.js';
import { parseMap } from '../../src/data/map-format.js';
import { Game } from '../../src/engine/game.js';
import { unitAt } from '../../src/engine/queries.js';
import { playTurn } from '../../src/ai/runner.js';
import { areaAt, areas, gapTo, inRangeOf } from '../../src/ai/strategist/analysis.js';
import { matchup } from '../../src/ai/strategist/knowledge.js';
import { planCaptures } from '../../src/ai/strategist/goals.js';
import { paramsOf } from '../../src/ai/strategist/params.js';
import { planBuilds } from '../../src/ai/strategist/production.js';
import { FALLBACK } from '../../src/ai/strategist/selector.js';
import { Situation } from '../../src/ai/strategist/situation.js';
import { bestOrder } from '../../src/ai/strategist/tactics.js';

const registry = await loadRegistry(readData);
const legend = {
  '~': { terrain: 'sea' }, '.': { terrain: 'plain' }, c: { terrain: 'city' },
  H: { terrain: 'hq', owner: 0 }, h: { terrain: 'hq', owner: 1 },
  F: { terrain: 'factory', owner: 0 }, B: { terrain: 'barracks', owner: 0 }, A: { terrain: 'airfield', owner: 0 }, Y: { terrain: 'shipyard', owner: 0 },
};
const world = (rows, unitsOnMap, funds = [30000, 30000], reg = registry) => {
  const players = [{ faction: 'ashmark', controller: 'ai', funds: funds[0] }, { faction: 'vantor_reach', controller: 'ai', funds: funds[1] }];
  const g = new Game(reg, parseMap(rawMap({ rows, unitsOnMap, players, legend }), reg));
  g.aiSetup = [{ engine: 'strategist', profile: {} }, { engine: 'strategist', profile: {} }];
  g.aiSeed = 3;
  return g;
};
const situation = (g, player = 0, profile = {}) => {
  const sit = new Situation(g, player, paramsOf(profile), FALLBACK);
  sit.profile = profile;
  sit.remaining = sit.mine;
  planCaptures(sit);
  return sit;
};

// two islands: ours on the left (HQ, factory, barracks, airfield, shipyard), theirs on the right
const ISLANDS = [
  'HF.~~~~~c..h',
  'BA.~~~~~....',
  '..Y~~~~~....',
];

test('landmasses: each island is its own area for walkers, the whole map one for fliers; distances to an area', () => {
  const g = world(ISLANDS, [['tank', 1, 10, 1]]);
  assert.notEqual(areaAt(g, 'foot', 0, 0), areaAt(g, 'foot', 11, 0), 'the islands are apart on foot');
  assert.equal(areaAt(g, 'foot', 4, 0), -1, 'nobody walks on the sea');
  assert.equal(areas(g, 'air').sizes.length, 1);
  const theirs = areaAt(g, 'foot', 11, 0);
  assert.equal(gapTo(g, 'foot', theirs)[2], 6, 'from (2,0) the enemy shore is 6 tiles away');
  assert.equal(inRangeOf(g, 'naval', areaAt(g, 'naval', 5, 0), 8, 0, 1), true, 'a ship can get next to the coastal city');
  assert.equal(inRangeOf(g, 'tread', areaAt(g, 'tread', 0, 0), 8, 0, 1), false, 'a tank cannot');
});

test('stuck on an island, it builds nothing that walks or drives: only what can reach the enemy', () => {
  const g = world(ISLANDS, [['tank', 1, 10, 1], ['soldier', 1, 9, 2]]);
  const builds = planBuilds(situation(g));
  assert.ok(builds.length, 'it does build');
  for (const b of builds) {
    const def = registry.unit(b.unit);
    assert.ok(['air', 'naval'].includes(def.moveClass), `${b.unit} (${def.moveClass}) at ${b.x},${b.y} cannot reach the other island`);
  }
});

test('once the enemy has landed on its island, ground units are worth building again', () => {
  const g = world(ISLANDS, [['tank', 1, 10, 1], ['tank', 1, 1, 2]]);   // an enemy tank ashore on our island
  const builds = planBuilds(situation(g));
  assert.ok(builds.some((b) => registry.unit(b.unit).moveClass === 'tread' || registry.unit(b.unit).moveClass === 'wheels'), builds.map((b) => b.unit).join(','));
});

test('with land to take across the water, a carrier is worth building, but not a walker that cannot get there', () => {
  const g = world(ISLANDS, [['tank', 1, 11, 2]]);
  const builds = planBuilds(situation(g));
  const sit = situation(g);
  assert.ok(builds.some((b) => sit.game.registry.unit(b.unit).attributes.deploy), `a carrier among ${builds.map((b) => b.unit).join(',')}`);
  assert.ok(!builds.some((b) => b.unit === 'soldier'), 'no soldiers: nothing on this island to capture');
});

test('a transport copter flies its troops over and they capture the city on the other island', () => {
  const g = world([
    'H.~~~~~c..h',
    '.A~~~~~....',
  ], [['transport_copter', 0, 1, 1], ['soldier', 1, 10, 1]], [0, 0]);
  const events = [];
  for (let t = 0; t < 10 && !g.isOver; t++) {
    events.push(...playTurn(g).map((e) => ({ ...e, player: g.state.turn })));
    if (g.state.owners[0][7] === 0 || unitAt(g, 7, 0)?.owner === 0) break;
    g.endTurn();
  }
  assert.ok(events.some((e) => e.type === 'deploy' && e.player === 0), 'it dropped its troops');
  const city = unitAt(g, 7, 0);
  assert.ok(g.state.owners[0][7] === 0 || (city?.owner === 0 && city.capture > 0), 'and they are taking the city');
});

test('a flier only plans landings it can make and still get back to refuel', async () => {
  // helicopters carry no fuel in the shipped data, so give this carrier a four-turn tank for the test
  const fueled = await loadRegistry(async (path) => {
    const data = await readData(path);
    if (path === 'units.json') data.transport_copter.attributes.fuel = { max: 4, low: 1 };
    return data;
  });
  const g = world([
    'H.~~~~~~~~~~~~~~~~~~~c..h',
    '.A~~~~~~~~~~~~~~~~~~~....',
  ], [['transport_copter', 0, 1, 1], ['soldier', 1, 24, 1]], [0, 0], fueled);
  const sit = situation(g);
  const c = bestOrder(sit, g.state.units[0]);
  assert.notEqual(c.goal.kind, 'land', 'the city is 20 tiles out: too far for 4 turns of fuel there and back');
});

test('focus fire: two attackers finish one target rather than wounding two', () => {
  const g = makeGame({
    units: { hitter: { hits: 50 }, target: { cost: 3000, hits: 20 } },
    rows: ['.....', '.....', '.....'],
    unitsOnMap: [['target', 1, 2, 0], ['target', 1, 2, 2], ['hitter', 0, 0, 1], ['hitter', 0, 4, 1]],
  });
  g.aiSetup = [{ engine: 'strategist' }, null];
  playTurn(g);
  const left = g.state.units.filter((u) => u.owner === 1);
  assert.equal(left.length, 1, 'one target destroyed');
  assert.equal(left[0].hp, 10, 'and the other untouched');
});

test('captures are shared out: two capturers head for two different cities', () => {
  const g = makeGame({
    units: { grunt: { attributes: { capture: true } }, foe: {} },
    rows: ['c........c', '..........', 'H........h'],
    unitsOnMap: [['grunt', 0, 4, 1], ['grunt', 0, 5, 1], ['foe', 1, 9, 1]],
  });
  const sit = situation(g);
  const targets = [...sit.captureTargets.values()].map((p) => `${p.x},${p.y}`);
  assert.equal(targets.length, 2);
  assert.notEqual(targets[0], targets[1]);
});

test('threat: with the enemy\'s reach counted, a unit stops short of where it would be hit', () => {
  const build = () => makeGame({
    units: { scout: { cost: 3000, move: 6, hits: 10 }, brute: { cost: 5000, move: 3, hits: 100 } },
    rows: ['H...........h'],
    unitsOnMap: [['scout', 0, 0, 0], ['brute', 1, 9, 0]],
  });
  const careful = build();
  const reckless = build();
  const a = bestOrder(situation(careful), careful.state.units[0]);
  const b = bestOrder(situation(reckless, 0, { params: { threat: 0 } }), reckless.state.units[0]);
  const sit = situation(careful);
  assert.equal(sit.threatAt(careful.state.units[0], a.order.to.x, a.order.to.y), 0, `stops out of reach (at ${a.order.to.x})`);
  assert.ok(b.order.to.x > a.order.to.x, 'without the threat map it walks into range');
});

test('matchups come from the data: a new unit is understood without any code', () => {
  const g = world(ISLANDS, [['tank', 1, 10, 1]]);
  assert.ok(matchup(g, 'tank', 'soldier') > matchup(g, 'soldier', 'tank'));
  assert.equal(matchup(g, 'tank', 'fighter'), 0, 'a tank cannot shoot down a fighter');
  assert.ok(matchup(g, 'fighter', 'bomber') > 0);
});

test('a medic (which heals by itself) ends its move next to wounded friends, and plays on as a support', () => {
  // a wounded soldier at x=3, the medic at x=0 (it moves 2); the enemy HQ is far off to the right
  const g = world(['H.......h'], [['medic', 0, 0, 0], ['soldier', 0, 3, 0, 4], ['soldier', 1, 8, 0]]);
  const medic = g.state.units[0];
  const sit = situation(g);
  const order = bestOrder(sit, medic);
  assert.ok(order, 'the medic gets an order');
  assert.equal(order.kind, 'support');
  assert.ok(Math.abs(order.order.to.x - 3) <= 1 && order.order.to.y === 0, `next to the wounded soldier, not at ${order.order.to.x},${order.order.to.y}`);
});

test('a unit does not park on its own factory when it could do its job from a neighbouring tile', () => {
  // the medic stands on the factory beside a wounded soldier: it could heal from there, but staying put would block every build that turn
  const g = world(['F.......h'], [['medic', 0, 0, 0], ['soldier', 0, 1, 0, 4], ['soldier', 1, 8, 0]]);
  const order = bestOrder(situation(g), g.state.units[0]);
  assert.ok(order?.order?.to, 'the medic is given a move');
  assert.notEqual(order.order.to.x, 0, 'and it leaves the factory tile');
});

test('a medic goes to take a free city rather than waiting beside a wounded friend: all infantry capture', () => {
  const g = world(['H..c.....'], [['medic', 0, 1, 0], ['soldier', 0, 0, 0, 4], ['soldier', 1, 8, 0]]);
  const medic = g.state.units[0];
  const sit = situation(g);
  assert.equal(sit.captureTargets.get(medic.id)?.x, 3, 'the medic is given the city');
  const order = bestOrder(sit, medic);
  assert.equal(order.goal.kind, 'capture');
  assert.ok(order.order.to.x > 1, 'and it heads for it');
});

test('a medic keeps out of the enemy\'s reach: support units weigh the threat map like any other unit', () => {
  const g = world(['H.........h.', '............', '............'], [['medic', 0, 5, 1], ['soldier', 0, 7, 1, 4], ['tank', 1, 8, 1]]);
  const sit0 = situation(g);
  const careful = bestOrder(sit0, g.state.units[0]);
  const reckless = bestOrder(situation(g, 0, { params: { threat: 0 } }), g.state.units[0]);
  assert.equal(sit0.threatAt(g.state.units[0], careful.order.to.x, careful.order.to.y), 0, 'it stays where the tank cannot reach');
  assert.ok(sit0.threatAt(g.state.units[0], reckless.order.to.x, reckless.order.to.y) > 0, 'while a medic that ignores the threat walks in to heal');
});

test('troops just dropped by a carrier always leave its tile (there is a free neighbour, or the drop is refused)', () => {
  const g = world(['H.~~~~h', '~~~~~~~'], [['transport_copter', 0, 1, 0], ['soldier', 1, 6, 0]], [0, 0]);
  g.aiSetup = [{ engine: 'strategist', profile: {} }, null];
  const copter = g.state.units[0];
  assert.ok(g.deploy({ unitId: copter.id }).ok);
  const dropped = g.state.units.find((u) => u.owner === 0 && u !== copter);
  const c = bestOrder(situation(g), dropped);
  assert.ok(c, 'it gets an order');
  assert.ok(c.order.to.x !== copter.x || c.order.to.y !== copter.y, 'and the order moves it off the carrier');
  const walled = world(['H~~~~~h', '~~~~~~~'], [['transport_copter', 0, 0, 0], ['soldier', 1, 6, 0]], [0, 0]);
  assert.equal(walled.deploy({ unitId: walled.state.units[0].id }).error, 'no-room', 'no free tile: the engine refuses the drop, so the AI never has a stuck unit');
  assert.doesNotThrow(() => { walled.aiSetup = [{ engine: 'strategist', profile: {} }, null]; playTurn(walled); });
});

test('join (off by default): two badly hurt units of one kind merge instead of both walking home', () => {
  const rows = ['H.........h', '...........'];
  const units = [['soldier', 0, 4, 0, 2], ['soldier', 0, 5, 0, 3], ['soldier', 1, 10, 1]];
  const off = world(rows, units);
  const on = world(rows, units);
  const joiner = (g, profile) => bestOrder(situation(g, 0, profile), g.state.units[1]);   // the 3 HP one, standing next to the 2 HP one
  assert.notEqual(joiner(off, {}).order.action.type, 'join', 'not unless the profile asks for it');
  const c = joiner(on, { params: { join: 20 } });
  assert.equal(c.order.action.type, 'join');
  assert.deepEqual(c.order.to, { x: 4, y: 0 });
  assert.ok(on.validateOrder(c.order).ok, 'and the engine accepts it');
  const healthy = world(rows, [['soldier', 0, 4, 0, 9], ['soldier', 0, 5, 0, 9], ['soldier', 1, 10, 1]]);
  assert.notEqual(bestOrder(situation(healthy, 0, { params: { join: 20 } }), healthy.state.units[1]).order.action.type, 'join', 'healthy units do not merge');
});

test('hide: a sniper weighs the threat less on a tile that cloaks it', () => {
  const g = world(['H.F.......h', '...........'], [['sniper', 0, 0, 1], ['tank', 1, 6, 1]]);
  const sniper = g.state.units[0];
  const plain = situation(g, 0, { params: { threat: 12, hide: 0 } });
  const wary = bestOrder(plain, sniper);
  const hiding = bestOrder(situation(g, 0, { params: { threat: 12, hide: 1 } }), sniper);
  assert.ok(hiding.order.to.x >= wary.order.to.x, 'it goes at least as far forward when the woods hide it');
});

test('finish: far ahead, the army drops its plan and heads for the enemy HQ', () => {
  const g = world(['H.........h'], [['tank', 0, 2, 0], ['tank', 0, 3, 0], ['soldier', 1, 9, 0]]);
  const s = situation(g, 0, { params: { finish: 1.5 } });
  assert.equal(s.target, 'hq');
  const even = world(['H.........h'], [['soldier', 0, 2, 0], ['soldier', 1, 9, 0]]);
  assert.notEqual(situation(even, 0, { params: { finish: 1.5 } }).target, 'hq', 'not while the forces are level');
  assert.notEqual(situation(even).target, 'hq');
});

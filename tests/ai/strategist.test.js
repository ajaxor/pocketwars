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
const world = (rows, unitsOnMap, funds = [30000, 30000]) => {
  const players = [{ faction: 'ashmark', controller: 'ai', funds: funds[0] }, { faction: 'vantor_reach', controller: 'ai', funds: funds[1] }];
  const g = new Game(registry, parseMap(rawMap({ rows, unitsOnMap, players, legend }), registry));
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

test('a flier only plans landings it can make and still get back to refuel', () => {
  const g = world([
    'H.~~~~~~~~~~~~~~~~~~~c..h',
    '.A~~~~~~~~~~~~~~~~~~~....',
  ], [['transport_copter', 0, 1, 1], ['soldier', 1, 24, 1]], [0, 0]);
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

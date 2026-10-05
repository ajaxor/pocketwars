// A leader's loadout changes what a player's buildings build: the menu, the build check, the money needed to stay in the game, and
// what the computer picks. Tiny rulesets first (one rule at a time), then a whole AI game with two different kits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { LEGEND, makeGame } from '../helpers/fixtures.js';
import { buildOptions, buildProblem, cheapestBuildableCost, menuFor } from '../../src/engine/economy.js';
import { planBuild } from '../../src/ai/greedy.js';
import { playTurn } from '../../src/ai/runner.js';
import { Game } from '../../src/engine/game.js';
import { loadMap, loadRegistry } from '../../src/data/loader.js';
import { placeStart, withLeaders } from '../../src/data/formation.js';
import { buildMenuModel } from '../../src/ui/build-menu.js';

const LAB = { name: 'Lab', defense: 3, moveCost: { foot: 1, wheel: 1, air: 1 }, attributes: { property: { income: 1000, capturePoints: 20, repair: 2, builds: ['ground'] } }, render: { base: '#86b95c' } };
const legend = { ...LEGEND, n: { terrain: 'base' }, l: { terrain: 'lab', owner: 0 }, L: { terrain: 'lab', owner: 1 } };
const units = { a: { cost: 1000 }, b: { cost: 3000 }, c: { cost: 2000, category: 'special' } };
const loadouts = {
  default: { build: { base: ['a'] }, start: {} },
  leaders: { x: { build: { base: ['b'] } }, y: {}, z: { build: { base: ['b', 'c'] } } },
};
const players = (l0, l1, funds = 5000) => [
  { faction: 'red', controller: 'human', funds, ...(l0 && { leader: l0 }) },
  { faction: 'blue', controller: 'human', funds, ...(l1 && { leader: l1 }) },
];
const game = (l0, l1, o = {}) => makeGame({ units, terrain: { lab: LAB }, loadouts, legend, rows: ['aH.hb', 'l...L', '..n..'], players: players(l0, l1, o.funds), ...o });

test('each player\'s buildings build what their leader\'s loadout lists, in its order', () => {
  const g = game('x', 'y');
  assert.deepEqual(buildOptions(g, 0, 0).map((u) => u.id), ['b']);
  assert.deepEqual(buildOptions(g, 4, 0).map((u) => u.id), ['a'], 'a leader with an empty kit gets the default menu');
  assert.deepEqual(game('z', 'y').state && buildOptions(game('z', 'y'), 0, 0).map((u) => u.id), ['b', 'c'], 'a menu can name units of a category the building does not list');
});

test('a player without a leader, and a building nobody owns, get the standard menu', () => {
  const g = game(null, 'x');
  assert.deepEqual(buildOptions(g, 0, 0).map((u) => u.id), ['a']);
  assert.deepEqual(menuFor(g, null, 2, 2).map((u) => u.id), ['a'], 'neutral base');
  assert.deepEqual(buildOptions(g, 2, 2).map((u) => u.id), ['a']);
});

test('a building the loadouts say nothing about (a lab) gives everyone the units of its categories', () => {
  const g = game('x', 'z');
  assert.deepEqual(buildOptions(g, 0, 1).map((u) => u.id), ['a', 'b']);
  assert.deepEqual(buildOptions(g, 4, 1).map((u) => u.id), ['a', 'b']);
});

test('without loadouts nothing changes: every building gives the units of its categories', () => {
  const g = makeGame({ units, loadouts: undefined, rows: ['aH.hb'] });
  assert.deepEqual(buildOptions(g, 0, 0).map((u) => u.id), ['a', 'b']);
});

test('buildProblem refuses a unit that is not on the player\'s menu, even when its category fits', () => {
  const g = game('x', 'y');
  assert.equal(buildProblem(g, 0, 0, 0, 'a'), 'cannot-build-here');
  assert.equal(buildProblem(g, 0, 0, 0, 'c'), 'cannot-build-here');
  assert.equal(buildProblem(g, 0, 0, 0, 'b'), null);
  assert.equal(buildProblem(g, 1, 4, 0, 'a'), null);
  assert.equal(buildProblem(g, 1, 4, 0, 'b'), 'cannot-build-here');
  const refused = g.build(0, 0, 'a');
  assert.deepEqual([refused.ok, refused.error], [false, 'cannot-build-here']);
  assert.equal(g.state.funds[0], 5000);
  assert.equal(g.build(0, 0, 'b').ok, true);
  assert.equal(g.state.funds[0], 2000);
  assert.deepEqual(g.state.units.map((u) => [u.type, u.x, u.y]), [['b', 0, 0]]);
});

test('the money a player needs to stay in the game follows the menus of the buildings they own', () => {
  const g = makeGame({ units, loadouts, rows: ['aH.hb'], players: players('x', 'y') });
  assert.equal(cheapestBuildableCost(g, 0), 3000);
  assert.equal(cheapestBuildableCost(g, 1), 1000);
  const none = makeGame({ units, loadouts, rows: ['.H.h.'], players: players('x', 'y') });
  assert.equal(cheapestBuildableCost(none, 0), Infinity);
});

test('a lab counts too: it can be the cheapest thing a player is able to build', () => {
  const g = game('x', 'y', { funds: 1000 });
  assert.equal(cheapestBuildableCost(g, 0), 1000, 'x\'s base only builds b (3000), but the lab builds a (1000)');
});

test('the build menu window lists the leader\'s units', () => {
  const g = game('z', 'y');
  const m = buildMenuModel(g, 0, 0, 0);
  assert.deepEqual(m.options.map((o) => o.id), ['b', 'c']);
  assert.deepEqual(m.options.map((o) => o.affordable), [true, true]);
});

// ---- the computer --------------------------------------------------------------------------------------------------------------------------
const weights = { distanceToGoal: 2, unreachableDistance: 60, terrainDefense: 0.4, attackBase: 60, killBonus: 4, captureBase: 50, victoryCaptureBonus: 100, costUnit: 1000 };
const ai = { weights, build: { ground: [{ unit: 'a', max: 9 }, { unit: 'b', max: 9 }], special: [{ unit: 'c', max: 9 }] } };

test('the computer builds from its leader\'s menu: a unit that is not on it is skipped, not tried', () => {
  assert.equal(planBuild(game('x', 'y', { ai }), 0, 0), 'b');
  assert.equal(planBuild(game('y', 'x', { ai }), 0, 0), 'a');
});

test('the computer also considers a category its leader added to a building, after the building\'s own', () => {
  const g = game('z', 'y', { ai, funds: 2500 });
  assert.equal(planBuild(g, 0, 0), 'c', 'b costs 3000 and cannot be paid, so the extra category is next');
  assert.equal(planBuild(game('z', 'y', { ai, funds: 9000 }), 0, 0), 'b', 'the building\'s own category comes first');
  assert.equal(planBuild(game('z', 'y', { ai: { weights, build: { ground: ai.build.ground } }, funds: 2500 }), 0, 0), null, 'a category the profile has no rules for is never built');
});

test('two AI teams with different kits build only what their menus allow, over a whole game', async () => {
  const base = await loadRegistry(readData);
  const custom = JSON.parse(JSON.stringify(await readData('loadouts.json')));
  custom.leaders.ada = { build: { barracks: ['soldier'], factory: ['tank'] } };
  custom.leaders.vex = { build: { barracks: ['sniper', 'mech'], factory: ['artillery', 'recon'] }, start: { hq: [{ unit: 'soldier', at: [0, 1] }], barracks: [], factory: [], airfield: [] } };
  const registry = await loadRegistry(async (p) => (p === 'loadouts.json' ? custom : readData(p)));
  const classic = await loadMap(readData, registry, 'classic');
  const rich = { ...classic, players: classic.players.map((p) => ({ ...p, controller: 'ai', funds: 40000 })) };
  const play = (engine) => {
    const g = new Game(registry, withLeaders(rich, registry, ['ada', 'vex']));
    g.aiSetup = [{ engine }, { engine }];
    g.aiSeed = 1;
    assert.equal(g.state.units.filter((u) => u.owner === 1).length, 1, 'vex starts with the one soldier her kit gives (no sets for her factories)');
    assert.equal(g.state.units.filter((u) => u.owner === 0).length, placeStart(classic, base, 0, base.loadoutFor('ada').start).units.length);
    const built = { 0: { barracks: new Set(), factory: new Set() }, 1: { barracks: new Set(), factory: new Set() } };
    for (let turn = 0; turn < 24 && !g.isOver; turn++) {
      for (const ev of playTurn(g)) {
        if (ev.type !== 'build') continue;
        const terrain = g.map.terrain[ev.unit.y][ev.unit.x];
        const allowed = registry.loadoutFor(g.map.players[ev.unit.owner].leader).build[terrain];
        assert.ok(allowed.includes(ev.unit.type), `${engine}: ${ev.unit.type} on a ${terrain} is not on the menu of player ${ev.unit.owner}`);
        built[ev.unit.owner][terrain]?.add(ev.unit.type);
      }
      g.endTurn();
    }
    return built;
  };
  play('strategist');   // every engine keeps to the menus; which buildings it uses depends on its plan
  const built = play('greedy');   // greedy's fixed lists use every building
  assert.deepEqual([...built[0].barracks], ['soldier']);
  assert.deepEqual([...built[0].factory], ['tank']);
  assert.ok(built[1].barracks.size && [...built[1].barracks].every((t) => ['sniper', 'mech'].includes(t)), 'vex builds snipers and mechs at the barracks');
  assert.ok(built[1].factory.size && [...built[1].factory].every((t) => ['artillery', 'recon'].includes(t)), 'and artillery and recon at the factory');
});

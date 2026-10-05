// The strategy layer: the shipped strategy file, conditions, tastes, picking and switching plans, and learning across battles.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { makeData, makeGame } from '../helpers/fixtures.js';
import { loadRegistry, loadMap } from '../../src/data/loader.js';
import { createRegistry } from '../../src/data/registry.js';
import { parseMap } from '../../src/data/map-format.js';
import { validateData } from '../../src/data/validate.js';
import { Game } from '../../src/engine/game.js';
import { loadHistory, recordGame } from '../../src/ai/history.js';
import { memoryOf, rngFor } from '../../src/ai/runner.js';
import { paramsOf } from '../../src/ai/strategist/params.js';
import { currentStrategy, FALLBACK } from '../../src/ai/strategist/selector.js';
import { applicable, buildTaste, holds, withJitter } from '../../src/ai/strategist/strategies.js';
import { validateStrategies } from '../../src/ai/strategist/index.js';
import { loadAnyMap } from '../../tools/ai/lib/maps.mjs';

const registry = await loadRegistry(readData);

test('the shipped strategies are valid, varied, and every one can be chosen somewhere', async () => {
  const file = await readData('ai-strategies.json');
  const problems = [];
  validateStrategies(file, await readData('units.json'), problems);
  assert.deepEqual(problems, []);
  assert.ok(registry.aiStrategies.length >= 15, 'a large pool keeps the computer from being predictable');
  const maps = await Promise.all(['classic', 'island_chain', 'four_seas', 'twin_fleets'].map((id) => loadMap(readData, registry, id)));
  maps.push(await loadAnyMap(readData, registry, 'archipelago'));
  for (const s of registry.aiStrategies) {
    const somewhere = maps.some((m) => registry.leaderIds.some((leader) => {
      const g = new Game(registry, { ...m, players: m.players.map((p) => ({ ...p, leader })) });
      return applicable(g, 0, s);
    }));
    assert.ok(somewhere || s.when?.includes('enemyAir'), `${s.id} applies on some map with some leader`);
  }
});

test('strategy file problems are reported: unknown conditions, keys, units, targets', () => {
  const problems = [];
  validateStrategies({ strategies: [
    { id: 'a', name: 'A', when: ['moonIsFull'] },
    { id: 'a', name: 'A again', build: { colour: { red: 2 } } },
    { id: 'b', name: 'B', build: { unit: { ghost: 2 } }, tactics: { target: 'moon' } },
  ] }, { soldier: {} }, problems);
  for (const want of [/unknown condition "moonIsFull"/, /duplicate id/, /build.colour: unknown key/, /build.unit.ghost: unknown unit/, /tactics.target/]) {
    assert.ok(problems.some((p) => want.test(p)), `${want}: ${problems.join(' | ')}`);
  }
});

test('conditions read the map and the factories: islands, ground routes, and open-ended canBuild', async () => {
  const chain = new Game(registry, await loadMap(readData, registry, 'island_chain'));
  assert.equal(holds(chain, 0, 'groundRoute'), true, 'Island Chain has a causeway');
  const arch = new Game(registry, await loadAnyMap(readData, registry, 'archipelago'));
  assert.equal(holds(arch, 0, 'islands'), true);
  assert.equal(holds(arch, 0, '!groundRoute'), true);
  assert.equal(holds(arch, 0, 'canBuild:naval'), true, 'a category');
  assert.equal(holds(arch, 0, 'canBuild:helicopter'), true, 'a tag');
  assert.equal(holds(arch, 0, 'canBuild:battleship|ghost'), true, 'any of several');
  assert.throws(() => holds(arch, 0, 'moonIsFull'), /unknown strategy condition/);
});

test('a strategy\'s taste multiplies over every way a unit matches it', () => {
  const s = { build: { category: { vehicle: 2 }, moveClass: { tread: 1.5 }, role: { capture: 0.5 }, unit: { tank: 3 }, heavy: 2 } };
  assert.equal(buildTaste(s, registry.unit('tank')), 2 * 1.5 * 3);
  assert.equal(buildTaste(s, registry.unit('heavy_tank')), 2 * 1.5 * 2);
  assert.equal(buildTaste(s, registry.unit('soldier')), 0.5);
  assert.equal(buildTaste({}, registry.unit('soldier')), 1);
});

test('jitter nudges a plan\'s tactics a little and no more', () => {
  let n = 0;
  const rng = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 50; i++) {
    const j = withJitter({ tactics: { aggression: 1.2, mass: 4 } }, rng);
    assert.ok(j.tactics.aggression >= 1.2 * 0.88 && j.tactics.aggression <= 1.2 * 1.12);
    assert.ok(j.tactics.mass >= 2 && j.tactics.mass <= 6);
  }
});

const STRATS = { strategies: [
  { id: 'rush', name: 'Rush', tactics: { target: 'hq' } },
  { id: 'hold', name: 'Hold', tactics: { target: 'army', mass: 5 } },
  { id: 'never', name: 'Never', when: ['freeForAll'] },
] };

function strategyGame(enemyUnits = 1) {
  const data = makeData({ units: { grunt: { attributes: { capture: true } }, tank: { cost: 7000 } } });
  data['ai-strategies'] = STRATS;
  const registry2 = createRegistry(data);
  const units = [['grunt', 0, 0, 1]];
  for (let i = 0; i < enemyUnits; i++) units.push(['tank', 1, 2 + i, 1]);
  const map = parseMap({ format: 'pocketwars-map', version: 1, id: 't', name: 'T', description: '',
    players: [{ faction: 'red', controller: 'ai', funds: 0 }, { faction: 'blue', controller: 'ai', funds: 0 }],
    legend: { '.': { terrain: 'plain' }, H: { terrain: 'hq', owner: 0 }, h: { terrain: 'hq', owner: 1 } },
    tiles: ['H..........h', '............'], units: units.map(([type, owner, x, y]) => ({ type, owner, x, y })) }, registry2);
  const g = new Game(registry2, map);
  g.aiSeed = 1;
  return g;
}
const ctxOf = (g, history = null, profile = {}) => { const memory = memoryOf(g, 0); return { player: 0, profile, memory, rng: rngFor(g, 0, memory), history }; };

test('picking: only strategies whose conditions hold; with no strategies at all, a balanced fallback', () => {
  for (let seed = 1; seed < 20; seed++) {
    const g = strategyGame();
    g.aiSeed = seed;
    assert.notEqual(currentStrategy(g, ctxOf(g), paramsOf({})).id, 'never');
  }
  const bare = makeGame();
  assert.equal(currentStrategy(bare, ctxOf(bare), paramsOf({})).id, FALLBACK.id);
});

test('a tuned strategyWeight of 0 rules a strategy out', () => {
  for (let seed = 1; seed < 10; seed++) {
    const g = strategyGame();
    g.aiSeed = seed;
    assert.equal(currentStrategy(g, ctxOf(g, null, { strategyWeight: { rush: 0 } }), paramsOf({})).id, 'hold');
  }
});

test('a failing strategy is dropped after its hold time, for one not yet tried', () => {
  const g = strategyGame(6);   // badly outnumbered: its share of the worth is low
  const ctx = ctxOf(g);
  const params = paramsOf({});
  const first = currentStrategy(g, ctx, params).id;
  ctx.memory.strategy.share = 1;   // it was doing better when it started
  g.state.day += params.holdDays;
  const second = currentStrategy(g, ctx, params).id;
  assert.notEqual(second, first);
  assert.deepEqual(new Set(ctx.memory.tried), new Set([first, second]));
  assert.equal(ctx.memory.log.length, 2);
});

test('history: plans that beat this player are favoured and last battle\'s is avoided', () => {
  const pickCounts = (history) => {
    const n = { rush: 0, hold: 0 };
    for (let seed = 1; seed <= 200; seed++) { const g = strategyGame(); g.aiSeed = seed; n[currentStrategy(g, ctxOf(g, history), paramsOf({})).id]++; }
    return n;
  };
  const plain = pickCounts(null);
  const learned = pickCounts({ strategies: { rush: { games: 6, wins: 6 }, hold: { games: 6, wins: 0 } }, last: 'hold' });
  assert.ok(learned.rush > plain.rush + 40, `${JSON.stringify(plain)} -> ${JSON.stringify(learned)}`);
});

test('history is saved per browser: each plan a computer player used, and whether it won', () => {
  const store = { data: {}, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = v; } };
  assert.deepEqual(loadHistory(store), { strategies: {}, last: null });
  const g = strategyGame();
  g.state.ai = { 0: { log: [{ id: 'rush', day: 1 }, { id: 'hold', day: 6 }] } };
  g.state.winner = 0;
  recordGame(g, store);
  g.state.winner = 1;
  recordGame(g, store);
  const h = loadHistory(store);
  assert.deepEqual(h.strategies.rush, { games: 2, wins: 1 });
  assert.deepEqual(h.strategies.hold, { games: 2, wins: 1 });
  assert.equal(h.last, 'rush');
  assert.deepEqual(loadHistory({ getItem() { throw new Error('refused'); } }), { strategies: {}, last: null }, 'storage refused: no history, no error');
});

test('the shipped data validates with the strategist profile and strategies in place', async () => {
  const raw = {};
  for (const k of ['rules', 'factions', 'terrain', 'weapons', 'units', 'ai', 'ai-strategies', 'ground', 'loadouts']) raw[k] = await readData(`${k}.json`);
  assert.deepEqual(validateData(raw), []);
});

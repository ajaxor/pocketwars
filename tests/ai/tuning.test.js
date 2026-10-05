// The arena and tuner tools: scoring, the search space following the data, and mutations staying in bounds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { makeData } from '../helpers/fixtures.js';
import { loadRegistry } from '../../src/data/loader.js';
import { createRegistry } from '../../src/data/registry.js';
import { PARAMS } from '../../src/ai/strategist/params.js';
import { duelJobs, scoreDuel } from '../../tools/ai/lib/arena.mjs';
import { playMatch, seeded } from '../../tools/ai/lib/match.mjs';
import { loadAnyMap } from '../../tools/ai/lib/maps.mjs';
import { compactProfile, dataHash, fullProfile, getValue, mutate, searchSpace } from '../../tools/ai/lib/tune.mjs';

const registry = await loadRegistry(readData);
const A = { label: 'a', engine: 'strategist', profile: {} };
const B = { label: 'b', engine: 'greedy', profile: registry.ai.engines.greedy };

test('duels play every map with both seat orders and the same seeds', () => {
  const jobs = duelJobs(A, B, { maps: [{ id: 'm', slots: 2 }, { id: 'n', slots: 4 }], seeds: 2 });
  assert.equal(jobs.length, 8);
  assert.deepEqual(jobs[0].labels, ['a', 'b']);
  assert.deepEqual(jobs[1].labels, ['b', 'a']);
  assert.equal(jobs[0].seed, jobs[1].seed);
  assert.deepEqual(jobs.find((j) => j.mapId === 'n').labels, ['a', 'b', 'a', 'b'], 'free-for-all seats alternate');
});

test('scoring: a win is 1, a draw a half; results are kept per map', () => {
  const r = (map, labels, winner, adjudicated = false) => ({ map, winner, adjudicated, days: 10, job: { labels } });
  const s = scoreDuel([r('m', ['a', 'b'], 0), r('m', ['b', 'a'], 1), r('n', ['a', 'b'], null, true), r('n', ['b', 'a'], 0)], A, B);
  assert.equal(s.games, 4);
  assert.equal(s.wins, 2);
  assert.equal(s.losses, 1);
  assert.equal(s.draws, 1);
  assert.equal(s.score, 2.5 / 4);
  assert.equal(s.byMap.m.wins, 2);
  assert.equal(s.adjudicated, 1);
});

test('a match is repeatable from its seed', async () => {
  const map = await loadAnyMap(readData, registry, 'classic');
  const seats = [{ engine: 'strategist', profile: {} }, { engine: 'greedy', profile: registry.ai.engines.greedy }];
  const a = playMatch(registry, map, { seats, seed: 9, maxDays: 6 });
  const b = playMatch(registry, map, { seats, seed: 9, maxDays: 6 });
  assert.deepEqual({ ...a, msPerTurn: 0 }, { ...b, msPerTurn: 0 });
});

test('the search space follows the data: every parameter, every buildable unit, every strategy', () => {
  const dims = searchSpace(registry);
  const keys = new Set(dims.map((d) => d.key));
  for (const k of Object.keys(PARAMS)) assert.ok(keys.has(`params.${k}`));
  assert.ok(keys.has('unitBias.tank') && keys.has('unitBias.marine'));
  assert.ok(!keys.has('unitBias.jammer'), 'structures are never built');
  for (const s of registry.aiStrategies) assert.ok(keys.has(`strategyWeight.${s.id}`));
  // a unit added to the data joins the search with no other change
  const data = makeData({ units: { grunt: {}, walker_mk2: { cost: 4000 } } });
  assert.ok(searchSpace(createRegistry(data)).some((d) => d.key === 'unitBias.walker_mk2'));
});

test('mutations stay inside each dimension\'s range, and compact profiles keep only what differs', () => {
  const dims = searchSpace(registry);
  let p = fullProfile({}, dims);
  const rng = seeded(5);
  for (let i = 0; i < 300; i++) p = mutate(p, dims, rng, 0.4).profile;
  for (const d of dims) { const v = getValue(p, d); assert.ok(v >= d.min && v <= d.max, `${d.key} = ${v}`); }
  const c = compactProfile(fullProfile({ unitBias: { tank: 0.5 } }, dims), dims);
  assert.equal(c.unitBias.tank, 0.5);
  assert.equal(c.unitBias.soldier, undefined);
  assert.equal(Object.keys(c.params).length, Object.keys(PARAMS).length, 'parameters are always written out');
});

test('the data hash changes when the units do (so the tuning is known to be stale)', () => {
  const raw = { units: { a: { cost: 1 } }, maps: {}, code: ['x'] };
  const before = dataHash(raw);
  assert.equal(dataHash(structuredClone(raw)), before);
  raw.units.a.cost = 2;
  assert.notEqual(dataHash(raw), before);
});

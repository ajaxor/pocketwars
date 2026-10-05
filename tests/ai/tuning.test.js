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

test('the search space follows the data: every parameter and every strategy, and nothing per unit', () => {
  const dims = searchSpace(registry);
  const keys = new Set(dims.map((d) => d.key));
  for (const k of Object.keys(PARAMS)) assert.ok(keys.has(`params.${k}`));
  assert.ok(![...keys].some((k) => k.startsWith('unitBias')), 'the AI is unit-agnostic');
  for (const s of registry.aiStrategies) assert.ok(keys.has(`strategyWeight.${s.id}`));
  // a new unit needs no entry anywhere: the search space is the same
  const data = makeData({ units: { grunt: {}, walker_mk2: { cost: 4000 } } });
  assert.equal(searchSpace(createRegistry(data)).length, dims.length - registry.aiStrategies.length + createRegistry(data).aiStrategies.length);
});

test('mutations stay inside each dimension\'s range, and compact profiles keep only what differs', () => {
  const dims = searchSpace(registry);
  let p = fullProfile({}, dims);
  const rng = seeded(5);
  for (let i = 0; i < 300; i++) p = mutate(p, dims, rng, 0.4).profile;
  for (const d of dims) { const v = getValue(p, d); assert.ok(v >= d.min && v <= d.max, `${d.key} = ${v}`); }
  const c = compactProfile(fullProfile({ strategyWeight: { turtle: 2.5 } }, dims), dims);
  assert.equal(c.strategyWeight.turtle, 2.5);
  assert.equal(Object.keys(c.strategyWeight).length, 1, 'only what differs');
  assert.equal(Object.keys(c.params).length, Object.keys(PARAMS).length, 'parameters are always written out');
});

test('the data hash changes when the units do (so the tuning is known to be stale)', () => {
  const raw = { units: { a: { cost: 1 } }, maps: {}, code: ['x'] };
  const before = dataHash(raw);
  assert.equal(dataHash(structuredClone(raw)), before);
  raw.units.a.cost = 2;
  assert.notEqual(dataHash(raw), before);
});

test('evolution strategy: finds the top of a noisy hill over many dimensions at once, and keeps to its bounds', async () => {
  const es = await import('../../tools/ai/lib/es.mjs');
  const dim = { min: 0.2, max: 4, log: true };
  assert.ok(Math.abs(es.fromUnit(dim, es.toUnit(dim, 1)) - 1) < 1e-9, 'log scale round-trips');
  assert.equal(es.fromUnit({ min: -1.5, max: 1.5 }, 0.5), 0);
  const n = 40;
  const target = Array.from({ length: n }, (_, i) => 0.2 + 0.6 * ((i * 7) % 10) / 10);
  const rng = seeded(5);
  const state = es.init(new Array(n).fill(0.5), { lambda: 24, sigma: 0.15 });
  const score = (x) => -x.reduce((a, xi, i) => a + (xi - target[i]) ** 2, 0) + (rng() - 0.5) * 0.05;   // noisy
  const dist = (m) => Math.sqrt(m.reduce((a, xi, i) => a + (xi - target[i]) ** 2, 0));
  const before = dist(state.mean);
  for (let g = 0; g < 120; g++) {
    const cands = es.ask(state, rng);
    for (const c of cands) assert.ok(c.x.every((v) => v >= 0 && v <= 1));
    es.tell(state, cands, cands.map((c) => score(c.x)));
    assert.ok(state.sigma >= es.SIGMA_MIN && state.sigma <= es.SIGMA_MAX);
  }
  assert.ok(dist(state.mean) < before * 0.35, `mean moved toward the target: ${before.toFixed(2)} -> ${dist(state.mean).toFixed(2)}`);
  assert.equal(es.ask(state, rng).length, 24);
});

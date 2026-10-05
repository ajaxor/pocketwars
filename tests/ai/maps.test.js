// The strategist on every shipped map and training map, with leaders: whole games of legal orders, against itself and against greedy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadMapIndex, loadRegistry } from '../../src/data/loader.js';
import { playMatch } from '../../tools/ai/lib/match.mjs';
import { loadAnyMap, trainingMapIds } from '../../tools/ai/lib/maps.mjs';

const registry = await loadRegistry(readData);
const ids = [...Object.keys((await loadMapIndex(readData)).maps), ...trainingMapIds()];

for (const id of ids) {
  test(`${id}: the strategist plays 12 days against itself and against greedy without an invalid order`, async () => {
    const map = await loadAnyMap(readData, registry, id);
    const strat = { engine: 'strategist', profile: registry.ai.engines.strategist };
    const greedy = { engine: 'greedy', profile: registry.ai.engines.greedy };
    for (const [seed, seats] of [[1, map.players.map(() => strat)], [2, map.players.map((_, i) => (i % 2 ? greedy : strat))]]) {
      const r = playMatch(registry, map, { seats, seed, maxDays: 12 });   // an invalid order throws
      assert.ok(r.days >= 1 && r.turns > 0, id);
      assert.ok(r.strategies.some(Boolean), 'a strategist picked a plan');
    }
  });
}

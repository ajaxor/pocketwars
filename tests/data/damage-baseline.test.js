// Regression net for the shipped unit stats: every value in damage-baseline.json was captured from the
// pre-refactor game.js. If you retune data/units.json on purpose, regenerate the baseline (or delete it).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readData } from '../helpers/node-io.js';
import { loadRegistry, loadMap } from '../../src/data/loader.js';
import { Game } from '../../src/engine/game.js';
import { calcDamage } from '../../src/engine/combat.js';

const baseline = JSON.parse(readFileSync(new URL('./damage-baseline.json', import.meta.url), 'utf8'));
const registry = await loadRegistry(readData);
const map = await loadMap(readData, registry, 'classic');

// A tile on the classic map for each terrain the baseline uses.
const TILE = { plain: [0, 2], forest: [1, 0], mountain: [0, 0], road: [4, 2], city: [2, 1], hq: [5, 0] };

test('baseline covers every unit and several terrains', () => {
  assert.ok(baseline.cases.length > 200);
  assert.deepEqual([...new Set(baseline.cases.map((c) => c.t))].sort(), Object.keys(TILE).sort());
});

test('calcDamage matches the original implementation for every captured case', () => {
  const game = new Game(registry, map);
  const failures = [];
  for (const c of baseline.cases) {
    const [x, y] = TILE[c.t];
    assert.equal(map.terrain[y][x], c.t, `fixture tile for ${c.t} moved`);
    const attacker = { id: 9001, type: c.a, owner: 0, x: 0, y: 5, hp: c.ahp, done: false, capture: 0 };
    const defender = { id: 9002, type: c.d, owner: 1, x, y, hp: c.dhp, done: false, capture: 0 };
    game.state.units = [attacker, defender];
    const got = calcDamage(game, attacker, defender);
    if (got !== c.dmg) failures.push(`${c.a}(${c.ahp}) -> ${c.d}(${c.dhp}) on ${c.t}: expected ${c.dmg}, got ${got}`);
  }
  assert.deepEqual(failures, []);
});

// Regression net for the shipped unit stats: every value in damage-baseline.json is the damage of one matchup (attacker HP, defender HP,
// terrain). If you retune data/units.json or data/weapons.json on purpose, regenerate it with `node tools/regen-damage-baseline.mjs`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readData } from '../helpers/node-io.js';
import { loadRegistry, loadMap } from '../../src/data/loader.js';
import { Game } from '../../src/engine/game.js';
import { canTarget, weaponDamage, weaponsOf } from '../../src/engine/combat.js';

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
    // the formula on its own: the first weapon that covers the defender's layer, wherever the two stand (range and sight are tested elsewhere)
    const layer = registry.unit(c.d).layer;
    const weapon = weaponsOf(game, attacker).find((w) => w.targets.some((m) => registry.rules.targetModes[m].layer === layer));
    const got = canTarget(game, attacker, defender) && weapon ? weaponDamage(game, weapon, attacker, defender) : 0;
    if (got !== c.dmg) failures.push(`${c.a}(${c.ahp}) -> ${c.d}(${c.dhp}) on ${c.t}: expected ${c.dmg}, got ${got}`);
  }
  assert.deepEqual(failures, []);
});

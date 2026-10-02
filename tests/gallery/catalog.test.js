import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readData } from '../helpers/node-io.js';
import { loadRegistry } from '../../src/data/loader.js';
import { GROUPS, buildCatalog, catalogProblems, stageCounts } from '../../gallery/catalog.js';
import { SPRITES as CONCEPT_SPRITES } from '../../gallery/concept-art.js';
import { SPRITES as GAME_SPRITES } from '../../src/render/unit-art.js';
import { BUILDINGS } from '../../src/render/buildings.js';
import { BASES, wallLinks, drawWall } from '../../gallery/structure-art.js';
import { cycle, fortLayout, FORT_BUILDINGS } from '../../gallery/wall-lab.js';

const json = (p) => JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8'));
const registry = await loadRegistry(readData);
const concepts = json('gallery/concepts.json'), status = json('gallery/status.json'), planned = json('gallery/planned-units.json');
const catalog = buildCatalog({ registry, concepts, planned, status });

test('the catalogue has no problems: stages and groups are known, game units are drafts or better, ideas are not in the game', () => {
  assert.deepEqual(catalogProblems(catalog, status), []);
});

test('every unit in the game, every concept and every planned unit is in the catalogue exactly once', () => {
  assert.equal(catalog.length, registry.unitIds.length + catalog.filter((u) => u.kind === 'building' && u.inGame).length + concepts.units.length + Object.keys(planned).length);
  for (const id of registry.unitIds) assert.ok(catalog.find((u) => u.id === id && u.inGame), id);
});

test('the pipeline: five stages in order, and the counts add up', () => {
  assert.deepEqual(status.stages.map((s) => s.id), ['idea', 'draft', 'solid', 'balanced', 'ready']);
  assert.equal(stageCounts(catalog, status).reduce((a, s) => a + s.n, 0), catalog.length);
  assert.ok(stageCounts(catalog, status)[0].n >= concepts.units.length, 'concepts are ideas');
});

test('every entry names a sprite that exists and sits in a known group', () => {
  for (const u of catalog) {
    const pool = u.kind === 'building' && u.inGame ? BUILDINGS : u.kind === 'wall' ? { [u.sprite]: drawWall } : u.kind === 'building' ? BASES : u.group === 'structure' ? CONCEPT_SPRITES : u.art === 'concept' ? CONCEPT_SPRITES : GAME_SPRITES;
    assert.ok(pool[u.sprite], `${u.id}: no sprite "${u.sprite}"`);
    assert.ok(GROUPS.some((g) => g.id === u.group), u.id);
  }
});

test('catalogProblems reports a game unit marked idea, an idea marked solid and a stray status', () => {
  const bad = catalog.map((u) => (u.id === 'tank' ? { ...u, stage: 'idea' } : u.id === 'jammer' ? { ...u, stage: 'solid' } : u));
  const problems = catalogProblems(bad, { ...status, units: { ...status.units, ghost: 'draft' } });
  assert.equal(problems.length, 3);
});

test('walls link to their wall neighbours, and a wall draws in both variants without throwing', () => {
  const set = new Set(['1,1', '2,1', '1,2']);
  assert.deepEqual(wallLinks((x, y) => set.has(`${x},${y}`), 1, 1), { n: false, e: true, s: true, w: false });
  const calls = [];
  const g = new Proxy({}, { get: (_, k) => (k === 'canvas' ? {} : (...a) => calls.push([k, a])), set: () => true });
  for (const cracked of [false, true]) drawWall(g, 0, 0, 40, '#c33', { links: { n: true, e: true }, cracked });
  assert.ok(calls.length > 4);
});

test('wall builder: tap cycles wall, cracked wall, empty; the starting fort has gaps only for its gate and buildings', () => {
  assert.equal(cycle(undefined), 'wall'); assert.equal(cycle('wall'), 'cracked'); assert.equal(cycle('cracked'), undefined);
  const fort = fortLayout();
  assert.ok(fort.size > 10);
  for (const k of Object.keys(FORT_BUILDINGS)) assert.ok(!fort.has(k), `${k} is a building, not a wall`);
});

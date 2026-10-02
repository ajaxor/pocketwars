import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readData } from '../helpers/node-io.js';
import { loadRegistry } from '../../src/data/loader.js';
import { GROUPS, buildCatalog, catalogProblems, stageCounts } from '../../gallery/catalog.js';
import { SPRITES as CONCEPT_SPRITES } from '../../gallery/concept-art.js';
import { SPRITES as GAME_SPRITES } from '../../src/render/unit-art.js';

const json = (p) => JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8'));
const registry = await loadRegistry(readData);
const concepts = json('gallery/concepts.json'), status = json('gallery/status.json'), planned = json('gallery/planned-units.json');
const catalog = buildCatalog({ registry, concepts, planned, status });

test('the catalogue has no problems: stages and groups are known, game units are drafts or better, ideas are not in the game', () => {
  assert.deepEqual(catalogProblems(catalog, status), []);
});

test('every unit in the game, every concept and every planned unit is in the catalogue exactly once', () => {
  assert.equal(catalog.length, registry.unitIds.length + concepts.units.length + Object.keys(planned).length);
  for (const id of registry.unitIds) assert.ok(catalog.find((u) => u.id === id && u.inGame), id);
});

test('the pipeline: five stages in order, and the counts add up', () => {
  assert.deepEqual(status.stages.map((s) => s.id), ['idea', 'draft', 'solid', 'balanced', 'ready']);
  assert.equal(stageCounts(catalog, status).reduce((a, s) => a + s.n, 0), catalog.length);
  assert.ok(stageCounts(catalog, status)[0].n >= concepts.units.length, 'concepts are ideas');
});

test('every entry names a sprite that exists and sits in a known group', () => {
  for (const u of catalog) {
    assert.ok((u.art === 'concept' ? CONCEPT_SPRITES : GAME_SPRITES)[u.sprite], `${u.id}: no sprite "${u.sprite}"`);
    assert.ok(GROUPS.some((g) => g.id === u.group), u.id);
  }
});

test('catalogProblems reports a game unit marked idea, an idea marked solid and a stray status', () => {
  const bad = catalog.map((u) => (u.id === 'tank' ? { ...u, stage: 'idea' } : u.id === 'jammer' ? { ...u, stage: 'solid' } : u));
  const problems = catalogProblems(bad, { ...status, units: { ...status.units, ghost: 'draft' } });
  assert.equal(problems.length, 3);
});

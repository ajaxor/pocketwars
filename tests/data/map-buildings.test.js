// Maps decide what each side can build: every player starts with a HQ and at least one producing building besides it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry, loadMapIndex, loadMap } from '../../src/data/loader.js';
import { buildingGaps, playersWithoutProducer, PRODUCERS } from '../../src/data/map-buildings.js';

const registry = await loadRegistry(readData);
const index = await loadMapIndex(readData);

test('PRODUCERS lists exactly the terrain that builds units besides the HQ', () => {
  const builders = Object.keys(registry.terrain).filter((id) => id !== 'hq' && registry.terrainDef(id).attributes.property?.builds?.length);
  assert.deepEqual([...PRODUCERS].sort(), builders.sort());
});

test('every player of every shipped map starts with at least one producing building besides the HQ', async () => {
  for (const id of Object.keys(index.maps)) {
    const map = await loadMap(readData, registry, id);
    assert.deepEqual(playersWithoutProducer(map), [], `${id}: a player has nothing to build with`);
    for (const g of buildingGaps(map)) assert.ok(g.missing.length < PRODUCERS.length, id);
  }
});

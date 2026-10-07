// Every shipped map gives every starting player all four producing buildings (leaders' kits assume them).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry, loadMapIndex, loadMap } from '../../src/data/loader.js';
import { buildingGaps } from '../../src/data/map-buildings.js';

const registry = await loadRegistry(readData);
const index = await loadMapIndex(readData);

test('every shipped map has barracks, factory, airfield and shipyard for every player', async () => {
  for (const id of Object.keys(index.maps)) {
    const map = await loadMap(readData, registry, id);
    assert.deepEqual(buildingGaps(map), [], `${id} is missing producing buildings`);
  }
});

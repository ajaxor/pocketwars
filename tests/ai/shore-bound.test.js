// The strategist values a diver (wades ashore a tile at a time) by the shoreline it can reach, not by the whole map.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry, loadMap } from '../../src/data/loader.js';
import { Game } from '../../src/engine/game.js';
import { shoreBound } from '../../src/ai/strategist/production.js';

const registry = await loadRegistry(readData);
const game = new Game(registry, await loadMap(readData, registry, 'classic'));

test('only the diver is shore-bound: ships, walkers, marines and fliers are not', () => {
  const bound = registry.unitIds.filter((id) => shoreBound(game, registry.unit(id)));
  assert.deepEqual(bound, ['diver']);
});

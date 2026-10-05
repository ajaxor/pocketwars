// Worker thread for pool.mjs: loads the data once, then plays the matches it is sent.
import { parentPort } from 'node:worker_threads';
import { readData } from '../../../tests/helpers/node-io.js';
import { loadRegistry } from '../../../src/data/loader.js';
import { loadAnyMap } from './maps.mjs';
import { playMatch } from './match.mjs';

const registry = await loadRegistry(readData);
const maps = new Map();
parentPort.on('message', async ({ id, job }) => {
  try {
    if (!maps.has(job.mapId)) maps.set(job.mapId, await loadAnyMap(readData, registry, job.mapId));
    parentPort.postMessage({ id, result: { ...playMatch(registry, maps.get(job.mapId), job), job } });
  } catch (e) {
    parentPort.postMessage({ id, error: `${job.mapId} seed ${job.seed}: ${e.stack || e.message}` });
  }
});
parentPort.postMessage({ ready: true });

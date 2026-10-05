// Maps for the arena and the tuner: every map the game ships (data/maps/index.json) plus training maps kept here in tools/ai/maps/,
// which test the AI on layouts the shipped maps do not have (Archipelago: islands with no land in common, so whatever cannot swim or
// fly is stuck at home). Training maps follow the same file format; they are not in the game.

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadMap, loadMapIndex } from '../../../src/data/loader.js';
import { parseMap } from '../../../src/data/map-format.js';

const DIR = fileURLToPath(new URL('../maps/', import.meta.url));

export const trainingMapIds = () => readdirSync(DIR).filter((f) => f.endsWith('.map.json')).map((f) => f.replace(/\.map\.json$/, ''));

/** Load a shipped map or a training map by id. */
export async function loadAnyMap(readData, registry, id) {
  const index = await loadMapIndex(readData);
  if (index.maps[id]) return loadMap(readData, registry, id);
  if (trainingMapIds().includes(id)) return parseMap(JSON.parse(readFileSync(`${DIR}${id}.map.json`, 'utf8')), registry);
  throw new Error(`Unknown map "${id}" (shipped: ${Object.keys(index.maps).join(', ')}; training: ${trainingMapIds().join(', ')})`);
}

/** The ids for a pool name: 'all' / '2p' (shipped and training maps), 'shipped', or a comma list. */
export async function poolIds(readData, which) {
  const index = await loadMapIndex(readData);
  if (which === 'shipped') return Object.keys(index.maps);
  if (which === 'all' || which === '2p') return [...Object.keys(index.maps), ...trainingMapIds()];
  return which.split(',').map((s) => s.trim());
}

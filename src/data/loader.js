// Loading game data through an injected `readJson(path)` so the same code works in the browser
// (fetch) and in Node (fs, used by tests and tools/). Paths are relative to the data/ directory.

import { createRegistry } from './registry.js';
import { parseMap } from './map-format.js';

const DATA_FILES = ['rules', 'factions', 'terrain', 'weapons', 'units', 'ai', 'ground'];

/** @param {(path:string)=>Promise<any>} readJson */
export async function loadRegistry(readJson) {
  const entries = await Promise.all(DATA_FILES.map(async (name) => [name, await readJson(`${name}.json`)]));
  return createRegistry(Object.fromEntries(entries));
}

/** Read data/maps/index.json: { default: "<id>", maps: { "<id>": "<file>" } } */
export const loadMapIndex = (readJson) => readJson('maps/index.json');

export async function loadMap(readJson, registry, id) {
  const index = await loadMapIndex(readJson);
  const file = index.maps[id];
  if (!file) throw new Error(`Unknown map "${id}" (available: ${Object.keys(index.maps).join(', ')})`);
  return parseMap(await readJson(`maps/${file}`), registry);
}

/** Browser reader: fetches JSON relative to a base URL (the data/ directory). */
export function fetchReader(baseUrl) {
  return async (path) => {
    const url = new URL(path, baseUrl);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
    return res.json();
  };
}

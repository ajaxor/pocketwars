// Loads every data file and every map in data/maps/index.json and reports all problems. Exit code 1 on error.
//   npm run validate
import { readData } from '../tests/helpers/node-io.js';
import { loadRegistry, loadMapIndex, loadMap } from '../src/data/loader.js';

let failed = false;
try {
  const registry = await loadRegistry(readData);
  console.log(`data ok: ${registry.unitIds.length} units, ${Object.keys(registry.terrain).length} terrain types`);
  const index = await loadMapIndex(readData);
  if (!index.maps[index.default]) throw new Error(`default map "${index.default}" is not in maps/index.json`);
  for (const id of Object.keys(index.maps)) {
    try {
      const map = await loadMap(readData, registry, id);
      if (map.id !== id) throw new Error(`file declares id "${map.id}" but is indexed as "${id}"`);
      console.log(`map ok: ${id} (${map.width}x${map.height}, ${map.players.length} players, ${map.units.length} units)`);
    } catch (e) { failed = true; console.error(`map FAILED: ${id}\n${e.message}`); }
  }
} catch (e) { failed = true; console.error(e.message); }
process.exit(failed ? 1 : 0);

// Loads every data file and every map in data/maps/index.json and reports all problems. Exit code 1 on error.
//   npm run validate
// Also checks that each leader's whole starting formation can be placed on each map (see src/data/formation.js).
import { readData } from '../tests/helpers/node-io.js';
import { loadRegistry, loadMapIndex, loadMap } from '../src/data/loader.js';
import { loadCampaign } from '../src/data/campaign.js';
import { placeFormation } from '../src/data/formation.js';

let failed = false;
try {
  const registry = await loadRegistry(readData);
  console.log(`data ok: ${registry.unitIds.length} units, ${Object.keys(registry.terrain).length} terrain types, ${registry.leaderIds.length} leader loadouts`);
  try {
    const campaign = await loadCampaign(readData, registry);
    console.log(`campaign ok: ${campaign.leaders.length} leaders, ${campaign.nations.length} nations`);
  } catch (e) { failed = true; console.error(`campaign FAILED\n${e.message}`); }
  const index = await loadMapIndex(readData);
  if (!index.maps[index.default]) throw new Error(`default map "${index.default}" is not in maps/index.json`);
  for (const id of Object.keys(index.maps)) {
    try {
      const map = await loadMap(readData, registry, id);
      if (map.id !== id) throw new Error(`file declares id "${map.id}" but is indexed as "${id}"`);
      console.log(`map ok: ${id} (${map.width}x${map.height}, ${map.players.length} players, ${map.units.length} units)`);
      // every leader on every team: the formation must fit (nobody skipped), however many units are pushed off their spot
      const unplaced = [];
      for (const leader of registry.leaderIds) {
        map.players.forEach((_, owner) => {
          const r = placeFormation(map, registry, owner, registry.loadoutFor(leader).start);
          if (!r) unplaced.push(`${leader} on team ${owner + 1}: no HQ or property to build around`);
          else if (r.skipped.length) unplaced.push(`${leader} on team ${owner + 1}: no room for ${r.skipped.join(', ')}`);
        });
      }
      if (unplaced.length) throw new Error(`leaders do not fit:\n - ${unplaced.join('\n - ')}`);
    } catch (e) { failed = true; console.error(`map FAILED: ${id}\n${e.message}`); }
  }
} catch (e) { failed = true; console.error(e.message); }
process.exit(failed ? 1 : 0);

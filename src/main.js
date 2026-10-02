// Entry point, loaded by the loader in index.html after it has picked the cache-busted build directory.
// Loads the entity data and the maps, sets up the default mission behind the title screen and hands the launcher a handle to
// start other games (the skirmish page does that).
//
//   boot({onQuit})    onQuit() is called when the player leaves to the title screen; resolves once the game is running behind it
//   ?map=<id>         URL parameter to pick another map from data/maps/index.json for the default mission
//
// boot() resolves to { registry, map, maps, defaultMapId, campaign, play(map) }:
//   campaign          the parsed campaign data (data/campaign.json), or null if it could not be loaded
//   map / maps        the default mission's map / every map in the index (parsed, in index order)
//   play(map)         throw away the running game and start a fresh one on `map` (a GameMap, e.g. from applySkirmish)

import { fetchReader, loadMap, loadMapIndex, loadRegistry } from './data/loader.js';
import { loadCampaign } from './data/campaign.js';
import { parseMap } from './data/map-format.js';
import { Game } from './engine/game.js';
import { Session } from './ui/session.js';

export async function boot({ onQuit } = {}) {
  const readJson = fetchReader(new URL('../data/', import.meta.url));
  const registry = await loadRegistry(readJson);
  const index = await loadMapIndex(readJson);
  const params = new URLSearchParams(location.search);
  const wanted = params.get('map');
  const defaultMapId = wanted && index.maps[wanted] ? wanted : index.default;
  const map = await loadMap(readJson, registry, defaultMapId);

  // every map, for the skirmish page; one that fails to load is left out rather than breaking the game
  const maps = (await Promise.all(Object.entries(index.maps).map(async ([id, file]) => {
    if (id === defaultMapId) return map;
    try { return parseMap(await readJson(`maps/${file}`), registry); } catch (e) { console.error(`Skipping map "${id}":`, e); return null; }
  }))).filter(Boolean);

  let campaign = null;          // the campaign is optional: if its data is broken the rest of the game still runs
  try { campaign = await loadCampaign(readJson, registry); } catch (e) { console.error('Campaign data not loaded:', e); }

  const canvas = document.getElementById('c');
  let session = null;
  let current = map;            // the map being played: restart replays it, quitting goes back to the default mission
  // quit: set the default mission up fresh behind the title screen, then let the host show that screen
  const quit = () => { current = map; launch(); onQuit?.(); };
  const launch = () => {
    if (session) session.dispose();
    session = new Session(new Game(registry, current), { canvas, doc: document, restart: launch, quit });
    session.start();
  };
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  launch();
  return {
    registry, map, maps, defaultMapId, campaign,
    play(next) { current = next; launch(); },
  };
}

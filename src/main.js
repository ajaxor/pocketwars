// Entry point, loaded by the loader in index.html after it has picked the cache-busted build directory.
// Loads the entity data and the chosen map, builds a Game and starts a Session.
//
//   boot()            resolves once the game is running behind the title screen
//   ?map=<id>         URL parameter to pick another map from data/maps/index.json
//   ?tiles=<id>       URL parameter to pick a tile style (src/render/terrain-styles.js); without it the style chosen
//                     in the gallery (gallery/terrain.html, remembered in localStorage) is used

import { fetchReader, loadMap, loadMapIndex, loadRegistry } from './data/loader.js';
import { Game } from './engine/game.js';
import { TILE_STYLE_KEY } from './render/terrain-styles.js';
import { Session } from './ui/session.js';

const remembered = () => { try { return localStorage.getItem(TILE_STYLE_KEY); } catch { return null; } };

export async function boot() {
  const readJson = fetchReader(new URL('../data/', import.meta.url));
  const registry = await loadRegistry(readJson);
  const index = await loadMapIndex(readJson);
  const params = new URLSearchParams(location.search);
  const tileStyle = params.get('tiles') || remembered();
  const wanted = params.get('map');
  const mapId = wanted && index.maps[wanted] ? wanted : index.default;
  const map = await loadMap(readJson, registry, mapId);

  const canvas = document.getElementById('c');
  let session = null;
  const launch = () => {
    if (session) session.dispose();
    session = new Session(new Game(registry, map), { canvas, doc: document, restart: launch, tileStyle });
    session.start();
  };
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  launch();
  return { registry, map };
}

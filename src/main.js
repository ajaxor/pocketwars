// Entry point, loaded by the loader in index.html after it has picked the cache-busted build directory.
// Loads the entity data and the chosen map, builds a Game and starts a Session.
//
//   boot({onQuit})    onQuit() is called when the player leaves to the title screen; resolves once the game is running behind the title screen
//   ?map=<id>         URL parameter to pick another map from data/maps/index.json

import { fetchReader, loadMap, loadMapIndex, loadRegistry } from './data/loader.js';
import { Game } from './engine/game.js';
import { Session } from './ui/session.js';

export async function boot({ onQuit } = {}) {
  const readJson = fetchReader(new URL('../data/', import.meta.url));
  const registry = await loadRegistry(readJson);
  const index = await loadMapIndex(readJson);
  const params = new URLSearchParams(location.search);
  const wanted = params.get('map');
  const mapId = wanted && index.maps[wanted] ? wanted : index.default;
  const map = await loadMap(readJson, registry, mapId);

  const canvas = document.getElementById('c');
  let session = null;
  // quit: set the mission up fresh behind the title screen, then let the host show that screen
  const quit = () => { launch(); onQuit?.(); };
  const launch = () => {
    if (session) session.dispose();
    session = new Session(new Game(registry, map), { canvas, doc: document, restart: launch, quit });
    session.start();
  };
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  launch();
  return { registry, map };
}

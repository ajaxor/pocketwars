// Entry point, loaded by the loader in index.html after it has picked the cache-busted build directory.
// Loads the entity data and the maps and hands the launcher a handle to start games (the skirmish page, the map editor and the
// campaign do that). No game runs until play() is called, so the title screen costs no frame loop or AI.
//
//   boot({onQuit})    onQuit() is called when the player leaves to the title screen; resolves once the data is loaded
//   ?map=<id>         URL parameter to pick another map from data/maps/index.json as the skirmish page's first pick
//
// boot() resolves to { registry, map, maps, defaultMapId, campaign, engines, defaultEngine, play(map) }:
//   engines / defaultEngine   the computer opponents on offer ([{ id, name, description }]) and the one the data plays by default
//   campaign          the parsed campaign data (data/campaign.json), or null if it could not be loaded
//   map / maps        the default map (the skirmish page's first pick) / every map in the index (parsed, in index order)
//   play(map)         throw away the running game, if any, and start a fresh one on `map` (a GameMap, e.g. from applySkirmish)

import { fetchReader, loadMap, loadMapIndex, loadRegistry } from './data/loader.js';
import { loadCampaign } from './data/campaign.js';
import { parseMap } from './data/map-format.js';
import { Game } from './engine/game.js';
import { loadHistory } from './ai/history.js';
import { ENGINES, engineIds } from './ai/engines.js';
import { Session } from './ui/session.js';
import { Talker } from './campaign/speech.js';
import { setFactions } from './render/portrait-art.js';
import { propertiesOwnedBy } from './engine/queries.js';

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

  // the leaders of the teams speak in battle (opening lines, commentary in the computer's turns), in the voice of their speech file
  let voices = null;
  if (campaign) {
    setFactions([...Object.values(registry.factions), { id: 'chorus', ...campaign.chorus }]);   // portraits are drawn in faction colours
    const talker = new Talker(campaign.speech || {});
    voices = { leader: (id) => campaign.leaderById[id] ?? null, say: (id, situation) => talker.say(id, situation) };
  }

  const canvas = document.getElementById('c');
  let session = null;
  let current = map;            // the map being played: restart replays it
  // quit: stop the running game, then let the host show the title screen
  const quit = () => { if (session) session.dispose(); session = null; onQuit?.(); };
  const leaderName = (id) => campaign?.leaderById[id]?.name ?? null;   // for the line that says who leads whom
  const launch = () => {
    if (session) session.dispose();
    const game = new Game(registry, current);
    // the computer players remember which of their game plans have worked against this player before (src/ai/history.js)
    const history = loadHistory();
    const engine = current.aiEngine && ENGINES[current.aiEngine] ? current.aiEngine : undefined;   // a skirmish may choose the opponent; unknown ids fall back to the default
    game.aiSetup = current.players.map((p) => (p.controller === 'ai' ? { history, engine } : null));
    session = new Session(game, { canvas, doc: document, restart: launch, quit, leaderName, voices: current.dialogue === false ? null : voices });
    session.start();
    if (params.has('smoke')) exposeSmokeHooks(game, session);
  };
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  return {
    registry, map, maps, defaultMapId, campaign,
    engines: engineIds.map((id) => ({ id, name: ENGINES[id].name, description: ENGINES[id].description })),
    defaultEngine: registry.ai.default,
    play(next) { current = next; launch(); },
  };
}

/**
 * Hooks for the browser smoke tests (tools/smoke): only present when the page is opened with ?smoke, so a normal game exposes nothing.
 *   showBuilding(id)       scroll the map to the current player's first building of that terrain id ('factory', 'barracks')
 *   buildingSpot(id)       where it is on screen, in window pixels (ask a moment after showBuilding: the layout updates on the next frame)
 *   unitCount()            how many units are on the board
 *   ready()                the opening is over and the player's input is idle
 */
function exposeSmokeHooks(game, session) {
  window.__pocketwars = {
    unitCount: () => game.state.units.length,
    ready: () => !session.intro && session.controller.mode === 'idle',
    showBuilding(id) {
      const p = propertiesOwnedBy(game, game.state.turn).find((q) => q.terrain.id === id);
      if (p) session.renderer.camera.centerOn(p.x, p.y);
    },
    buildingSpot(id) {
      const p = propertiesOwnedBy(game, game.state.turn).find((q) => q.terrain.id === id);
      if (!p) return null;
      const r = session.renderer.tileRect(p.x, p.y);
      return { x: r.left + r.size / 2, y: r.top + r.size / 2 };
    },
  };
}

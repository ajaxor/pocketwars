// Entry point, loaded by the loader in index.html after it has picked the cache-busted build directory.
// Loads the entity data and the maps and hands the launcher a handle to start games (the skirmish page, the map editor and the
// campaign do that). No game runs until play() is called, so the title screen costs no frame loop or AI.
//
//   boot({onQuit})    onQuit() is called when the player leaves to the title screen; resolves once the data is loaded
//   ?map=<id>         URL parameter to pick another map from data/maps/index.json as the skirmish page's first pick
//
// boot() resolves to { registry, map, maps, defaultMapId, campaign, play(map) }:
//   campaign          the parsed campaign data (data/campaign.json), or null if it could not be loaded
//   map / maps        the default map (the skirmish page's first pick) / every map in the index (parsed, in index order)
//   play(map)         throw away the running game, if any, and start a fresh one on `map` (a GameMap, e.g. from applySkirmish)

import { fetchReader, loadMap, loadMapIndex, loadRegistry } from './data/loader.js';
import { loadCampaign } from './data/campaign.js';
import { parseMap } from './data/map-format.js';
import { Game } from './engine/game.js';
import { loadHistory } from './ai/history.js';
import { Session } from './ui/session.js';
import { Talker } from './campaign/speech.js';
import { setFactions } from './render/portrait-art.js';

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
    game.aiSetup = current.players.map((p) => (p.controller === 'ai' ? { history } : null));
    session = new Session(game, { canvas, doc: document, restart: launch, quit, leaderName, voices: current.dialogue === false ? null : voices });
    session.start();
  };
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  return {
    registry, map, maps, defaultMapId, campaign,
    play(next) { current = next; launch(); },
  };
}

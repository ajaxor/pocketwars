// The launcher runs once the shell (index.html) has picked the build folder. It loads the stylesheet, shows the title screen
// and loads the game behind it (src/main.js), then waits for Campaign, Skirmish (the setup pages, which start a fresh game with the
// map and teams that were chosen) or the map editor. Once the game is loaded the menu gets its scrolling battlefield. It also watches
// for a newer deploy while the title screen is up. The shell stays tiny and stable so a stale cached copy of it cannot hide changes to any of this.

import { applySkirmish } from './data/skirmish.js';
import { SkirmishScreen } from './ui/skirmish-screen.js';
import { EditorScreen } from './editor/editor-screen.js';
import { customMaps } from './editor/storage.js';
import { TitleScreen } from './ui/title-screen.js';
import { ScreenStack } from './ui/screen-stack.js';
import { IntroScreen } from './ui/intro-screen.js';
import { WorldMapScreen } from './ui/world-map-screen.js';
import { setFactions } from './render/portrait-art.js';

/** Extra buttons on the title screen. */
export const GALLERIES = [
  { label: 'Unit art', href: 'gallery/' },
  { label: 'Terrain', href: 'gallery/terrain.html' },
];

const defaultLoadCss = (doc, href) => new Promise((ok, no) => {
  const el = doc.createElement('link');
  el.rel = 'stylesheet'; el.href = href; el.onload = ok; el.onerror = () => no(new Error('Could not load ' + href));
  doc.head.appendChild(el);
});
const defaultLoadGame = async (href, opts) => (await import(new URL(href, location.href).href)).boot(opts);

/**
 * @param {object} o
 * @param {string} o.base      build folder ('./' in development, 'v/<hash>/' when deployed)
 * @param {string} o.tag       cache-busting tag for this build
 * @param {string} [o.hash]    the build's hash, or 'dev' when there is no version.json
 * @param {string} [o.built]   ISO timestamp of the build
 * @param {() => Promise<{hash:string}|null>} o.getVersion  fetches the current version.json
 * @param {(hash:string) => void} o.goTo                    reloads the page on that build
 * @param {() => void} [o.reload]
 * @param {Document} [o.doc]
 * @param {Function} [o.raf] @param {Function} [o.caf]  animation-frame functions for the campaign screens (tests pass stubs)
 * @param {Function} [o.loadCss] @param {Function} [o.loadGame]  replaceable for tests; loadGame resolves to the game's
 *   handle { registry, maps, defaultMapId, play(map) } (src/main.js), or to nothing in tests that do not run a game
 * @returns {Promise<TitleScreen>} resolves once the game has loaded (or failed) behind the title screen
 */
export async function launch({
  base, tag, hash = 'dev', built, getVersion, goTo, reload = () => location.reload(),
  doc = document, random = Math.random, loadCss = defaultLoadCss, loadGame = defaultLoadGame, raf, caf,
}) {
  await loadCss(doc, base + 'style.css?v=' + tag);          // the title screen is styled by style.css, so it comes first
  doc.getElementById('boot')?.remove();
  doc.body.classList.remove('loading');

  const version = 'build ' + (hash === 'dev' ? 'dev' : hash + (built ? ' - ' + built.slice(0, 10) : ''));
  let title = null, started = false, ready = false, failed = null, game = null;
  // the pages that sit on top of the title screen (skirmish, editor, campaign); the stack covers and uncovers its battlefield
  const pages = new ScreenStack(doc, { onCover: () => title?.coverBackdrop(true), onUncover: () => title?.coverBackdrop(false) });

  // The title screen can come back (Quit to title), so it is built by a function.
  const show = () => {
    started = false;
    const t = title = new TitleScreen(doc, { links: GALLERIES });
    t.setVersion(version);
    t.onRetry = () => reload();
    t.onSkirmish = () => openSkirmish(t);
    t.onCampaign = () => openCampaign(t);
    t.onEditor = () => openEditor(t);
    if (ready) { t.setReady(); t.setSkirmish(canSkirmish()); t.setCampaign(canCampaign()); t.setEditor(canSkirmish()); backdrop(t); } else if (failed) t.setFailed(failed); else t.setProgress(60, 'Loading game...');
    return t;
  };
  const canSkirmish = () => !!(game && game.maps && game.maps.length && game.play);
  // the battlefield behind the menu: a new random one each time the title screen appears, once the game's data is there to draw it with
  const backdrop = (t) => { if (game?.registry?.unitIds) t.showBackdrop(game.registry, { random, raf, caf }); };

  // The skirmish page sits on top of the title screen; Back removes it, Start plays the chosen setup and removes both. Leaders come
  // from the campaign (names and portraits); the one a human team starts with is the hero of the home nation.
  const portraitColors = () => setFactions([...Object.values(game.registry.factions), { id: 'chorus', ...game.campaign?.chorus }]);
  const startGame = (t, map) => { pages.clear(); game.play(map); started = true; t.remove(); };
  const openSkirmish = (t) => {
    if (!t.ready || !canSkirmish() || pages.active) return;
    const leaders = game.campaign?.leaders || [];
    if (leaders.length) portraitColors();
    pages.push(new SkirmishScreen(doc, {
      registry: game.registry, maps: [...game.maps, ...customMaps(game.registry)], selectedId: game.defaultMapId,   // with the maps saved in the editor
      leaders, speech: game.campaign?.speech || {}, engines: game.engines || [], defaultEngine: game.defaultEngine,
      onBack: () => pages.pop(),
      onStart: (map, settings) => startGame(t, applySkirmish(map, settings, game.registry, random)),
    }));
  };

  // The map editor sits on top of the title screen like the skirmish page; Back removes it, Play starts the map being edited.
  const openEditor = (t) => {
    if (!t.ready || !canSkirmish() || pages.active) return;
    pages.push(new EditorScreen(doc, { registry: game.registry, maps: game.maps, onBack: () => pages.pop(), onPlay: (map) => startGame(t, map) }));
  };

  // The campaign: the intro cutscene (skippable) and then the world map. Both sit on top of the title screen; Back on the map
  // returns to it, and Replay intro plays the cutscene again.
  const canCampaign = () => !!(game && game.campaign);
  const colorsOf = (id) => (id === 'chorus' ? game.campaign.chorus : game.registry.factions[id]);
  const openCampaign = (t) => {
    if (!t.ready || !canCampaign() || pages.active) return;
    portraitColors();
    const playIntro = (swap) => {
      const intro = new IntroScreen(doc, { campaign: game.campaign, colors: colorsOf, raf, caf, onDone: showMap });
      swap ? pages.replace(intro) : pages.push(intro);
      intro.start();
    };
    const showMap = () => {
      const map = new WorldMapScreen(doc, { campaign: game.campaign, colors: colorsOf, raf, caf, onBack: () => pages.pop(), onReplay: () => playIntro(true) });
      pages.replace(map);
      map.start();
    };
    playIntro(false);
  };
  show();

  // Coming back to the tab while still on the title screen: check for a newer deploy.
  doc.addEventListener('visibilitychange', async () => {
    if (doc.hidden || started || !title.ready || hash === 'dev') return;
    const v = await getVersion();
    if (v && v.hash !== hash) title.showUpdate(() => goTo(v.hash));
  });

  try {
    game = (await loadGame(base + 'src/main.js?v=' + tag, { onQuit: show })) || null;
    ready = true;
    title.setReady();
    title.setSkirmish(canSkirmish());
    title.setCampaign(canCampaign());
    title.setEditor(canSkirmish());
    backdrop(title);
  } catch (e) {
    console.error(e);
    failed = String(e.message || e).split('\n')[0].slice(0, 120);
    title.setFailed(failed);
  }
  return title;
}

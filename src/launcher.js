// The launcher runs once the shell (index.html) has picked the build folder. It loads the stylesheet, shows the title screen
// and loads the game behind it (src/main.js), then waits for Start (the default mission, already set up behind the title screen)
// or Skirmish (the setup page, which starts a fresh game with the map and teams that were chosen). It also watches for a newer
// deploy while the title screen is up. The shell stays tiny and stable so a stale cached copy of it cannot hide changes to any of this.

import { applySkirmish } from './data/skirmish.js';
import { SkirmishScreen } from './ui/skirmish-screen.js';
import { TitleScreen } from './ui/title-screen.js';
import { IntroScreen } from './ui/intro-screen.js';
import { WorldMapScreen } from './ui/world-map-screen.js';
import { setFactions } from './render/portrait-art.js';

/** Extra buttons on the title screen. */
export const GALLERIES = [
  { label: 'Unit art', href: 'gallery/' },
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
  let title = null, started = false, ready = false, failed = null, game = null, skirmish = null, campaignScreen = null;

  // The title screen can come back (Quit to title), so it is built by a function.
  const show = () => {
    started = false;
    const t = title = new TitleScreen(doc, { links: GALLERIES });
    t.setVersion(version);
    t.onStart = () => {
      if (!t.ready) return reload();
      if (canSkirmish()) game.play(game.maps[Math.floor(random() * game.maps.length)]);   // Quick Start: any map, its own rules
      started = true; t.remove();
    };
    t.onSkirmish = () => openSkirmish(t);
    t.onCampaign = () => openCampaign(t);
    if (ready) { t.setReady(); t.setSkirmish(canSkirmish()); t.setCampaign(canCampaign()); } else if (failed) t.setFailed(failed); else t.setProgress(60, 'Loading game...');
    return t;
  };
  const canSkirmish = () => !!(game && game.maps && game.maps.length && game.play);

  // The skirmish page sits on top of the title screen; Back removes it, Start plays the chosen setup and removes both. Leaders come
  // from the campaign (names and portraits); the one a human team starts with is the hero of the home nation.
  const portraitColors = () => setFactions([...Object.values(game.registry.factions), { id: 'chorus', ...game.campaign?.chorus }]);
  const openSkirmish = (t) => {
    if (!t.ready || !canSkirmish() || skirmish) return;
    const leaders = game.campaign?.leaders || [];
    if (leaders.length) portraitColors();
    skirmish = new SkirmishScreen(doc, {
      registry: game.registry, maps: game.maps, selectedId: game.defaultMapId,
      leaders, speech: game.campaign?.speech || {},
      onBack: () => { skirmish.remove(); skirmish = null; },
      onStart: (map, settings) => {
        skirmish.remove(); skirmish = null;
        game.play(applySkirmish(map, settings, game.registry, random));
        started = true; t.remove();
      },
    });
    doc.body.append(skirmish.root);
  };

  // The campaign: the intro cutscene (skippable) and then the world map. Both sit on top of the title screen; Back on the map
  // returns to it, and Replay intro plays the cutscene again.
  const canCampaign = () => !!(game && game.campaign);
  const colorsOf = (id) => (id === 'chorus' ? game.campaign.chorus : game.registry.factions[id]);
  const openCampaign = (t) => {
    if (!t.ready || !canCampaign() || campaignScreen) return;
    portraitColors();
    const playIntro = () => {
      const intro = campaignScreen = new IntroScreen(doc, { campaign: game.campaign, colors: colorsOf, raf, caf, onDone: () => { intro.remove(); showMap(); } });
      doc.body.append(intro.root); intro.start();
    };
    const showMap = () => {
      const map = campaignScreen = new WorldMapScreen(doc, {
        campaign: game.campaign, colors: colorsOf, raf, caf,
        onBack: () => { map.remove(); campaignScreen = null; },
        onReplay: () => { map.remove(); playIntro(); },
      });
      doc.body.append(map.root); map.start();
    };
    playIntro();
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
  } catch (e) {
    console.error(e);
    failed = String(e.message || e).split('\n')[0].slice(0, 120);
    title.setFailed(failed);
  }
  return title;
}

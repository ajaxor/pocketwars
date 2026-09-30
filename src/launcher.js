// The launcher runs once the shell (index.html) has picked the build folder. It loads the stylesheet, shows the title screen
// and loads the game behind it (src/main.js), then waits for Start. It also watches for a newer deploy while the title screen
// is up. The shell stays tiny and stable so a stale cached copy of it cannot hide changes to any of this.

import { TitleScreen } from './ui/title-screen.js';

/** Extra buttons on the title screen. */
export const GALLERIES = [
  { label: 'Unit art', href: 'gallery/' },
  { label: 'Terrain art', href: 'gallery/terrain.html' },
];

const defaultLoadCss = (doc, href) => new Promise((ok, no) => {
  const el = doc.createElement('link');
  el.rel = 'stylesheet'; el.href = href; el.onload = ok; el.onerror = () => no(new Error('Could not load ' + href));
  doc.head.appendChild(el);
});
const defaultLoadGame = async (href) => (await import(new URL(href, location.href).href)).boot();

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
 * @param {Function} [o.loadCss] @param {Function} [o.loadGame]  replaceable for tests
 * @returns {Promise<TitleScreen>} resolves once the game has loaded (or failed) behind the title screen
 */
export async function launch({
  base, tag, hash = 'dev', built, getVersion, goTo, reload = () => location.reload(),
  doc = document, loadCss = defaultLoadCss, loadGame = defaultLoadGame,
}) {
  await loadCss(doc, base + 'style.css?v=' + tag);          // the title screen is styled by style.css, so it comes first
  doc.getElementById('boot')?.remove();
  doc.body.classList.remove('loading');

  const title = new TitleScreen(doc, { links: GALLERIES });
  title.setVersion('build ' + (hash === 'dev' ? 'dev' : hash + (built ? ' - ' + built.slice(0, 10) : '')));
  let started = false;
  title.onStart = () => { if (title.ready) { started = true; title.remove(); } else reload(); };

  // Coming back to the tab while still on the title screen: check for a newer deploy.
  doc.addEventListener('visibilitychange', async () => {
    if (doc.hidden || started || !title.ready || hash === 'dev') return;
    const v = await getVersion();
    if (v && v.hash !== hash) title.showUpdate(() => goTo(v.hash));
  });

  title.setProgress(60, 'Loading game...');
  try {
    await loadGame(base + 'src/main.js?v=' + tag);
    title.setReady();
  } catch (e) {
    console.error(e);
    title.setFailed(String(e.message || e).split('\n')[0].slice(0, 120));
  }
  return title;
}

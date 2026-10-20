// Service worker: lets Pocket Wars install to the home screen and play offline (see docs/pwa.md).
//
// The site is deployed as a tiny shell (index.html) plus one immutable folder per build, v/<hash>/, and version.json names the
// current folder (.github/workflows/pages.yml). That maps onto three rules:
//   * the shell (index.html, version.json): network first, so a reload always finds a new deploy; the cached copy is used offline
//   * a build folder (v/<hash>/...): cache first, because its files never change; the whole folder is downloaded in the
//     background as soon as version.json names it (it lists its files in files.json), so the game works offline after one visit
//   * anything else (the galleries, sound files): the network, untouched
// Only the newest two builds are kept. BUILD below is replaced with the commit hash on deploy, which also makes this file
// differ on every deploy so browsers install the new worker. It is never registered in a local checkout (index.html).

const BUILD = '__BUILD__';
const SHELL = 'pw-shell-' + BUILD;
const BUILDS = 'pw-builds';
const KEEP = 2;
const SCOPE = self.registration.scope;
const url = (path) => new URL(path, SCOPE).href;
const SHELL_FILES = ['./', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // Best effort: a missing file must not stop the worker installing.
    await Promise.all(SHELL_FILES.map((f) => cache.add(new Request(url(f), { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith('pw-shell-') && name !== SHELL) await caches.delete(name);
    await self.clients.claim();
  })());
});

/** The hash in a build-folder URL (…/v/<hash>/…), or null. */
const buildOf = (href) => (href.startsWith(SCOPE + 'v/') ? href.slice(SCOPE.length + 2).split('/')[0] : null) || null;

async function networkFirst(request, key) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(request);
    if (res.ok) await cache.put(key, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(key, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}

/** Downloads every file of a build into the builds cache (skipping what is there), then drops all but the newest builds. */
async function fetchBuild(hash) {
  const cache = await caches.open(BUILDS);
  const list = await (await fetch(url(`v/${hash}/files.json`), { cache: 'no-store' })).json();
  await Promise.all(list.map(async (file) => {
    const req = url(`v/${hash}/${file}`);
    if (!(await cache.match(req))) {
      const res = await fetch(req).catch(() => null);
      if (res && res.ok) await cache.put(req, res);
    }
  }));
  await prune(cache, hash);
}

async function prune(cache, hash) {
  const metaKey = url('__recent-builds');
  const old = await cache.match(metaKey);
  const recent = [hash, ...((old ? await old.json() : []).filter((h) => h !== hash))].slice(0, KEEP);
  await cache.put(metaKey, new Response(JSON.stringify(recent), { headers: { 'content-type': 'application/json' } }));
  for (const req of await cache.keys()) {
    const h = buildOf(req.url);
    if (h && !recent.includes(h)) await cache.delete(req);
  }
}

async function versionRequest(event) {
  const res = await networkFirst(event.request, url('version.json'));
  try {
    const { hash } = await res.clone().json();
    if (hash) event.waitUntil(fetchBuild(hash).catch(() => {}));
  } catch { /* offline copy or unreadable: nothing to fetch */ }
  return res;
}

async function buildRequest(request) {
  const cache = await caches.open(BUILDS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) await cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(SCOPE)) return;
  const path = new URL(request.url).pathname.slice(new URL(SCOPE).pathname.length);
  if (request.mode === 'navigate' && (path === '' || path === 'index.html')) event.respondWith(networkFirst(request, url('./')));
  else if (path === 'version.json') event.respondWith(versionRequest(event));
  else if (path === 'manifest.webmanifest' || path.startsWith('icons/')) event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
  else if (/^v\/[^/]+\//.test(path) && !path.includes('/gallery/')) event.respondWith(buildRequest(request));
});

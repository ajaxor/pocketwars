// The home-screen install: manifest, icons, the shell's links, the build file list and the service worker's caching rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listBuildFiles } from '../../tools/build-file-list.mjs';

const ROOT = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const pngSize = (p) => { const b = readFileSync(new URL(p, ROOT)); assert.equal(b.toString('latin1', 1, 4), 'PNG'); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('the manifest makes an installable standalone app with correctly sized icons', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, './');
  assert.equal(m.scope, './');
  assert.ok(m.name && m.short_name);
  for (const icon of m.icons) {
    assert.ok(existsSync(new URL(icon.src, ROOT)), icon.src + ' exists');
    assert.deepEqual(pngSize(icon.src), icon.sizes.split('x').map(Number), icon.src + ' is the size it claims');
  }
  assert.ok(m.icons.some((i) => i.sizes === '192x192' && i.purpose === 'any'));
  assert.ok(m.icons.some((i) => i.sizes === '512x512' && i.purpose === 'any'));
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
});

test('the shell links the manifest and the iPhone icon, and its colours match the manifest', () => {
  const html = read('index.html'), m = JSON.parse(read('manifest.webmanifest'));
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  const touch = /<link rel="apple-touch-icon" href="([^"]+)">/.exec(html)?.[1];
  assert.ok(touch && existsSync(new URL(touch, ROOT)));
  assert.deepEqual(pngSize(touch), [180, 180]);
  assert.match(html, /<meta name="theme-color" content="#1d2436">/);
  assert.equal(m.theme_color, '#1d2436');
  assert.equal(m.background_color, '#1d2436');
  assert.match(html, /serviceWorker.*register\('sw\.js'/s, 'the shell registers the worker');
  assert.match(html, /if\(!DEV&&'serviceWorker' in navigator\)/, 'but never in a local checkout');
});

test('the deploy ships the worker, manifest, icons and the build file list', () => {
  const wf = read('.github/workflows/pages.yml');
  assert.match(wf, /cp index\.html sw\.js manifest\.webmanifest/);
  assert.match(wf, /cp -r icons _site\/icons/);
  assert.match(wf, /build-file-list\.mjs "_site\/v\/\$\{SHORT\}"/);
  assert.match(wf, /sed -i "s\/__BUILD__\/\$\{SHORT\}\/g" _site\/index\.html _site\/sw\.js/);
});

test('the build file list has every file, sorted, without the galleries or itself', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pw-build-'));
  for (const f of ['style.css', 'src/main.js', 'src/ui/hud.js', 'data/rules.json', 'gallery/index.html', 'files.json']) {
    mkdirSync(join(dir, f, '..'), { recursive: true });
    writeFileSync(join(dir, f), 'x');
  }
  assert.deepEqual(listBuildFiles(dir), ['data/rules.json', 'src/main.js', 'src/ui/hud.js', 'style.css']);
});

// ---- the worker itself, run against an in-memory Cache API ----
const SCOPE = 'https://nathan.test/pocketwars/';

function makeCaches() {
  const stores = new Map();
  const norm = (r, ignoreSearch) => { const u = new URL(typeof r === 'string' ? r : r.url); if (ignoreSearch) u.search = ''; return u.href; };
  const open = async (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const s = stores.get(name);
    return {
      match: async (r, o = {}) => { const k = norm(r, o.ignoreSearch); for (const [key, v] of s) if (norm(key, o.ignoreSearch) === k) return v.clone(); },
      put: async (r, res) => { s.set(norm(r), res); },
      add: async (r) => { s.set(norm(r), new Response('shell')); },
      keys: async () => [...s.keys()].map((u) => new Request(u)),
      delete: async (r) => s.delete(norm(r)),
    };
  };
  return {
    stores, open,
    keys: async () => [...stores.keys()],
    delete: async (n) => stores.delete(n),
    match: async (r) => { for (const n of stores.keys()) { const hit = await (await open(n)).match(r); if (hit) return hit; } },
  };
}

function loadWorker({ online = true, files = {} } = {}) {
  const net = { online, files: { ...files }, log: [] };
  const handlers = {};
  const caches = makeCaches();
  const fetchFn = async (r) => {
    const href = typeof r === 'string' ? r : r.url;
    net.log.push(href);
    const path = href.slice(SCOPE.length).split('?')[0];
    if (!net.online || !(path in net.files)) throw new TypeError('offline or missing: ' + path);
    return new Response(net.files[path]);
  };
  const self = {
    registration: { scope: SCOPE },
    addEventListener: (type, fn) => { handlers[type] = fn; },
    skipWaiting: async () => {}, clients: { claim: async () => {} },
  };
  vm.runInNewContext(read('sw.js').replaceAll('__BUILD__', 'abc1234'), { self, caches, fetch: fetchFn, URL, Request, Response, Promise, JSON, Map });
  const request = (path, mode = 'cors') => { const r = new Request(SCOPE + path); return Object.defineProperty(r, 'mode', { value: mode }); };
  const dispatch = async (path, mode) => {
    const pending = [];
    let response;
    handlers.fetch({ request: request(path, mode), respondWith: (p) => { response = p; }, waitUntil: (p) => pending.push(p) });
    const res = response ? await response : null;
    await Promise.all(pending);
    return res;
  };
  return { net, caches, handlers, dispatch };
}

test('the placeholder is stamped exactly once in the worker', () => {
  assert.equal(read('sw.js').split('__BUILD__').length - 1, 1);
});

test('the worker ignores other sites, other methods and the galleries', async () => {
  const w = loadWorker({ files: { 'gallery/index.html': 'g', 'v/abc/gallery/x.js': 'g' } });
  let handled = false;
  w.handlers.fetch({ request: new Request('https://elsewhere.test/x.js'), respondWith: () => { handled = true; } });
  w.handlers.fetch({ request: new Request(SCOPE + 'v/abc/src/main.js', { method: 'POST' }), respondWith: () => { handled = true; } });
  assert.equal(handled, false);
  assert.equal(await w.dispatch('gallery/index.html'), null);
  assert.equal(await w.dispatch('v/abc/gallery/x.js'), null);
});

test('install caches the shell files; activate drops the old shells and keeps the builds', async () => {
  const w = loadWorker();
  w.caches.stores.set('pw-shell-old', new Map());
  w.caches.stores.set('pw-builds', new Map());
  await w.handlers.install({ waitUntil: (p) => p });
  await new Promise((r) => setImmediate(r));
  let done; await w.handlers.activate({ waitUntil: (p) => { done = p; } }); await done;
  assert.deepEqual([...await w.caches.keys()].sort(), ['pw-builds', 'pw-shell-abc1234']);
});

test('the page is network first and falls back to the cached copy offline', async () => {
  const w = loadWorker({ files: { '': '<html>v1' } });
  assert.equal(await (await w.dispatch('?v=abc', 'navigate')).text(), '<html>v1');
  w.net.files[''] = '<html>v2';
  assert.equal(await (await w.dispatch('', 'navigate')).text(), '<html>v2', 'a new deploy is found at once');
  w.net.online = false;
  assert.equal(await (await w.dispatch('?v=abc', 'navigate')).text(), '<html>v2', 'offline: the last copy, whatever the query');
});

test('a build file is fetched once and then served from the cache', async () => {
  const w = loadWorker({ files: { 'v/abc1234/src/main.js': 'code' } });
  assert.equal(await (await w.dispatch('v/abc1234/src/main.js')).text(), 'code');
  w.net.online = false;
  assert.equal(await (await w.dispatch('v/abc1234/src/main.js')).text(), 'code');
  assert.equal(w.net.log.length, 1, 'only one request went out');
});

test('version.json downloads the whole named build for offline play', async () => {
  const w = loadWorker({ files: {
    'version.json': JSON.stringify({ hash: 'abc1234' }),
    'v/abc1234/files.json': JSON.stringify(['style.css', 'src/main.js']),
    'v/abc1234/style.css': 'css', 'v/abc1234/src/main.js': 'js',
  } });
  await w.dispatch('version.json');
  w.net.online = false;
  assert.equal(await (await w.dispatch('v/abc1234/style.css')).text(), 'css');
  assert.equal(await (await w.dispatch('v/abc1234/src/main.js')).text(), 'js');
  assert.deepEqual(JSON.parse(await (await w.dispatch('version.json')).text()), { hash: 'abc1234' }, 'offline, version.json comes from the cache');
});

test('only the two newest builds are kept', async () => {
  const files = { 'version.json': '' };
  for (const h of ['b1', 'b2', 'b3']) { files[`v/${h}/files.json`] = JSON.stringify(['a.js']); files[`v/${h}/a.js`] = h; }
  const w = loadWorker({ files });
  for (const h of ['b1', 'b2', 'b3']) { w.net.files['version.json'] = JSON.stringify({ hash: h }); await w.dispatch('version.json'); }
  const cache = await w.caches.open('pw-builds');
  const urls = (await cache.keys()).map((r) => r.url).filter((u) => u.endsWith('a.js'));
  assert.deepEqual(urls.sort(), [SCOPE + 'v/b2/a.js', SCOPE + 'v/b3/a.js']);
});

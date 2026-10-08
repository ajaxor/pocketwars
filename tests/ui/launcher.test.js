// The launcher: styles first, then the title screen, the game behind it, Start, retry and the update button.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeDoc } from '../helpers/fake-dom.js';
import { GALLERIES, launch } from '../../src/launcher.js';

function setup(over = {}) {
  const doc = new FakeDoc();
  doc.body.classList.add('loading');
  doc.withId('boot');
  const log = [];
  const opts = {
    doc, base: 'v/abc1234/', tag: 'abc1234', hash: 'abc1234', built: '2026-09-30T15:07:10Z',
    getVersion: async () => ({ hash: 'abc1234' }), goTo: (h) => log.push('goTo ' + h), reload: () => log.push('reload'),
    loadCss: async (_, href) => { log.push('css ' + href); },
    loadGame: async (href) => { log.push('game ' + href); },
    ...over,
  };
  return { doc, log, opts };
}

test('it loads the stylesheet before showing the title screen, then the game, then enables Start', async () => {
  const { doc, log, opts } = setup();
  const title = await launch(opts);
  assert.deepEqual(log, ['css v/abc1234/style.css?v=abc1234', 'game v/abc1234/src/main.js?v=abc1234']);
  assert.equal(doc.getElementById('boot'), null, 'the splash is gone');
  assert.equal(doc.body.classList.contains('loading'), false);
  assert.equal(title.ready, true);
  assert.equal(title.go.textContent, 'Quick Start');
  assert.equal(title.ver.textContent, 'build abc1234 - 2026-09-30');
});

test('the title screen carries the gallery links', async () => {
  const { opts } = setup();
  const title = await launch(opts);
  assert.deepEqual(title.links.children.map((a) => a.attrs.href), ['gallery/', 'gallery/terrain.html']);
  assert.deepEqual(GALLERIES.map((g) => g.label), ['Unit art', 'Terrain']);
});

test('the styles are awaited: nothing is shown before they load', async () => {
  const { doc, opts } = setup();
  let release;
  const gate = new Promise((r) => { release = r; });
  const run = launch({ ...opts, loadCss: () => gate });
  await Promise.resolve();
  assert.equal(doc.body.children.some((c) => c.className === 'title'), false);
  assert.notEqual(doc.getElementById('boot'), null);
  release();
  await run;
  assert.equal(doc.body.children.some((c) => c.className === 'title'), true);
});

test('Start removes the title screen once the game has loaded', async () => {
  const { doc, opts } = setup();
  const title = await launch(opts);
  title.go.click();
  assert.equal(doc.body.children.some((c) => c.className === 'title'), false);
});

test('a failed game load shows Retry, and Retry reloads the page', async () => {
  const { log, opts } = setup({ loadGame: async () => { throw new Error('boom\nstack line'); } });
  const quiet = console.error; console.error = () => {};
  const title = await launch(opts).finally(() => { console.error = quiet; });
  assert.equal(title.go.textContent, 'Retry');
  assert.match(title.status.textContent, /boom$/);
  title.go.click();
  assert.deepEqual(log.filter((l) => l === 'reload'), ['reload']);
});

test('a failed stylesheet load rejects, so the shell can show its own error', async () => {
  const { opts } = setup({ loadCss: async () => { throw new Error('no css'); } });
  await assert.rejects(launch(opts), /no css/);
});

test('coming back to the tab offers an update only when a newer build exists', async () => {
  const { doc, log, opts } = setup();
  const title = await launch(opts);
  await doc.fire('visibilitychange');
  assert.equal(title.upd.hidden, true, 'same build: nothing to offer');

  const newer = setup({ getVersion: async () => ({ hash: 'def5678' }) });
  const t2 = await launch(newer.opts);
  await newer.doc.fire('visibilitychange');
  assert.equal(t2.upd.hidden, false);
  t2.upd.click();
  assert.ok(newer.log.includes('goTo def5678'));
  assert.ok(!log.some((l) => l.startsWith('goTo')));
});

test('no update check while the tab is hidden, after Start, or on a dev build', async () => {
  const asked = [];
  const getVersion = async () => { asked.push(1); return { hash: 'zzz' }; };

  const a = setup({ getVersion }); const ta = await launch(a.opts); a.doc.hidden = true; await a.doc.fire('visibilitychange');
  const b = setup({ getVersion }); const tb = await launch(b.opts); tb.go.click(); await b.doc.fire('visibilitychange');
  const c = setup({ getVersion, hash: 'dev', built: undefined }); const tc = await launch(c.opts); await c.doc.fire('visibilitychange');
  assert.deepEqual(asked, []);
  assert.equal(tc.ver.textContent, 'build dev');
  assert.ok(ta && tb);
});

test('Quick Start plays a random map', async () => {
  const played = [];
  const maps = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const { opts } = setup({ random: () => 0.7, loadGame: async () => ({ maps, play: (m) => played.push(m.id), registry: {} }) });
  const title = await launch(opts);
  title.go.click();
  assert.deepEqual(played, ['c']);
});

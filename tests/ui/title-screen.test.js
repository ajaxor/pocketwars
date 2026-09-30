// The title screen view: its DOM, states and buttons.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeDoc } from '../helpers/fake-dom.js';
import { TitleScreen } from '../../src/ui/title-screen.js';

const make = (links) => { const doc = new FakeDoc(); const title = new TitleScreen(doc, { links }); return { doc, title }; };

test('it mounts one overlay on the page, with Start disabled while loading', () => {
  const { doc, title } = make();
  assert.equal(doc.body.children.length, 1);
  assert.equal(doc.body.children[0], title.root);
  assert.equal(title.go.textContent, 'Loading');
  assert.equal(title.go.disabled, true);
  assert.ok(title.root.find((e) => e.tag === 'h1' && e.children.map((c) => c.textContent).join(' ') === 'Pocket Wars').length === 1);
});

test('links become anchors under the Start button, in order', () => {
  const { title } = make([{ label: 'Unit art', href: 'gallery/' }]);
  const anchors = title.links.children;
  assert.deepEqual(anchors.map((a) => [a.tag, a.textContent, a.attrs.href]), [['a', 'Unit art', 'gallery/']]);
});

test('with no links the link row is empty, not missing', () => assert.equal(make().title.links.children.length, 0));

test('progress, version, ready and failed states', () => {
  const { title } = make();
  title.setProgress(60, 'Loading game...');
  assert.equal(title.fill.style.width, '60%');
  assert.equal(title.status.textContent, 'Loading game...');
  title.setVersion('build abc1234');
  assert.equal(title.ver.textContent, 'build abc1234');

  title.setReady();
  assert.deepEqual([title.ready, title.go.disabled, title.go.textContent, title.fill.style.width, title.status.textContent], [true, false, 'Start', '100%', 'Ready']);

  title.setFailed('offline');
  assert.deepEqual([title.ready, title.go.disabled, title.go.textContent, title.fill.style.width], [false, false, 'Retry', '0%']);
  assert.match(title.status.textContent, /Could not load the game: offline/);
});

test('the main button calls onStart, and the update button is hidden until asked for', () => {
  const { title } = make();
  const calls = [];
  title.onStart = () => calls.push('start');
  title.go.click();
  assert.deepEqual(calls, ['start']);
  assert.equal(title.upd.hidden, true);
  title.showUpdate(() => calls.push('update'));
  assert.equal(title.upd.hidden, false);
  title.upd.click();
  assert.deepEqual(calls, ['start', 'update']);
});

test('remove takes the overlay off the page', () => {
  const { doc, title } = make();
  title.remove();
  assert.equal(doc.body.children.length, 0);
});

test('the progress bar fades away once the game is ready, and comes back if loading fails', () => {
  const doc = new FakeDoc();
  const title = new TitleScreen(doc);
  assert.ok(!title.loading.classList.contains('is-done'));
  title.setReady();
  assert.ok(title.loading.classList.contains('is-done'));
  title.setFailed('x');
  assert.ok(!title.loading.classList.contains('is-done'));
});

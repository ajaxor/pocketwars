// The title screen view: its DOM, states and buttons.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeDoc } from '../helpers/fake-dom.js';
import { TitleScreen } from '../../src/ui/title-screen.js';

const make = (links) => { const doc = new FakeDoc(); const title = new TitleScreen(doc, { links }); return { doc, title }; };

test('it mounts one overlay on the page, with every button disabled while loading and no Quick Start', () => {
  const { doc, title } = make();
  assert.equal(doc.body.children.length, 1);
  assert.equal(doc.body.children[0], title.root);
  assert.deepEqual([title.campaign, title.skirmish, title.editor].map((b) => b.disabled), [true, true, true]);
  assert.equal(title.retry.hidden, true);
  assert.equal(title.root.find((e) => e.tag === 'button' && /quick/i.test(e.textContent)).length, 0);
  assert.ok(title.root.find((e) => e.tag === 'h1' && e.children.map((c) => c.textContent).join(' ') === 'Pocket Wars').length === 1);
});

test('the main buttons and the links share one menu column, so they are all as wide as the column lets them be', () => {
  const { title } = make([{ label: 'Unit art', href: 'gallery/' }]);
  const menu = title.root.find((e) => e.className === 'title-menu')[0];
  assert.deepEqual(menu.children.map((c) => c.className.split(' ')[0] || c.tag), ['btn', 'btn', 'btn', 'title-links', 'btn']);
  assert.equal(title.links.parent, menu);
});

test('links become anchors under the main buttons, in order', () => {
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
  assert.deepEqual([title.ready, title.retry.hidden, title.fill.style.width, title.status.textContent], [true, true, '100%', 'Ready']);

  title.setCampaign(true); title.setSkirmish(true); title.setEditor(true);
  title.setFailed('offline');
  assert.deepEqual([title.ready, title.retry.hidden, title.fill.style.width], [false, false, '0%']);
  assert.deepEqual([title.campaign, title.skirmish, title.editor].map((b) => b.disabled), [true, true, true], 'a failed load turns the menu off');
  assert.match(title.status.textContent, /Could not load the game: offline/);
});

test('Retry calls onRetry, and the update button is hidden until asked for', () => {
  const { title } = make();
  const calls = [];
  title.onRetry = () => calls.push('retry');
  title.retry.click();
  assert.deepEqual(calls, ['retry']);
  assert.equal(title.upd.hidden, true);
  title.showUpdate(() => calls.push('update'));
  assert.equal(title.upd.hidden, false);
  title.upd.click();
  assert.deepEqual(calls, ['retry', 'update']);
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

test('the backdrop is added on request, replaced by the next one, dropped while a page covers it and made anew after, and stopped with the screen', () => {
  const { doc, title } = make();
  const registry = {};   // the fake document has no canvas, so the backdrop never touches it
  assert.equal(title.backdrop, null);
  title.showBackdrop(registry);
  const first = title.backdrop;
  assert.equal(title.bg.children.length, 1);
  title.showBackdrop(registry);
  assert.notEqual(title.backdrop, first);
  assert.equal(first.stopped, true);
  assert.equal(title.bg.children.length, 1, 'the old canvas is gone');

  const second = title.backdrop;
  title.coverBackdrop(true);
  assert.equal(second.stopped, true, 'its memory is let go while a page hides it');
  assert.equal(title.backdrop, null);
  assert.equal(title.bg.children.length, 0);
  title.coverBackdrop(false);
  assert.ok(title.backdrop && title.backdrop !== second, 'a new battlefield when the menu is uncovered');
  assert.equal(title.bg.children.length, 1);

  title.coverBackdrop(true);
  title.showBackdrop(registry);
  assert.equal(title.backdrop, null, 'nothing is made while covered');
  title.coverBackdrop(false);
  assert.ok(title.backdrop);
  const last = title.backdrop;
  title.remove();
  assert.equal(doc.body.children.length, 0);
  assert.equal(last.stopped, true);
});

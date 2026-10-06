import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GhostClickGuard } from '../../src/ui/ghost-click.js';

const map = { id: 'map' }, row = { id: 'build-row' };
const click = (target, detail = 1) => ({ target, detail });

test('the click that follows a map tap does not reach the build row that opened under the finger', () => {
  const g = new GhostClickGuard();
  g.press();                                   // finger down on the factory
  g.mapRelease();                              // lifted: the tap opens the menu
  assert.equal(g.swallows(click(row), map), true, 'the ghost click is dropped');
});

test('a real press on a row still builds: its own pointerdown disarms the guard', () => {
  const g = new GhostClickGuard();
  g.press(); g.mapRelease(); g.swallows(click(row), map);   // the ghost, dropped
  g.press();                                   // the player now deliberately touches a row
  assert.equal(g.swallows(click(row), map), false);
});

test('a real press on a row disarms the guard even if the ghost never arrived (a drag, or a browser that sends none)', () => {
  const g = new GhostClickGuard();
  g.press(); g.mapRelease();                   // no click follows
  g.press();                                   // the next press, on a row
  assert.equal(g.swallows(click(row), map), false);
});

test('only one click is swallowed per map press', () => {
  const g = new GhostClickGuard();
  g.press(); g.mapRelease();
  assert.equal(g.swallows(click(row), map), true);
  assert.equal(g.swallows(click(row), map), false);
});

test('a click that is aimed at the map itself is used up, not swallowed (browsers that keep it on the pressed element)', () => {
  const g = new GhostClickGuard();
  g.press(); g.mapRelease();
  assert.equal(g.swallows(click(map), map), false);
  assert.equal(g.swallows(click(row), map), false, 'and it does not stay armed for a later click');
});

test('keyboard and programmatic clicks (detail 0) are never ghosts, and do not use up the guard', () => {
  const g = new GhostClickGuard();
  g.press(); g.mapRelease();
  assert.equal(g.swallows(click(row, 0), map), false);
  assert.equal(g.swallows(click(row), map), true, 'the real ghost is still caught');
});

test('with no map press pending, nothing is swallowed', () => {
  const g = new GhostClickGuard();
  assert.equal(g.swallows(click(row), map), false);
});

test('the session arms the guard when a press on the map ends and checks clicks on the way down, before the buttons see them', () => {
  const src = readFileSync(new URL('../../src/ui/session.js', import.meta.url), 'utf8');
  assert.match(src, /onPointerUp = \(e\) => \{ this\.gestures\.up\(e\); this\.ghost\.mapRelease\(\); \}/);
  assert.match(src, /addEventListener\?\.\('pointerdown', this\.onDocPointerDown, true\)/, 'capture phase');
  assert.match(src, /addEventListener\?\.\('click', this\.onDocClick, true\)/, 'capture phase');
  assert.match(src, /removeEventListener\?\.\('click', this\.onDocClick, true\)/, 'and removed again on dispose');
});

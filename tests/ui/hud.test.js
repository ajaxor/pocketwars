// The HUD against a fake DOM: what each call puts on the page, and what the buttons do.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry, loadMap } from '../../src/data/loader.js';
import { Game } from '../../src/engine/game.js';
import { allProperties } from '../../src/engine/queries.js';
import { FakeDoc } from '../helpers/fake-dom.js';
import { Hud } from '../../src/ui/hud.js';
import { buildMenuModel } from '../../src/ui/build-menu.js';
import { terrainInfo, unitInfo } from '../../src/ui/info.js';

const registry = await loadRegistry(readData);
const classic = await loadMap(readData, registry, 'classic');

function make() {
  const doc = new FakeDoc();
  doc.withId('ui');
  let now = 1000;
  const hud = new Hud(doc, { registry, clock: () => now });
  const at = (t) => { now = t; };
  const within = (root) => (cls) => root.find((e) => e.classList.contains(cls));
  const byClass = within(hud.el.dock);       // the floating windows
  const inRoot = within(hud.root);           // everything, including the status bar
  const inModal = within(hud.el.modal);
  const texts = (els) => els.map((e) => e.textContent);
  return { doc, hud, at, byClass, inRoot, inModal, texts, game: new Game(registry, classic) };
}
const colors = { color: '#e8712c', dark: '#9a3f0e' };

test('the status bar shows the day, whose turn it is, funds and properties, and only writes what changed', () => {
  const { hud, inRoot: byClass } = make();
  hud.status({ day: 3, name: 'Orange Star', color: '#e8712c', funds: 12500, props: 4 });
  const day = byClass('bar-day')[0], who = byClass('bar-who')[0], nums = byClass('bar-num');
  assert.deepEqual([day.textContent, who.textContent, nums[0].textContent, nums[1].textContent], ['Day 3', 'Orange Star', '12,500', '4']);
  assert.equal(hud.el.bar.style['--accent'], '#e8712c');
  day.textContent = 'edited elsewhere';
  hud.status({ day: 3, name: 'Orange Star', color: '#e8712c', funds: 12500, props: 4 });
  assert.equal(day.textContent, 'edited elsewhere', 'an unchanged value is not written again');
});

test('Undo and End turn are buttons the session can wire and disable', () => {
  const { hud } = make();
  const calls = [];
  hud.onEnd(() => calls.push('end')); hud.onUndo(() => calls.push('undo'));
  hud.el.end.click(); hud.el.undo.click();
  assert.deepEqual(calls, ['end', 'undo']);
  hud.setUndoDisabled(true); hud.setEndDisabled(true);
  assert.deepEqual([hud.el.undo.disabled, hud.el.end.disabled], [true, true]);
});

test('the dock switches between the top and the bottom edge', () => {
  const { hud } = make();
  hud.setSide('top');
  assert.ok(hud.el.dock.classList.contains('dock--top') && !hud.el.dock.classList.contains('dock--bottom'));
  hud.setSide('bottom');
  assert.ok(hud.el.dock.classList.contains('dock--bottom') && !hud.el.dock.classList.contains('dock--top'));
});

test('a toast fades after a few seconds, unless it is sticky', () => {
  const { hud, at } = make();
  hud.message('Tank hits Soldier -4');
  assert.equal(hud.el.toast.children.length, 1);
  hud.tick(2000);
  assert.equal(hud.el.toast.children.length, 1, 'still there after one second');
  hud.tick(9000);
  assert.equal(hud.el.toast.children.length, 0);
  hud.message('Blue Moon is moving...', { sticky: true });
  hud.tick(1e9);
  assert.equal(hud.el.toast.children.length, 1);
  hud.message(null);
  assert.equal(hud.el.toast.children.length, 0);
  at(0);
});

test('info boxes: the unit window and the terrain window, with the faction and terrain names', () => {
  const { hud, game, byClass, texts } = make();
  const u = game.state.units.find((q) => q.owner === 0 && q.type === 'soldier');
  hud.info({ unit: unitInfo(game, u), terrain: terrainInfo(game, u.x, u.y) });
  assert.equal(hud.el.info.children.length, 2);
  assert.deepEqual(texts(byClass('card-name')), ['Soldier', 'Plain']);
  assert.deepEqual(texts(byClass('card-sub')), ['Orange Star']);
  assert.ok(texts(byClass('chip-v')).includes('10/10') || texts(byClass('v')).includes('10/10'));
  assert.ok(byClass('star').length >= 8, 'two rows of defense stars');
  hud.info({});
  assert.equal(hud.el.info.children.length, 0);
});

test('a terrain window for a property shows its owner and income; impassable moves are marked', () => {
  const { hud, game, byClass, texts } = make();
  const p = allProperties(game).find((q) => q.owner === 1 && q.terrain.id === 'factory');
  hud.info({ terrain: terrainInfo(game, p.x, p.y) });
  assert.deepEqual(texts(byClass('card-sub')), ['Blue Moon']);
  assert.ok(texts(byClass('chip-v')).includes('+1,000'));
  assert.ok(texts(byClass('tag')).includes('Builds vehicles'));
  let sea = null;
  game.map.terrain.forEach((row, y) => row.forEach((t, x) => { if (t === 'sea') sea = { x, y }; }));
  hud.info({ terrain: terrainInfo(game, sea.x, sea.y) });
  assert.equal(byClass('chip--no').length, 2, 'foot and wheels cannot enter the sea');
});

test('the capture and attack-forecast lines appear only when they apply', () => {
  const { hud, game, byClass, texts } = make();
  const u = game.state.units.find((q) => q.owner === 0);
  hud.info({ unit: { ...unitInfo(game, u), capture: { progress: 10, needed: 20 }, forecast: 4 } });
  const notes = texts(byClass('note'));
  assert.ok(notes.includes('Capturing 10/20') && notes.includes('Your attack: -4 HP'));
  hud.info({ unit: unitInfo(game, u) });
  assert.equal(byClass('note--hot').length, 0);
});

test('order buttons come in the order given and call their handlers; null removes the window', () => {
  const { hud, byClass, texts } = make();
  const calls = [];
  hud.actions({ hint: 'Tap your unit to confirm the move.', items: [
    { label: 'Wait', variant: 'primary', onClick: () => calls.push('wait') },
    { label: 'Cancel', variant: 'ghost', onClick: () => calls.push('cancel') },
  ] });
  const buttons = byClass('btn');
  assert.deepEqual(texts(buttons.map((b) => b.children[0])), ['Wait', 'Cancel']);
  assert.ok(buttons[0].classList.contains('btn--primary') && buttons[1].classList.contains('btn--ghost'));
  assert.equal(texts(byClass('hint'))[0], 'Tap your unit to confirm the move.');
  buttons[1].click(); buttons[0].click();
  assert.deepEqual(calls, ['cancel', 'wait']);
  hud.actions(null);
  assert.equal(hud.el.main.children.length, 0);
});

function openBuild(funds, extra = {}) {
  const t = make();
  const f = allProperties(t.game).find((p) => p.owner === 0 && p.terrain.id === 'factory');
  t.game.state.funds[0] = funds;
  const calls = [];
  const model = buildMenuModel(t.game, 0, f.x, f.y);
  t.hud.build(model, { choice: extra.choice ?? model.options[0].id, faction: colors, onBuild: (id) => calls.push(['build', id]), onClose: () => calls.push(['close']) });
  const rows = () => t.byClass('build-row');
  const buy = () => t.byClass('btn--primary')[0];
  return { ...t, calls, rows, buy, label: (b) => b.children.at(-1).textContent };
}

test('the build menu has a row per unit, the funds in its title, and a Build button for the picked unit', () => {
  const { rows, byClass, texts, buy, label } = openBuild(8000);
  assert.equal(rows().length, 5);
  assert.deepEqual(texts(byClass('win-title')), ['Factory']);
  assert.deepEqual(texts(byClass('win-tag')), ['Funds 8,000']);
  assert.deepEqual(texts(byClass('build-name')), ['Recon', 'Tank', 'Heavy Tank', 'Artillery', 'Flak']);
  assert.deepEqual(texts(byClass('build-cost')), ['4,000', '7,000', '10,000', '6,000', '6,000']);
  assert.ok(rows()[0].classList.contains('is-picked'));
  assert.equal(label(buy()), 'Build Recon - 4,000');
});

test('tapping a row only selects it (and shows its details); the Build button spends the money', () => {
  const { rows, calls, buy, byClass, texts, label } = openBuild(8000);
  rows()[1].click();
  assert.deepEqual(calls, [], 'selecting never builds');
  assert.ok(rows()[1].classList.contains('is-picked') && !rows()[0].classList.contains('is-picked'));
  assert.equal(label(buy()), 'Build Tank - 7,000');
  assert.ok(texts(byClass('note')).some((n) => n.startsWith('Tank cannon: 80 damage, range 1.')));
  buy().click();
  assert.deepEqual(calls, [['build', 'tank']]);
});

test('an unaffordable unit can be looked at but not built, and says how much is missing', () => {
  const { rows, buy, label, calls } = openBuild(8000);
  assert.ok(rows()[2].classList.contains('is-poor'));
  rows()[2].click();
  assert.equal(label(buy()), 'Need 2,000 more');
  assert.equal(buy().disabled, true);
  assert.deepEqual(calls, []);
});

test('Close calls onClose, and a new model replaces the old window', () => {
  const { hud, byClass, calls } = openBuild(8000);
  byClass('btn--ghost')[0].click();
  assert.deepEqual(calls, [['close']]);
  hud.build(null, {});
  assert.equal(hud.el.main.children.length, 0);
});

test('unit pictures are drawn for every visible unit and dropped once their window is gone', () => {
  const { hud, game } = make();
  const u = game.state.units.find((q) => q.owner === 0);
  hud.info({ unit: unitInfo(game, u), terrain: null });
  assert.equal(hud.icons.length, 1);
  hud.drawIcons(0);                 // the fake canvas has no context: drawing is skipped, not a crash
  hud.info({});
  hud.drawIcons(0);
  assert.equal(hud.icons.length, 0);
});

test('the game-over box shows the result and a button; null hides it', () => {
  const { hud, inModal: byClass, texts } = make();
  const calls = [];
  assert.equal(hud.el.modal.hidden, true);
  hud.gameOver({ title: 'Victory', text: 'Orange Star wins!', color: '#e8712c', onClick: () => calls.push('again') });
  assert.equal(hud.el.modal.hidden, false);
  assert.deepEqual(texts(byClass('win-title')), ['Victory']);
  assert.deepEqual(texts(byClass('big')), ['Orange Star wins!']);
  byClass('btn')[0].click();
  assert.deepEqual(calls, ['again']);
  hud.gameOver(null);
  assert.equal(hud.el.modal.hidden, true);
});

test('clear() removes the boxes, the orders and the build menu but leaves the toast', () => {
  const { hud, game } = make();
  hud.message('hello');
  hud.info({ terrain: terrainInfo(game, 0, 0) });
  hud.actions({ items: [{ label: 'Wait', onClick() {} }] });
  hud.clear();
  assert.deepEqual([hud.el.info.children.length, hud.el.main.children.length, hud.el.toast.children.length], [0, 0, 1]);
});

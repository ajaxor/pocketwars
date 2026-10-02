// What leaders say in battle: the commentator (when and what), the banner (typing, cards, tapping), the pacer (fast-forward clock and
// waits) and holding the screen (gestures).
import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeDoc } from '../helpers/fake-dom.js';
import { makeGame } from '../helpers/fixtures.js';
import { Commentator, MIN_GAP } from '../../src/campaign/commentary.js';
import { CPS, CommentaryBanner } from '../../src/ui/commentary-banner.js';
import { Pacer } from '../../src/ui/pacing.js';
import { Gestures } from '../../src/ui/gestures.js';

const players = (a, b) => [{ faction: 'red', controller: 'human', funds: 0, ...(a && { leader: a }) }, { faction: 'blue', controller: 'ai', funds: 0, ...(b && { leader: b }) }];
const voices = (log = []) => ({ say: (id, situation) => { log.push([id, situation]); return `${id}:${situation}`; } });
const loadouts = { default: { build: {}, start: {} }, leaders: { x: {}, y: {} } };
const game = (a, b, unitsOnMap = [['a', 0, 1, 1], ['a', 1, 3, 1]]) => makeGame({ rows: ['a..b.', '.....'], loadouts, unitsOnMap, players: players(a, b) });
const strike = (attacker, defender, destroyed = false) => ({ type: 'strike', attacker: { owner: attacker }, defender: { owner: defender }, destroyed });

// ---- the commentator ----------------------------------------------------------------------------------------------------------------
test('the opening has a battle_start line from every team that has a leader, in turn order', () => {
  const log = [];
  const c = new Commentator(game('x', 'y'), voices(log));
  assert.deepEqual(c.opening().map((o) => [o.owner, o.leader, o.situation, o.line]), [[0, 'x', 'battle_start', 'x:battle_start'], [1, 'y', 'battle_start', 'y:battle_start']]);
  assert.deepEqual(new Commentator(game(null, 'y'), voices()).opening().map((o) => o.owner), [1]);
  assert.deepEqual(new Commentator(game(null, null), voices()).opening(), []);
  assert.deepEqual(new Commentator(game('x', 'y'), { say: () => '' }).opening(), [], 'a leader with nothing to say is left out');
});

const kill = (attacker, defender) => strike(attacker, defender, true);
const capture = (taker, from, completed = true, hq = false) => ({ type: 'capture', completed, hq, previousOwner: from, unit: { owner: taker } });
const t = (i) => i * MIN_GAP;   // moments far enough apart that nobody is still quiet

test('a milestone is said once: the first kill gets a line, and later kills only at their own milestones', () => {
  const c = new Commentator(game(null, 'y'), voices());   // only y has a leader here
  const out = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => c.react([kill(1, 0)], t(i), 1)?.situation ?? null);
  assert.deepEqual(out.slice(0, 3), ['first_blood', 'attack', 'killing_spree'], 'the first kill, the first attack (once), the third kill');
  assert.deepEqual(out.slice(3, 5), [null, null], 'the fourth and fifth kills are not remarked on');
  assert.equal(out[5], 'taunt', 'the sixth kill is');
  assert.deepEqual(out.slice(6), [null, null]);
});

test('the loser of a unit, a building and the one who took it each speak up once', () => {
  const c = new Commentator(game('x', 'y'), voices());
  const seq = [[[kill(0, 1)], 1], [[], 1], [[capture(0, 1)], 1], [[], 1], [[], 1], [[capture(0, 1)], 1], [[capture(0, 1)], 0], [[], 0]]
    .map(([events, prefer], i) => { const r = c.react(events, t(i + 1), prefer); return r && `${r.owner}:${r.situation}`; });
  assert.deepEqual(seq, ['1:first_loss', '0:first_blood', '1:building_lost', '0:capture', '0:attack', null, '0:capture', null],
    'y loses a unit; x gloats; y loses a building; x took it; x\'s first attack; the second capture is not remarked on, the third is');
});

test('an enemy starting to capture the HQ is a danger once, for the one whose HQ it is', () => {
  const c = new Commentator(game('x', 'y'), voices());
  const threat = capture(0, 1, false, true);
  const r = c.react([threat], t(1), 0);
  assert.deepEqual([r.owner, r.situation], [1, 'hq_threat'], 'y worries, though it is x\'s turn');
  assert.equal(c.react([threat], t(2), 1), null, 'once');
  assert.equal(c.react([capture(0, 1, false, false)], t(3), 0), null, 'a plain building under capture is no threat to the HQ');
});

test('turns bring the state milestones: a first idle remark, being outnumbered, being far ahead', () => {
  const c = new Commentator(game('x', 'y', [['a', 0, 0, 1], ['a', 0, 1, 1], ['a', 0, 2, 1], ['a', 1, 3, 1]]), voices());
  assert.equal(c.turnStart(1, t(1))?.situation, 'first_turn', 'the first turn: just a remark');
  assert.equal(c.turnStart(1, t(2))?.situation, 'outnumbered', 'outnumbered three to one');
  assert.equal(c.turnStart(1, t(3)), null, 'and not again');
  assert.equal(c.turnStart(0, t(4))?.situation, 'first_turn');
  assert.equal(c.turnStart(0, t(5))?.situation, 'dominant', 'three to one ahead');
  assert.equal(new Commentator(game('x', null), voices()).turnStart(1, 0), null, 'a team without a leader is silent');
});

test('after a comment a leader is quiet for a while, and a milestone that comes due meanwhile waits', () => {
  const c = new Commentator(game(null, 'y'), voices());
  assert.equal(c.react([kill(1, 0)], 0, 1)?.situation, 'first_blood');
  assert.equal(c.react([kill(1, 0)], MIN_GAP - 1, 1), null);
  assert.equal(c.react([], MIN_GAP, 1)?.situation, 'attack', 'its turn comes when the pause is over');
});

test('the ending: the winner has a victory line and the others a defeat line, and a draw has none', () => {
  const c = new Commentator(game('x', 'y'), voices());
  assert.deepEqual(c.ending(1).map((o) => [o.owner, o.situation]), [[0, 'defeat'], [1, 'victory']]);
  assert.deepEqual(c.ending('draw'), []);
  assert.deepEqual(c.ending(null), []);
});

// ---- the banner ---------------------------------------------------------------------------------------------------------------------
const L = { id: 'x', skin: '#fff' };

test('the banner types a line out, shows it whole when fast-forwarding, and turns verse into line breaks', () => {
  const b = new CommentaryBanner(new FakeDoc());
  assert.equal(b.root.classList.contains('cm--hidden'), true);
  b.say({ leader: L, name: 'Ada', color: '#f00', text: 'Hello there, sugar' });
  assert.equal(b.root.classList.contains('cm--hidden'), false);
  assert.equal(b.name.textContent, 'Ada');
  b.tick(1000);
  b.tick(1000 + (5 / CPS) * 1000 + 1);
  assert.equal(b.shownText, 'Hello');
  assert.ok(b.typing);
  b.tick(1100, true);
  assert.equal(b.shownText, 'Hello there, sugar');
  assert.ok(!b.typing);
  b.say({ leader: L, text: 'Fair is foul / and foul is fair' });
  b.tick(5000, true);
  assert.equal(b.shownText, 'Fair is foul\nand foul is fair');
  b.hide();
  assert.equal(b.root.classList.contains('cm--hidden'), true);
  assert.equal(b.visible, false);
});

test('a card takes taps: the first shows the whole line, the second answers it; plain comments ignore taps', async () => {
  const b = new CommentaryBanner(new FakeDoc());
  let answered = false;
  const asked = b.ask({ leader: L, text: 'We fight at dawn.' }).then(() => { answered = true; });
  assert.equal(b.root.classList.contains('cm--modal'), true);
  b.tick(0); b.tick(100);
  b.root.click();
  assert.equal(b.shownText, 'We fight at dawn.');
  b.tick(150);
  assert.equal(b.shownText, 'We fight at dawn.', 'the next frame does not take the text back');
  await Promise.resolve();
  assert.equal(answered, false);
  b.root.click();
  await asked;
  assert.equal(answered, true);

  b.say({ leader: L, text: 'Hmph.' });
  assert.equal(b.root.classList.contains('cm--modal'), false);
  b.tick(0, true);
  b.root.click();
  assert.equal(b.visible, true, 'a comment is not dismissed by a tap');
});

test('showing another card answers the one before, and hiding answers it too', async () => {
  const b = new CommentaryBanner(new FakeDoc());
  let n = 0;
  const first = b.ask({ leader: L, text: 'One' }).then(() => n++);
  const second = b.ask({ leader: L, text: 'Two' }).then(() => n++);
  await first;
  assert.equal(n, 1);
  b.hide();
  await second;
  assert.equal(n, 2);
});

test('the fast-forward mark follows setFast', () => {
  const b = new CommentaryBanner(new FakeDoc());
  assert.equal(b.ff.classList.contains('cm-ff--hidden'), true);
  b.setFast(true);
  assert.equal(b.ff.classList.contains('cm-ff--hidden'), false);
  b.setFast(false);
  assert.equal(b.ff.classList.contains('cm-ff--hidden'), true);
});

// ---- the pacer ----------------------------------------------------------------------------------------------------------------------
const fakeTimers = () => {
  const timers = new Map(); let id = 0;
  return { timers, setTimer: (fn) => { timers.set(++id, fn); return id; }, clearTimer: (i) => timers.delete(i), fire: () => { for (const [i, fn] of [...timers]) { timers.delete(i); fn(); } } };
};

test('the clock runs four times as fast while fast-forwarding and keeps going from where it was', () => {
  let t = 1000;
  const p = new Pacer({ clock: () => t, factor: 4 });
  assert.equal(p.now(), 1000, 'it starts on the real clock');
  t = 1100; assert.equal(p.now(), 1100);
  p.setFast(true);
  t = 1200; assert.equal(p.now(), 1500);
  p.setFast(false);
  t = 1300; assert.equal(p.now(), 1600);
});

test('waits resolve by themselves, at once while fast, and the moment fast-forwarding starts', async () => {
  const ft = fakeTimers();
  const p = new Pacer({ clock: () => 0, setTimer: ft.setTimer, clearTimer: ft.clearTimer });
  let done = 0;
  const w = p.wait(500).then(() => done++);
  assert.equal(ft.timers.size, 1);
  await Promise.resolve();
  assert.equal(done, 0);
  ft.fire();
  await w;
  assert.equal(done, 1);

  const w2 = p.wait(500).then(() => done++);
  p.setFast(true);
  await w2;
  assert.equal(done, 2);
  assert.equal(ft.timers.size, 0, 'the timer of a wait that was cut short is gone');
  await p.wait(500);
  assert.equal(ft.timers.size, 0, 'and nothing is scheduled while fast');
  await p.wait(0);
});

// ---- holding the screen -------------------------------------------------------------------------------------------------------------
const ev = (pointerId, clientX, clientY) => ({ pointerId, clientX, clientY });
const hold = (use = true) => {
  const ft = fakeTimers(), log = [];
  const g = new Gestures({ onTap: () => log.push('tap'), onPan: () => log.push('pan'), onZoom: () => {}, onHold: (on) => { log.push(on ? 'hold' : 'release'); return use; }, setTimer: ft.setTimer, clearTimer: ft.clearTimer });
  return { g, log, ft };
};

test('a finger that stays down starts a hold, and lifting ends it without a tap', () => {
  const { g, log, ft } = hold();
  g.down(ev(1, 5, 5));
  ft.fire();
  assert.deepEqual(log, ['hold']);
  g.up(ev(1, 5, 5));
  assert.deepEqual(log, ['hold', 'release']);
});

test('a quick tap is still a tap, and a drag or a second finger cancels the wait for a hold', () => {
  const quick = hold();
  quick.g.down(ev(1, 5, 5)); quick.g.up(ev(1, 5, 5));
  assert.deepEqual(quick.log, ['tap']);
  assert.equal(quick.ft.timers.size, 0);

  const drag = hold();
  drag.g.down(ev(1, 0, 0)); drag.g.move(ev(1, 30, 0));
  drag.ft.fire();
  drag.g.up(ev(1, 30, 0));
  assert.ok(!drag.log.includes('hold'));

  const pinch = hold();
  pinch.g.down(ev(1, 0, 0)); pinch.g.down(ev(2, 50, 0));
  pinch.ft.fire();
  assert.ok(!pinch.log.includes('hold'));
});

test('a hold that moves into a drag ends at once', () => {
  const { g, log, ft } = hold();
  g.down(ev(1, 0, 0)); ft.fire();
  g.move(ev(1, 40, 0));
  assert.deepEqual(log.slice(0, 3), ['hold', 'release', 'pan']);
  g.up(ev(1, 40, 0));
  assert.equal(log.filter((l) => l === 'release').length, 1);
});

test('when nothing uses the hold, a long press is a tap as before', () => {
  const { g, log, ft } = hold(false);
  g.down(ev(1, 5, 5)); ft.fire(); g.up(ev(1, 5, 5));
  assert.deepEqual(log, ['hold', 'tap']);
  const plain = new Gestures({ onTap: () => log.push('plain-tap'), onPan: () => {}, onZoom: () => {} });
  plain.down(ev(1, 1, 1)); plain.up(ev(1, 1, 1));
  assert.equal(log.at(-1), 'plain-tap', 'no onHold: nothing changes');
});

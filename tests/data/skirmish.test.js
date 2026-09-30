// Skirmish setup rules, the skirmish screen, and the title/launcher wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { FakeDoc } from '../helpers/fake-dom.js';
import { loadRegistry, loadMapIndex, loadMap } from '../../src/data/loader.js';
import { defaultSkirmish, skirmishProblems, applySkirmish, swapFaction } from '../../src/data/skirmish.js';
import { SkirmishScreen } from '../../src/ui/skirmish-screen.js';
import { TitleScreen } from '../../src/ui/title-screen.js';
import { launch } from '../../src/launcher.js';

const registry = await loadRegistry(readData);
const index = await loadMapIndex(readData);
const maps = [];
for (const id of Object.keys(index.maps)) maps.push(await loadMap(readData, registry, id));
const classic = maps.find((m) => m.id === 'classic');
const four = maps.find((m) => m.players.length === 4);

test('defaults copy the map; problems catch duplicates, unknown colours and no human', () => {
  const s = defaultSkirmish(classic);
  assert.deepEqual(skirmishProblems(classic, registry, s), []);
  const dup = { ...s, players: s.players.map((p) => ({ ...p, faction: s.players[0].faction })) };
  assert.match(skirmishProblems(classic, registry, dup)[0], /already taken/);
  assert.match(skirmishProblems(classic, registry, { ...s, players: [{ ...s.players[0], faction: 'nope' }, s.players[1]] })[0], /unknown colour/);
  assert.ok(skirmishProblems(classic, registry, { ...s, players: s.players.map((p) => ({ ...p, controller: 'ai' })) }).some((p) => /human/.test(p)));
  assert.ok(skirmishProblems(classic, registry, { ...s, funds: -5 }).length);
  assert.ok(skirmishProblems(classic, registry, { ...s, players: [s.players[0]] }).length);
});

test('applying settings gives a frozen copy with colours, controllers and funds', () => {
  const s = defaultSkirmish(classic);
  s.funds = 15000; s.players[1].controller = 'human'; s.players[0].faction = 'green_earth';
  const m = applySkirmish(classic, s);
  assert.ok(Object.isFrozen(m) && Object.isFrozen(m.players[0]));
  assert.deepEqual(m.players.map((p) => [p.faction, p.controller, p.funds]), [['green_earth', classic.players[0].controller, 15000], [classic.players[1].faction, 'human', 15000]]);
  assert.equal(applySkirmish(classic, defaultSkirmish(classic)).players[0].funds, classic.players[0].funds);
  assert.notEqual(m.players, classic.players, 'the original is untouched');
});

test('swapFaction trades colours with whoever held the one asked for', () => {
  const p = [{ faction: 'a' }, { faction: 'b' }, { faction: 'c' }];
  assert.deepEqual(swapFaction(p, 0, 'b').map((x) => x.faction), ['b', 'a', 'c']);
  assert.deepEqual(swapFaction(p, 0, 'z').map((x) => x.faction), ['z', 'b', 'c']);
  assert.equal(p[0].faction, 'a', 'input is not mutated');
});

test('the skirmish screen lists every map, picks, edits and starts', () => {
  const doc = new FakeDoc();
  let started = null, back = 0;
  const s = new SkirmishScreen(doc, { registry, maps, selectedId: 'classic', onStart: (m, st) => { started = [m, st]; }, onBack: () => back++ });
  assert.equal(s.root.find((e) => e.className.includes('sk-map ')).length + s.root.find((e) => e.className === 'sk-map').length, maps.length);
  assert.equal(s.map.id, 'classic');
  s.pick(four.id);
  assert.equal(s.settings.players.length, 4);
  assert.equal(s.root.find((e) => e.className === 'sk-slot').length, 4);
  s.setFunds(10000);
  s.pick('classic');
  assert.equal(s.settings.funds, 10000, 'funds survive picking another map');
  s.setFaction(0, 'yellow_comet');
  assert.equal(new Set(s.settings.players.map((p) => p.faction)).size, 2);
  s.setController(0, 'ai'); s.setController(1, 'ai');
  assert.equal(s.go.disabled, true, 'no human, no start');
  s.go.click();
  assert.equal(started, null);
  s.setController(0, 'human');
  assert.equal(s.go.disabled, false);
  s.go.click();
  assert.equal(started[0].id, 'classic');
  assert.equal(started[1].funds, 10000);
  s.back.click();
  assert.equal(back, 1);
});

test('the title screen has a Skirmish button that waits for the game', () => {
  const t = new TitleScreen(new FakeDoc(), { links: [] });
  assert.equal(t.skirmish.disabled, true);
  t.setSkirmish(true);
  assert.equal(t.skirmish.disabled, false);
  let hit = 0; t.onSkirmish = () => hit++; t.skirmish.click();
  assert.equal(hit, 1);
  t.setFailed('x');
  assert.equal(t.skirmish.disabled, true);
});

test('launcher: Skirmish opens the page, Back closes it, Start plays the chosen setup', async () => {
  const doc = new FakeDoc();
  doc.body.classList.add('loading'); doc.withId('boot');
  const played = [];
  const game = { registry, maps, map: classic, defaultMapId: 'classic', play: (m) => played.push(m) };
  const title = await launch({ doc, base: '', tag: 't', hash: 't', built: '2026-09-30T00:00:00Z', getVersion: async () => ({ hash: 't' }), goTo() {}, reload() {}, loadCss: async () => {}, loadGame: async () => game });
  assert.equal(title.skirmish.disabled, false);
  const open = () => doc.body.children.find((c) => c.className === 'sk');
  const press = (label) => open().find((e) => e.className === 'btn-label' && e.textContent === label)[0].parent.click();
  title.skirmish.click();
  assert.ok(open());
  press('Back');
  assert.equal(open(), undefined);
  title.skirmish.click();
  press('Start battle');
  assert.equal(played.length, 1);
  assert.equal(played[0].id, 'classic');
  assert.equal(open(), undefined);
  assert.equal(doc.body.children.some((c) => c.className === 'title'), false);
});

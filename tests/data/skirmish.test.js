// Skirmish setup rules, the skirmish screen, and the title/launcher wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { FakeDoc } from '../helpers/fake-dom.js';
import { loadRegistry, loadMapIndex, loadMap } from '../../src/data/loader.js';
import { RANDOM_LEADER, defaultSkirmish, skirmishProblems, applySkirmish, resolveLeaders, swapFaction } from '../../src/data/skirmish.js';
import { placeStart } from '../../src/data/formation.js';
import { loadCampaign } from '../../src/data/campaign.js';
import { SkirmishScreen } from '../../src/ui/skirmish-screen.js';
import { TitleScreen } from '../../src/ui/title-screen.js';
import { launch } from '../../src/launcher.js';

const registry = await loadRegistry(readData);
const index = await loadMapIndex(readData);
const maps = [];
for (const id of Object.keys(index.maps)) maps.push(await loadMap(readData, registry, id));
const campaign = await loadCampaign(readData, registry);
const bare = await loadRegistry(async (p) => (p === 'loadouts.json' ? undefined : readData(p)));   // the game without any leaders
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
  s.funds = 15000; s.players[1].controller = 'human'; s.players[0].faction = 'ironvale';
  const m = applySkirmish(classic, s);
  assert.ok(Object.isFrozen(m) && Object.isFrozen(m.players[0]));
  assert.deepEqual(m.players.map((p) => [p.faction, p.controller, p.funds]), [['ironvale', classic.players[0].controller, 15000], [classic.players[1].faction, 'human', 15000]]);
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
  s.setFaction(0, 'solace');
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

// ---- leaders ------------------------------------------------------------------------------------------------------------------------------
const ids = registry.leaderIds;
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };

test('defaults: a human team starts with the starter leader, the computer on Random, and nobody without leaders to pick', () => {
  assert.deepEqual(defaultSkirmish(classic, ids).players.map((p) => p.leader), ['harlan', RANDOM_LEADER], 'the first leader is the starter');
  assert.deepEqual(defaultSkirmish(classic, ids, 'ada').players.map((p) => p.leader), ['ada', RANDOM_LEADER]);
  assert.deepEqual(defaultSkirmish(four, ids).players.map((p) => p.leader), ['harlan', RANDOM_LEADER, RANDOM_LEADER, RANDOM_LEADER]);
  assert.deepEqual(defaultSkirmish(classic).players.map((p) => p.leader), [null, null]);
  assert.deepEqual(skirmishProblems(classic, registry, defaultSkirmish(classic, ids)), []);
});

test('leader problems: an unknown leader, and Random with no leaders to roll', () => {
  const s = defaultSkirmish(classic, ids);
  s.players[1].leader = 'nobody';
  assert.match(skirmishProblems(classic, registry, s)[0], /slot 2: unknown leader "nobody"/);
  s.players[1].leader = 'envoy';
  assert.match(skirmishProblems(classic, registry, s)[0], /unknown leader "envoy"/, 'the Chorus\' avatar is not a pickable leader');
  const r = defaultSkirmish(classic, ids);
  assert.match(skirmishProblems(classic, bare, r).join('|'), /slot 1: unknown leader "harlan"/, 'without loadouts no leader id is known');
  assert.match(skirmishProblems(classic, bare, { ...r, players: [{ ...r.players[0], leader: RANDOM_LEADER }, r.players[1]] }).join('|'), /slot 1: there are no leaders to pick from/);
  for (const leader of [null, undefined]) assert.deepEqual(skirmishProblems(classic, registry, { ...r, players: r.players.map((p) => ({ ...p, leader })) }), []);
});

test('Random rolls a leader no other team has, unless there is no other choice', () => {
  assert.deepEqual(resolveLeaders([{ leader: 'ada' }, { leader: RANDOM_LEADER }], ['harlan', 'ada', 'vex'], seq(0)), ['ada', 'harlan']);
  assert.deepEqual(resolveLeaders([{ leader: 'ada' }, { leader: RANDOM_LEADER }], ['harlan', 'ada', 'vex'], seq(0.99)), ['ada', 'vex']);
  assert.deepEqual(resolveLeaders([{ leader: RANDOM_LEADER }, { leader: RANDOM_LEADER }, { leader: null }], ['a', 'b', 'c'], seq(0)), ['a', 'b', null], 'two Randoms differ');
  assert.deepEqual(resolveLeaders([{ leader: 'a' }, { leader: RANDOM_LEADER }], ['a'], seq(0)), ['a', 'a'], 'a mirror when it is all there is');
  assert.deepEqual(resolveLeaders([{ leader: RANDOM_LEADER }], ['a', 'b'], () => 1), ['b'], 'a random() of 1 stays in range');
  assert.deepEqual(resolveLeaders([{}, { leader: null }, { leader: 'x' }], ['x'], seq(0)), [null, null, 'x']);
});

const armyOf = (map, owner, leader) => placeStart(map, registry, owner, registry.loadoutFor(leader).start).units;

test('applying settings with leaders: their units, build menus and a random pick, all in a frozen copy', () => {
  const s = defaultSkirmish(classic, ids);
  s.players[0].leader = 'ada';
  const m = applySkirmish(classic, s, registry, seq(0));
  assert.deepEqual(m.players.map((p) => p.leader), ['ada', 'harlan'], 'the computer rolled the first leader that is not ada');
  assert.ok(Object.isFrozen(m) && Object.isFrozen(m.players[1]) && Object.isFrozen(m.units));
  for (const o of [0, 1]) assert.deepEqual(m.units.filter((u) => u.owner === o).map((u) => u.type).sort(), armyOf(classic, o, m.players[o].leader).map((x) => x.type).sort(), `team ${o + 1} has the leader's army`);
  assert.notDeepEqual(m.units, classic.units, 'the map\'s own soldiers, tank and artillery are replaced');
  assert.equal(classic.units.length, 10, 'the original map is untouched');
  assert.equal(classic.players[0].leader, undefined);
  for (const u of m.units) assert.equal(registry.terrain[m.terrain[u.y][u.x]].attributes.property, undefined, 'nobody starts on a property');
});

test('applying settings without leaders keeps the map\'s own units, exactly as before', () => {
  const m = applySkirmish(classic, defaultSkirmish(classic), registry);
  assert.deepEqual(m.units, classic.units);
  assert.equal('leader' in m.players[0], false);
  assert.deepEqual(applySkirmish(classic, defaultSkirmish(classic)).units, classic.units, 'and no registry is needed');
  const some = defaultSkirmish(classic, ids);
  some.players[0].leader = null; some.players[1].leader = 'vex';
  const mixed = applySkirmish(classic, some, registry);
  assert.deepEqual(mixed.units.filter((u) => u.owner === 0), classic.units.filter((u) => u.owner === 0), 'a team without a leader keeps its own units');
  assert.equal(mixed.units.filter((u) => u.owner === 1).length, armyOf(classic, 1, 'vex').length);
  assert.throws(() => applySkirmish(classic, some), /needs the registry/);
});

test('every map plays with every leader pairing the shipped kits allow (no unit left unplaced)', () => {
  for (const m of maps) {
    const s = defaultSkirmish(m, ids);
    s.players.forEach((p, i) => { p.leader = ids[i % ids.length]; });
    const applied = applySkirmish(m, s, registry);
    assert.equal(applied.units.length, m.players.reduce((n, _, o) => n + armyOf(m, o, ids[o % ids.length]).length, 0), m.id);
    for (const a of m.players.map((_, o) => placeStart(m, registry, o, registry.loadoutFor(null).start))) assert.deepEqual(a.skipped, [], m.id);
  }
});

// ---- the screen: the colour picks the leader ---------------------------------------------------------------------------------------------------
const screen = (o = {}) => {
  const doc = new FakeDoc(); const started = [];
  const s = new SkirmishScreen(doc, { registry, maps, selectedId: 'classic', leaders: campaign.leaders, speech: campaign.speech, onStart: (m, st) => started.push([m, st]), onBack() {}, ...o });
  const text = (cls) => s.root.find((e) => e.className === cls).map((e) => e.textContent);
  return { s, started, strips: () => s.root.find((e) => e.className === 'sk-leaders'), who: () => text('sk-leader-who'), quotes: () => text('sk-leader-quote') };
};
const nameOf = (btn) => btn.find((e) => e.className === 'sk-leader-name')[0].textContent;

test('each team shows only the leader of its colour, with their name and a line they say', () => {
  const { s, strips, who, quotes } = screen();
  assert.deepEqual(strips().map((strip) => strip.children.map(nameOf)), [['Ada'], ['Vex']], 'classic is Ashmark against Vantor Reach');
  assert.deepEqual(s.settings.players.map((p) => p.leader), ['ada', 'vex']);
  assert.match(who()[0], /^Cmdr\. Ada - Ashmark - /);
  const lines = campaign.speech.ada.lines.greeting;
  assert.ok(lines.some((l) => quotes()[0] === `\u201c${l}\u201d`), 'a greeting from the leader\'s own speech file');
  assert.equal(strips()[0].attrs['aria-label'], 'Team 1 leader');
});

test('choosing a colour chooses its leader, and the other team follows when colours swap', () => {
  const { s, strips, who } = screen();
  s.setFaction(1, 'tidehaven');
  assert.deepEqual(s.settings.players.map((p) => [p.faction, p.leader]), [['ashmark', 'ada'], ['tidehaven', 'rex']]);
  assert.deepEqual(strips().map((strip) => strip.children.map(nameOf)), [['Ada'], ['Rex']]);
  assert.match(who()[1], /^Adm\. Rex - Tidehaven - /);
  s.setFaction(0, 'tidehaven');   // swaps with team 2
  assert.deepEqual(s.settings.players.map((p) => [p.faction, p.leader]), [['tidehaven', 'rex'], ['ashmark', 'ada']]);
});

test('the line is kept while nothing changes and drawn again when a colour does', () => {
  const { s, quotes } = screen();
  const first = quotes();
  s.setFunds(5000);
  assert.deepEqual(quotes(), first, 'redrawing for another reason keeps the line');
  for (const f of ['solace', 'skyreach', 'deepmere']) { s.setFaction(0, f); assert.match(quotes()[0], /^\u201c.+\u201d$/); }
});

test('picking another map gives every team the leader of its colour; funds are kept', () => {
  const { s } = screen();
  s.setFunds(10000);
  s.pick(four.id);
  assert.deepEqual(s.settings.players.map((p) => p.leader), four.players.map((p) => registry.leaderIds.find((id) => campaign.leaders.find((l) => l.id === id).faction === p.faction)));
  assert.equal(s.settings.funds, 10000);
  assert.equal(s.root.find((e) => e.className === 'sk-leaders').length, 4);
});

test('Start hands the leaders on as picked by colour, as a copy', () => {
  const { s, started } = screen();
  s.setFaction(0, 'highspire');
  s.go.click();
  assert.deepEqual(started[0][1].players.map((p) => [p.faction, p.leader]), [['highspire', 'lysandra'], ['vantor_reach', 'vex']]);
  started[0][1].players[0].leader = 'x';
  assert.equal(s.settings.players[0].leader, 'lysandra');
});

test('without the campaign the leaders are still offered, by id; without any loadouts the strips are not there at all', () => {
  const noNames = screen({ leaders: undefined, speech: undefined });
  assert.deepEqual(noNames.s.settings.players.map((p) => p.leader), [null, null], 'no campaign: no nation is known, so no leader goes with a colour');
  const doc = new FakeDoc(); const started = [];
  const s = new SkirmishScreen(doc, { registry: bare, maps, selectedId: 'classic', onStart: (m, st) => started.push(st), onBack() {} });
  assert.equal(s.root.find((e) => e.className === 'sk-leaders').length, 0);
  assert.deepEqual(s.settings.players.map((p) => p.leader), [null, null]);
  s.go.click();
  assert.equal(started.length, 1);
});

// ---- the launcher with the campaign ------------------------------------------------------------------------------------------------------------
test('launcher: Skirmish offers the colour\'s leaders, and Start plays a map where the teams have their leaders and armies', async () => {
  const doc = new FakeDoc();
  doc.body.classList.add('loading'); doc.withId('boot');
  const played = [];
  const game = { registry, campaign, maps, map: classic, defaultMapId: 'classic', play: (m) => played.push(m) };
  const title = await launch({ doc, base: '', tag: 't', hash: 't', getVersion: async () => ({ hash: 't' }), goTo() {}, reload() {}, loadCss: async () => {}, loadGame: async () => game, random: () => 0 });
  title.skirmish.click();
  const open = doc.body.children.find((c) => c.className === 'sk');
  assert.ok(open.find((e) => e.className === 'sk-leader-name' && e.textContent === 'Ada').length > 0, 'names come from the campaign');
  assert.ok(open.find((e) => e.className === 'sk-leader-quote').length > 0, 'and so does the line they say');
  open.find((e) => e.className === 'btn-label' && e.textContent === 'Start battle')[0].parent.click();
  const m = played[0];
  assert.deepEqual(m.players.map((p) => p.leader), ['ada', 'vex']);
  assert.equal(m.units.filter((u) => u.owner === 0).length, armyOf(played[0], 0, 'ada').length);
  assert.ok(Object.isFrozen(m));
});

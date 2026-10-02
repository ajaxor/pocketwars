// The campaign data (five nations, six leaders, the intro script), its validation, the cutscene timeline, the intro and world-map
// screens and the title/launcher wiring for the Campaign button.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { FakeDoc } from '../helpers/fake-dom.js';
import { loadRegistry } from '../../src/data/loader.js';
import { campaignProblems, loadCampaign, parseCampaign } from '../../src/data/campaign.js';
import { assimilation, buildTimeline, nextLineTime, speech, stateAt } from '../../src/campaign/cutscene.js';
import { inPolygon, nationAt } from '../../src/render/campaign-art.js';
import { IntroScreen } from '../../src/ui/intro-screen.js';
import { WorldMapScreen } from '../../src/ui/world-map-screen.js';
import { TitleScreen } from '../../src/ui/title-screen.js';
import { launch } from '../../src/launcher.js';

const registry = await loadRegistry(readData);
const campaign = await loadCampaign(readData, registry);
const colors = (id) => (id === 'chorus' ? campaign.chorus : registry.factions[id]);
const win = { innerWidth: 390, innerHeight: 700, devicePixelRatio: 1 };
const raw = async () => structuredClone(JSON.parse(JSON.stringify(await readData('campaign.json'))));

// ---- data ---------------------------------------------------------------------------------------------------------------------------
test('the shipped campaign has five nations: one free home nation and four to liberate', () => {
  assert.equal(campaign.nations.length, 5);
  assert.deepEqual(campaign.nations.filter((n) => n.home).map((n) => n.id), ['south']);
  assert.equal(new Set(campaign.nations.map((n) => n.faction)).size, 5, 'each nation is its own colour');
  assert.equal(registry.factionIds.length >= 5, true);
  for (const n of campaign.nations) assert.equal(n.leaderData.faction, n.faction);
});

test('validation catches unknown leaders, factions, nations and bad scenes', async () => {
  const bad = await raw();
  bad.nations[0].leader = 'nobody'; bad.nations[1].faction = 'nope'; bad.nations[2].home = true;
  bad.intro.scenes[2].lines[0].who = 'ada'; bad.intro.scenes[3].order = ['atlantis']; bad.intro.scenes[0].duration = 0;
  const p = campaignProblems(bad, registry).join('\n');
  for (const re of [/unknown leader "nobody"/, /unknown faction "nope"/, /exactly one nation must be the home/, /speaker who is on screen/, /unknown nation "atlantis"/, /positive duration/]) assert.match(p, re);
  assert.throws(() => parseCampaign(bad, registry), /Invalid game data/);
});

// ---- timeline -----------------------------------------------------------------------------------------------------------------------
const tl = buildTimeline(campaign.intro.scenes);

test('the timeline walks the scenes in order and ends on the title card', () => {
  assert.equal(tl.total, campaign.intro.scenes.reduce((a, s) => a + s.duration, 0));
  assert.deepEqual(campaign.intro.scenes.map((s) => stateAt(tl, tl.starts[campaign.intro.scenes.indexOf(s)] + 0.01).scene.id), campaign.intro.scenes.map((s) => s.id));
  assert.equal(stateAt(tl, -5).index, 0);
  const end = stateAt(tl, 9999); assert.equal(end.done, true); assert.equal(end.scene.kind, 'title');
});

test('lines type out, then the next line follows, and the last line fills the scene', () => {
  const sc = campaign.intro.scenes.find((s) => s.id === 'envoy');
  assert.equal(speech(sc, 0).shown, 0);
  assert.equal(speech(sc, 0).lineIndex, 0);
  const mid = speech(sc, 0.5); assert.ok(mid.shown > 0 && mid.typing);
  assert.equal(speech(sc, sc.duration - 0.01).lineIndex, 1);
  assert.equal(speech(sc, sc.duration).typing, false);
  const at = tl.starts[campaign.intro.scenes.indexOf(sc)];
  const next = nextLineTime(tl, at + 0.5);
  assert.ok(next > at && stateAt(tl, next + 0.01).lineIndex === 1);
  assert.equal(nextLineTime(tl, at + sc.duration - 0.1), null, 'nothing after the last line');
});

test('nations fall in the scripted order and stay fallen; the home nation never does', () => {
  const idx = (id) => campaign.intro.scenes.findIndex((s) => s.id === id);
  const free = assimilation(tl, idx('peace'), 1, campaign.nations);
  assert.ok(Object.values(free).every((v) => v === 0));
  const fall = campaign.intro.scenes[idx('fall')];
  const mid = assimilation(tl, idx('fall'), fall.duration * 0.3, campaign.nations);
  assert.ok(mid.north > 0 && mid.west === 0, 'the first in the order starts first');
  const after = assimilation(tl, idx('holdout'), 1, campaign.nations);
  assert.deepEqual(Object.entries(after).filter(([, v]) => v === 1).map(([k]) => k).sort(), ['centre', 'east', 'north', 'west']);
  assert.equal(after.south, 0);
});

test('a tap finds the nation under it, and nothing in the sea', () => {
  const south = campaign.nations.find((n) => n.id === 'south');
  assert.equal(nationAt(campaign.nations, south.capital).id, 'south');
  for (const n of campaign.nations) assert.equal(nationAt(campaign.nations, n.capital).id, n.id, `${n.id}'s capital is inside its own land`);
  assert.equal(nationAt(campaign.nations, [1, 1]), null);
  assert.equal(inPolygon([2, 8], [[0, 0], [10, 0], [10, 10]]), false);
});

// ---- screens ------------------------------------------------------------------------------------------------------------------------
test('the intro runs to the end and calls onDone once; Skip, Escape and the end all go through the same door', () => {
  const doc = new FakeDoc(); let done = 0;
  const s = new IntroScreen(doc, { campaign, colors, onDone: () => done++, raf: () => 1, caf() {}, win });
  doc.body.append(s.root); s.start();
  s.advance(5); assert.equal(done, 0);
  s.advance(tl.total); assert.equal(done, 1);
  s.skip(); s.advance(1); assert.equal(done, 1, 'only once');

  const d2 = new FakeDoc(); let n = 0;
  const a = new IntroScreen(d2, { campaign, colors, onDone: () => n++, raf: () => 1, caf() {}, win });
  a.skipBtn.click(); assert.equal(n, 1);
  const b = new IntroScreen(d2, { campaign, colors, onDone: () => n++, raf: () => 1, caf() {}, win });
  d2.listeners.keydown[1]({ key: 'a' }); assert.equal(n, 1, 'other keys do nothing');
  d2.listeners.keydown[1]({ key: 'Escape' }); assert.equal(n, 2);
  void b;
});

test('tapping the intro during a conversation jumps to the next line', () => {
  const s = new IntroScreen(new FakeDoc(), { campaign, colors, raf: () => 1, caf() {}, win });
  s.time = tl.starts[campaign.intro.scenes.findIndex((x) => x.id === 'envoy')] + 0.5;
  s.tap(); assert.equal(stateAt(tl, s.time).lineIndex, 1);
  const before = s.time; s.tap(); assert.equal(s.time, before, 'last line: tapping does nothing');
});

test('the world map shows five nations, your homeland first, and the mission button is a disabled placeholder', () => {
  const doc = new FakeDoc(); const log = [];
  const m = new WorldMapScreen(doc, { campaign, colors, onBack: () => log.push('back'), onReplay: () => log.push('replay'), raf: () => 1, caf() {}, win });
  assert.equal(m.selected, 'south');
  assert.match(m.status.textContent, /Free/);
  assert.equal(m.mission.disabled, true);
  m.select('north');
  assert.equal(m.name.textContent, 'Violet Reach');
  assert.match(m.status.textContent, /Assimilated/);
  assert.match(m.theme.textContent, /Defeat them to free them/);
  m.select('atlantis'); assert.equal(m.selected, 'north', 'an unknown nation is ignored');
  m.back.click(); m.replay.click(); assert.deepEqual(log, ['back', 'replay']);
  assert.deepEqual(Object.values(m.assim).sort(), [0, 1, 1, 1, 1]);
});

// ---- title and launcher -------------------------------------------------------------------------------------------------------------
test('the title screen has a Campaign button that starts disabled and fails closed', () => {
  const doc = new FakeDoc(); const t = new TitleScreen(doc); let hit = 0; t.onCampaign = () => hit++;
  assert.equal(t.campaign.disabled, true);
  t.setCampaign(true); assert.equal(t.campaign.disabled, false);
  t.campaign.click(); assert.equal(hit, 1);
  t.setFailed('x'); assert.equal(t.campaign.disabled, true);
});

test('Campaign plays the intro, then the world map; Back returns to the title; Replay plays it again', async () => {
  const doc = new FakeDoc(); doc.body.classList.add('loading'); doc.withId('boot');
  const game = { registry, campaign, maps: [], play() {} };
  const title = await launch({
    doc, base: './', tag: 't', getVersion: async () => null, goTo() {}, loadCss: async () => {}, loadGame: async () => game, raf: () => 1, caf() {},
  });
  assert.equal(title.campaign.disabled, false);
  const kinds = () => doc.body.children.map((c) => c.className);
  const el = (cls) => doc.body.children.find((c) => c.className === cls);
  const press = (cls, sel) => el(cls).find((e) => e.className.includes(sel))[0].click();
  title.campaign.click();
  assert.ok(kinds().includes('cine'), 'the intro is on top of the title screen');
  press('cine', 'cine-skip');
  assert.ok(!kinds().includes('cine') && kinds().includes('wm'), 'skipping goes to the world map');
  press('wm', 'wm-replay');
  assert.ok(kinds().includes('cine') && !kinds().includes('wm'), 'replay');
  press('cine', 'cine-skip');
  el('wm').find((e) => e.tag === 'button' && e.children.some((c) => c.textContent === 'Back'))[0].click();
  assert.deepEqual(kinds().filter((c) => c === 'wm' || c === 'cine'), [], 'Back leaves the campaign');
  assert.ok(kinds().includes('title'));
  title.campaign.click(); assert.ok(kinds().includes('cine'), 'and it can be opened again');
});

test('without campaign data the Campaign button stays off', async () => {
  const doc = new FakeDoc(); doc.withId('boot');
  const title = await launch({ doc, base: './', tag: 't', getVersion: async () => null, goTo() {}, loadCss: async () => {}, loadGame: async () => ({ registry, campaign: null, maps: [], play() {} }) });
  assert.equal(title.campaign.disabled, true);
});

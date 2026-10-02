// The campaign data (data/campaign.json): the Chorus' colours, the five leaders, the five nations on the continent map and the
// script of the intro cutscene. Pure functions (no DOM, no fs), so tests, tools and the browser all use them.
//
//   campaignProblems(raw, registry)   a list of human-readable problems (empty = valid)
//   parseCampaign(raw, registry)      the same data, or throws DataError; nations gain `leaderData`
//   loadCampaign(readJson, registry)  read data/campaign.json and every leader's speech file, and parse them

import { DataError } from './validate.js';
import { speechProblems } from '../campaign/speech.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.length > 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isColor = (v) => typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v);

export const SCENE_KINDS = ['map', 'arrival', 'talk', 'gift', 'fall', 'title'];

export function campaignProblems(raw, registry) {
  const p = [];
  if (!isObj(raw)) return ['campaign.json must be an object'];
  if (!isObj(raw.chorus) || !isStr(raw.chorus.name) || !isColor(raw.chorus.color) || !isColor(raw.chorus.dark)) p.push('campaign: chorus needs name, color and dark');

  const leaders = new Map();
  if (!Array.isArray(raw.leaders) || !raw.leaders.length) p.push('campaign: leaders must be a non-empty array');
  else for (const L of raw.leaders) {
    if (!isObj(L) || !isStr(L.id)) { p.push('campaign: every leader needs an id'); continue; }
    if (leaders.has(L.id)) p.push(`campaign: duplicate leader "${L.id}"`);
    leaders.set(L.id, L);
    if (!isStr(L.name)) p.push(`campaign: leader "${L.id}" needs a name`);
    if (!isStr(L.bio)) p.push(`campaign: leader "${L.id}" needs a bio (their personality)`);
    if (L.faction !== 'chorus' && !registry.factions[L.faction]) p.push(`campaign: leader "${L.id}" has unknown faction "${L.faction}"`);
    // everyone who can be fielded needs a loadout (data/loadouts.json); the Chorus' own leader is not one of them
    if (L.faction !== 'chorus' && !registry.leaderIds.includes(L.id)) p.push(`campaign: leader "${L.id}" has no loadout in loadouts.json`);
  }
  for (const id of registry.leaderIds) if (!leaders.has(id)) p.push(`campaign: loadouts.json has a loadout for "${id}", who is not a leader`);

  const nations = new Set();
  if (!Array.isArray(raw.nations) || raw.nations.length < 2) p.push('campaign: nations must list at least two');
  else {
    let homes = 0;
    for (const n of raw.nations) {
      if (!isObj(n) || !isStr(n.id)) { p.push('campaign: every nation needs an id'); continue; }
      if (nations.has(n.id)) p.push(`campaign: duplicate nation "${n.id}"`);
      nations.add(n.id);
      if (!isStr(n.name)) p.push(`campaign: nation "${n.id}" needs a name`);
      if (!leaders.has(n.leader)) p.push(`campaign: nation "${n.id}" has unknown leader "${n.leader}"`);
      else if (leaders.get(n.leader).faction !== n.faction) p.push(`campaign: nation "${n.id}" faction differs from its leader's`);
      if (!registry.factions[n.faction]) p.push(`campaign: nation "${n.id}" has unknown faction "${n.faction}"`);
      if (!Array.isArray(n.capital) || n.capital.length !== 2 || !n.capital.every(isNum)) p.push(`campaign: nation "${n.id}" needs a capital [x, y]`);
      if (!Array.isArray(n.outline) || n.outline.length < 3 || !n.outline.every((q) => Array.isArray(q) && q.length === 2 && q.every(isNum))) p.push(`campaign: nation "${n.id}" needs an outline of at least three [x, y] points`);
      if (n.home) homes++;
    }
    if (homes !== 1) p.push('campaign: exactly one place must be the home (the player hideout)');
    if (raw.home && !raw.nations.some((n) => n.faction === raw.home && n.home)) p.push('campaign: home must be the faction of the home nation');
  }

  if (raw.islands !== undefined && (!Array.isArray(raw.islands) || !raw.islands.every((o) => Array.isArray(o) && o.length >= 3 && o.every((q) => Array.isArray(q) && q.length === 2 && q.every(isNum))))) p.push('campaign: islands must be a list of polygons');

  const scenes = raw.intro && raw.intro.scenes;
  if (!Array.isArray(scenes) || !scenes.length) p.push('campaign: intro.scenes must be a non-empty array');
  else for (const s of scenes) {
    const at = `campaign: intro scene "${s && s.id}"`;
    if (!isObj(s) || !SCENE_KINDS.includes(s.kind)) { p.push(`${at} has an unknown kind`); continue; }
    if (!isNum(s.duration) || s.duration <= 0) p.push(`${at} needs a positive duration`);
    if (s.kind === 'talk') {
      for (const side of ['left', 'right']) if (s[side] && !leaders.has(s[side])) p.push(`${at}: unknown ${side} leader "${s[side]}"`);
      if (!Array.isArray(s.lines) || !s.lines.length) p.push(`${at} needs lines`);
      else for (const l of s.lines) if (![s.left, s.right].includes(l.who) || !isStr(l.text)) p.push(`${at}: every line needs text and a speaker who is on screen`);
    }
    if (s.focus !== undefined && !nations.has(s.focus)) p.push(`${at}: unknown focus nation "${s.focus}"`);
    if (s.kind === 'fall' || s.kind === 'gift') for (const id of s.order || []) if (!nations.has(id)) p.push(`${at}: unknown nation "${id}" in order`);
  }
  return p;
}

export function parseCampaign(raw, registry) {
  const problems = campaignProblems(raw, registry);
  if (problems.length) throw new DataError(problems);
  const leaders = Object.fromEntries(raw.leaders.map((l) => [l.id, l]));
  return { ...raw, leaderById: leaders, nations: raw.nations.map((n) => ({ ...n, leaderData: leaders[n.leader] })) };
}

/** Read data/campaign.json and one speech file per leader (data/speech/<id>.json); the result carries `speech` keyed by leader id. */
export async function loadCampaign(readJson, registry) {
  const campaign = parseCampaign(await readJson('campaign.json'), registry);
  const entries = await Promise.all(campaign.leaders.map(async (l) => [l.id, await readJson(`speech/${l.id}.json`)]));
  const problems = entries.flatMap(([id, s]) => speechProblems(s, id));
  if (problems.length) throw new DataError(problems);
  return { ...campaign, speech: Object.fromEntries(entries) };
}

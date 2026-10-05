// Self-tuning for the strategist: a (1+λ) evolution strategy over its profile, scored by playing games.
//
// The search space is built from the data every time, so it follows the game as it changes:
//   params.<name>          every number in src/ai/strategist/params.js, within its min..max
//   unitBias.<unit>        a bias for every buildable unit type (-1.5..1.5, 0 = none): a new unit joins the search automatically
//   strategyWeight.<id>    how often each strategy in data/ai-strategies.json is chosen (0.2..4, searched on a log scale)
//
// Each round, λ variants of the champion (a few dimensions nudged at random) play the champion on the same maps with the same seeds,
// both seat orders. The best variant, if it scores well enough, plays a second, fresh batch to confirm; if it holds up it becomes the
// champion. The step size grows after a success and shrinks after a failure. At the end the champion must beat the starting profile
// over every map (the gate) before anything is written.

import { createHash } from 'node:crypto';
import { PARAMS } from '../../../src/ai/strategist/params.js';
import { duelJobs, scoreDuel } from './arena.mjs';

/** Every dimension the tuner may move, for this data. */
export function searchSpace(registry) {
  const dims = [];
  for (const [k, spec] of Object.entries(PARAMS)) dims.push({ key: `params.${k}`, min: spec.min, max: spec.max, def: spec.def, log: false });
  for (const id of registry.unitIds) {
    const def = registry.unit(id);
    if (def.attributes?.structure || def.attributes?.mine) continue;
    dims.push({ key: `unitBias.${id}`, min: -1.5, max: 1.5, def: 0, log: false });
  }
  for (const s of registry.aiStrategies) dims.push({ key: `strategyWeight.${s.id}`, min: 0.2, max: 4, def: 1, log: true });
  return dims;
}

export function getValue(profile, dim) {
  const [group, name] = dim.key.split('.');
  return profile?.[group]?.[name] ?? dim.def;
}

export function setValue(profile, dim, value) {
  const [group, name] = dim.key.split('.');
  profile[group] ??= {};
  profile[group][name] = value;
}

/** A copy of the profile with every value in the search space written out (defaults filled in), plus anything else it had. */
export function fullProfile(profile, dims) {
  const out = structuredClone(profile ?? {});
  for (const d of dims) setValue(out, d, getValue(profile, d));
  return out;
}

/** Strip a profile down to what differs from the defaults, rounded, for writing to data/ai.json. */
export function compactProfile(profile, dims) {
  const out = {};
  for (const d of dims) {
    const v = getValue(profile, d);
    const r = Math.round(v * 1000) / 1000;
    if (d.key.startsWith('params.') || Math.abs(v - d.def) > 1e-3) setValue(out, d, r);
  }
  if (profile?.tuned) out.tuned = profile.tuned;
  return out;
}

const gauss = (rng) => {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/** A variant of `profile` with a few dimensions nudged by about `sigma` of their range. Returns { profile, changed: [keys] }. */
export function mutate(profile, dims, rng, sigma) {
  const next = structuredClone(profile);
  const count = 1 + Math.floor(-Math.log(1 - rng()) * 2.5);   // usually 1-4 dimensions at a time
  const changed = [];
  for (let i = 0; i < count; i++) {
    const d = dims[Math.floor(rng() * dims.length)];
    const v = getValue(next, d);
    let nv = d.log ? v * Math.exp(gauss(rng) * sigma * Math.log(d.max / d.min)) : v + gauss(rng) * sigma * (d.max - d.min);
    nv = Math.min(d.max, Math.max(d.min, nv));
    setValue(next, d, nv);
    changed.push(`${d.key} ${round(v)}→${round(nv)}`);
  }
  return { profile: next, changed };
}

const round = (v) => Math.round(v * 100) / 100;

/** A hash of what the tuning depends on: units, weapons, loadouts, rules, strategies, maps and the strategist's code. Tuning older than it is stale. */
export function dataHash(raw) {
  const h = createHash('sha256');
  for (const k of ['units', 'weapons', 'loadouts', 'rules', 'terrain', 'ai-strategies', 'maps', 'code']) h.update(JSON.stringify(raw[k] ?? null));
  return h.digest('hex').slice(0, 16);
}

/** Play contender a against b on `maps` with `seeds` seeds from `seedBase`; returns the duel summary (score for a). */
const errors = [];   // engine errors seen since the last round was logged

export async function duel(pool, a, b, { maps, seeds, seedBase, maxDays }) {
  const results = await pool.run(duelJobs(a, b, { maps, seeds, seedBase, maxDays }));
  for (const r of results) if (r.error) errors.push(`${r.map} seed ${r.seed}: ${r.job.labels[r.error.seat]}: ${r.error.message}`);
  return scoreDuel(results, a, b);
}

/**
 * The tuning loop. Returns the champion profile and a history of the rounds.
 *   start      the profile to start from (data/ai.json engines.strategist)
 *   budget     { minutes?, rounds? }
 *   lambda     variants per round; maps: { id, slots } list; batchMaps: maps per batch (sampled each round)
 *   onChampion called with each new champion (the CLI saves it, so an interrupted run can be resumed with --from)
 */
export async function tune({ pool, registry, start, maps, budget, lambda = 4, batchMaps = 6, screenMaps = 3, seedsPerMap = 1, maxDays = 20,
  accept = 0.15, confirm = 0.56, sigma = 0.15, rng, log = () => {}, onChampion = () => {} }) {
  const dims = searchSpace(registry);
  let champion = fullProfile(start, dims);
  const t0 = Date.now();
  const history = [];
  let seedBase = 1000 + Math.floor(rng() * 1e6);
  for (let round = 1; ; round++) {
    if (budget.rounds && round > budget.rounds) break;
    if (budget.minutes && (Date.now() - t0) / 60000 >= budget.minutes) break;
    // Screen every variant on a few maps (cheap, noisy), then spend the real games only on the best one, on a fresh batch of maps:
    // a variant that merely got lucky in the screen has to repeat it, so luck is not rewarded.
    const pick = (n) => [...maps].sort(() => rng() - 0.5).slice(0, n);
    const screen = pick(screenMaps);
    const variants = Array.from({ length: lambda }, () => mutate(champion, dims, rng, sigma));
    const champ = { label: 'champion', engine: 'strategist', profile: champion };
    // all the variants at once, so that many cores stay busy even though each screen is only a handful of games
    const screens = await Promise.all(variants.map((v, i) => duel(pool, { label: `v${i}`, engine: 'strategist', profile: v.profile }, champ, { maps: screen, seeds: seedsPerMap, seedBase, maxDays })));
    let best = null;
    for (const [i, s] of screens.entries()) if (!best || s.score > best.s.score) best = { v: variants[i], s };
    seedBase += 100;
    let accepted = false;
    let confirmScore = null;
    if (best.s.score >= 0.5 + accept) {
      const c = await duel(pool, { label: 'best', engine: 'strategist', profile: best.v.profile }, champ, { maps: pick(batchMaps), seeds: seedsPerMap, seedBase, maxDays });
      seedBase += 100;
      confirmScore = c.score;
      if (c.score >= confirm) { champion = best.v.profile; accepted = true; onChampion(champion); }
    }
    // the step grows after a success and shrinks after a failure, but not below what a batch of games can tell apart from noise
    sigma = Math.min(0.4, Math.max(0.08, sigma * (accepted ? 1.25 : 0.96)));
    const entry = { round, minutes: (Date.now() - t0) / 60000, best: best.s.score, confirm: confirmScore, accepted, sigma, changed: best.v.changed, errors: errors.splice(0) };
    history.push(entry);
    log(entry);
  }
  return { champion, history, dims };
}

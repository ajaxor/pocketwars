// Graded scoring for tuning: games are played to a time limit and scored on the material lead held when it runs out, not just win/lose.
//
// Three windows, cheap to dear: a SHORT game (a few days: openings, economy, early fights), a MEDIUM one, and a LONG one that is long
// enough to be finished. More short games are played than long ones, but the long game is what shows that a profile can actually win.
//
//   points for one game (the contender's, 0..1 around an even 0.5):
//     unfinished at the limit   0.5 + (share - 0.5) x LEAD_GAIN, clamped: the share of the two armies' worth (src/ai/evaluate.js).
//                               A 75% share counts as a full win, an even position as a draw
//     finished                  a win is 1 plus an early bonus of up to EARLY_BONUS (the sooner the better); a loss is 0 minus the
//                               same, so a contender that loses fast is worse than one that loses slowly
//   score = the weighted mean of the windows' mean points (WINDOWS[w].weight). Short games are cheap, so there are more of them, but they
//   carry the least weight: a short window pays for early captures, and must not teach the AI to spam infantry at the cost of the mid game.
//   late = the same over the medium and long windows only. Callers use it as a veto: a profile that is not at least even in the games
//   where the mid game decides (late < LATE_FLOOR) is not accepted, however well it opens
//
//   makeSample(plan, maps, rng, seedBase)   what to play: plan = { short: n, medium: n, long: n } game slots (a map and a seed each);
//                                           every contender in a comparison plays the same sample, so they are compared like for like
//   gradedDuel(pool, a, b, sample, opts)    plays a against b (both seat orders) and returns { score, ci, windows, games, errors }

import { duelJobs } from './arena.mjs';

export const WINDOWS = {
  short: { days: 8, weight: 0.15 },
  medium: { days: 14, weight: 0.4 },
  long: { days: 30, weight: 0.45 },
};
export const EARLY_BONUS = 0.25;
export const LEAD_GAIN = 2;
export const LATE_FLOOR = 0.5;

export function parseWindows(spec, base = WINDOWS) {
  if (!spec) return base;
  const days = String(spec).split(',').map(Number);
  if (days.length !== 3 || days.some((d) => !(d > 0))) throw new Error('--windows takes three day counts, short,medium,long (e.g. 8,14,30)');
  return Object.fromEntries(Object.keys(base).map((k, i) => [k, { ...base[k], days: days[i] }]));
}

export function parsePlan(spec, fallback) {
  if (!spec) return fallback;
  const n = String(spec).split(',').map(Number);
  if (n.length !== 3 || n.some((x) => !(x >= 0))) throw new Error('a plan is three game counts, short,medium,long (e.g. 4,2,1)');
  return { short: n[0], medium: n[1], long: n[2] };
}

export const scalePlan = (plan, k) => Object.fromEntries(Object.entries(plan).map(([w, n]) => [w, Math.round(n * k)]));

/** `plan[w]` slots for each window: maps taken round the shuffled pool ('all' = every map once), each repeat with a new seed. */
export function makeSample(plan, maps, rng, seedBase) {
  const sample = [];
  let offset = 0;
  for (const w of Object.keys(plan)) {
    const order = [...maps].sort(() => rng() - 0.5);
    const n = plan[w] === 'all' ? maps.length : plan[w];
    for (let i = 0; i < n; i++) sample.push({ window: w, map: order[i % order.length], seed: seedBase + offset + Math.floor(i / order.length) });
    offset += 50;
  }
  return sample;
}

export function pointsFor(result, label, limit) {
  const seat = result.job.labels.indexOf(label);
  if (result.winner != null && !result.adjudicated) {
    const bonus = EARLY_BONUS * (1 - Math.min(1, result.days / limit));
    return result.winner === seat ? 1 + bonus : -bonus;
  }
  if (!result.adjudicated && result.winner == null && result.shares[seat] == null) return 0.5;   // a drawn finish
  const share = result.shares[seat] ?? 0;
  return Math.min(1, Math.max(0, 0.5 + (share - 0.5) * LEAD_GAIN));
}

export async function gradedDuel(pool, a, b, sample, { windows = WINDOWS } = {}) {
  const jobs = [];
  for (const s of sample) {
    for (const j of duelJobs(a, b, { maps: [s.map], seeds: 1, seedBase: s.seed, maxDays: windows[s.window].days })) jobs.push({ ...j, window: s.window });
  }
  const results = await pool.run(jobs);
  const by = {};
  const errors = [];
  for (const r of results) {
    if (r.error) errors.push(`${r.map} seed ${r.seed}: ${r.job.labels[r.error.seat]}: ${r.error.message}`);
    (by[r.job.window] ??= []).push(pointsFor(r, a.label, windows[r.job.window].days));
  }
  let num = 0;
  let den = 0;
  let lateNum = 0;
  let lateDen = 0;
  let varSum = 0;
  const out = {};
  for (const [w, pts] of Object.entries(by)) {
    const n = pts.length;
    const mean = pts.reduce((x, y) => x + y, 0) / n;
    const variance = pts.reduce((x, y) => x + (y - mean) ** 2, 0) / Math.max(1, n - 1);
    const weight = windows[w].weight;
    num += weight * mean;
    den += weight;
    if (w !== 'short') { lateNum += weight * mean; lateDen += weight; }
    varSum += (weight ** 2) * variance / n;
    out[w] = { games: n, score: mean };
  }
  return { a: a.label, b: b.label, score: den ? num / den : 0.5, late: lateDen ? lateNum / lateDen : 0.5, ci: den ? 1.96 * Math.sqrt(varSum) / den : 0, windows: out, games: results.length, errors };
}

export const formatGraded = (g) => `${(g.score * 100).toFixed(0)}% ±${(g.ci * 100).toFixed(0)}, mid+late ${(g.late * 100).toFixed(0)}% (${Object.entries(g.windows).map(([w, x]) => `${w} ${(x.score * 100).toFixed(0)}% of ${x.games}`).join(', ')})`;

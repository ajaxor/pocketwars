#!/usr/bin/env node
// Tunes ONE number: coarse first (a spread of values across its whole range), then narrower and narrower around the best, each pass on a
// bigger sample of games. Prints the response curve (value -> score against the current profile) so you can see how much it matters.
//
//   npm run ai:sweep -- --param params.attack [--write]
//   npm run ai:sweep -- --param unitBias.tank
//   npm run ai:sweep -- --list                 every dimension that can be swept
//   options: --points 7        values in the coarse pass (spread over the whole range; log scale for strategy weights)
//            --passes 3        coarse pass + this many minus one narrowing passes
//            --inner 3         new values tried inside the bracket in each narrowing pass
//            --plan 6,3,1      games (short,medium,long) per value in the coarse pass; each narrowing pass has half as many again
//            --final 12,6,3    the last check of the winner against the profile it started from (default: 2x the last pass)
//            --gate 0.52       the winner must score this much in the last check to be kept
//            --maps 2p|all|id,id   --windows 8,14,30   --from file   --write   --workers N --seed N
//
// Every value in a pass plays the same games (same maps, seeds, seats, leaders) against the profile as it stands, so scores within a pass
// compare like for like; the best value of a pass is carried into the next pass with its bracket so that passes share a yardstick.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readData } from '../../tests/helpers/node-io.js';
import { loadMapIndex, loadRegistry } from '../../src/data/loader.js';
import { createPool } from './lib/pool.mjs';
import { mapList } from './lib/arena.mjs';
import { seeded } from './lib/match.mjs';
import { compactProfile, fullProfile, getValue, searchSpace, setValue } from './lib/tune.mjs';
import { LATE_FLOOR, formatGraded, gradedDuel, makeSample, parsePlan, parseWindows, scalePlan } from './lib/graded.mjs';
import { parseArgs } from './arena.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const AI_JSON = `${ROOT}data/ai.json`;
const fmt = (v) => String(Math.round(v * 1000) / 1000);

/** n values spread evenly over the dimension's range (geometrically for a log dimension), ends included. */
export function spread(dim, n, lo = dim.min, hi = dim.max) {
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    return dim.log ? lo * (hi / lo) ** t : lo + (hi - lo) * t;
  });
}

/** n values strictly inside (lo, hi). */
export function inside(dim, n, lo, hi) {
  return spread(dim, n + 2, lo, hi).slice(1, -1);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const registry = await loadRegistry(readData);
  const dims = searchSpace(registry);
  if (opts.list) { for (const d of dims) console.log(`${d.key.padEnd(34)} ${fmt(d.min)} .. ${fmt(d.max)}  (default ${fmt(d.def)})`); return; }
  const dim = dims.find((d) => d.key === opts.param);
  if (!dim) {
    const near = dims.filter((d) => d.key.toLowerCase().includes(String(opts.param ?? '').toLowerCase())).slice(0, 8).map((d) => d.key);
    console.error(`--param ${opts.param ?? '(missing)'} is not something that can be tuned. ${near.length ? `Did you mean: ${near.join(', ')}?` : '--list shows them all.'}`);
    process.exit(1);
  }
  const ai = JSON.parse(readFileSync(AI_JSON, 'utf8'));
  const start = ai.engines.strategist ?? {};
  const base = fullProfile(opts.from ? JSON.parse(readFileSync(opts.from, 'utf8')) : start, dims);
  const baseValue = getValue(base, dim);
  const windows = parseWindows(opts.windows);
  const plan = parsePlan(opts.plan, { short: 6, medium: 3, long: 1 });
  const passes = Number(opts.passes ?? 3);
  const points = Number(opts.points ?? 7);
  const inner = Number(opts.inner ?? 3);
  const maps = await mapList(readData, registry, await loadMapIndex(readData), opts.maps ?? '2p');
  const pool = await createPool(opts.workers ? { workers: Number(opts.workers) } : {});
  const rng = seeded(Number(opts.seed ?? 7));
  const t0 = Date.now();
  const withValue = (v) => { const p = structuredClone(base); setValue(p, dim, v); return p; };
  const baseline = { label: 'current', engine: 'strategist', profile: base };
  console.log(`sweeping ${dim.key} (range ${fmt(dim.min)}..${fmt(dim.max)}, now ${fmt(baseValue)}) on ${maps.length} maps with ${pool.size} workers`);

  const scored = new Map();   // value -> latest { score, ci } (from the pass it was last in)
  const evaluate = async (values, passPlan, seedBase, title) => {
    const sample = makeSample(passPlan, maps, rng, seedBase);
    const rows = await Promise.all(values.map(async (v) => {
      if (Math.abs(v - baseValue) < 1e-9) return { v, score: 0.5, ci: 0, note: 'current value', windows: {} };
      const g = await gradedDuel(pool, { label: 'candidate', engine: 'strategist', profile: withValue(v) }, baseline, sample, { windows });
      for (const e of g.errors) console.log(`  ENGINE ERROR (counted as a loss): ${e}`);
      return { v, score: g.score, ci: g.ci, windows: g.windows };
    }));
    rows.sort((a, b) => a.v - b.v);
    const top = Math.max(...rows.map((r) => r.score));
    console.log(`\n${title}: ${sample.length * 2} games per value (${Object.entries(passPlan).map(([w, n]) => `${n} ${w}`).join(', ')}), ${((Date.now() - t0) / 60000).toFixed(1)} min in`);
    for (const r of rows) {
      scored.set(r.v, r);
      const w = r.windows;
      const split = w.short ? `   short ${(w.short.score * 100).toFixed(0)} med ${(w.medium?.score * 100).toFixed(0)} long ${w.long ? (w.long.score * 100).toFixed(0) : '-'}` : '';
      console.log(`  ${fmt(r.v).padStart(9)}  ${(r.score * 100).toFixed(0).padStart(3)}% ±${(r.ci * 100).toFixed(0).padEnd(2)} ${'█'.repeat(Math.round(r.score * 30))}${r.score === top ? ' ◀' : ''}${r.note ? `  (${r.note})` : split}`);
    }
    return rows;
  };

  // pass 1: the whole range
  let seedBase = 1;
  let values = spread(dim, points);
  if (!values.some((v) => Math.abs(v - baseValue) < 1e-9)) values.push(baseValue);
  let rows = await evaluate(values, plan, seedBase, 'pass 1, whole range');
  let bestRow = rows.reduce((a, b) => (b.score > a.score ? b : a));
  // narrowing passes: bracket the best between its neighbours, try new values inside, keep the best, its bracket and the current value
  for (let pass = 2; pass <= passes; pass++) {
    const vs = rows.map((r) => r.v);
    const i = vs.indexOf(bestRow.v);
    const lo = vs[Math.max(0, i - 1)];
    const hi = vs[Math.min(vs.length - 1, i + 1)];
    if (hi - lo < (dim.max - dim.min) * 1e-3) break;
    const next = [...new Set([lo, bestRow.v, hi, ...inside(dim, inner, lo, hi), baseValue])].sort((a, b) => a - b);
    seedBase += 1000;
    rows = await evaluate(next, scalePlan(plan, 1.5 ** (pass - 1)), seedBase, `pass ${pass}, between ${fmt(lo)} and ${fmt(hi)}`);
    bestRow = rows.reduce((a, b) => (b.score > a.score ? b : a));
  }

  // the check: the winner against the profile it started from, on a fresh and larger sample, a long game included
  let verdict = 'unchanged';
  let kept = baseValue;
  if (Math.abs(bestRow.v - baseValue) > 1e-9) {
    const finalPlan = parsePlan(opts.final, scalePlan(plan, 1.5 ** passes));
    const sample = makeSample(finalPlan, maps, rng, 90000);
    const g = await gradedDuel(pool, { label: 'candidate', engine: 'strategist', profile: withValue(bestRow.v) }, baseline, sample, { windows });
    console.log(`\nfinal check, ${fmt(bestRow.v)} against ${fmt(baseValue)}: ${formatGraded(g)}`);
    if (g.score >= Number(opts.gate ?? 0.52) && g.late >= LATE_FLOOR && g.errors.length === 0) { kept = bestRow.v; verdict = 'better'; }
    else verdict = g.errors.length ? 'errors in the check' : g.late < LATE_FLOOR ? 'worse in the medium and long games' : 'not better in the check';
  }
  await pool.close();
  console.log(`\n${dim.key}: ${verdict === 'better' ? `${fmt(baseValue)} -> ${fmt(kept)}` : `stays ${fmt(baseValue)} (${verdict}; best in the sweep was ${fmt(bestRow.v)})`}  [${((Date.now() - t0) / 60000).toFixed(1)} min]`);
  if (opts.write && verdict === 'better') {
    const out = withValue(kept);
    ai.engines.strategist = compactProfile({ ...out, tuned: start.tuned }, dims);
    writeFileSync(AI_JSON, JSON.stringify(ai, null, 2) + '\n');
    console.log('data/ai.json updated');
  } else if (verdict === 'better') console.log('run with --write to keep it');
}

main().catch((e) => { console.error(e); process.exit(1); });

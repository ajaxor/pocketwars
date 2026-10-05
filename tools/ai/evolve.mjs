#!/usr/bin/env node
// Tunes every number in the strategist's profile at once with an evolution strategy (lib/es.mjs), for as long as you give it. When the
// time is up it stops, checks the best weights it has found against the profile it started from, and prints them.
//
//   npm run ai:evolve -- --minutes 10
//   npm run ai:evolve -- --minutes 120 --resume --write       carry on from the saved state; keep the result if it passes the gate
//
//   --minutes N        how long to run in total, the final check included (default 10)
//   --lambda 16        candidates per generation (mirrored pairs); each plays the current mean on the same games
//   --sigma 0.1        starting step, as a share of every number's range (it adapts)
//   --plan 2,2,0       games (short,medium,long) each candidate plays per generation; every game is both seat orders
//   --check-every 4    every this many generations the mean plays the starting profile (--check 4,3,2): a lasting record of progress
//   --final 4,4,3      the last check of the best few means against the starting profile
//   --windows 8,14,30  day limits; games are scored on material lead at the limit (lib/graded.mjs)
//   --maps 2p|all|id,id   --workers N --seed N --vs-greedy
//   --state file       where progress is saved after every generation (default tools/ai/out/evolve-state.json); --resume loads it
//   --out file         the best profile (default tools/ai/out/evolve-best.json)
//   --write            put it in data/ai.json if it beats the starting profile, mid and late games included (--gate 0.53)

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readData } from '../../tests/helpers/node-io.js';
import { loadMapIndex, loadRegistry } from '../../src/data/loader.js';
import { createPool } from './lib/pool.mjs';
import { mapList } from './lib/arena.mjs';
import { seeded } from './lib/match.mjs';
import { compactProfile, fullProfile, getValue, searchSpace, setValue } from './lib/tune.mjs';
import { LATE_FLOOR, formatGraded, gradedDuel, makeSample, parsePlan, parseWindows } from './lib/graded.mjs';
import * as es from './lib/es.mjs';
import { parseArgs } from './arena.mjs';
import { dataHash } from './lib/tune.mjs';
import { readdirSync } from 'node:fs';
import { trainingMapIds } from './lib/maps.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = `${ROOT}tools/ai/out/`;
const AI_JSON = `${ROOT}data/ai.json`;
const fmt = (v) => String(Math.round(v * 1000) / 1000);
const pct = (x) => `${(x * 100).toFixed(0)}%`;

async function rawData() {
  const raw = { code: readdirSync(`${ROOT}src/ai/strategist`).sort().map((f) => readFileSync(`${ROOT}src/ai/strategist/${f}`, 'utf8')) };
  for (const k of ['units', 'weapons', 'loadouts', 'rules', 'terrain', 'ai-strategies']) raw[k] = await readData(`${k}.json`);
  const index = await loadMapIndex(readData);
  raw.maps = {};
  for (const [id, file] of Object.entries(index.maps)) raw.maps[id] = await readData(`maps/${file}`);
  for (const id of trainingMapIds()) raw.maps[`training:${id}`] = readFileSync(`${ROOT}tools/ai/maps/${id}.map.json`, 'utf8');
  return raw;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const registry = await loadRegistry(readData);
  const dims = searchSpace(registry);
  const ai = JSON.parse(readFileSync(AI_JSON, 'utf8'));
  const start = fullProfile(ai.engines.strategist ?? {}, dims);
  const windows = parseWindows(opts.windows);
  const plan = parsePlan(opts.plan, { short: 2, medium: 2, long: 0 });
  const checkPlan = parsePlan(opts.check, { short: 4, medium: 3, long: 2 });
  const finalPlan = parsePlan(opts.final, { short: 4, medium: 4, long: 3 });
  const checkEvery = Number(opts['check-every'] ?? 4);
  const limitMs = Number(opts.minutes ?? 10) * 60000;
  const reserveMs = Math.min(120000, Math.max(30000, limitMs * 0.08));
  const maps = await mapList(readData, registry, await loadMapIndex(readData), opts.maps ?? '2p');
  const pool = await createPool(opts.workers ? { workers: Number(opts.workers) } : {});
  const rng = seeded(Number(opts.seed ?? Date.now()));
  mkdirSync(OUT, { recursive: true });
  const stateFile = opts.state ?? `${OUT}evolve-state.json`;
  const outFile = opts.out ?? `${OUT}evolve-best.json`;
  const logFile = `${OUT}evolve-log.jsonl`;
  const hash = dataHash(await rawData());

  const decode = (x) => { const p = structuredClone(start); dims.forEach((d, i) => setValue(p, d, es.fromUnit(d, x[i]))); return p; };
  const contender = (label, x) => ({ label, engine: 'strategist', profile: decode(x) });
  const startContender = { label: 'start', engine: 'strategist', profile: start };

  let state;
  let checkpoints = [];
  if (opts.resume && existsSync(stateFile)) {
    const saved = JSON.parse(readFileSync(stateFile, 'utf8'));
    if (saved.dims?.join() !== dims.map((d) => d.key).join()) throw new Error('the saved state is for a different search space (units, strategies or parameters changed); start without --resume');
    ({ state, checkpoints } = saved);
    console.log(`resuming from generation ${state.generation}`);
  } else {
    state = es.init(dims.map((d, i) => es.toUnit(d, getValue(start, d))), { lambda: Number(opts.lambda ?? 16), sigma: Number(opts.sigma ?? 0.1) });
  }
  const startUnits = dims.map((d) => es.toUnit(d, getValue(start, d)));
  const save = () => writeFileSync(stateFile, JSON.stringify({ dims: dims.map((d) => d.key), state, checkpoints, data: hash }));

  console.log(`evolving ${dims.length} numbers at once on ${maps.length} maps with ${pool.size} workers: ${state.lambda} candidates a generation, ${opts.minutes ?? 10} minutes`);
  const t0 = Date.now();
  let seedBase = 5000 + Math.floor(rng() * 1e6);
  let genMs = 0;
  const errors = [];
  const play = async (a, b, sample) => { const g = await gradedDuel(pool, a, b, sample, { windows }); errors.push(...g.errors); return g; };

  while (Date.now() - t0 + genMs + reserveMs < limitMs) {
    const g0 = Date.now();
    const cands = es.ask(state, rng);
    const mean = contender('mean', state.mean);
    const sample = makeSample(plan, maps, rng, seedBase);
    seedBase += 200;
    const results = await Promise.all(cands.map((c, i) => play(contender(`c${i}`, c.x), mean, sample)));
    const scores = results.map((r) => r.score);
    const moved = es.tell(state, cands, scores);
    const sorted = [...scores].sort((a, b) => b - a);
    let checked = '';
    if (state.generation % checkEvery === 0) {
      const c = await play(contender('mean', state.mean), startContender, makeSample(checkPlan, maps, rng, seedBase));
      seedBase += 200;
      checkpoints.push({ generation: state.generation, mean: [...state.mean], score: c.score, late: c.late });
      checked = `  | mean vs start ${formatGraded(c)}`;
    }
    genMs = Date.now() - g0;
    const dist = Math.hypot(...state.mean.map((m, i) => m - startUnits[i]));
    console.log(`gen ${state.generation} (${((Date.now() - t0) / 60000).toFixed(1)} min): candidates ${pct(sorted[0])} best / ${pct(sorted[Math.floor(sorted.length / 2)])} median / ${pct(sorted.at(-1))} worst, σ=${state.sigma.toFixed(3)}, moved ${moved.toFixed(2)}σ, ${dist.toFixed(2)} from start${checked}`);
    for (const e of [...new Set(errors.splice(0))].slice(0, 3)) console.log(`  ENGINE ERROR (counted as a loss): ${e}`);
    appendFileSync(logFile, JSON.stringify({ at: new Date().toISOString(), generation: state.generation, sigma: state.sigma, moved, dist, best: sorted[0], median: sorted[Math.floor(sorted.length / 2)] }) + '\n');
    save();
  }

  // time is up: the best few means (by their own checks) and the final mean play the starting profile once more, on one fresh sample
  console.log(`\ntime is up after ${state.generation} generations; checking the best weights found`);
  const finalists = [...checkpoints].sort((a, b) => b.score - a.score).slice(0, 2).map((c) => ({ label: `gen ${c.generation}`, x: c.mean }));
  if (!finalists.some((f) => f.x === state.mean)) finalists.push({ label: `final mean (gen ${state.generation})`, x: [...state.mean] });
  const sample = makeSample(finalPlan, maps, rng, 777000);
  const scored = [];
  for (const f of finalists) {
    const g = await play(contender(f.label, f.x), startContender, sample);
    scored.push({ ...f, g });
    console.log(`  ${f.label.padEnd(24)} vs start: ${formatGraded(g)}`);
  }
  const best = scored.reduce((a, b) => (b.g.score > a.g.score ? b : a));
  const greedy = opts['vs-greedy'] ? await play(contender('best', best.x), { label: 'greedy', engine: 'greedy', profile: ai.engines.greedy }, sample) : null;
  await pool.close();

  const profile = decode(best.x);
  const tuned = { date: new Date().toISOString().slice(0, 10), data: hash, method: 'evolve', generations: state.generation, vsBefore: Math.round(best.g.score * 100) / 100 };
  writeFileSync(outFile, JSON.stringify(compactProfile({ ...profile, tuned }, dims), null, 2) + '\n');
  const moves = dims.map((d, i) => ({ key: d.key, from: getValue(start, d), to: getValue(profile, d), shift: best.x[i] - startUnits[i] }))
    .filter((m) => Math.abs(m.shift) >= 0.05).sort((a, b) => Math.abs(b.shift) - Math.abs(a.shift));
  console.log(`\nbest weights: ${best.label}, ${formatGraded(best.g)} against the starting profile${greedy ? `; against greedy ${formatGraded(greedy)}` : ''}`);
  console.log(`${moves.length} of ${dims.length} numbers moved by 5% of their range or more; the biggest:`);
  for (const m of moves.slice(0, 25)) console.log(`  ${m.key.padEnd(34)} ${fmt(m.from).padStart(8)} -> ${fmt(m.to).padEnd(8)} (${m.shift > 0 ? '+' : ''}${(m.shift * 100).toFixed(0)}% of range)`);
  console.log(`\nsaved to ${outFile}; the search state is in ${stateFile} (--resume continues it)`);
  const gate = Number(opts.gate ?? 0.53);
  const passes = best.g.score >= gate && best.g.late >= LATE_FLOOR && best.g.errors.length === 0;
  console.log(passes ? 'passes the gate' : `does not pass the gate (needs ${pct(gate)} overall and ${pct(LATE_FLOOR)} in the mid and late games)`);
  if (opts.write && passes) {
    ai.engines.strategist = compactProfile({ ...profile, tuned }, dims);
    writeFileSync(AI_JSON, JSON.stringify(ai, null, 2) + '\n');
    console.log('data/ai.json updated');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

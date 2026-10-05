#!/usr/bin/env node
// The arena: plays AI engines against each other on the shipped maps and reports who wins. Use it to check that a new engine, a new
// strategy or a re-tuned profile is actually better than what it replaces.
//
//   npm run ai:arena -- strategist greedy                      the two engines' profiles from data/ai.json
//   npm run ai:arena -- strategist=candidate.json strategist    a profile from a file against the shipped one
//   options: --maps all|2p|id,id   --seeds 4 (games per map and seat order)   --days 30 (then judged on worth)
//            --workers N (default: one per CPU)   --fog off   --seed-base 1   --json results.json   --quiet
//
// Every map is played with both seat orders for each seed (same leaders per slot), so neither engine gains from moving first.

import { writeFileSync } from 'node:fs';
import { readData } from '../../tests/helpers/node-io.js';
import { loadMapIndex, loadRegistry } from '../../src/data/loader.js';
import { createPool } from './lib/pool.mjs';
import { duelJobs, formatDuel, mapList, parseContender, scoreDuel } from './lib/arena.mjs';
import { DEFAULT_MAX_DAYS } from './lib/match.mjs';

export function parseArgs(argv) {
  const opts = { positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      opts[k] = v ?? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true);
    } else opts.positional.push(a);
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const registry = await loadRegistry(readData);
  const [aSpec = 'strategist', bSpec = 'greedy'] = opts.positional;
  const a = parseContender(aSpec, registry);
  const b = parseContender(bSpec, registry);
  if (a.label === b.label) b.label += '#2';
  const maps = await mapList(readData, registry, await loadMapIndex(readData), opts.maps ?? 'all');
  const jobs = duelJobs(a, b, {
    maps, seeds: Number(opts.seeds ?? 4), seedBase: Number(opts['seed-base'] ?? 1),
    maxDays: Number(opts.days ?? DEFAULT_MAX_DAYS), fog: opts.fog !== 'off',
  });
  const pool = await createPool(opts.workers ? { workers: Number(opts.workers) } : {});
  const t0 = Date.now();
  if (!opts.quiet) console.log(`${jobs.length} games on ${maps.length} maps, ${pool.size} workers`);
  const results = await pool.run(jobs, {
    onResult: (r, done, total) => {
      if (opts.quiet) return;
      const w = r.winner == null ? 'draw' : r.job.labels[r.winner];
      process.stdout.write(`\r${done}/${total}  ${r.map} seed ${r.seed}: ${w}${r.adjudicated ? ' (judged)' : ''}, day ${r.days}, ${r.msPerTurn.toFixed(0)} ms/turn        `);
    },
  });
  await pool.close();
  const summary = scoreDuel(results, a, b);
  console.log(`\n\n${formatDuel(summary)}\n\n${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (opts.json) writeFileSync(opts.json, JSON.stringify({ summary, results }, null, 1));
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });

#!/usr/bin/env node
// Tunes the strategist by playing it against itself (lib/tune.mjs) and, if the result beats the profile it started from, writes it to
// data/ai.json. Run it after adding units, strategies or maps, or after a balance change: the search space is read from the data, so
// new units and strategies are tuned along with everything else.
//
//   npm run ai:tune -- --minutes 60 --write
//   options: --minutes N | --rounds N     how long to search (default 10 minutes)
//            --lambda 4                   variants tried per round
//            --screen 4,1,0               games (short,medium,long) each variant plays against the champion; every game is both seat orders
//            --confirm 4,2,1              the same for the best variant's confirmation (at least one long game: can it finish?)
//            --windows 8,14,30            day limits of the short, medium and long games; scored on material lead at the limit (lib/graded.mjs)
//            --maps 2p|all|id,id          the map pool (default 2p)
//            --gate 0.52 --gate-seeds 2   the final check: every map in all three windows x seeds; the champion must score this against the starting profile
//            --write                      write data/ai.json when the gate is passed (otherwise only the --out file)
//            --out file                   where the champion is saved, after every improvement (default tools/ai/out/strategist-tuned.json)
//            --from file                  start from a saved champion (resume an interrupted run); the gate still compares with data/ai.json
//            --vs-greedy                  also play the champion against greedy at the gate (for the record; slower)
//            --if-stale                   do nothing when data/ai.json was tuned on the current data (for scheduled runs)
//            --check                      only report whether the tuning is stale (exit 2 when it is)
//            --workers N --seed N
//
// Progress goes to the console and to tools/ai/out/tune-log.jsonl.

import { appendFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readData } from '../../tests/helpers/node-io.js';
import { loadMapIndex, loadRegistry } from '../../src/data/loader.js';
import { createPool } from './lib/pool.mjs';
import { mapList } from './lib/arena.mjs';
import { trainingMapIds } from './lib/maps.mjs';
import { seeded } from './lib/match.mjs';
import { compactProfile, dataHash, searchSpace, tune } from './lib/tune.mjs';
import { LATE_FLOOR, formatGraded, gradedDuel, makeSample, parsePlan, parseWindows } from './lib/graded.mjs';
import { parseArgs } from './arena.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = `${ROOT}tools/ai/out/`;
const AI_JSON = `${ROOT}data/ai.json`;

/** Everything the tuning depends on: the game data, the maps, and the strategist's own code. */
async function rawData() {
  const raw = {};
  raw.code = readdirSync(`${ROOT}src/ai/strategist`).sort().map((f) => readFileSync(`${ROOT}src/ai/strategist/${f}`, 'utf8'));
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
  const hash = dataHash(await rawData());
  const ai = JSON.parse(readFileSync(AI_JSON, 'utf8'));
  const start = ai.engines.strategist ?? {};   // the shipped profile: what the result has to beat
  const from = opts.from ? JSON.parse(readFileSync(opts.from, 'utf8')) : start;   // where the search starts
  const stale = start.tuned?.data !== hash;
  if (opts.check) {
    console.log(stale ? `stale: tuned on ${start.tuned?.data ?? 'nothing'}, data is now ${hash}` : `fresh: tuned on the current data (${hash})`);
    process.exit(stale ? 2 : 0);
  }
  if (opts['if-stale'] && !stale) { console.log(`the strategist is already tuned on this data (${hash}); nothing to do`); return; }

  mkdirSync(OUT, { recursive: true });
  const maps = await mapList(readData, registry, await loadMapIndex(readData), opts.maps ?? '2p');
  const pool = await createPool(opts.workers ? { workers: Number(opts.workers) } : {});
  const rng = seeded(Number(opts.seed ?? Date.now()));
  const budget = opts.rounds ? { rounds: Number(opts.rounds) } : { minutes: Number(opts.minutes ?? 10) };
  const windows = parseWindows(opts.windows);
  console.log(`tuning the strategist on ${maps.length} maps with ${pool.size} workers, ${budget.rounds ? `${budget.rounds} rounds` : `${budget.minutes} minutes`}`);
  const logFile = `${OUT}tune-log.jsonl`;
  const outFile = opts.out ?? `${OUT}strategist-tuned.json`;
  const { champion, history, dims } = await tune({
    pool, registry, start: from, maps, budget, rng, windows,
    screenPlan: parsePlan(opts.screen, { short: 4, medium: 1, long: 0 }), confirmPlan: parsePlan(opts.confirm, { short: 4, medium: 2, long: 1 }),
    onChampion: (c) => writeFileSync(outFile, JSON.stringify(compactProfile({ ...c, tuned: { checkpoint: new Date().toISOString(), data: hash } }, searchSpace(registry)), null, 2) + '\n'),
    lambda: Number(opts.lambda ?? 4),
    log: (e) => {
      appendFileSync(logFile, JSON.stringify({ at: new Date().toISOString(), ...e }) + '\n');
      console.log(`round ${e.round} (${e.minutes.toFixed(1)} min): best ${(e.best * 100).toFixed(0)}%${e.confirm != null ? `, confirm ${(e.confirm * 100).toFixed(0)}%` : ''}${e.accepted ? '  ACCEPTED' : ''}  σ=${e.sigma.toFixed(3)}  ${e.changed.join(', ')}`);
      for (const err of e.errors) console.log(`  ENGINE ERROR (counted as a loss): ${err}`);
    },
  });
  const accepted = history.filter((h) => h.accepted).length + (opts.from ? 1 : 0);   // a resumed champion counts as a change to check
  console.log(`\n${history.length} rounds, ${accepted} improvements accepted`);

  // the gate: the champion against the starting profile, and against greedy for the record, over the whole pool
  const gateSeeds = Number(opts['gate-seeds'] ?? 2);
  const champ = { label: 'tuned', engine: 'strategist', profile: champion };
  const sampleRng = seeded(1);
  const gateSample = makeSample({ short: 'all', medium: 'all', long: 'all' }, maps, sampleRng, 1)
    .concat(...Array.from({ length: gateSeeds - 1 }, (_, i) => makeSample({ short: 'all', medium: 'all', long: 'all' }, maps, sampleRng, 1 + 7 * (i + 1))));
  const vsStart = accepted ? await gradedDuel(pool, champ, { label: 'before', engine: 'strategist', profile: start }, gateSample, { windows }) : { score: 0.5, windows: {} };
  const vsGreedy = opts['vs-greedy'] ? await gradedDuel(pool, champ, { label: 'greedy', engine: 'greedy', profile: ai.engines.greedy }, gateSample, { windows }) : null;
  await pool.close();
  console.log(`gate: ${accepted ? formatGraded(vsStart) : 'nothing to check'} against the starting profile; against greedy: ${vsGreedy ? formatGraded(vsGreedy) : 'not played'}`);

  const tuned = { date: new Date().toISOString().slice(0, 10), data: hash, rounds: history.length, accepted, vsBefore: round2(vsStart.score), ...(vsGreedy ? { vsGreedy: round2(vsGreedy.score) } : start.tuned?.vsGreedy != null ? { vsGreedy: start.tuned.vsGreedy } : {}) };
  const passed = accepted && vsStart.score >= Number(opts.gate ?? 0.52) && vsStart.late >= LATE_FLOOR;
  const result = compactProfile({ ...(passed ? champion : start), tuned: passed || !start.tuned ? tuned : { ...start.tuned, data: hash, checked: tuned.date } }, dims);
  writeFileSync(outFile, JSON.stringify(compactProfile({ ...champion, tuned }, dims), null, 2) + '\n');
  if (opts.write) {
    // the stamp is renewed even when nothing better was found: the shipped profile has been checked against the current data
    ai.engines.strategist = result;
    writeFileSync(AI_JSON, JSON.stringify(ai, null, 2) + '\n');
    console.log(passed ? 'data/ai.json updated with the tuned profile' : 'nothing beat the shipped profile; data/ai.json keeps it (stamped as checked on this data)');
  } else {
    console.log(passed ? 'passed the gate; run with --write to ship it' : 'did not pass the gate');
  }
}

const round2 = (v) => Math.round(v * 100) / 100;

main().catch((e) => { console.error(e); process.exit(1); });

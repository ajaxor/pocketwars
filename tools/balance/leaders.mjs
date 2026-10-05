#!/usr/bin/env node
// Every leader against every other leader, played out by the AI on a range of maps: how balanced are they?
//
//   npm run balance:leaders [-- --maps 2p --seeds 1 --days 20 --engine strategist --workers N --out tools/balance/out]
//
// A leader brings a build menu and starting units (data/loadouts.json); the factions are only colours. For every pair of leaders and every
// map (two-player maps by default), the pair plays twice with the seats swapped, both seats played by the same engine and profile, so
// the engine's own strength cancels out and what is left is the leaders (and the maps). Each game is scored like the tuner scores them
// (tools/ai/lib/graded.mjs): material lead at the day limit, a win a bit more than a full lead, a quick win a bit more still.
//
// Reports a leader-by-leader matrix (score of the row against the column, 50% = even), each leader's average, its score on each map,
// and which leaders sit outside the noise. The AI plays the leaders, so this measures them as the AI plays them: a leader whose kit
// needs a human's touch will look weaker than it is.

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readData } from '../../tests/helpers/node-io.js';
import { loadMapIndex, loadRegistry } from '../../src/data/loader.js';
import { createPool } from '../ai/lib/pool.mjs';
import { mapList } from '../ai/lib/arena.mjs';
import { pointsFor } from '../ai/lib/graded.mjs';
import { parseArgs } from '../ai/arena.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const pct = (x) => `${(x * 100).toFixed(0)}%`;
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sdOf = (xs) => { const m = mean(xs); return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, xs.length - 1)); };

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const registry = await loadRegistry(readData);
  const leaders = registry.leaderIds;
  const maps = (await mapList(readData, registry, await loadMapIndex(readData), opts.maps ?? '2p')).filter((m) => m.slots === 2);
  const seeds = Number(opts.seeds ?? 1);
  const days = Number(opts.days ?? 20);
  const engine = opts.engine ?? registry.ai.default;
  const profile = registry.ai.engines[engine];
  const seat = { engine, profile };
  const jobs = [];
  for (const m of maps) {
    for (let s = 0; s < seeds; s++) {
      for (let i = 0; i < leaders.length; i++) {
        for (let j = i + 1; j < leaders.length; j++) {
          for (const order of [[leaders[i], leaders[j]], [leaders[j], leaders[i]]]) {
            jobs.push({ mapId: m.id, seed: 1 + s, maxDays: days, fog: true, leaders: order, seats: [seat, seat], labels: order });
          }
        }
      }
    }
  }
  const pool = await createPool(opts.workers ? { workers: Number(opts.workers) } : {});
  console.log(`${leaders.length} leaders, ${maps.length} maps, ${jobs.length} games with ${pool.size} workers (${engine}, ${days}-day limit)`);
  const t0 = Date.now();
  let done = 0;
  const results = await pool.run(jobs, { onResult: () => { if (++done % 100 === 0) console.log(`  ${done}/${jobs.length}  ${((Date.now() - t0) / 60000).toFixed(1)} min`); } });
  await pool.close();

  const cell = {};   // `${row}>${col}` -> points of row against col
  const perMap = {};   // leader -> map -> points
  const all = {};   // leader -> every game's points (for the confidence interval)
  const errors = [];
  for (const r of results) {
    if (r.error) errors.push(`${r.map}: ${r.job.labels[r.error.seat]}: ${r.error.message}`);
    const [a, b] = r.job.labels;
    const pa = pointsFor(r, a, days);
    const pb = pointsFor(r, b, days);
    (cell[`${a}>${b}`] ??= []).push(pa);
    (cell[`${b}>${a}`] ??= []).push(pb);
    for (const [l, p] of [[a, pa], [b, pb]]) { ((perMap[l] ??= {})[r.map] ??= []).push(p); (all[l] ??= []).push(p); }
  }
  const stats = leaders.map((l) => ({ id: l, mean: mean(all[l]), ci: 1.96 * sdOf(all[l]) / Math.sqrt(all[l].length), games: all[l].length }));
  stats.sort((a, b) => b.mean - a.mean);

  const md = ['# Leader balance', '', `${leaders.length} leaders, ${maps.length} two-player maps, ${jobs.length} games (every pair, both seat orders${seeds > 1 ? `, ${seeds} seeds` : ''}), AI engine \`${engine}\`, ${days}-day limit. Score = the graded material-lead score; 50% is even.`, '',
    '## Average against everyone else', '', '| leader | score | ± | games |', '|---|---:|---:|---:|', ...stats.map((s) => `| ${s.id} | ${pct(s.mean)} | ${(s.ci * 100).toFixed(0)} | ${s.games} |`), '',
    '## Row against column', '', `| | ${leaders.join(' | ')} |`, `|---|${leaders.map(() => '---:').join('|')}|`,
    ...leaders.map((a) => `| **${a}** | ${leaders.map((b) => (a === b ? '·' : pct(mean(cell[`${a}>${b}`] ?? [0.5])))).join(' | ')} |`), '',
    '## Score on each map', '', `| | ${maps.map((m) => m.id).join(' | ')} |`, `|---|${maps.map(() => '---:').join('|')}|`,
    ...stats.map((s) => `| **${s.id}** | ${maps.map((m) => pct(mean(perMap[s.id]?.[m.id] ?? [0.5]))).join(' | ')} |`), ''];
  const out = stats.filter((s) => Math.abs(s.mean - 0.5) > s.ci);
  md.push('## Worth a look', '', out.length ? out.map((s) => `- **${s.id}** scores ${pct(s.mean)} ± ${(s.ci * 100).toFixed(0)}: ${s.mean > 0.5 ? 'stronger' : 'weaker'} than the field, outside the noise`).join('\n') : 'No leader is outside the noise: none can be called stronger or weaker than the field on these games.', '',
    ...[...new Set(stats.flatMap((s) => Object.entries(perMap[s.id] ?? {}).filter(([, p]) => p.length >= 4 && Math.abs(mean(p) - 0.5) > 0.2).map(([m, p]) => `- ${s.id} on ${m}: ${pct(mean(p))}`)))], '',
    `Per-map and per-pair numbers rest on few games (a pair on a map is ${2 * seeds} games), so treat single cells as hints; the per-leader averages (${stats[0]?.games} games each) are the ones to trust. Run again with \`--seeds 3\` to firm any of them up.`);
  if (errors.length) md.push('', `${errors.length} games ended in an engine error (counted as a loss): ${[...new Set(errors)].slice(0, 3).join('; ')}`);
  const dir = opts.out ?? `${ROOT}tools/balance/out`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/leader-report.md`, md.join('\n') + '\n');
  writeFileSync(`${dir}/leader-matrix.csv`, [['leader', ...leaders].join(','), ...leaders.map((a) => [a, ...leaders.map((b) => (a === b ? '' : (mean(cell[`${a}>${b}`] ?? [0.5])).toFixed(3)))].join(','))].join('\n') + '\n');
  console.log(`\n${md.join('\n')}\n\nwrote ${dir}/leader-report.md and leader-matrix.csv  [${((Date.now() - t0) / 60000).toFixed(1)} min]`);
}

main().catch((e) => { console.error(e); process.exit(1); });

#!/usr/bin/env node
// Every leader against every other leader, played out by the AI on a range of maps: how balanced are they?
//
//   npm run balance:leaders [-- --maps 2p --seeds 1 --days 20 --engine strategist --workers N --no-start-units --out tools/balance/out]
//   --no-start-units   nobody starts with units (the skirmish "Starting units: Off" rule): the leaders are then only their build menus and prices
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
            jobs.push({ mapId: m.id, seed: 1 + s, maxDays: days, fog: true, startUnits: !opts['no-start-units'], leaders: order, seats: [seat, seat], labels: order });
          }
        }
      }
    }
  }
  const pool = await createPool(opts.workers ? { workers: Number(opts.workers) } : {});
  console.log(`${opts['no-start-units'] ? 'NO STARTING UNITS: ' : ''}${leaders.length} leaders, ${maps.length} maps, ${jobs.length} games with ${pool.size} workers (${engine}, ${days}-day limit)`);
  const t0 = Date.now();
  let done = 0;
  const results = await pool.run(jobs, { onResult: () => { if (++done % 100 === 0) console.log(`  ${done}/${jobs.length}  ${((Date.now() - t0) / 60000).toFixed(1)} min`); } });
  await pool.close();

  const cell = {};   // `${row}>${col}` -> points of row against col
  const perMap = {};   // leader -> map -> points
  const all = {};   // leader -> every game's points (for the confidence interval)
  const errors = [];
  const credits = {};   // leader -> type -> { fielded, dealt, lost, games } summed over the games
  const overall = {};   // type -> the same, over every leader
  for (const r of results) {
    r.leaders.forEach((l, seat) => {
      for (const [type, c] of Object.entries(r.combat?.[seat] ?? {})) {
        for (const t of [((credits[l] ??= {})[type] ??= { fielded: 0, dealt: 0, lost: 0, units: 0, struck: 0 }), (overall[type] ??= { fielded: 0, dealt: 0, lost: 0, units: 0, struck: 0 })]) { t.fielded += c.fielded; t.dealt += c.dealt; t.lost += c.lost; t.units += c.units ?? 0; t.struck += c.struck ?? 0; }
      }
    });
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
  // where the damage comes from: credits of enemy value each unit type took off, per game, and per credit it cost to field
  const k = (v) => (v >= 10000 ? `${(v / 1000).toFixed(0)}k` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)));
  const eff = (c) => (c.fielded > 0 ? c.dealt / c.fielded : 0);
  md.push('## Where the damage comes from', '', 'Credits of enemy value each unit type took off (counterattacks included), per game the leader played, with its share of the leader\'s total and its **return**: credits of damage dealt per credit of that type fielded (built, plus what the leader starts with). A return well above the rest of the leader\'s army, or above the same unit for other leaders, points at a unit that is too good for its price (or a leader whose kit leans on one).', '',
    '| leader | top unit by damage | 2nd | 3rd |', '|---|---|---|---|');
  for (const s of stats) {
    const games = all[s.id].length;
    const rows = Object.entries(credits[s.id] ?? {}).sort((a, b) => b[1].dealt - a[1].dealt);
    const total = rows.reduce((x, [, c]) => x + c.dealt, 0) || 1;
    md.push(`| **${s.id}** | ${[0, 1, 2].map((i) => (rows[i] ? `${rows[i][0]}: ${k(rows[i][1].dealt / games)}/game, ${pct(rows[i][1].dealt / total)} of its damage, return ${eff(rows[i][1]).toFixed(1)}` : '')).join(' | ')} |`);
  }
  const types = Object.entries(overall).filter(([, c]) => c.fielded > 0).sort((a, b) => eff(b[1]) - eff(a[1]));
  const effs = types.map(([, c]) => eff(c)).sort((a, b) => a - b);
  const medianEff = effs[Math.floor(effs.length / 2)] || 1;
  md.push('', '### Every unit type, best return first', '', `Over all ${results.length} games (each game has two leaders). Return = damage dealt / credits fielded; "lost" = how much of what was fielded was destroyed; net per credit = (damage dealt - value lost) / credits fielded, which credits a unit for hitting things that cannot hit back (bombers, fighters), where return alone does not. The median return is ${medianEff.toFixed(2)}.`, '',
    '| unit | fielded | damage dealt | return | destroyed (of fielded) | net per credit | vs median |', '|---|---:|---:|---:|---:|---:|---:|',
    ...types.map(([t, c]) => `| ${t} | ${k(c.fielded)} | ${k(c.dealt)} | ${eff(c).toFixed(2)} | ${pct(c.lost / c.fielded)} | ${((c.dealt - c.lost) / c.fielded).toFixed(2)} | ${(eff(c) / medianEff).toFixed(1)}x |`), '',
    `Low hanging fruit: ${types.filter(([, c]) => eff(c) > 2 * medianEff).map(([t, c]) => `**${t}** (${(eff(c) / medianEff).toFixed(1)}x the median return)`).join(', ') || 'no unit returns more than twice the median'}. Units under a third of the median: ${types.filter(([, c]) => eff(c) < medianEff / 3).map(([t]) => t).join(', ') || 'none'} (support units that deal little damage by design will always be here).`, '');
  // units bought and never used: armed types ranked by the share of their units that never attacked (a gap in the AI's controller, or a
  // unit that is not worth its price). Types with a handful of units are left out: too few to say.
  const armed = Object.entries(overall).filter(([t, c]) => registry.unit(t).weapons?.length && !registry.unit(t).attributes?.heal && !registry.unit(t).attributes?.supply && c.units >= 15);
  const idle = (c) => 1 - c.struck / c.units;
  const unused = armed.sort((a, b) => b[1].fielded * idle(b[1]) - a[1].fielded * idle(a[1]));
  md.push('### Most under-used armed units', '', `Armed unit types with at least 15 units fielded over the ${results.length} games, ranked by the credits spent on units that never attacked at all (killed on arrival counts: the AI paid for it and got nothing; a unit that only captures counts too, so infantry sit high by nature). Healers and suppliers are left out. "Wasted" is the type's credits fielded times the share that never attacked. Read it against the median below and the return column above: a type that is both idle and low-return is probably used badly by the AI; one that is idle but dies quickly may be priced above what it survives to do.`, '',
    '| unit | units | never attacked | wasted | return | destroyed (of fielded) |', '|---|---:|---:|---:|---:|---:|',
    ...unused.slice(0, 12).map(([t, c]) => `| ${t} | ${c.units} | ${pct(idle(c))} | ${k(c.fielded * idle(c))} | ${eff(c).toFixed(2)} | ${pct(c.lost / c.fielded)} |`), '',
    `Median share that never attacked, over all ${armed.length} armed types: ${pct(armed.map(([, c]) => idle(c)).sort((a, b) => a - b)[Math.floor(armed.length / 2)] ?? 0)}.`, '');
  const out = stats.filter((s) => Math.abs(s.mean - 0.5) > s.ci);
  md.push('## Worth a look', '', out.length ? out.map((s) => `- **${s.id}** scores ${pct(s.mean)} ± ${(s.ci * 100).toFixed(0)}: ${s.mean > 0.5 ? 'stronger' : 'weaker'} than the field, outside the noise`).join('\n') : 'No leader is outside the noise: none can be called stronger or weaker than the field on these games.', '',
    ...[...new Set(stats.flatMap((s) => Object.entries(perMap[s.id] ?? {}).filter(([, p]) => p.length >= 4 && Math.abs(mean(p) - 0.5) > 0.2).map(([m, p]) => `- ${s.id} on ${m}: ${pct(mean(p))}`)))], '',
    `Per-map and per-pair numbers rest on few games (a pair on a map is ${2 * seeds} games), so treat single cells as hints; the per-leader averages (${stats[0]?.games} games each) are the ones to trust. Run again with \`--seeds 3\` to firm any of them up.`);
  if (errors.length) md.push('', `${errors.length} games ended in an engine error (counted as a loss): ${[...new Set(errors)].slice(0, 3).join('; ')}`);
  const dir = opts.out ?? `${ROOT}tools/balance/out${opts['no-start-units'] ? '/no-start-units' : ''}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/leader-report.md`, md.join('\n') + '\n');
  writeFileSync(`${dir}/leader-matrix.csv`, [['leader', ...leaders].join(','), ...leaders.map((a) => [a, ...leaders.map((b) => (a === b ? '' : (mean(cell[`${a}>${b}`] ?? [0.5])).toFixed(3)))].join(','))].join('\n') + '\n');
  console.log(`\n${md.join('\n')}\n\nwrote ${dir}/leader-report.md and leader-matrix.csv  [${((Date.now() - t0) / 60000).toFixed(1)} min]`);
}

main().catch((e) => { console.error(e); process.exit(1); });

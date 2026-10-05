// Scheduling and scoring engine-vs-engine games. A contender is an engine with a profile: { label, engine, profile? }.
//
//   duelJobs(a, b, { maps, seeds, maxDays })   every map x seed, played twice with the seats swapped (fair: same leaders per slot)
//   scoreDuel(results, a, b)                   { a, b, games, wins, losses, draws, adjudicated, score, ci, byMap }
//     score is a's share of the points (win 1, draw 0.5); ci the half-width of its 95% confidence interval
//   parseContender(spec, registry)            "greedy", "strategist", "strategist=path/to/profile.json" -> contender
//   mapList(index, registry, which)           'all', '2p', or a comma list of map ids

import { readFileSync } from 'node:fs';
import { loadMap } from '../../../src/data/loader.js';

export async function mapList(readData, registry, index, which = 'all') {
  const ids = which === 'all' || which === '2p' ? Object.keys(index.maps) : which.split(',').map((s) => s.trim());
  const maps = [];
  for (const id of ids) {
    const map = await loadMap(readData, registry, id);
    if (which === '2p' && map.players.length !== 2) continue;
    maps.push({ id, slots: map.players.length });
  }
  return maps;
}

export function parseContender(spec, registry) {
  const [engine, file] = spec.split('=');
  if (!registry.ai.engines[engine] && !file) throw new Error(`no profile for engine "${engine}" in data/ai.json`);
  const profile = file ? JSON.parse(readFileSync(file, 'utf8')) : registry.ai.engines[engine];
  return { label: file ? `${engine}(${file.split('/').pop()})` : engine, engine, profile };
}

/** Seats for one game on a map with `slots` players: a and b alternate, starting with `first`. */
const seatsFor = (slots, first, second) => Array.from({ length: slots }, (_, i) => (i % 2 === 0 ? first : second));

export function duelJobs(a, b, { maps, seeds = 4, seedBase = 1, maxDays, fog = true, margin }) {
  const jobs = [];
  for (const { id, slots } of maps) {
    for (let s = 0; s < seeds; s++) {
      const seed = seedBase + s;
      for (const [first, second] of [[a, b], [b, a]]) {
        jobs.push({
          mapId: id, seed, maxDays, fog, margin,
          seats: seatsFor(slots, first, second).map((c) => ({ engine: c.engine, profile: c.profile })),
          labels: seatsFor(slots, first, second).map((c) => c.label),
        });
      }
    }
  }
  return jobs;
}

export function scoreDuel(results, a, b) {
  const blank = () => ({ games: 0, wins: 0, losses: 0, draws: 0, adjudicated: 0, days: 0 });
  const total = blank();
  const byMap = {};
  const points = [];
  for (const r of results) {
    const m = (byMap[r.map] ??= blank());
    const winLabel = r.winner == null ? null : r.job.labels[r.winner];
    const p = winLabel == null ? 0.5 : winLabel === a.label ? 1 : 0;
    points.push(p);
    for (const t of [total, m]) {
      t.games++;
      t.days += r.days;
      if (r.adjudicated) t.adjudicated++;
      if (p === 1) t.wins++; else if (p === 0) t.losses++; else t.draws++;
    }
  }
  const n = points.length || 1;
  const score = points.reduce((x, y) => x + y, 0) / n;
  const sd = Math.sqrt(points.reduce((x, y) => x + (y - score) ** 2, 0) / Math.max(1, n - 1));
  for (const m of Object.values(byMap)) m.days = m.days / m.games;
  return { a: a.label, b: b.label, ...total, days: total.days / n, score, ci: 1.96 * sd / Math.sqrt(n), byMap };
}

export function formatDuel(s) {
  const pct = (x) => `${(x * 100).toFixed(0)}%`;
  const lines = [`${s.a} vs ${s.b}: ${s.games} games, ${s.wins} won, ${s.losses} lost, ${s.draws} drawn (${s.adjudicated} judged at the day limit)`,
    `score ${pct(s.score)} ± ${pct(s.ci)} for ${s.a}`, '', 'map               games  won  lost  drawn  judged  avg days'];
  for (const [id, m] of Object.entries(s.byMap)) {
    lines.push(`${id.padEnd(18)}${String(m.games).padStart(5)}${String(m.wins).padStart(5)}${String(m.losses).padStart(6)}${String(m.draws).padStart(7)}${String(m.adjudicated).padStart(8)}${m.days.toFixed(1).padStart(10)}`);
  }
  return lines.join('\n');
}

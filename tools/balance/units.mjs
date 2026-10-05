#!/usr/bin/env node
// Every unit against every other unit, one attack each, in credits.
//
//   npm run balance:units [-- --out tools/balance/out --html]
//
// For each attacker A and defender D (full HP, in the open, no terrain cover), straight from the damage formula in the data:
//   dealt    HP of damage A's best weapon does to D, in credits: HP x (D's price / max HP)
//   taken    what D's reply does to A, if D survives and has a direct weapon that reaches it. A ranged (indirect) attacker is assumed to
//            strike first and be answered second, as it would be in a real fight, unless D is ranged too (ranged units never reply).
//            In the game itself an indirect shot is never countered, so ranged units always score a little oddly here
//   net      dealt - taken: what one exchange is worth to A's owner, in credits (positive: A wins the trade)
//   value    dealt / A's price: damage bought per credit spent on the attacker
// Blank where A cannot hurt D at all. Position, range and terrain are left out on purpose: this is the pure matchup of the two stat
// blocks, so that a price or weapon change shows up here before it shows up as an imbalance in play.
//
// Writes unit-trades.csv (one row per pair), unit-matrix.csv (net, attackers down, defenders across) and unit-report.md to --out
// (default tools/balance/out/), and with --html a heat map. The report lists each unit's average result, best and worst targets, and the
// outliers worth a look: units that win nearly every trade for their price, and units that lose nearly all of them.

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readData } from '../../tests/helpers/node-io.js';
import { loadMapIndex, loadRegistry } from '../../src/data/loader.js';
import { hasAttribute } from '../../src/engine/attributes.js';
import { weaponDamage } from '../../src/engine/combat.js';
import { makeUnit } from '../../src/engine/state.js';
import { loadAnyMap } from '../ai/lib/maps.mjs';
import { setupMatch } from '../ai/lib/match.mjs';
import { parseArgs } from '../ai/arena.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BIG = 1e6;   // damage is linear in the attacker's HP, so a huge HP gives it unrounded: the game rounds to whole HP, which would blur small differences

/** One A-against-D exchange. Returns null when A cannot hurt D. */
export function trade(game, a, d) {
  const { registry } = game;
  const da = registry.unit(a);
  const dd = registry.unit(d);
  const maxHp = registry.rules.maxHp;
  const at = { x: 0, y: 0 };
  const ghost = (type, id) => ({ ...makeUnit(registry, game.map, id, { type, owner: id, x: at.x, y: at.y }), submerged: false });
  const reach = (from, to, counter) => {   // the best weapon `from` has against `to`: { perHp, indirect } or null
    let best = null;
    for (const wid of registry.unit(from).weapons) {
      const w = registry.weapon(wid);
      const t = registry.unit(to);
      if (!(w.damage > 0)) continue;
      if (w.onlyTags && !w.onlyTags.some((tag) => t.tags?.includes(tag))) continue;
      if (!w.targets.some((m) => registry.rules.targetModes[m].layer === t.layer)) continue;
      const indirect = !!w.indirect || hasAttribute(registry.unit(from), 'indirect');
      if (counter && indirect) continue;
      const attacker = { ...ghost(from, -1), hp: BIG };
      const perHp = weaponDamage(game, w, attacker, ghost(to, -2), !counter && !indirect) / BIG;   // a direct-fire unit usually moves before it fires
      if (!best || perHp > best.perHp) best = { perHp, indirect };
    }
    return best;
  };
  const first = reach(a, d, false);
  if (!first || !(first.perHp > 0)) return null;
  const hit = Math.min(maxHp, first.perHp * maxHp);   // HP taken off D by a full-strength A
  const survives = hit < maxHp;
  let back = 0;
  if (survives) {   // a ranged attacker is treated as striking first and being answered second, unless the target is ranged too (reach() skips indirect counters)
    const r = reach(d, a, true);
    if (r) back = Math.min(maxHp, r.perHp * (maxHp - hit));
  }
  const dealt = (Math.min(hit, maxHp) * dd.cost) / maxHp;
  const taken = (back * da.cost) / maxHp;
  return { hit, back, dealt, taken, net: dealt - taken, value: dealt / da.cost, kills: !survives };
}

const round = (v, n = 2) => (v == null ? '' : Math.round(v * 10 ** n) / 10 ** n);
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const registry = await loadRegistry(readData);
  const index = await loadMapIndex(readData);
  const map = await loadAnyMap(readData, registry, Object.keys(index.maps)[0]);
  const game = setupMatch(registry, map, { seats: map.players.map(() => ({ engine: 'greedy' })), leaders: false });
  const ids = registry.unitIds.filter((id) => { const d = registry.unit(id); return !hasAttribute(d, 'structure') && !hasAttribute(d, 'mine'); });
  const attackers = ids.filter((id) => registry.unit(id).weapons.length);
  const rows = [];
  const by = new Map();   // attacker -> { defender -> trade }
  for (const a of attackers) {
    by.set(a, new Map());
    for (const d of ids) {
      const t = trade(game, a, d);
      if (!t) continue;
      by.get(a).set(d, t);
      rows.push({ attacker: a, defender: d, ...t });
    }
  }

  // per unit: how it does over everything it can hit, and (as a defender) over everything that can hit it
  const stats = attackers.map((a) => {
    const ts = [...by.get(a).entries()];
    const asDef = attackers.map((x) => by.get(x).get(a)).filter(Boolean);
    const sorted = [...ts].sort((x, y) => y[1].net - x[1].net);
    return {
      id: a, name: registry.unit(a).name ?? a, cost: registry.unit(a).cost, targets: ts.length,
      mean: mean(ts.map(([, t]) => t.net)), value: mean(ts.map(([, t]) => t.value)), winShare: ts.length ? ts.filter(([, t]) => t.net > 0).length / ts.length : 0,
      defence: mean(asDef.map((t) => -t.net)), best: sorted.slice(0, 3).map(([d, t]) => `${d} (${round(t.net, 0)})`), worst: sorted.slice(-3).reverse().map(([d, t]) => `${d} (${round(t.net, 0)})`),
    };
  });
  const valueMedian = [...stats.map((s) => s.value)].sort((a, b) => a - b)[Math.floor(stats.length / 2)];

  // distilled by category: every pair of an attacking category and a defending one, mean and median of the net
  const cats = [...new Set(ids.map((id) => registry.unit(id).category))];
  const median = (xs) => { const v = [...xs].sort((a, b) => a - b); return v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null; };
  const catOf = (id) => registry.unit(id).category;
  const nets = (aCat, dCat, unit = null) => rows.filter((r) => catOf(r.attacker) === aCat && catOf(r.defender) === dCat && (unit == null || r.attacker === unit)).map((r) => r.net);
  const attCats = cats.filter((c) => attackers.some((a) => catOf(a) === c));
  const defCats = cats.filter((c) => ids.some((d) => catOf(d) === c) && rows.some((r) => catOf(r.defender) === c));
  const cell2 = (xs) => (xs.length ? `${round(mean(xs), 0)} / ${round(median(xs), 0)}` : '·');
  const catRows = [];
  for (const a of attCats) for (const d of defCats) { const xs = nets(a, d); if (xs.length) catRows.push({ attacker: a, defender: d, pairs: xs.length, mean: mean(xs), median: median(xs) }); }

  const out = opts.out ?? `${ROOT}tools/balance/out`;
  mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/unit-trades.csv`, ['attacker,defender,hp_dealt,hp_taken_back,credits_dealt,credits_taken,net,value_per_credit,kills',
    ...rows.map((r) => [r.attacker, r.defender, round(r.hit), round(r.back), round(r.dealt, 0), round(r.taken, 0), round(r.net, 0), round(r.value, 3), r.kills ? 1 : 0].join(','))].join('\n') + '\n');
  writeFileSync(`${out}/category-trades.csv`, ['attacker_category,defender_category,pairs,mean_net,median_net', ...catRows.map((r) => [r.attacker, r.defender, r.pairs, round(r.mean, 0), round(r.median, 0)].join(','))].join('\n') + '\n');
  writeFileSync(`${out}/unit-matrix.csv`, [['attacker\\defender', ...ids].join(','), ...attackers.map((a) => [a, ...ids.map((d) => round(by.get(a).get(d)?.net, 0))].join(','))].join('\n') + '\n');

  const md = [`# Unit trades`, '', `${attackers.length} armed units against ${ids.length} units, one attack each at full HP in the open. \`net\` = credits of damage dealt minus credits taken back; \`value\` = damage dealt per credit of the attacker's price (averaged over everything it can hit).`, '',
    '| unit | cost | can hit | avg net | win share | value/credit | as a target (avg loss to attackers) | best against | worst against |', '|---|---:|---:|---:|---:|---:|---:|---|---|',
    ...[...stats].sort((x, y) => y.value - x.value).map((s) => `| ${s.id} | ${s.cost} | ${s.targets}/${ids.length} | ${round(s.mean, 0)} | ${(s.winShare * 100).toFixed(0)}% | ${round(s.value, 2)} | ${round(s.defence, 0)} | ${s.best.join(', ')} | ${s.worst.join(', ')} |`), ''];
  md.push('## By category: mean / median net credits per exchange', '', `Attacking category down, defending category across; ${defCats.map((c) => `${c} (${ids.filter((d) => catOf(d) === c).length})`).join(', ')} units as targets. Ranged units are assumed to strike first and be answered second (unless the target is ranged too), so their rows read high or low depending on that assumption.`, '',
    `| attacker \\ target | ${defCats.join(' | ')} |`, `|---|${defCats.map(() => '---:').join('|')}|`,
    ...attCats.map((a) => `| **${a}** (${attackers.filter((x) => catOf(x) === a).length}) | ${defCats.map((d) => cell2(nets(a, d))).join(' | ')} |`), '',
    '### Each unit against each category (mean net)', '', `| unit | ${defCats.join(' | ')} |`, `|---|${defCats.map(() => '---:').join('|')}|`,
    ...[...stats].sort((x, y) => (catOf(x.id) === catOf(y.id) ? y.mean - x.mean : cats.indexOf(catOf(x.id)) - cats.indexOf(catOf(y.id)))).map((st) => `| ${st.id} (${catOf(st.id)}${registry.unit(st.id).weapons.some((w) => registry.weapon(w).indirect) || hasAttribute(registry.unit(st.id), 'indirect') ? ', ranged' : ''}) | ${defCats.map((d) => { const xs = nets(catOf(st.id), d, st.id); return xs.length ? round(mean(xs), 0) : '·'; }).join(' | ')} |`), '');
  const strong = stats.filter((s) => s.value > 2 * valueMedian);
  const weak = stats.filter((s) => s.value < 0.5 * valueMedian || s.winShare < 0.2);
  md.push('## Worth a look', '', strong.length ? `Strong for their price (value/credit more than twice the median, ${round(valueMedian, 2)}): ${strong.map((s) => `${s.id} (${round(s.value, 2)})`).join(', ')}.` : 'No unit stands out as strong for its price.', '',
    weak.length ? `Weak for their price (under half the median, or winning under 20% of their trades): ${weak.map((s) => `${s.id} (${round(s.value, 2)}, wins ${(s.winShare * 100).toFixed(0)}%)`).join(', ')}.` : 'No unit stands out as weak for its price.', '',
    'Remember what this leaves out: movement, range, terrain, transport and capture all matter in play. A unit that looks weak here may be the only one that can do its job; one that looks strong may simply be hard to bring to the fight.');
  writeFileSync(`${out}/unit-report.md`, md.join('\n') + '\n');

  if (opts.html) {
    const col = (net, cost) => { const t = Math.tanh(net / 3000); return t >= 0 ? `hsl(135 ${Math.round(60 * t)}% ${Math.round(100 - 45 * t)}%)` : `hsl(0 ${Math.round(-60 * t)}% ${Math.round(100 + 45 * t)}%)`; };
    const cells = attackers.map((a) => `<tr><th>${a}</th>${ids.map((d) => { const t = by.get(a).get(d); return t ? `<td style="background:${col(t.net, 0)}" title="${a} vs ${d}: ${round(t.hit, 1)} HP dealt, ${round(t.back, 1)} back, net ${round(t.net, 0)}">${round(t.net, 0)}</td>` : '<td class="n"></td>'; }).join('')}</tr>`).join('');
    writeFileSync(`${out}/unit-matrix.html`, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Unit trades</title><style>body{font:12px system-ui;margin:12px}table{border-collapse:collapse}td,th{padding:2px 4px;text-align:right;border:1px solid #ddd}th{font-weight:600;background:#f4f4f4;position:sticky;left:0}thead th{position:sticky;top:0;writing-mode:vertical-rl;left:auto}td.n{background:#eee}</style><h2>Unit trades: net credits of one attack (row attacks column)</h2><table><thead><tr><th></th>${ids.map((d) => `<th>${d}</th>`).join('')}</tr></thead><tbody>${cells}</tbody></table>`);
  }
  console.log(md.slice(md.indexOf('## By category: mean / median net credits per exchange'), md.indexOf('### Each unit against each category (mean net)')).join('\n'));
  console.log(`\nwrote ${out}/unit-trades.csv, unit-matrix.csv, unit-report.md${opts.html ? ', unit-matrix.html' : ''}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e); process.exit(1); });

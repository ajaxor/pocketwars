#!/usr/bin/env node
// Every leader's primary infantry against the others: is each one worth its price?
//
//   npm run balance:infantry [-- --out tools/balance/out --cost royal_guard=2200,swordsman=1400]
//
// The leader report says how whole kits do under the AI; this looks at the one unit every leader builds most of (the `infantry` of its
// loadout, plus the flamethrower, which two leaders get instead of a second infantry type) with nothing but the damage formula.
//
// For two units A and B, k(A>B) is the share of B's HP that one full-HP A takes off it in one attack, and cost(A) its price. In a skirmish of many
// A against many B for the same money, the square law (Lanchester) says A wins when k(A>B) / cost(A)^2 > k(B>A) / cost(B)^2. The report
// prints the square root of that ratio: the **strength ratio at equal money**. 1.00 is an even fight, 1.20 means every credit spent on A
// is worth 20% more than a credit spent on B. It is worked out
//   in the open       both on plain; the attacker has moved (the motorcycle's penalty applies), the reply has not
//   in cover          B (and A) fighting from a forest, where the terrain defence stars count (the commando and conscript double them)
//   against the soldier's tools   what each unit does to a tank, a heavy tank and a mech per credit, and what a rifle, a machine gun and a bazooka do to it
// A unit's `rating` is the geometric mean of its ratio over the others in the open and in cover; a primary infantry should sit near 1.00 for
// the money. `--cost id=price,...` tries other prices without touching the data.
//
// Writes infantry-report.md to --out (default tools/balance/out/).

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readData } from '../../tests/helpers/node-io.js';
import { loadMap, loadRegistry } from '../../src/data/loader.js';
import { Game } from '../../src/engine/game.js';
import { weaponDamage, weaponsOf } from '../../src/engine/combat.js';
import { parseArgs } from '../ai/arena.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TILE = { plain: [0, 2], forest: [1, 0], city: [2, 1] };   // tiles of the classic map (the same fixture the damage baseline uses)
const round = (v, n = 2) => (v == null || !Number.isFinite(v) ? '' : Math.round(v * 10 ** n) / 10 ** n);
const geo = (xs) => Math.exp(xs.reduce((a, x) => a + Math.log(x), 0) / xs.length);

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const registry = await loadRegistry(readData);
  const game = new Game(registry, await loadMap(readData, registry, 'classic'));
  const price = (id) => registry.unit(id).cost;
  const override = Object.fromEntries(String(opts.cost ?? '').split(',').filter(Boolean).map((p) => p.split('=')).map(([k, v]) => [k, Number(v)]));
  const cost = (id) => override[id] ?? price(id);

  // who is whose basic infantry, in leader order
  const owners = {};
  for (const l of registry.leaderIds) (owners[registry.loadoutFor(l).infantry] ??= []).push(l);
  owners.flamethrower = registry.leaderIds.filter((l) => Object.values(registry.loadoutFor(l).build).flat().includes('flamethrower'));
  const ids = Object.keys(owners);
  const BIG = 1e6;

  /** Share of `d`'s HP one full-HP `a` takes off it when `d` stands on `dt` and `a` on plain (`moved`: the attacker has walked up). */
  const k = (a, d, dt, moved) => {
    const [dx, dy] = TILE[dt];
    const at = { id: 9001, type: a, owner: 0, x: 0, y: 5, hp: BIG, done: false, capture: 0 };
    const df = { id: 9002, type: d, owner: 1, x: dx, y: dy, hp: 10, done: false, capture: 0 };
    game.state.units = [at, df];
    const layer = registry.unit(d).layer;
    const hits = weaponsOf(game, at).filter((w) => w.targets.some((m) => registry.rules.targetModes[m].layer === layer)).map((w) => weaponDamage(game, w, at, df, moved) / BIG);
    return hits.length ? Math.max(...hits) : 0;
  };
  /** Strength ratio at equal money of a against b when both fight from `terrain` (a attacks having moved, b replies). `noCounter`: b gets no reply when a fires. */
  const ratio = (a, b, terrain) => {
    const ab = k(a, b, terrain, true), ba = k(b, a, terrain, true);   // each side is the one that moves up in its own half of the fight
    const noA = registry.weapon(registry.unit(a).weapons[0]).noCounter, noB = registry.weapon(registry.unit(b).weapons[0]).noCounter;
    const A = ab * (noA ? 1.5 : 1), B = ba * (noB ? 1.5 : 1);   // an attack nobody answers is worth half as much again in a skirmish (the other side loses its reply)
    return Math.sqrt((A / cost(a) ** 2) / (B / cost(b) ** 2));
  };

  const rows = ids.map((a) => {
    const open = ids.filter((b) => b !== a).map((b) => ratio(a, b, 'plain'));
    const cover = ids.filter((b) => b !== a).map((b) => ratio(a, b, 'forest'));
    return { id: a, leaders: owners[a].join(', '), cost: cost(a), open: geo(open), cover: geo(cover), rating: geo([...open, ...cover]) };
  }).sort((x, y) => y.rating - x.rating);

  const md = ['# Primary infantry', '', `${ids.length} units: the basic infantry of every leader, and the flamethrower. Strength ratio at equal money (1.00 = even, above 1 = better for its price); see the header of \`tools/balance/infantry.mjs\`.`, '',
    '| unit | leaders | cost | in the open | in cover | rating |', '|---|---|---:|---:|---:|---:|',
    ...rows.map((r) => `| ${r.id} | ${r.leaders} | ${r.cost} | ${round(r.open)} | ${round(r.cover)} | **${round(r.rating)}** |`), '',
    '## Row against column, in the open (strength ratio at equal money)', '', `| | ${ids.join(' | ')} |`, `|---|${ids.map(() => '---:').join('|')}|`,
    ...ids.map((a) => `| **${a}** | ${ids.map((b) => (a === b ? '·' : round(ratio(a, b, 'plain')))).join(' | ')} |`), '',
    '## Row against column, fighting from a forest', '', `| | ${ids.join(' | ')} |`, `|---|${ids.map(() => '---:').join('|')}|`,
    ...ids.map((a) => `| **${a}** | ${ids.map((b) => (a === b ? '·' : round(ratio(a, b, 'forest')))).join(' | ')} |`), '',
    '## What each does to armour, per 1,000 credits (HP of damage to a full-HP target by a full-HP unit, having moved)', '',
    `| unit | cost | tank | heavy tank | mech | per 1,000 credits vs tank |`, '|---|---:|---:|---:|---:|---:|',
    ...ids.map((a) => `| ${a} | ${cost(a)} | ${round(k(a, 'tank', 'plain', true) * 10, 1)} | ${round(k(a, 'heavy_tank', 'plain', true) * 10, 1)} | ${round(k(a, 'mech', 'plain', true) * 10, 1)} | ${round(k(a, 'tank', 'plain', true) * 10 / cost(a) * 1000, 2)} |`), '',
    '## What common weapons do to each (HP of damage by a full-HP attacker, target in the open)', '',
    `| unit | cost | soldier's rifle | machine gun | tank cannon | bazooka | durability vs rifle per 1,000 credits |`, '|---|---:|---:|---:|---:|---:|---:|',
    ...ids.map((d) => {
      const hit = (a) => k(a, d, 'plain', false) * 10;
      return `| ${d} | ${cost(d)} | ${round(hit('soldier'), 1)} | ${round(hit('recon'), 1)} | ${round(hit('tank'), 1)} | ${round(hit('mech'), 1)} | ${round(1 / hit('soldier') * 10 / cost(d) * 1000, 2)} |`;
    }), ''];

  const out = opts.out ?? `${ROOT}tools/balance/out`;
  mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/infantry-report.md`, md.join('\n') + '\n');
  console.log(md.slice(0, 5 + rows.length).join('\n'));
  console.log(`\nwrote ${out}/infantry-report.md`);
}

main().catch((e) => { console.error(e); process.exit(1); });

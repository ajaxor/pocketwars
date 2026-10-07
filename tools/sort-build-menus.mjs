#!/usr/bin/env node
// Sorts every build menu in data/loadouts.json cheapest first, in place, leaving the rest of the file's layout alone.
//
//   node tools/sort-build-menus.mjs            rewrite data/loadouts.json
//   node tools/sort-build-menus.mjs --check    only report menus that are out of order (exit 2 when there are any)
//
// A menu is sorted by what the unit costs that leader (a troop carrier's price moves with the infantry the leader loads it with, see
// `costFor` in src/engine/queries.js); units that cost the same keep the order they had. tests/data/leaders.test.js fails when a menu
// is out of order, so run this after adding a unit to a menu.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readData } from '../tests/helpers/node-io.js';
import { loadRegistry } from '../src/data/loader.js';
import { costFor } from '../src/engine/queries.js';

const FILE = fileURLToPath(new URL('../data/loadouts.json', import.meta.url));
const registry = await loadRegistry(readData);

/** The price of a unit for a leader (null: the default kit, whose carriers carry plain soldiers). */
const priceFor = (leader, id) => costFor({ registry, map: { players: [{ leader }] } }, 0, id);

/** `ids` cheapest first, ties kept in their listed order. */
const sortedMenu = (leader, ids) => ids.map((id, i) => ({ id, i, cost: priceFor(leader, id) })).sort((a, b) => a.cost - b.cost || a.i - b.i).map((x) => x.id);

const check = process.argv.includes('--check');
const lines = readFileSync(FILE, 'utf8').split('\n');
let leader = null, inLeaders = false, inBuild = false, changed = 0;
const out = lines.map((line) => {
  if (/^ {2}"default": \{$/.test(line)) { leader = null; inLeaders = false; }
  if (/^ {2}"leaders": \{$/.test(line)) inLeaders = true;
  const who = inLeaders && line.match(/^ {4}"([a-z0-9_]+)": \{$/);   // a leader's block ("harlan": {)
  if (who) leader = who[1];
  if (/^ {4,6}"build": \{$/.test(line)) { inBuild = true; return line; }
  if (inBuild && /^ {4,6}\},?$/.test(line)) { inBuild = false; return line; }
  const menu = inBuild && line.match(/^(\s*"[a-z]+": )\[(.*)\](,?)$/);   // one building's menu, written on a single line
  if (!menu) return line;
  const ids = menu[2].split(',').map((t) => t.trim().replace(/^"|"$/g, ''));
  const sorted = sortedMenu(leader, ids);
  if (sorted.join() === ids.join()) return line;
  changed++;
  console.log(`${leader ?? 'default'}: ${menu[1].trim().replace(/[": ]/g, '')}  ${ids.join(', ')}  ->  ${sorted.join(', ')}`);
  return `${menu[1]}[${sorted.map((id) => `"${id}"`).join(', ')}]${menu[3]}`;
});

if (check) { console.log(changed ? `${changed} menu(s) out of order` : 'all build menus are sorted'); process.exit(changed ? 2 : 0); }
if (changed) writeFileSync(FILE, out.join('\n'));
console.log(changed ? `sorted ${changed} menu(s)` : 'all build menus were already sorted');

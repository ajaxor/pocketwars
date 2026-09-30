// Regenerates tests/data/damage-baseline.json from the CURRENT data. Run after deliberately retuning units or weapons:
//   node tools/regen-damage-baseline.mjs
// The cases (who attacks whom, at what HP, on what terrain) are kept; only the expected damage is recomputed.
import { readFileSync, writeFileSync } from 'node:fs';
import { readData } from '../tests/helpers/node-io.js';
import { loadRegistry, loadMap } from '../src/data/loader.js';
import { Game } from '../src/engine/game.js';
import { canTarget, weaponDamage, weaponsOf } from '../src/engine/combat.js';

const file = new URL('../tests/data/damage-baseline.json', import.meta.url);
const baseline = JSON.parse(readFileSync(file, 'utf8'));
const registry = await loadRegistry(readData);
const map = await loadMap(readData, registry, 'classic');
const game = new Game(registry, map);
const TILE = { plain: [0, 2], forest: [1, 0], mountain: [0, 0], road: [4, 2], city: [2, 1], hq: [5, 0] };

let changed = 0;
const lines = baseline.cases.map((c) => {
  const [x, y] = TILE[c.t];
  const attacker = { id: 9001, type: c.a, owner: 0, x: 0, y: 5, hp: c.ahp, done: false, capture: 0 };
  const defender = { id: 9002, type: c.d, owner: 1, x, y, hp: c.dhp, done: false, capture: 0 };
  game.state.units = [attacker, defender];
  const layer = registry.unit(c.d).layer;
  const weapon = weaponsOf(game, attacker).find((w) => w.targets.some((m) => registry.rules.targetModes[m].layer === layer));
  const dmg = canTarget(game, attacker, defender) && weapon ? weaponDamage(game, weapon, attacker, defender) : 0;
  if (dmg !== c.dmg) changed++;
  return JSON.stringify({ a: c.a, d: c.d, t: c.t, ahp: c.ahp, dhp: c.dhp, dmg });
});
const note = 'Damage of one matchup: dmg = the attacker\'s weapon formula (attacker at ahp HP, defender at dhp HP standing on terrain t). Regenerate with tools/regen-damage-baseline.mjs after retuning data/units.json or data/weapons.json.';
writeFileSync(file, `{"note":${JSON.stringify(note)},"cases":[\n${lines.join(',\n')}\n]}\n`);
console.log(`${lines.length} cases, ${changed} changed`);

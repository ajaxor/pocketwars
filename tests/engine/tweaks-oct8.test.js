// October 8 tweaks on the shipped data: flamethrowers burn out structures, the royal guard is armoured, barracks build without a per-turn limit,
// and the dreadnought fires once a turn but hits harder than the battleship.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadMap, loadRegistry } from '../../src/data/loader.js';
import { Game } from '../../src/engine/game.js';
import { forecastAttack } from '../../src/engine/combat.js';
import { buildProblem, buildUnit } from '../../src/engine/economy.js';

const registry = await loadRegistry(readData);
const game = async () => new Game(registry, await loadMap(readData, registry, 'ridgeback'));

test('a flamethrower hurts a jammer as much as a siege weapon would; a rifle barely scratches it', async () => {
  const g = await game();
  const jammer = g.state.units.find((u) => u.type === 'jammer');
  const mk = (type) => ({ id: 9000, type, owner: 0, x: jammer.x - 1, y: jammer.y, hp: 10 });
  const flame = forecastAttack(g, mk('flamethrower'), jammer, { x: jammer.x - 1, y: jammer.y });
  const soldier = forecastAttack(g, mk('soldier'), jammer, { x: jammer.x - 1, y: jammer.y });
  assert.ok(flame.damage > soldier.damage * 4, `flame ${flame.damage} vs soldier ${soldier.damage}`);
  assert.ok(flame.damage >= 2, 'a real dent in the jammer');
});

test('the royal guard has more armour than before, and the dreadnought is a single, stronger shooter than the battleship', () => {
  assert.ok(registry.unit('royal_guard').armor >= 0.5);
  const dread = registry.unit('dreadnought');
  assert.equal(dread.attributes.attacksPerTurn, undefined);
  const [dm, ds] = dread.weapons.map((w) => registry.weapon(w)), [bm, bs] = registry.unit('battleship').weapons.map((w) => registry.weapon(w));
  assert.ok(dm.damage > bm.damage && dm.armorPiercing > bm.armorPiercing && ds.damage >= bs.damage);
});

test('a barracks may build again the same turn once the first unit has moved off; a factory may not', async () => {
  const g = await game();
  const tile = (id) => { for (let y = 0; y < g.map.height; y++) for (let x = 0; x < g.map.width; x++) if (g.map.terrain[y][x] === id && g.map.owners[y][x] === 0) return { x, y }; };
  const b = tile('barracks'), f = tile('factory');
  g.state.funds[0] = 50000;
  g.state.units = g.state.units.filter((u) => !(u.x === b.x && u.y === b.y) && !(u.x === f.x && u.y === f.y));
  assert.ok(buildUnit(g, 0, b.x, b.y, 'soldier').ok);
  g.state.units = g.state.units.filter((u) => !(u.x === b.x && u.y === b.y));   // it drove off
  assert.equal(buildProblem(g, 0, b.x, b.y, 'soldier'), null);
  assert.ok(buildUnit(g, 0, f.x, f.y, 'recon').ok);
  g.state.units = g.state.units.filter((u) => !(u.x === f.x && u.y === f.y));
  assert.equal(buildProblem(g, 0, f.x, f.y, 'recon'), 'already-built');
});

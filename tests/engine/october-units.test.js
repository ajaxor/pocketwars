// The six units drafted from the gallery in October 2026 (flamethrower, royal guard, shock trooper, swordsman, missile tank, airship), the two
// weapon rules they brought (`noCounter`, `categoryMultipliers`), the leader-dependent price of a troop carrier, and the kits that use them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry } from '../../src/data/loader.js';
import { parseMap } from '../../src/data/map-format.js';
import { rawMap, makeData } from '../helpers/fixtures.js';
import { validateData } from '../../src/data/validate.js';
import { Game } from '../../src/engine/game.js';
import { calcDamage, canCounter, forecastAttack } from '../../src/engine/combat.js';
import { costFor, unitCost } from '../../src/engine/queries.js';
import { menuByPrice, menuFor } from '../../src/engine/economy.js';
import { buildMenuModel } from '../../src/ui/build-menu.js';

const registry = await loadRegistry(readData);
const legend = { '.': { terrain: 'plain' }, F: { terrain: 'forest' }, H: { terrain: 'hq', owner: 0 }, h: { terrain: 'hq', owner: 1 }, B: { terrain: 'agency', owner: 0 }, A: { terrain: 'airfield', owner: 0 } };
const players = [{ faction: 'ashmark', controller: 'human', funds: 20000 }, { faction: 'vantor_reach', controller: 'human', funds: 20000 }];
const world = (rows, unitsOnMap, p = players) => new Game(registry, parseMap(rawMap({ rows, unitsOnMap, players: p, legend }), registry));
const unit = (id) => registry.unit(id);
const weapon = (id) => registry.weapon(unit(id).weapons[0]);

// ---- the units' stats --------------------------------------------------------------------------------------------------------------------
test('flamethrower: an infantry unit whose flame cannot be answered, that can still answer a blow itself', () => {
  assert.equal(unit('flamethrower').name, 'Flamethrower');
  assert.equal(registry.units.flame_trooper, undefined, 'renamed, not duplicated');
  assert.equal(weapon('flamethrower').noCounter, true);
  const g = world(['H....h', '......'], [['flamethrower', 0, 2, 0], ['soldier', 1, 3, 0]]);
  const [flame, soldier] = g.state.units;
  const f = forecastAttack(g, flame, soldier);
  assert.ok(f.damage > 0 && !f.destroyed, 'it hurts but does not kill a full-HP soldier');
  assert.equal(f.counter, null, 'the preview shows no reply');
  assert.equal(canCounter(g, soldier, flame), false);
  g.act({ unitId: flame.id, to: { x: 2, y: 0 }, action: { type: 'attack', targetId: soldier.id } });
  assert.equal(flame.hp, 10, 'the soldier never hit back');
  // the other way round the flamethrower is an ordinary infantryman: it answers a soldier's rifle
  const h = world(['H....h', '......'], [['flamethrower', 1, 2, 0], ['soldier', 0, 3, 0]]);
  const back = forecastAttack(h, h.state.units[1], h.state.units[0]);
  assert.ok(back.counter > 0, 'a soldier that attacks a flamethrower is answered');
});

test('swordsman: bonus damage against infantry, little against anything else, and it cannot shoot aircraft', () => {
  const w = weapon('swordsman');
  assert.ok(w.categoryMultipliers.infantry > 1);
  assert.equal(w.targets.includes('low_air'), false, 'a blade does not reach a helicopter');
  const g = world(['H....h', '......'], [['swordsman', 0, 2, 0], ['soldier', 1, 3, 0], ['tank', 1, 2, 1], ['soldier', 0, 0, 1]]);
  const [sword, soldier, tank, mine] = g.state.units;
  const vsInfantry = calcDamage(g, sword, soldier), vsTank = calcDamage(g, sword, tank);
  const rifle = calcDamage(g, mine, soldier, { x: 3, y: 1 });
  assert.ok(vsInfantry > rifle, `the swordsman (${vsInfantry}) out-hurts a soldier's rifle (${rifle}) against infantry`);
  assert.ok(vsTank < vsInfantry / 3, `and does little to a tank (${vsTank})`);
  const marine = world(['H....h', '......'], [['swordsman', 0, 2, 0], ['marine', 1, 3, 0]]);
  assert.ok(calcDamage(marine, marine.state.units[0], marine.state.units[1]) > 0, 'the amphibious infantry count as infantry too');
});

test('royal guard: an armour stat, so rifles and machine guns do less to it than to a soldier, but armour-piercing weapons do not', () => {
  assert.ok(unit('royal_guard').armor > 0, 'it has armour');
  assert.equal(unit('soldier').armor, 0);
  const g = world(['H....h', '......'], [['soldier', 1, 3, 0], ['royal_guard', 1, 3, 1], ['soldier', 0, 0, 1], ['tank', 0, 0, 0]]);
  const [plain, guard, shooter, tank] = g.state.units;
  const from = (t) => ({ x: t.x - 1, y: t.y });   // standing right beside the target
  assert.ok(calcDamage(g, shooter, guard, from(guard)) < calcDamage(g, shooter, plain, from(plain)), 'a rifle does less to the guard');
  assert.equal(calcDamage(g, tank, guard, from(guard)), calcDamage(g, tank, plain, from(plain)), 'a tank cannon pierces the plating');
  assert.equal(unit('royal_guard').attributes.capture, true, 'as a leader\'s basic infantry it has to capture');
});

test('shock trooper: hits harder than a soldier, with the same body', () => {
  assert.ok(weapon('shock_trooper').damage > weapon('soldier').damage);
  assert.equal(unit('shock_trooper').toughness, unit('soldier').toughness);
  assert.equal(unit('shock_trooper').armor, unit('soldier').armor);
  assert.ok(unit('shock_trooper').cost > unit('soldier').cost, 'and costs more for it');
});

test('missile tank: a tank body with a rocket buggy\'s kind of weapon', () => {
  const t = unit('tank'), m = unit('missile_tank'), buggy = weapon('rocket_buggy'), mw = weapon('missile_tank');
  assert.equal(m.moveClass, t.moveClass);
  assert.equal(m.toughness, t.toughness);
  assert.equal(m.armor, t.armor);
  assert.deepEqual(mw.range, buggy.range, 'it reaches two tiles like the buggy');
  assert.deepEqual(mw.targets, buggy.targets);
  assert.equal(mw.siege, true);
  assert.ok(m.attributes.ammo.max >= 2 && mw.ammo === 1, 'a limited magazine');
  assert.ok(m.cost > t.cost, 'a missile tank costs more than a plain tank');
});

test('airship: the bomber\'s bombs on a tougher, slower hull', () => {
  const a = unit('airship'), b = unit('bomber');
  assert.deepEqual(a.weapons, b.weapons);
  assert.ok(a.toughness > b.toughness && a.armor > b.armor, 'tough');
  assert.ok(a.move < b.move, 'slow');
  assert.equal(a.layer, 'high_air');
  assert.ok(a.attributes.fuel.max > 0, 'every plane has a fuel tank');
});

// ---- weapon rules ------------------------------------------------------------------------------------------------------------------------
test('validation: noCounter must be true, and categoryMultipliers must map known unit categories to positive numbers', () => {
  const bad = (weapons) => validateData(makeData({ weapons })).join('\n');
  assert.match(bad({ w: { noCounter: false } }), /noCounter/);
  assert.match(bad({ w: { categoryMultipliers: {} } }), /categoryMultipliers/);
  assert.match(bad({ w: { categoryMultipliers: { infantry: 0 } } }), /categoryMultipliers/);
  assert.equal(bad({ w: { noCounter: true, categoryMultipliers: { vehicle: 2 } } }).includes('noCounter'), false);
});

// ---- the carriers' price -------------------------------------------------------------------------------------------------------------------
const gameFor = (leader) => world(['H....h', '......'], [], [{ ...players[0], leader }, players[1]]);

test('a troop carrier costs more for a leader whose basic infantry costs more than a soldier, and less for one whose infantry is cheaper', () => {
  const base = unit('transport_copter').cost;
  const price = (leader, id = 'transport_copter') => costFor(gameFor(leader), 0, id);
  assert.equal(price(null), base, 'no leader: soldiers');
  assert.equal(price('harlan'), base, 'a soldier carrier is the listed price');
  assert.ok(price('lysandra') > base, 'royal guards are dearer than soldiers');
  assert.ok(price('dmitri') < base, 'conscripts are cheaper');
  const order = ['dmitri', 'harlan', 'hiroshi', 'ludwig', 'rex', 'chase', 'lysandra', 'ada'].map((l) => [l, registry.unit(registry.loadoutFor(l).infantry).cost]);
  for (const [a, b] of order.flatMap((x, i) => order.slice(i + 1).map((y) => [x, y]))) {
    if (a[1] < b[1]) assert.ok(price(a[0]) <= price(b[0]), `${a[0]} (infantry ${a[1]}) pays no more than ${b[0]} (infantry ${b[1]})`);
  }
  for (const carrier of ['apc', 'troop_transport']) assert.ok(price('lysandra', carrier) > price('dmitri', carrier), carrier);
});

test('a carrier is priced for what it carries: the listed price plus the full cost difference of every drop it holds', () => {
  assert.equal(registry.rules.carrierCargoRate, 1, 'the whole difference is passed on, so dearer infantry gains no discount');
  for (const id of ['transport_copter', 'apc', 'troop_transport']) {
    const def = unit(id);
    const cfg = def.attributes.deploy;
    const drops = Math.floor(def.attributes.ammo.max / (cfg.ammo ?? 1));
    for (const leader of ['harlan', 'ada', 'dmitri', 'lysandra', 'hiroshi']) {
      const cargo = registry.unit(registry.loadoutFor(leader).infantry);
      const expected = def.cost + (cargo.cost - registry.unit(cfg.unit).cost) * drops;
      assert.equal(costFor(gameFor(leader), 0, id), Math.round(expected / 100) * 100, `${id} for ${leader}`);
    }
  }
});

test('only troop carriers have a leader-dependent price', () => {
  const g = gameFor('lysandra');
  for (const id of registry.unitIds) if (!registry.unit(id).attributes.deploy) assert.equal(costFor(g, 0, id), registry.unit(id).cost, id);
  assert.equal(costFor(g, 0, 'transport_copter') % 100, 0, 'rounded to the nearest 100');
});

test('the price is what the build check, the build menu and the funds use, and units on the board are worth it', () => {
  const g = world(['H..A.h', '......'], [], [{ ...players[0], leader: 'lysandra', funds: 100000 }, players[1]]);
  const price = costFor(g, 0, 'transport_copter');
  assert.notEqual(price, unit('transport_copter').cost);
  assert.ok(menuFor(g, 0, 3, 0).some((u) => u.id === 'transport_copter'), 'Lysandra can build one');
  assert.equal(buildMenuModel(g, 0, 3, 0).options.find((o) => o.id === 'transport_copter').cost, price, 'the menu shows it');
  g.state.funds[0] = price - 100;
  assert.equal(g.build(3, 0, 'transport_copter').error, 'not-enough-funds');
  g.state.funds[0] = price + 250;
  assert.equal(g.build(3, 0, 'transport_copter').ok, true);
  assert.equal(g.state.funds[0], 250, 'charged the leader\'s price');
  assert.equal(unitCost(g, g.state.units[0]), price);
});

test('a carrier deploys the leader\'s basic infantry (a motorcycle for Chase)', () => {
  const g = world(['H.A..h', '......'], [['soldier', 1, 5, 1]], [{ ...players[0], leader: 'chase', funds: 100000 }, players[1]]);
  assert.equal(g.build(2, 0, 'transport_copter').ok, true);
  g.endTurn(); g.endTurn();
  const copter = g.state.units.find((u) => u.type === 'transport_copter');
  const res = g.deploy({ unitId: copter.id });
  assert.equal(res.ok, true);
  assert.equal(g.state.units.find((u) => u.id === res.deployed.unitId).type, 'motorcycle');
});

// ---- the kits ---------------------------------------------------------------------------------------------------------------------------
const kit = (leader) => registry.loadoutFor(leader);
const menu = (leader, building) => kit(leader).build[building] ?? registry.loadouts.default.build[building];

test('every faction builds its own infantry at the HQ: Lysandra royal guard, Ludwig shock trooper, Hiroshi swordsman, Chase motorcycle', () => {
  assert.equal(kit('lysandra').infantry, 'royal_guard');
  assert.equal(kit('ludwig').infantry, 'shock_trooper');
  assert.equal(kit('hiroshi').infantry, 'swordsman');
  assert.equal(kit('chase').infantry, 'motorcycle');
  for (const leader of registry.leaderIds) assert.deepEqual(kit(leader).build.hq, [kit(leader).infantry], `${leader}'s HQ builds their infantry and nothing else`);
  assert.deepEqual(registry.loadouts.default.build.hq, ['soldier']);
  for (const leader of ['lysandra', 'ludwig', 'hiroshi', 'chase']) assert.ok(!Object.values(kit(leader).build).flat().includes('soldier'), `${leader} has no soldier`);
});

test('each leader builds only their own roster: the old units, spread over the fixed building menus', () => {
  const rosters = {
    harlan: ['medic', 'sniper', 'mech', 'vintage_fighter', 'vintage_bomber', 'torpedo_bomber', 'recon', 'artillery', 'apc', 'flak', 'tank', 'heavy_tank', 'destroyer', 'troop_transport', 'cruiser', 'battleship'],
    ada: ['missile_tank', 'rocket_launcher', 'rocket_buggy', 'sam_launcher', 'gun_boat', 'hunter_sub'],
    ludwig: ['hover_tank', 'stealth_copter', 'radar_plane', 'missile_sub'],
    chase: ['hover_tank', 'heavy_tank', 'stealth_fighter', 'aircraft_carrier'],
    rex: ['amphibious_tank', 'torpedo_bomber', 'aircraft_carrier', 'hunter_sub'],
    dmitri: ['airship', 'heavy_tank', 'missile_sub', 'torpedo_bomber'],
    lysandra: ['stealth_bomber', 'dreadnought', 'radar_plane'],
    hiroshi: ['dreadnought', 'heavy_tank', 'mortar'],
    vex: ['stealth_copter', 'missile_sub', 'diver'],
  };
  for (const [leader, units] of Object.entries(rosters)) for (const u of units) assert.ok(kit(leader).roster.includes(u), `${leader} builds ${u}`);
  assert.ok(!kit('ada').roster.includes('tank') && !kit('ludwig').roster.includes('tank'), 'Ada and Ludwig have no plain tank');
  assert.ok(!kit('lysandra').roster.includes('marine') && !kit('chase').roster.includes('flak'));
  for (const leader of registry.leaderIds) assert.ok(!('unlock' in kit(leader)), 'no leader unlocks a lab unit any more');
});

test('the default menus list every unit a building can build; a leader\'s roster cuts them down', () => {
  const b = registry.loadouts.default.build;
  assert.deepEqual([...b.garage].sort(), ['mechanic', 'recon', 'rocket_buggy']);
  assert.deepEqual([...b.chemical_plant].sort(), ['flamethrower', 'mine_layer', 'rocket_launcher']);
  assert.ok(['mech', 'tank', 'flak', 'heavy_tank', 'hover_tank', 'missile_tank', 'amphibious_tank', 'stealth_tank'].every((u) => b.factory.includes(u)));
  const menuAt = (leader, building, labs = []) => {
    const glyphs = { factory: 'f', airfield: 'a', shipyard: 'y', sub_pen: 's', airbase: 'x', chemical_plant: 'c', support_factory: 'u' };
    const lg = { ...legend, ...Object.fromEntries(Object.entries(glyphs).map(([t, g]) => [g, { terrain: t, owner: 0 }])), 1: { terrain: 'hover_lab', owner: 0 }, 2: { terrain: 'stealth_lab', owner: 0 }, 3: { terrain: 'heavy_lab', owner: 0 }, 4: { terrain: 'missile_lab', owner: 0 } };
    const row = `H${glyphs[building]}${labs.join('')}h`.padEnd(6, '.');
    const g = new Game(registry, parseMap(rawMap({ rows: [row, '.'.repeat(6)], unitsOnMap: [], players: [{ ...players[0], leader }, players[1]], legend: lg }), registry));
    return menuFor(g, 0, 1, 0).map((d) => d.id).sort();
  };
  assert.deepEqual(menuAt('harlan', 'factory'), ['flak', 'heavy_tank', 'mech', 'tank'], 'Harlan: his tanks and the AT infantry');
  assert.deepEqual(menuAt('ada', 'factory'), ['missile_tank'], 'Ada: only her missile tank');
  assert.deepEqual(menuAt('rex', 'factory'), ['amphibious_tank', 'flak'], 'Rex: the amphibious tank and flak');
  assert.deepEqual(menuAt('harlan', 'airfield'), ['torpedo_bomber', 'vintage_bomber', 'vintage_fighter']);
  assert.deepEqual(menuAt('vex', 'airfield'), ['stealth_copter', 'transport_copter']);
  assert.deepEqual(menuAt('harlan', 'chemical_plant'), ['flamethrower'], 'Harlan: one unit of his own at each building');
  assert.deepEqual(menuAt('lysandra', 'shipyard'), ['cruiser', 'destroyer', 'dreadnought']);
  // a lab swaps a unit for its upgrade, but only where the leader has the unit
  assert.deepEqual(menuAt('harlan', 'factory', ['1']), ['flak', 'heavy_tank', 'hover_tank', 'mech'], 'the hover lab: tank -> hover tank');
  assert.deepEqual(menuAt('harlan', 'factory', ['1', '2']), ['flak', 'heavy_tank', 'hover_tank', 'mech', 'stealth_tank'], 'two labs offer both upgrades');
  assert.deepEqual(menuAt('harlan', 'shipyard', ['3']), ['cruiser', 'destroyer', 'dreadnought'], 'the heavy lab: battleship -> dreadnought');
  assert.deepEqual(menuAt('ada', 'factory', ['1']), ['missile_tank'], 'Ada has no tank, so the hover lab gives her nothing');
  assert.deepEqual(menuAt('harlan', 'sub_pen', ['4']), ['missile_sub'], 'Harlan has the submarine, so the missile lab upgrades it');
  assert.deepEqual(menuAt('ada', 'sub_pen', ['4']), ['hunter_sub'], 'Ada has no submarine, so the missile lab does nothing for her');
  assert.deepEqual(menuAt('chase', 'sub_pen', ['4']), ['missile_sub'], 'the missile lab: submarine -> missile sub');
});

test('every build menu is listed cheapest first for its leader, whatever order the data lists the units in', () => {
  for (const leader of [null, ...registry.leaderIds]) {
    const g = gameFor(leader);
    for (const [building, ids] of Object.entries(kit(leader).build)) {
      const shuffled = [...ids].reverse().map((id) => registry.unit(id));
      const costs = menuByPrice(g, 0, shuffled).map((d) => costFor(g, 0, d.id));
      assert.deepEqual(costs, [...costs].sort((a, b) => a - b), `${leader ?? 'default'} ${building}: ${ids.join(', ')}`);
    }
  }
});

test('flamethrower: some armour piercing (less than the RPG trooper and mech) and a +5 capture bonus', () => {
  const ap = weapon('flamethrower').armorPiercing;
  assert.ok(ap > 0 && ap < registry.weapon(unit('rpg_trooper').weapons[0]).armorPiercing && ap < registry.weapon(unit('mech').weapons[0]).armorPiercing);
  assert.deepEqual(unit('flamethrower').attributes.capture, { bonus: 5 });
});

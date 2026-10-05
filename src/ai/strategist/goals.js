// Where each unit is heading this turn. A goal list is [[x, y, headStart], ...]: the unit walks down the distance field toward the
// nearest one, and a head start makes a goal count as that much further away (so better goals win ties and near-ties).
//
// Every goal is checked against the landmasses (analysis.js): a unit is only sent where its kind of movement can actually get, so a
// tank on an island looks for work on its island (guarding it against landings) instead of standing on the shore facing the enemy.
//
//   planCaptures(sit)         assigns each capturer a property of its own to take (no three soldiers walking to one city)
//   goalsFor(sit, unit)       { kind, tiles } for one unit: 'refuel' | 'resupply' | 'repair' | 'heal' | 'supply' | 'escort' | 'capture'
//                             | 'land' | 'attack' | 'objective' | 'rally' | 'guard'
//   landingTiles(sit, unit)   for a carrier: the tiles it could drop its troops from, toward land worth taking

import { ammoLevel, resupplyCost } from '../../engine/ammo.js';
import { attributeConfig, hasAttribute } from '../../engine/attributes.js';
import { ammoOf } from '../../engine/ammo.js';
import { deployConfig, deployCost } from '../../engine/deploy.js';
import { fuelHomes, fuelOf, usesFuel } from '../../engine/fuel.js';
import { supplyConfig } from '../../engine/supply.js';
import { deployedType, distance, inBounds, unitDef } from '../../engine/queries.js';
import { isStructure } from '../../engine/structures.js';
import { areaAt, areas, gapTo, inRangeOf } from './analysis.js';
import { matchup, reachOf, roles } from './knowledge.js';

const W = (game) => game.map.width;
const passable = (game, mc, x, y) => inBounds(game.map, x, y) && game.registry.terrainDef(game.map.terrain[y][x]).moveCost[mc] != null;
const isHq = (p) => hasAttribute(p.terrain, 'victoryOnCapture');

/** The landmasses (for `mc`) a unit at (x, y) is on or right next to (a unit just dropped on the water's edge, a ship at its shipyard). */
export function areasAround(game, mc, x, y) {
  const out = new Set();
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (!inBounds(game.map, x + dx, y + dy)) continue;
    const a = areaAt(game, mc, x + dx, y + dy);
    if (a >= 0) out.add(a);
  }
  return out;
}

/** Could a unit of move class `mc` on any of `ids` get within `range` of (x, y)? */
const canGet = (game, mc, ids, x, y, range) => [...ids].some((id) => inRangeOf(game, mc, id, x, y, range));

/** Ring of tiles at distance lo..hi around (x, y) that `mc` can stand on, in `ids`. */
function ring(game, mc, ids, x, y, lo, hi, start = 0, out = []) {
  for (let dy = -hi; dy <= hi; dy++) {
    for (let dx = -hi; dx <= hi; dx++) {
      const d = Math.abs(dx) + Math.abs(dy);
      if (d < lo || d > hi) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (!passable(game, mc, nx, ny) || !ids.has(areaAt(game, mc, nx, ny))) continue;
      out.push([nx, ny, start]);
    }
  }
  return out;
}

/**
 * How far from a refuelling spot a flier can go and still get back: half its fuel (in turns, plus the turn it gets on an empty tank)
 * times its move. Infinity for a unit without fuel. `homes` are the [x, y] of its refuelling spots (fuel.js fuelHomes).
 */
export function roundTrip(game, def) {
  const cfg = attributeConfig(def, 'fuel');
  return cfg ? Math.floor((cfg.max + 1) / 2) * def.move : Infinity;
}

/** The refuelling spots of a type for a player: their properties that resupply its category (for a type with no unit yet). */
export const fuelSpots = (sit, def) => sit.properties.filter((p) => p.owner === sit.player && p.terrain.attributes.resupply?.categories.includes(def.category)).map((p) => [p.x, p.y]);

const propertyValue = (sit, p) => p.property.income / 1000 + (p.property.builds?.length ? 1.5 : 0) + (isHq(p) && p.owner !== null ? 4 : 0);

/** Give every capturer its own property to take this turn (sit.captureTargets: unitId -> property). */
export function planCaptures(sit) {
  const { game, player } = sit;
  sit.captureTargets = new Map();
  const capturers = sit.mine.filter((u) => roles(unitDef(game, u)).capture && !isStructure(game, u));
  const wanted = sit.properties.filter((p) => p.owner !== player);
  const taken = new Map();   // tile -> number of capturers on it
  const free = [];
  for (const u of capturers) {
    const here = wanted.find((p) => p.x === u.x && p.y === u.y);
    if (here && u.capture > 0) { sit.captureTargets.set(u.id, here); taken.set(here.y * W(game) + here.x, 1); } else free.push(u);
  }
  const hqFirst = sit.tactics.target === 'hq' ? 6 : 0;
  const pairs = [];
  for (const u of free) {
    const mc = unitDef(game, u).moveClass;
    const ids = areasAround(game, mc, u.x, u.y);
    for (const p of wanted) {
      if (!canGet(game, mc, ids, p.x, p.y, 0)) continue;
      const value = propertyValue(sit, p) + (isHq(p) && p.owner !== null ? hqFirst : 0);
      pairs.push({ u, p, score: value / (distance(u.x, u.y, p.x, p.y) / Math.max(1, unitDef(game, u).move) + 1.5) });
    }
  }
  pairs.sort((a, b) => b.score - a.score);
  const done = new Set();
  for (const { u, p } of pairs) {
    if (done.has(u.id)) continue;
    const k = p.y * W(game) + p.x;
    if ((taken.get(k) ?? 0) >= (isHq(p) && p.owner !== null ? 2 : 1)) continue;
    taken.set(k, (taken.get(k) ?? 0) + 1);
    sit.captureTargets.set(u.id, p);
    done.add(u.id);
  }
}

/** Repair spots for `unit`: its own properties it can stand on, or the water next to one it cannot enter (a ship by its shipyard). */
function repairTiles(sit, unit, mc, ids) {
  const { game, player } = sit;
  const out = [];
  for (const p of sit.properties) {
    if (p.owner !== player) continue;
    if (passable(game, mc, p.x, p.y)) { if (ids.has(areaAt(game, mc, p.x, p.y))) out.push([p.x, p.y, p.property.builds?.length ? 2 : 0]); continue; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = p.x + dx;
      const y = p.y + dy;
      if (passable(game, mc, x, y) && ids.has(areaAt(game, mc, x, y))) out.push([x, y, 0]);
    }
  }
  return out;
}

/**
 * Where a carrier could put its troops ashore: tiles it can reach (its own landmass, anywhere for a flier) right next to (or on) the
 * landmass of a property worth taking, within the troops' walk of it. Land that walkers cannot reach from home (an island) and the enemy
 * HQ come first. Returns [x, y, headStart] goals, and remembers the targets on sit (for the deploy decision).
 */
export function landingTiles(sit, unit) {
  const { game, player } = sit;
  const def = unitDef(game, unit);
  const cargoType = deployedType(game, unit);
  if (!cargoType) return [];
  const cargo = game.registry.unit(cargoType);
  if (!roles(cargo).capture) return [];
  const mc = def.moveClass;
  const ids = areasAround(game, mc, unit.x, unit.y);
  // the landmasses our walkers already get to from home: taking land there is the capturers' job
  const home = new Set();
  for (const p of sit.properties) if (p.owner === player) for (const a of areasAround(game, cargo.moveClass, p.x, p.y)) home.add(a);
  const assigned = new Set([...sit.captureTargets.values()].map((p) => p.y * W(game) + p.x));
  const targets = [];
  for (const p of sit.properties) {
    if (p.owner === player || assigned.has(p.y * W(game) + p.x)) continue;
    const area = areaAt(game, cargo.moveClass, p.x, p.y);
    if (area < 0) continue;
    const island = !home.has(area);
    const value = propertyValue(sit, p) + (island ? 3 : 0);
    targets.push({ p, area, value });
  }
  targets.sort((a, b) => b.value / (1 + distance(unit.x, unit.y, b.p.x, b.p.y) / 8) - a.value / (1 + distance(unit.x, unit.y, a.p.x, a.p.y) / 8));
  const best = targets.slice(0, 6);
  if (!best.length) return [];
  const top = best[0].value;
  const out = [];
  const reachIn = cargo.move + 1;
  // a flier only goes where it can drop its troops and still get back to refuel
  const range = roundTrip(game, def);
  const homes = range < Infinity ? fuelHomes(game, unit) : [];
  const inRange = (x, y) => range === Infinity || homes.some(([hx, hy]) => distance(x, y, hx, hy) <= range);
  for (const t of best) {
    const gap = gapTo(game, cargo.moveClass, t.area);
    for (let dy = -reachIn; dy <= reachIn; dy++) {
      for (let dx = -reachIn; dx <= reachIn; dx++) {
        const x = t.p.x + dx;
        const y = t.p.y + dy;
        if (Math.abs(dx) + Math.abs(dy) > reachIn || !passable(game, mc, x, y) || !ids.has(areaAt(game, mc, x, y))) continue;
        if (gap[y * W(game) + x] > 1 || !inRange(x, y)) continue;
        out.push([x, y, Math.max(0, (top - t.value) * 1.5)]);
      }
    }
  }
  sit.landing ??= new Map();
  sit.landing.set(unit.id, range === Infinity ? best : best.filter((t) => homes.some(([hx, hy]) => distance(t.p.x, t.p.y, hx, hy) <= range + reachIn)));
  return out;
}

/** The enemy positions `unit` could fight from: tiles in its weapons' range of each enemy it can hurt and can get near. */
function attackGoals(sit, unit, mc, ids, start = 0) {
  const { game } = sit;
  const def = unitDef(game, unit);
  const { min, max } = reachOf(game.registry, def);
  const out = [];
  if (!max) return out;
  for (const e of sit.army) {
    const dmg = matchup(game, unit.type, e.type);
    if (dmg <= 0.5) continue;
    if (!canGet(game, mc, ids, e.x, e.y, max)) continue;
    const weak = Math.max(0, 3 - dmg / 2);   // prefer what it hurts most
    ring(game, mc, ids, e.x, e.y, Math.max(1, min), max, start + weak, out);
  }
  return out;
}

/** Tiles around enemy (or unowned) properties: where an army that is not capturing should be pressing. */
function objectiveGoals(sit, unit, mc, ids, start, hqOnly) {
  const { game, player } = sit;
  const out = [];
  for (const p of sit.properties) {
    if (p.owner === player || p.owner === null || (hqOnly && !isHq(p))) continue;
    if (!canGet(game, mc, ids, p.x, p.y, 1)) continue;
    ring(game, mc, ids, p.x, p.y, 1, 2, start + (isHq(p) ? 0 : 3), out);
  }
  return out;
}

/** Home: tiles around own HQ and production, for a unit with nothing it can get at (an army stuck on an island guards it). */
function guardGoals(sit, unit, mc, ids) {
  const { game, player } = sit;
  const out = [];
  for (const p of sit.properties) {
    if (p.owner !== player) continue;
    const weight = isHq(p) ? 0 : p.property.builds?.length ? 2 : 4;
    ring(game, mc, ids, p.x, p.y, 1, 2, weight, out);
  }
  return out;
}

/** A rally point while the army masses: the ring around our property nearest the enemy HQ (or the enemy army). */
function rallyGoals(sit, unit, mc, ids) {
  const { game, player } = sit;
  const enemyHqs = sit.properties.filter((p) => isHq(p) && p.owner !== player && p.owner !== null);
  const toward = enemyHqs.length ? enemyHqs : sit.army.map((e) => ({ x: e.x, y: e.y }));
  if (!toward.length) return [];
  let best = null;
  for (const p of sit.properties) {
    if (p.owner !== player || !canGet(game, mc, ids, p.x, p.y, 1)) continue;
    const d = Math.min(...toward.map((t) => distance(p.x, p.y, t.x, t.y)));
    if (!best || d < best.d) best = { p, d };
  }
  return best ? ring(game, mc, ids, best.p.x, best.p.y, 1, 2) : [];
}

export function goalsFor(sit, unit) {
  const { game, player, params, tactics } = sit;
  const def = unitDef(game, unit);
  const mc = def.moveClass;
  const ids = areasAround(game, mc, unit.x, unit.y);
  const r = roles(def);
  const result = (kind, tiles) => ({ kind, tiles });

  // a flier low on fuel turns home in time (fuel is in turns, and an empty tank still gets one to reach a refill), unless it is a carrier
  // that can make its drop this turn and still get home from there
  if (usesFuel(game, unit)) {
    const homes = fuelHomes(game, unit);
    if (homes.length) {
      const homeFrom = (x, y) => Math.min(...homes.map(([hx, hy]) => distance(x, y, hx, hy)));
      const away = homeFrom(unit.x, unit.y);
      const fuel = fuelOf(game, unit);
      if (away > 0 && fuel <= Math.ceil(away / def.move)) {
        const land = r.carrier && (ammoOf(game, unit) ?? 1) >= deployCost(deployConfig(game, unit)) ? landingTiles(sit, unit) : [];
        const drop = land.filter(([x, y]) => distance(unit.x, unit.y, x, y) <= def.move && Math.ceil(homeFrom(x, y) / def.move) <= fuel);
        if (drop.length) return result('land', drop);
        return result('refuel', homes);
      }
    }
  }
  // out of ammo (a carrier with no troops left), with the money to refill: back to where it is refilled
  if (ammoLevel(game, unit) === 'empty' && resupplyCost(game, unit) <= game.state.funds[player]) {
    const homes = sit.properties.filter((p) => p.owner === player && p.terrain.attributes.resupply?.categories.includes(def.category));
    const tiles = homes.flatMap((p) => ring(game, mc, ids, p.x, p.y, 0, 1));
    if (tiles.length) return result('resupply', tiles);
  }
  // badly hurt: home to be repaired (not while it is in the middle of taking a property)
  const capturing = unit.capture > 0 && sit.properties.some((p) => p.x === unit.x && p.y === unit.y && p.owner !== player);
  if (!capturing && unit.hp <= params.retreatHp * (tactics.retreat ?? 1) && sit.army.length) {
    const tiles = repairTiles(sit, unit, mc, ids);
    if (tiles.length) return result('repair', tiles);
  }
  if (r.healer) {
    const cfg = attributeConfig(def, 'heal');
    const mine = sit.mine.filter((u) => u !== unit && cfg.categories.includes(unitDef(game, u).category));
    const hurt = mine.filter((u) => u.hp < sit.maxHp);
    const chosen = (hurt.length ? hurt : mine).filter((u) => canGet(game, mc, ids, u.x, u.y, 1));
    if (chosen.length) return result('heal', chosen.flatMap((u) => ring(game, mc, ids, u.x, u.y, 1, 1)));
  }
  if (r.supplier) {
    const cfg = supplyConfig(game, unit);
    const mine = sit.mine.filter((u) => u !== unit && cfg.categories.includes(unitDef(game, u).category));
    const needy = mine.filter((v) => (ammoLevel(game, v) !== null && ammoLevel(game, v) !== 'ok') || (cfg.repair && v.hp < sit.maxHp));
    const chosen = (needy.length ? needy : mine).filter((u) => canGet(game, mc, ids, u.x, u.y, 1));
    if (chosen.length) return result('supply', chosen.flatMap((u) => ring(game, mc, ids, u.x, u.y, 1, 1)));
  }
  if (r.radar && !r.combat) {
    const army = sit.mine.filter((u) => u !== unit && !roles(unitDef(game, u)).radar && !isStructure(game, u));
    if (army.length) return result('escort', army.flatMap((u) => ring(game, mc, ids, u.x, u.y, 1, 2)));
  }
  // a carrier with troops aboard heads for a landing; an empty one with no money to reload keeps with the army
  if (r.carrier) {
    const cfg = deployConfig(game, unit);
    if ((ammoOf(game, unit) ?? 1) >= deployCost(cfg)) {
      const tiles = landingTiles(sit, unit);
      if (tiles.length) return result('land', tiles);
    }
  }
  if (r.capture) {
    const p = sit.captureTargets?.get(unit.id);
    if (p) return result('capture', [[p.x, p.y, 0]]);
  }
  // an armed unit: the enemy it can hurt and get to, the strategy's objective, or else home
  let tiles = [];
  const combatUnits = sit.mine.filter((u) => roles(unitDef(game, u)).combat && !isStructure(game, u) && !roles(unitDef(game, u)).capture).length;
  const engaged = sit.threatAt(unit, unit.x, unit.y) > 0;
  if (tactics.mass && combatUnits < tactics.mass && !engaged && sit.army.length) {
    tiles = rallyGoals(sit, unit, mc, ids);
    if (tiles.length) return result('rally', tiles);
  }
  const target = tactics.target ?? 'balanced';
  if (r.combat) {
    const fight = target === 'hq' ? 4 : target === 'properties' ? 2 : 0;
    tiles = attackGoals(sit, unit, mc, ids, fight);
    if (target !== 'army') tiles.push(...objectiveGoals(sit, unit, mc, ids, target === 'balanced' ? 6 : 0, target === 'hq'));
    if (tiles.length) return result('attack', tiles);
  }
  tiles = objectiveGoals(sit, unit, mc, ids, 0, false);
  if (tiles.length) return result('objective', tiles);
  tiles = guardGoals(sit, unit, mc, ids);
  if (tiles.length) return result('guard', tiles);
  return result('guard', [[unit.x, unit.y, 0]]);
}

export { areas };

// Computer-controlled player. Tuning (weights, build lists) lives in data/ai.json; this file only holds the logic.
//
//   chooseOrder(game, unit)  -> an order for game.act()   (one unit at a time so the UI can animate between them)
//   planBuild(game, x, y)    -> unit type id to build on that property, or null
//   buildPhase(game)         -> builds everything the profile wants; returns the events
//   playTurn(game)           -> whole turn synchronously (used by tests and headless simulation)
//
// A turn goes: every unit moves, then production, then the units just built use their free move (they are `fresh`: a move and a
// Wait only, see game.js) so they leave the properties that built them.
//
// Support units. A healer (medic, mechanic: the `heal` attribute) walks toward the friendly units it can heal, the damaged ones first, and likes
// tiles next to them (`healValue`); a radar plane stays with the army. It gives the Heal order in preference to a weak attack.
//
// Supply units (supply truck, aircraft carrier: the `supply` attribute) walk toward the friends that need ammo (or repairs, for a carrier) and
// give the Supply order next to them. A mine layer lays a mine (the Lay order) at the free tile in range closest to the enemy, while it can
// afford it and has fewer than `maxMines` mines out. A unit that can hit nothing it can see (an anti-air battery with no aircraft about, a hunter
// sub with no submarine in sight) stays with the army instead of marching into the enemy. A submerged submarine comes up before moving unless an
// enemy is close, so it travels at the surface speed (`surfaceToTravel`).
//
// Carriers (the transport copter) fly toward properties they could have captured, drop their troops once close to one (`tryDeploy`, after
// the carrier's own move; the dropped unit is then ordered like any other), and go back to an airfield for more when empty and the owner
// can pay for it. Resupply is only chosen when the unit is low or empty and the money is there.

// The AI plays fair: it only plans around enemy units it can see (detection.js), and like a human it can have a move interrupted by a
// hidden one. When act() reports that, the unit is asked again (chooseOrder on a halted unit plans from where it stopped).

import { ammoOf, ammoLevel, canResupplyAt, resupplyCost, roundCost } from './ammo.js';
import { AI_CONDITIONS } from './ai-conditions.js';
import { attributeConfig, hasAttribute } from './attributes.js';
import { canCapture } from './capture.js';
import { canHealAt } from './heal.js';
import { canSupplyAt, supplyConfig, supplyPlan } from './supply.js';
import { isMine, layConfig, layTiles } from './mines.js';
import { calcDamage, canAttackFrom, canTarget } from './combat.js';
import { canSee } from './detection.js';
import { canDeploy, deployConfig, deployReach } from './deploy.js';
import { buildProblem, menuFor } from './economy.js';
import { computeReach, distanceField, canFireAfterMoving, hasMovedAlready } from './movement.js';
import { allProperties, distance, ownerAt, propertyAt, terrainAt, tileIndex, unitDef } from './queries.js';
import { canSubmergeAt, canSurface } from './submerge.js';

/** The friendly units `unit` (a healer) could heal, by the categories of its `heal` attribute. */
function healable(game, unit) {
  const cfg = attributeConfig(unitDef(game, unit), 'heal');
  if (!cfg) return [];
  return game.state.units.filter((u) => u !== unit && u.owner === unit.owner && cfg.categories.includes(unitDef(game, u).category));
}

/** A healer likes a tile for the HP it would restore from there (what a unit next to it is missing, up to its heal amount, at the unit's price). */
function healScore(game, unit, x, y, w) {
  const cfg = attributeConfig(unitDef(game, unit), 'heal');
  if (!cfg) return 0;
  const max = game.registry.rules.maxHp;
  let score = 0;
  for (const u of healable(game, unit)) {
    if (distance(x, y, u.x, u.y) !== 1 || u.hp >= max) continue;
    score += Math.min(cfg.amount, max - u.hp) * unitDef(game, u).cost / w.costUnit * (w.healValue ?? 2);
  }
  return score;
}

/** Does friendly `v` need something a unit with the `supply` config `cfg` gives (rounds, or HP when it repairs)? */
const needsSupply = (game, cfg, v) => cfg.categories.includes(unitDef(game, v).category)
  && ((ammoLevel(game, v) !== null && ammoLevel(game, v) !== 'ok') || (!!cfg.repair && v.hp < game.registry.rules.maxHp));

/** What a Supply order from (x, y) is worth to the AI: the price of the rounds and the HP it would give, in the profile's cost units. */
function supplyScore(game, unit, x, y, w) {
  return supplyPlan(game, unit, x, y).reduce((a, p) => a + (p.rounds * roundCost(game, p.unit) + p.hp * unitDef(game, p.unit).cost / game.registry.rules.maxHp) / w.costUnit, 0);
}

/**
 * Tiles worth walking toward: capturers head for properties they don't own, everyone else for enemy units.
 * With nothing to chase, units march on the enemy HQ (any victoryOnCapture property they don't own).
 */
function goalTiles(game, unit) {
  const { state, map } = game;
  // out of ammo (and able to pay for more): back to the property that refills it
  if (ammoLevel(game, unit) === 'empty' && resupplyCost(game, unit) <= state.funds[unit.owner]) {
    const category = unitDef(game, unit).category;
    const homes = allProperties(game).filter((p) => p.owner === unit.owner && p.terrain.attributes.resupply?.categories.includes(category)).map((p) => [p.x, p.y]);
    if (homes.length) return homes;
  }
  const def = unitDef(game, unit);
  // a healer goes to its wounded (or, with none, to the units it looks after); a radar plane stays with the army
  if (hasAttribute(def, 'heal')) {
    const mine = healable(game, unit);
    const hurt = mine.filter((u) => u.hp < game.registry.rules.maxHp);
    const chosen = hurt.length ? hurt : mine;
    if (chosen.length) return chosen.map((u) => [u.x, u.y]);
  }
  if (hasAttribute(def, 'radar') && !def.weapons.length) {
    const army = state.units.filter((u) => u !== unit && u.owner === unit.owner && !hasAttribute(unitDef(game, u), 'radar'));
    if (army.length) return army.map((u) => [u.x, u.y]);
  }
  const sup = supplyConfig(game, unit);
  if (sup) {   // a supplier goes to the friends that need it, or else stays with the ones it looks after
    const mine = state.units.filter((u) => u !== unit && u.owner === unit.owner && sup.categories.includes(unitDef(game, u).category));
    const needy = mine.filter((u) => needsSupply(game, sup, u));
    const chosen = needy.length ? needy : mine;
    if (chosen.length) return chosen.map((u) => [u.x, u.y]);
  }
  if (def.weapons.length && !deployConfig(game, unit)) {   // armed, but nothing it can see is a target (SAM with no aircraft about): it keeps to the army
    const visible = state.units.filter((e) => e.owner !== unit.owner && canSee(game, unit.owner, e));
    if (visible.length && !visible.some((e) => canTarget(game, unit, e))) {
      const army = state.units.filter((u) => u !== unit && u.owner === unit.owner && !isMine(game, u));
      if (army.length) return army.map((u) => [u.x, u.y]);
    }
  }
  if (hasAttribute(def, 'capture') || deployConfig(game, unit)) {   // a carrier takes its troops where they can capture
    const props = allProperties(game).filter((p) => p.owner !== unit.owner).map((p) => [p.x, p.y]);
    if (props.length) return props;
  }
  const seen = state.units.filter((e) => e.owner !== unit.owner && canSee(game, unit.owner, e));
  const hunted = def.weapons.length ? seen.filter((e) => canTarget(game, unit, e)) : seen;   // a hunter sub only chases submarines
  if (hunted.length) return hunted.map((e) => [e.x, e.y]);
  const hqs = allProperties(game).filter((p) => p.owner !== unit.owner && hasAttribute(p.terrain, 'victoryOnCapture')).map((p) => [p.x, p.y]);
  if (hqs.length) return hqs;
  return [[Math.floor(map.width / 2), Math.floor(map.height / 2)]];
}

export function chooseOrder(game, unit, ai = game.registry.ai) {
  const { map, state } = game;
  const w = ai.weights;
  const def = unitDef(game, unit);
  const reach = computeReach(game, unit);
  const enemies = state.units.filter((e) => e.owner !== unit.owner && canSee(game, unit.owner, e));
  const goals = goalTiles(game, unit);
  const field = distanceField(game, def.moveClass, goals);
  const movedAlready = hasMovedAlready(unit);   // an interrupted move counts: indirect weapons cannot fire after it
  const mayAct = !unit.fresh;                   // a freshly built unit only gets its free move: no attack, capture or dive
  const mayFire = (moved) => mayAct && (!(moved || movedAlready) || canFireAfterMoving(game, unit));
  // Where no route to a goal exists for this kind of unit (a ship whose enemy is inland), it still closes in as the crow flies.
  const fallback = (x, y) => w.unreachableDistance + Math.min(...goals.map(([gx, gy]) => distance(x, y, gx, gy))) * (w.crowFlies ?? .1);

  let best = null;
  for (const { x, y } of reach.tiles()) {
    const moved = x !== unit.x || y !== unit.y;
    if (unit.carriedBy && !moved && reach.size > 1) continue;   // a unit just deployed has to leave its carrier's tile
    // cover only matters to a unit that gets it (aircraft ignore it)
    const defense = hasAttribute(def, 'ignoresTerrainDefense') ? 0 : terrainAt(game, x, y).defense * (attributeConfig(def, 'terrainDefenseMultiplier') ?? 1);
    let score = -(field.get(tileIndex(map, x, y)) ?? fallback(x, y)) * w.distanceToGoal + defense * w.terrainDefense + healScore(game, unit, x, y, w);
    let target = null;
    let capture = false;
    let heal = false;
    let supply = false;

    if (mayFire(moved)) {
      for (const e of enemies) {
        if (!canAttackFrom(game, unit, e, x, y)) continue;
        const dmg = calcDamage(game, unit, e, { x, y });
        if (dmg <= 0) continue;
        const value = (dmg * game.registry.unit(e.type).cost) / w.costUnit + (dmg >= e.hp ? w.killBonus : 0);
        if (!target || value > target.value) target = { e, value };
      }
    }
    if (target) {
      score = w.attackBase + target.value + defense;
    } else if (mayAct && canCapture(game, unit, x, y)) {
      capture = true;
      const winsGame = hasAttribute(terrainAt(game, x, y), 'victoryOnCapture');
      score = w.captureBase + (winsGame ? w.victoryCaptureBonus : 0);
    } else if (propertyAt(game, x, y) && ownerAt(game, x, y) !== unit.owner) {
      // a unit parked on someone else's property keeps everyone from capturing it: leave those tiles to the units that can
      score -= w.blockCapture ?? 0;
    }
    // a healer with someone to heal does that rather than plink with a pistol
    if (mayAct && canHealAt(game, unit, x, y)) { score = w.attackBase + healScore(game, unit, x, y, w) + defense; heal = true; target = null; capture = false; }
    // a supplier with someone to supply does that (unless it has something to shoot)
    if (mayAct && !target && canSupplyAt(game, unit, x, y)) { score = w.attackBase * .5 + supplyScore(game, unit, x, y, w) + defense; supply = true; capture = false; }
    if (!best || score > best.score) best = { x, y, score, target, capture, heal, supply };
  }

  // with nothing to shoot or capture, a submarine goes under (it cannot be hunted there without sonar, and it can still strike from there)
  const dive = mayAct && !best.target && !best.capture && !best.heal && !best.supply && canSubmergeAt(game, unit, best.x, best.y);
  const lay = mayAct && !best.target && !best.capture && !best.heal && !best.supply ? layOrder(game, unit, best, goals, w) : null;
  const action = best.target ? { type: 'attack', targetId: best.target.e.id } : best.capture ? { type: 'capture' } : best.heal ? { type: 'heal' } : best.supply ? { type: 'supply' } : lay ? lay : dive ? { type: 'submerge' } : canResupplyAt(game, unit, best.x, best.y) && ammoLevel(game, unit) !== 'ok' && resupplyCost(game, unit) <= game.state.funds[unit.owner] ? { type: 'resupply' } : { type: 'wait' };
  return { unitId: unit.id, to: { x: best.x, y: best.y }, action };
}

/** A Lay order for a mine layer standing on `best`: the free tile in range nearest the enemy, while it has a mine left and fewer than `maxMines` out; null otherwise. */
function layOrder(game, unit, best, goals, w) {
  const cfg = layConfig(game, unit);
  if (!cfg) return null;
  const out = game.state.units.filter((u) => u.owner === unit.owner && isMine(game, u)).length;
  if (out >= (w.maxMines ?? 4) || (ammoOf(game, unit) ?? 1) < 1) return null;
  let pick = null;
  for (const t of layTiles(game, unit, best.x, best.y)) {
    const d = Math.min(...goals.map(([gx, gy]) => distance(t.x, t.y, gx, gy)));
    if (!pick || d < pick.d) pick = { t, d };
  }
  return pick ? { type: 'lay', at: pick.t } : null;
}

/**
 * A submerged submarine comes up before it moves unless an enemy it can see is close: on the surface it travels faster (see `submerge.move`), and it
 * dives again at the end of its move. Returns the events (empty when nothing happens).
 */
export function surfaceToTravel(game, unit) {
  if (game.isOver || unit.done || unit.halted || !canSurface(game, unit)) return [];
  const near = game.state.units.some((e) => e.owner !== unit.owner && canSee(game, unit.owner, e) && distance(unit.x, unit.y, e.x, e.y) <= 6);
  if (near) return [];
  const res = game.setSubmerged({ unitId: unit.id, submerged: false });
  return res.ok ? res.events : [];
}

/**
 * Which unit (if any) the profile wants built on the property at (x, y) for the current player. The profile (ai.json) ranks units
 * by category; a unit the player's leader cannot build here is skipped (buildProblem), and a leader's extra categories come last.
 */
export function planBuild(game, x, y, ai = game.registry.ai) {
  const { state } = game;
  const player = state.turn;
  const property = terrainAt(game, x, y).attributes.property;
  if (!property) return null;
  const categories = new Set(property.builds);
  for (const def of menuFor(game, player, x, y)) categories.add(def.category);
  for (const category of categories) {
    for (const rule of ai.build[category] || []) {
      const owned = state.units.filter((u) => u.owner === player && u.type === rule.unit).length;
      if (owned >= rule.max) continue;
      if (rule.when && !AI_CONDITIONS[rule.when](game, player)) continue;
      if (buildProblem(game, player, x, y, rule.unit)) continue; // can't afford / tile not usable
      return rule.unit;
    }
  }
  return null;
}

/** Build on every free property the current player owns, in row-major order. */
export function buildPhase(game, ai = game.registry.ai) {
  const events = [];
  for (const p of allProperties(game)) {
    if (p.owner !== game.state.turn || !p.property.builds.length) continue;
    const type = planBuild(game, p.x, p.y, ai);
    if (type) events.push(...game.build(p.x, p.y, type).events);
  }
  return events;
}

/**
 * A carrier that has moved drops its troops once it is within `deployRange` tiles of something to capture or fight. Returns
 * `{ events, dropped }` (the dropped unit still has to be ordered), or null when it does not deploy.
 */
export function tryDeploy(game, unit, ai = game.registry.ai) {
  if (game.isOver || !game.state.units.includes(unit) || !canDeploy(game, unit)) return null;
  const range = ai.weights.deployRange ?? 8;
  if (Math.min(...goalTiles(game, unit).map(([gx, gy]) => distance(unit.x, unit.y, gx, gy))) > range) return null;
  if (!deployReach(game, unit).tiles.length) return null;
  const res = game.deploy({ unitId: unit.id });
  return res.ok ? { events: res.events, dropped: game.state.units.find((u) => u.id === res.deployed.unitId) } : null;
}

/** Give `unit` its order(s): a second one when the first was cut short by a hidden unit. */
function orderUnit(game, unit, events) {
  if (!unit.fresh) events.push(...surfaceToTravel(game, unit));
  for (let step = 0; step < 2 && game.state.units.includes(unit) && !unit.done && !game.isOver; step++) {
    const result = game.act(chooseOrder(game, unit));
    if (!result.ok) throw new Error(`AI produced an invalid order: ${result.error}`);
    events.push(...result.events);
    if (!result.interrupted) break;
  }
}

/** Play the current player's whole turn (every unit, then production, then the new units' free moves) and return all events. */
export function playTurn(game) {
  const player = game.state.turn;
  const events = [];
  for (const unit of game.state.units.filter((u) => u.owner === player)) {
    orderUnit(game, unit, events);
    const drop = tryDeploy(game, unit);
    if (drop) { events.push(...drop.events); orderUnit(game, drop.dropped, events); }
  }
  if (game.isOver) return events;
  events.push(...buildPhase(game));
  for (const unit of game.state.units.filter((u) => u.owner === player && u.fresh)) orderUnit(game, unit, events);
  return events;
}

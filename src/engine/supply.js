// The Supply order. A unit with `supply: { categories, repair? }` (the supply truck, the aircraft carrier) can end its move with Supply
// instead of Wait: every friendly unit of one of those categories on a tile next to it gets its ammo topped up (the owner pays each
// missing round at ammo.js roundCost; with too little money it fills what it can pay for) and, when `repair` is given, regains that many
// HP for free. The order is only offered when somebody next to it needs something.

import { attributeConfig } from './attributes.js';
import { ammoConfig, ammoOf, roundCost, usesAmmo } from './ammo.js';
import { distance, round1, snapshotUnit, unitDef } from './queries.js';

export const supplyConfig = (game, unit) => attributeConfig(unitDef(game, unit), 'supply');

/** What a Supply order from (x, y) would do: [{ unit, rounds, hp, cost }] in unit order, limited by the owner's funds. */
export function supplyPlan(game, unit, x = unit.x, y = unit.y) {
  const cfg = supplyConfig(game, unit);
  if (!cfg) return [];
  const max = game.registry.rules.maxHp;
  let funds = game.state.funds[unit.owner];
  const plan = [];
  for (const v of game.state.units) {
    if (v === unit || v.owner !== unit.owner || distance(x, y, v.x, v.y) !== 1 || !cfg.categories.includes(unitDef(game, v).category)) continue;
    let rounds = usesAmmo(game, v) ? Math.max(0, ammoConfig(game, v).max - ammoOf(game, v)) : 0;
    const price = roundCost(game, v);
    if (price > 0) rounds = Math.min(rounds, Math.floor(funds / price));
    const hp = cfg.repair ? Math.min(cfg.repair, round1(max - v.hp)) : 0;
    if (rounds <= 0 && hp <= 0) continue;
    funds -= rounds * price;
    plan.push({ unit: v, rounds, hp, cost: rounds * price });
  }
  return plan;
}

/** Could `unit`, stopping on (x, y), supply anybody? */
export const canSupplyAt = (game, unit, x, y) => supplyPlan(game, unit, x, y).length > 0;

/** Carry out the order from where the unit stands: the single 'supply' event. */
export function resolveSupply(game, unit) {
  const supplied = [];
  for (const { unit: v, rounds, hp, cost } of supplyPlan(game, unit)) {
    game.state.funds[unit.owner] -= cost;
    const ammoFrom = usesAmmo(game, v) ? ammoOf(game, v) : null;
    const from = v.hp;
    if (rounds > 0) v.ammo = ammoOf(game, v) + rounds;
    if (hp > 0) v.hp = Math.min(game.registry.rules.maxHp, round1(v.hp + hp));
    supplied.push({ id: v.id, x: v.x, y: v.y, ammoFrom, ammoTo: usesAmmo(game, v) ? ammoOf(game, v) : null, from, to: v.hp, cost });
  }
  return [{ type: 'supply', unit: snapshotUnit(unit), supplied }];
}

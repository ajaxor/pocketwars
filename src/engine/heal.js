// Healing.
//
//   `heal: { amount, categories, costRate? }`   support units (medic, mechanic) have a Heal ORDER, an end-of-move action like Capture or
//       Resupply: after moving (or staying put) the unit heals every damaged friendly unit of those categories on a tile next to it, each
//       by up to `amount` HP. `costRate` is the price of one HP as a fraction of the healed unit's cost, paid from the owner's funds; when
//       the funds run short only the HP that can be paid for are restored. A unit that has nothing to heal cannot give the order.
//   `reloads: true`   a unit that did not change tile during its last turn is topped up to full ammo for free at the start of its next one (the SAM launcher).
//   `rest: { heal }`   a unit that did not change tile during its owner's last turn (`unit.moved` was never set, see game.js) regains
//       `heal` HP of its own at the start of its next turn. `unit.moved` is cleared here, for every unit of the player, once it has been looked at.
//
// Both only ever add HP up to rules.maxHp. The Heal order reports a 'heal' event { unit, healed: [{ id, x, y, from, to, cost }] }; rest
// reports 'healed' entries ({ id, x, y, from, to, by: null, cost: 0 }) on the 'turnStart' event.

import { ammoConfig, usesAmmo } from './ammo.js';
import { attributeConfig, hasAttribute } from './attributes.js';
import { distance, round1, snapshotUnit, unitDef } from './queries.js';

/** Rest for `player`'s units at the start of their turn; returns the 'healed' entries. */
export function healAtTurnStart(game, player) {
  const { state, registry } = game;
  const max = registry.rules.maxHp;
  const healed = [];
  for (const u of state.units) {
    if (u.owner !== player) continue;
    const rest = attributeConfig(unitDef(game, u), 'rest');
    if (rest && !u.moved && u.hp < max) {
      const from = u.hp;
      u.hp = Math.min(max, round1(u.hp + rest.heal));
      healed.push({ id: u.id, x: u.x, y: u.y, from, to: u.hp, by: null, cost: 0 });
    }
    if (!u.moved && hasAttribute(unitDef(game, u), 'reloads') && usesAmmo(game, u)) u.ammo = ammoConfig(game, u).max;   // sat out a turn: fully reloaded
    delete u.moved;
  }
  return healed;
}

/** The friendly units `unit` could heal if it stopped on (x, y): damaged, of a listed category, on a tile next to it. */
export function healTargets(game, unit, x = unit.x, y = unit.y) {
  const cfg = attributeConfig(unitDef(game, unit), 'heal');
  if (!cfg) return [];
  const max = game.registry.rules.maxHp;
  return game.state.units.filter((v) => v !== unit && v.owner === unit.owner && v.hp < max && distance(x, y, v.x, v.y) === 1
    && cfg.categories.includes(unitDef(game, v).category));
}

/** What a Heal order from (x, y) would do: [{ unit, hp, cost }] in map order, limited by the owner's funds. Empty when nothing can be done. */
export function healPlan(game, unit, x = unit.x, y = unit.y) {
  const cfg = attributeConfig(unitDef(game, unit), 'heal');
  if (!cfg) return [];
  const max = game.registry.rules.maxHp;
  let funds = game.state.funds[unit.owner];
  const plan = [];
  for (const v of healTargets(game, unit, x, y)) {
    let hp = Math.min(cfg.amount, round1(max - v.hp));
    const perHp = Math.round(unitDef(game, v).cost * (cfg.costRate ?? 0));
    if (perHp > 0) hp = Math.min(hp, Math.floor(funds / perHp));
    if (hp <= 0) continue;
    funds -= hp * perHp;
    plan.push({ unit: v, hp, cost: hp * perHp });
  }
  return plan;
}

/** Could `unit`, stopping on (x, y), heal anybody (and can its owner pay for at least some of it)? */
export const canHealAt = (game, unit, x, y) => hasAttribute(unitDef(game, unit), 'heal') && healPlan(game, unit, x, y).length > 0;

/** Carry out the Heal order from where the unit stands: returns the single 'heal' event. */
export function resolveHeal(game, unit) {
  const healed = [];
  for (const { unit: v, hp, cost } of healPlan(game, unit)) {
    game.state.funds[unit.owner] -= cost;
    const from = v.hp;
    v.hp = Math.min(game.registry.rules.maxHp, round1(v.hp + hp));
    healed.push({ id: v.id, x: v.x, y: v.y, from, to: v.hp, cost });
  }
  return [{ type: 'heal', unit: snapshotUnit(unit), healed }];
}

// Healing at the start of a turn (called by economy.js startTurn, after property repair).
//
//   `heal: { amount, categories, costRate? }`   support units (medic, mechanic): each friendly unit of those categories on an adjacent tile
//       regains up to `amount` HP. A unit is healed once, by the best healer next to it. `costRate` is the price of one HP as a fraction of
//       the healed unit's cost, paid from the owner's funds; when the funds run short only the HP that can be paid for are restored.
//   `rest: { heal }`   a unit that did not change tile during its owner's last turn (`unit.moved` was never set, see game.js) regains
//       `heal` HP of its own. `unit.moved` is cleared here, for every unit of the player, once it has been looked at.
//
// Both only ever add HP up to rules.maxHp and report what they did as 'healed' entries: { id, from, to, by, cost }.

import { attributeConfig, hasAttribute } from './attributes.js';
import { distance, round1, unitDef } from './queries.js';

/** Heal and rest for `player`'s units; returns the 'healed' entries (in the order they happened). */
export function healAtTurnStart(game, player) {
  const { state, registry } = game;
  const max = registry.rules.maxHp;
  const healed = [];
  // rest: a unit that stayed put heals itself
  for (const u of state.units) {
    if (u.owner !== player) continue;
    const rest = attributeConfig(unitDef(game, u), 'rest');
    if (rest && !u.moved && u.hp < max) {
      const from = u.hp;
      u.hp = Math.min(max, round1(u.hp + rest.heal));
      healed.push({ id: u.id, x: u.x, y: u.y, from, to: u.hp, by: null, cost: 0 });
    }
    delete u.moved;
  }
  // support units: each damaged unit takes the strongest heal next to it
  const healers = state.units.filter((u) => u.owner === player && hasAttribute(unitDef(game, u), 'heal'));
  for (const v of state.units) {
    if (v.owner !== player || v.hp >= max) continue;
    const def = unitDef(game, v);
    let best = null;
    for (const h of healers) {
      if (h === v || distance(h.x, h.y, v.x, v.y) !== 1) continue;
      const cfg = attributeConfig(unitDef(game, h), 'heal');
      if (!cfg.categories.includes(def.category)) continue;
      if (!best || cfg.amount > best.cfg.amount) best = { h, cfg };
    }
    if (!best) continue;
    let hp = Math.min(best.cfg.amount, round1(max - v.hp));
    const perHp = Math.round(def.cost * (best.cfg.costRate ?? 0));
    if (perHp > 0) hp = Math.min(hp, Math.floor(state.funds[player] / perHp));
    if (hp <= 0) continue;
    const cost = hp * perHp;
    state.funds[player] -= cost;
    const from = v.hp;
    v.hp = Math.min(max, round1(v.hp + hp));
    healed.push({ id: v.id, x: v.x, y: v.y, from, to: v.hp, by: best.h.id, cost });
  }
  return healed;
}

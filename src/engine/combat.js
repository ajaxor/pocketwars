// Combat rules. Damage is data-driven (unit.damage table x layers) and modified by attributes:
//   - ignoresTerrainDefense on the DEFENDER removes the terrain-star reduction
//   - terrainDefenseMultiplier on the DEFENDER scales the terrain stars it gets
//   - indirect on either side disables counterattacks
// Every function returns plain data / event objects; nothing here knows about drawing.

import { attributeConfig, hasAttribute } from './attributes.js';
import { inAttackRange, removeUnit, round1, snapshotUnit, terrainAt, unitDef } from './queries.js';

/** Can `attacker` ever damage `defender`? (defender's layer is targetable AND the damage table has an entry.) */
export function canTarget(game, attacker, defender) {
  const a = unitDef(game, attacker);
  const d = unitDef(game, defender);
  return a.targetLayers.includes(d.layer) && (a.damage[d.id] || 0) > 0;
}

/** Terrain defense stars `unit` gets on its current tile, after its attributes have had their say. */
export function terrainStars(game, unit) {
  const def = unitDef(game, unit);
  if (hasAttribute(def, 'ignoresTerrainDefense')) return 0;
  return terrainAt(game, unit.x, unit.y).defense * (attributeConfig(def, 'terrainDefenseMultiplier') ?? 1);
}

/**
 * HP of damage `attacker` deals to `defender` right now (uses current HP and the defender's tile).
 * Below 1 HP the result keeps one decimal (e.g. 0.4); otherwise it is rounded to whole HP.
 */
export function calcDamage(game, attacker, defender) {
  if (!canTarget(game, attacker, defender)) return 0;
  const a = unitDef(game, attacker);
  const d = unitDef(game, defender);
  const stars = terrainStars(game, defender);
  const v = (a.damage[d.id] * attacker.hp) / 10 * (1 - (stars * defender.hp) / 100) / 10;
  return v < 1 ? round1(v) : Math.round(v);
}

const strike = (attacker, defender, damage, { counter, destroyed }) => ({
  type: 'strike', attacker: snapshotUnit(attacker), defender: snapshotUnit(defender), damage, counter, destroyed,
});

/** Does `defender` hit back at `attacker` after surviving? */
export function canCounter(game, defender, attacker) {
  return !hasAttribute(unitDef(game, attacker), 'indirect')
    && !hasAttribute(unitDef(game, defender), 'indirect')
    && canTarget(game, defender, attacker)
    && inAttackRange(game, defender, defender.x, defender.y, attacker);
}

/**
 * Apply `attacker`'s attack on `defender` (position/range already validated by the caller).
 * Mutates HP and removes destroyed units. Returns 'strike' events: the attack, then an optional counter.
 */
export function resolveAttack(game, attacker, defender) {
  const events = [];
  const dealt = calcDamage(game, attacker, defender);
  defender.hp = round1(defender.hp - dealt);
  if (defender.hp <= 0) {
    removeUnit(game, defender);
    events.push(strike(attacker, defender, dealt, { counter: false, destroyed: true }));
    return events;
  }
  events.push(strike(attacker, defender, dealt, { counter: false, destroyed: false }));
  if (canCounter(game, defender, attacker)) {
    const back = calcDamage(game, defender, attacker);
    attacker.hp = round1(attacker.hp - back);
    const destroyed = attacker.hp <= 0;
    if (destroyed) removeUnit(game, attacker);
    events.push(strike(defender, attacker, back, { counter: true, destroyed }));
  }
  return events;
}

// Combat rules. Who can hit whom and for how much comes from data:
//   - a unit carries weapons (data/weapons.json); a weapon has a damage value, an armorPiercing value, a range and the target
//     modes it can fire at (rules.json -> targetModes: each mode is a unit layer, and direct ones need line of sight)
//   - damage taken = weapon damage x attacker HP, divided by the defender's toughness and reduced by its armor, less the part
//     of that armor the weapon pierces, and finally by terrain defense:
//        damage = weapon.damage x (attackerHP/10) x (1 - armor x (1 - armorPiercing)) / toughness x (1 - stars x defenderHP/100) / 10
//   - ignoresTerrainDefense on the DEFENDER removes the terrain-star reduction
//   - terrainDefenseMultiplier on the DEFENDER scales the terrain stars it gets
//   - indirect on either side disables counterattacks
// Every function returns plain data / event objects; nothing here knows about drawing.

import { attributeConfig, hasAttribute } from './attributes.js';
import { hasLineOfSight } from './sight.js';
import { distance, removeUnit, round1, snapshotUnit, terrainAt, unitDef } from './queries.js';

export const weaponsOf = (game, unit) => unitDef(game, unit).weapons.map((id) => game.registry.weapon(id));
const modesOf = (game, weapon) => weapon.targets.map((m) => game.registry.rules.targetModes[m]);
const layerOf = (game, unit) => unitDef(game, unit).layer;

/** Could `attacker` ever damage `defender`? (Some weapon has a target mode for the defender's layer; position is ignored.) */
export function canTarget(game, attacker, defender) {
  const layer = layerOf(game, defender);
  return weaponsOf(game, attacker).some((w) => w.damage > 0 && modesOf(game, w).some((m) => m.layer === layer));
}

/**
 * The weapon `attacker` would fire at `defender` if it stood on tile `from` (default: where it is): the first of its weapons
 * whose range and target mode fit, with a clear line of sight when the mode needs one. null when none can.
 */
export function weaponFor(game, attacker, defender, from = attacker) {
  const d = distance(from.x, from.y, defender.x, defender.y);
  const layer = layerOf(game, defender);
  return weaponsOf(game, attacker).find((w) => d >= w.range[0] && d <= w.range[1] && modesOf(game, w).some(
    (m) => m.layer === layer && (!m.lineOfSight || d <= 1 || hasLineOfSight(game, from, defender)),
  )) ?? null;
}

/** Can `attacker`, standing on (x, y), hit `defender` right now? */
export const canAttackFrom = (game, attacker, defender, x, y) => weaponFor(game, attacker, defender, { x, y }) !== null;

/** Why `attacker` standing on (x, y) cannot hit `defender`: 'cannot-target', 'out-of-range', 'no-line-of-sight', or null when it can. */
export function attackProblem(game, attacker, defender, x = attacker.x, y = attacker.y) {
  if (!canTarget(game, attacker, defender)) return 'cannot-target';
  if (canAttackFrom(game, attacker, defender, x, y)) return null;
  const d = distance(x, y, defender.x, defender.y);
  const layer = layerOf(game, defender);
  const inRange = weaponsOf(game, attacker).some((w) => d >= w.range[0] && d <= w.range[1] && modesOf(game, w).some((m) => m.layer === layer));
  return inRange ? 'no-line-of-sight' : 'out-of-range';
}

/** Terrain defense stars `unit` gets on its current tile, after its attributes have had their say. */
export function terrainStars(game, unit) {
  const def = unitDef(game, unit);
  if (hasAttribute(def, 'ignoresTerrainDefense')) return 0;
  return terrainAt(game, unit.x, unit.y).defense * (attributeConfig(def, 'terrainDefenseMultiplier') ?? 1);
}

/**
 * HP of damage `attacker` deals to `defender` right now (uses current HP, the defender's tile and the weapon the attacker would
 * fire from `from`, default its own tile). 0 when no weapon can hit. Below 1 HP the result keeps one decimal (e.g. 0.4);
 * otherwise it is rounded to whole HP.
 */
export function calcDamage(game, attacker, defender, from = attacker) {
  const weapon = weaponFor(game, attacker, defender, from);
  return weapon ? weaponDamage(game, weapon, attacker, defender) : 0;
}

/** The damage formula alone (weapon.damage is scaled by weapon.targetMultipliers for the defender's target mode): HP that `weapon`, fired by `attacker` at its current HP, takes off `defender` where it stands. */
export function weaponDamage(game, weapon, attacker, defender) {
  const d = unitDef(game, defender);
  const stars = terrainStars(game, defender);
  const toughness = (1 - d.armor * (1 - weapon.armorPiercing)) / d.toughness;
  // the weapon's multiplier for the target mode that reaches the defender's layer (1 when it lists none)
  const mode = weapon.targets.find((m) => game.registry.rules.targetModes[m].layer === d.layer);
  const vs = weapon.targetMultipliers?.[mode] ?? 1;
  const v = (weapon.damage * vs * attacker.hp) / 10 * toughness * Math.max(0, 1 - (stars * defender.hp) / 100) / 10;
  return v < 1 ? round1(v) : Math.round(v);
}

const strike = (attacker, defender, damage, { counter, destroyed }) => ({
  type: 'strike', attacker: snapshotUnit(attacker), defender: snapshotUnit(defender), damage, counter, destroyed,
});

/** Does `defender` hit back at `attacker` after surviving? */
export function canCounter(game, defender, attacker) {
  return !hasAttribute(unitDef(game, attacker), 'indirect')
    && !hasAttribute(unitDef(game, defender), 'indirect')
    && canAttackFrom(game, defender, attacker, defender.x, defender.y);
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

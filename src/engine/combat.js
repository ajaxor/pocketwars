// Combat rules. Who can hit whom and for how much comes from data:
//   - a unit carries weapons (data/weapons.json); a weapon has a damage value, an armorPiercing value, a range and the target
//     modes it can fire at (rules.json -> targetModes: each mode is a unit layer, and direct ones need line of sight)
//   - damage taken = weapon damage x attacker HP, divided by the defender's toughness and reduced by its armor, less the part
//     of that armor the weapon pierces, and finally by terrain defense:
//        damage = weapon.damage x (attackerHP/10) x (1 - armor x (1 - armorPiercing)) / toughness x (1 - stars x defenderHP/100) / 10
//   - ignoresTerrainDefense on the DEFENDER removes the terrain-star reduction
//   - terrainDefenseMultiplier on the DEFENDER scales the terrain stars it gets
//   - an indirect weapon (the unit attribute `indirect` makes all of a unit's weapons so, or one weapon says `indirect: true`) cannot
//     fire after moving, is never answered by a counterattack, and is never used to counter; not being able to see the attacker
//     (hidden, see detection.js) also disables the counter
//   - a unit may carry several weapons: of those that can legally fire at the defender from where the attacker stands, the one
//     that would do the most damage is used (weaponFor), for the order, the forecast and the counterattack alike
//   - a weapon with an `ammo` cost (and a unit with the `ammo` attribute) needs that many rounds left, and spends them when it fires,
//     as a counterattack too (see ammo.js); a unit that is out cannot fire it, so it is not offered, forecast or used
// Every function returns plain data / event objects; nothing here knows about drawing.

import { hasAmmoFor, spendAmmo } from './ammo.js';
import { attributeConfig, hasAttribute } from './attributes.js';
import { hasLineOfSight } from './sight.js';
import { canSee } from './detection.js';
import { distance, layerIdOf, removeUnit, round1, snapshotUnit, terrainAt, unitDef } from './queries.js';

/** Is `weapon` of `unit` an indirect-fire weapon (artillery style: fires from where the unit started, never counters or is countered)? */
export const isIndirect = (game, unit, weapon) => !!weapon.indirect || hasAttribute(unitDef(game, unit), 'indirect');
/** Has the unit left its tile this turn, if it were to fire from `from`? (An interrupted move counts.) */
const hasMoved = (unit, from) => from.x !== unit.x || from.y !== unit.y || !!(unit.halted && unit.halted.moved);
/** Did `unit` move this turn before firing from `from` (the damage penalty of `moveFirePenalty`; `unit.moved` is set by the order that moved it)? */
const firedAfterMoving = (unit, from) => hasMoved(unit, from) || !!unit.moved;

/** How many attacks `unit` may make in one turn (the attribute `attacksPerTurn`; 1 for everybody else). */
export const attacksPerTurn = (game, unit) => attributeConfig(unitDef(game, unit), 'attacksPerTurn') ?? 1;

export const weaponsOf = (game, unit) => unitDef(game, unit).weapons.map((id) => game.registry.weapon(id));
const modesOf = (game, weapon) => weapon.targets.map((m) => game.registry.rules.targetModes[m]);
// the layer a unit is on right now: a submerged submarine is on another layer than a surfaced one
const layerOf = (game, unit) => layerIdOf(game, unit);

/** May `weapon` hit this unit at all, as far as tags go (`onlyTags`: the hunter sub's torpedoes only hit units tagged `sub`)? */
const tagOk = (game, weapon, defender) => !weapon.onlyTags || weapon.onlyTags.some((t) => unitDef(game, defender).tags?.includes(t));
/** May `weapon` be fired from tile `from` at all (`fromTerrain`: the marine's boarding rifle only works from the water)? */
const standingOk = (game, weapon, from) => !weapon.fromTerrain || weapon.fromTerrain.includes(game.map.terrain[from.y][from.x]);

/** Could `attacker` ever damage `defender`? (Some weapon has a target mode for the defender's layer and may hit its tags; position is ignored.) */
export function canTarget(game, attacker, defender) {
  const layer = layerOf(game, defender);
  return weaponsOf(game, attacker).some((w) => w.damage > 0 && tagOk(game, w, defender) && modesOf(game, w).some((m) => m.layer === layer));
}

/**
 * The weapon `attacker` would fire at `defender` if it stood on tile `from` (default: where it is). Of its weapons, those whose
 * range and target mode fit are candidates (a direct mode also needs a clear line of sight); the one that would do the most damage
 * to this defender, where it stands, wins. A tie goes to the weapon listed first. null when no weapon can fire. A weapon the
 * attacker has no ammo for is not a candidate (unless `ignoreAmmo`, which attackProblem uses to tell "out of ammo" from "out of range").
 */
export function weaponFor(game, attacker, defender, from = attacker, { moved = hasMoved(attacker, from), counter = false, ignoreAmmo = false } = {}) {
  const d = distance(from.x, from.y, defender.x, defender.y);
  const layer = layerOf(game, defender);
  let best = null;
  let bestDamage = -1;
  for (const w of weaponsOf(game, attacker)) {
    if ((moved || counter) && isIndirect(game, attacker, w)) continue;   // indirect weapons need a standing start and never counter
    if (!ignoreAmmo && !hasAmmoFor(game, attacker, w)) continue;
    if (!standingOk(game, w, from)) continue;
    if (d < w.range[0] || d > w.range[1]) continue;
    if (!tagOk(game, w, defender)) continue;
    if (!modesOf(game, w).some((m) => m.layer === layer && (!m.lineOfSight || d <= 1 || hasLineOfSight(game, from, defender)))) continue;
    const damage = rawDamage(game, w, attacker, defender, !counter && firedAfterMoving(attacker, from));
    if (damage > bestDamage) { best = w; bestDamage = damage; }
  }
  return best;
}

/** Can `attacker`, standing on (x, y), hit `defender` right now? */
export const canAttackFrom = (game, attacker, defender, x, y) => weaponFor(game, attacker, defender, { x, y }) !== null;

/** Why `attacker` standing on (x, y) cannot hit `defender`: 'cannot-target', 'out-of-ammo', 'out-of-range', 'no-line-of-sight', or null when it can. */
export function attackProblem(game, attacker, defender, x = attacker.x, y = attacker.y) {
  if (!canTarget(game, attacker, defender)) return 'cannot-target';
  if (canAttackFrom(game, attacker, defender, x, y)) return null;
  if (weaponFor(game, attacker, defender, { x, y }, { ignoreAmmo: true })) return 'out-of-ammo';   // it would reach, but a weapon with no rounds left cannot fire
  if (weaponFor(game, attacker, defender, { x, y }, { moved: false })) return 'cannot-move-and-fire';   // only an indirect weapon reaches, and the unit moved
  const d = distance(x, y, defender.x, defender.y);
  const layer = layerOf(game, defender);
  if (!weaponsOf(game, attacker).some((w) => standingOk(game, w, { x, y }) && tagOk(game, w, defender) && modesOf(game, w).some((m) => m.layer === layer))) return 'wrong-terrain';   // only a weapon that has to be fired from somewhere else reaches this kind of target
  const inRange = weaponsOf(game, attacker).some((w) => standingOk(game, w, { x, y }) && tagOk(game, w, defender) && d >= w.range[0] && d <= w.range[1] && modesOf(game, w).some((m) => m.layer === layer));
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
  return weapon ? weaponDamage(game, weapon, attacker, defender, firedAfterMoving(attacker, from)) : 0;
}

/**
 * What an attack would do, for the preview: { damage, destroyed, counter } where `counter` is the HP the defender's reply would
 * take off the attacker, or null when there is no reply (the defender died, cannot answer, or the shot is indirect). `from` is where
 * the attacker would stand. It does not change the game.
 */
export function forecastAttack(game, attacker, defender, from = attacker) {
  const weapon = weaponFor(game, attacker, defender, from);
  if (!weapon) return { damage: 0, destroyed: false, counter: null };
  const where = { ...attacker, x: from.x, y: from.y };
  const damage = weaponDamage(game, weapon, attacker, defender, firedAfterMoving(attacker, from));
  const left = round1(defender.hp - damage);
  if (left <= 0) return { damage, destroyed: true, counter: null };
  const hurt = { ...defender, hp: left };
  if (!canCounter(game, hurt, where, weapon)) return { damage, destroyed: false, counter: null };
  const reply = weaponFor(game, hurt, where, hurt, { counter: true });
  return { damage, destroyed: false, counter: reply ? weaponDamage(game, reply, hurt, where) : null };
}

/** The damage formula before rounding. weapon.damage is scaled by weapon.targetMultipliers for the target mode that reaches the defender's layer. */
function rawDamage(game, weapon, attacker, defender, moved = false) {
  const d = unitDef(game, defender);
  const stars = terrainStars(game, defender);
  const toughness = (1 - d.armor * (1 - weapon.armorPiercing)) / d.toughness;
  // the weapon's multiplier for the target mode that reaches the defender's layer (1 when it lists none)
  const layer = layerOf(game, defender);
  const mode = weapon.targets.find((m) => game.registry.rules.targetModes[m].layer === layer);
  const vs = weapon.targetMultipliers?.[mode] ?? 1;
  const slow = moved ? attributeConfig(unitDef(game, attacker), 'moveFirePenalty')?.multiplier ?? 1 : 1;   // e.g. the motorcycle: half damage when it moved first
  const ambush = attacker.ambush && attacker.owner === game.state.turn ? game.registry.rules.ambushMultiplier ?? 1 : 1;   // started its turn hidden: +50% on the attack (never on a counterattack)
  return (weapon.damage * vs * slow * ambush * attacker.hp) / 10 * toughness * Math.max(0, 1 - (stars * defender.hp) / 100) / 10;
}

/** The damage formula alone: HP that `weapon`, fired by `attacker` at its current HP, takes off `defender` where it stands (whole HP, or one decimal below 1). */
export function weaponDamage(game, weapon, attacker, defender, moved = false) {
  const v = rawDamage(game, weapon, attacker, defender, moved);
  return v < 1 ? round1(v) : Math.round(v);
}

const strike = (attacker, defender, damage, { counter, destroyed, weapon }) => ({
  type: 'strike', attacker: snapshotUnit(attacker), defender: snapshotUnit(defender), damage, counter, destroyed, weapon: weapon ? weapon.id : null,
});

/** Does `defender` hit back at `attacker`'s `weapon` after surviving? (Not against an indirect weapon, not with one, and not when it cannot see what hit it.) */
export function canCounter(game, defender, attacker, weapon = weaponFor(game, attacker, defender)) {
  return !(weapon && isIndirect(game, attacker, weapon))
    && canSee(game, defender.owner, attacker)
    && weaponFor(game, defender, attacker, defender, { counter: true }) !== null;
}

/**
 * Apply `attacker`'s attack on `defender` (position/range already validated by the caller).
 * Mutates HP and removes destroyed units. Returns 'strike' events: the attack, then an optional counter.
 */
export function resolveAttack(game, attacker, defender) {
  const events = [];
  const weapon = weaponFor(game, attacker, defender);
  const dealt = weapon ? weaponDamage(game, weapon, attacker, defender, firedAfterMoving(attacker, attacker)) : 0;
  if (weapon) spendAmmo(game, attacker, weapon.ammo);
  defender.hp = round1(defender.hp - dealt);
  if (defender.hp <= 0) {
    removeUnit(game, defender);
    events.push(strike(attacker, defender, dealt, { counter: false, destroyed: true, weapon }));
    return events;
  }
  events.push(strike(attacker, defender, dealt, { counter: false, destroyed: false, weapon }));
  if (canCounter(game, defender, attacker, weapon)) {
    const reply = weaponFor(game, defender, attacker, defender, { counter: true });
    const back = reply ? weaponDamage(game, reply, defender, attacker) : 0;
    if (reply) spendAmmo(game, defender, reply.ammo);
    attacker.hp = round1(attacker.hp - back);
    const destroyed = attacker.hp <= 0;
    if (destroyed) removeUnit(game, attacker);
    events.push(strike(defender, attacker, back, { counter: true, destroyed, weapon: reply }));
  }
  return events;
}

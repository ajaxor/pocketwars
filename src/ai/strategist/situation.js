// The strategist's picture of one turn, made when the turn starts and read by every decision in it.
//
//   enemies          the units of other players it can see (hidden ones are not known about), turrets that would fire at it included
//   threatAt(u,x,y)  value (in thousands) the enemy could take off unit `u` if it ended its move on (x, y): every enemy that could
//                    reach that tile next turn, at its current strength, against `u` on that tile's cover, capped at what `u` is worth.
//                    This is the cheap one-move look-ahead: where the enemy can answer, and how hard.
//   field(mc, goals) a cached distance field (movement.js) for a move class toward a set of goal tiles
//
// Enemy reach is worked out once per turn (where they could move and fire from); units that die during the turn stop counting.

import { attributeConfig, hasAttribute } from '../../engine/attributes.js';
import { canSee } from '../../engine/detection.js';
import { isIndirect, weaponsOf } from '../../engine/combat.js';
import { computeReach, distanceField } from '../../engine/movement.js';
import { allProperties, inBounds, terrainAt, unitDef } from '../../engine/queries.js';
import { isNeutral, isStructure } from '../../engine/structures.js';
import { matchup, reachOf, roles } from './knowledge.js';

export class Situation {
  constructor(game, player, params, strategy) {
    this.game = game;
    this.player = player;
    this.params = params;
    this.strategy = strategy;
    this.tactics = strategy.tactics;
    this.maxHp = game.registry.rules.maxHp;
    this.fields = new Map();
    this.goalCache = new Map();   // unit id -> { at, goal }: goals hold for the turn unless the unit moves or someone dies
    this.refresh();
    this.threats = this.enemies.filter((e) => !isWall(game, e)).map((e) => ({ unit: e, mask: hitMask(game, e) })).filter((t) => t.mask);
    this.properties = allProperties(game);
  }

  /** Re-read who is where (after units have died or appeared). */
  refresh() {
    const { game, player } = this;
    this.mine = game.state.units.filter((u) => u.owner === player);
    this.enemies = game.state.units.filter((e) => e.owner !== player && (e.owner !== null || isStructure(game, e)) && !hasAttribute(unitDef(game, e), 'jammer') && canSee(game, player, e));   // a jammer only fogs the human: the computer never attacks, hunts or fears it
    this.army = this.enemies.filter((e) => !isNeutral(e) && !isStructure(game, e) && !hasAttribute(unitDef(game, e), 'mine'));
    // the balance of forces: our army's worth over the enemy's (both at their HP). Stronger, we press on; weaker, we are careful
    const worth = (list) => list.reduce((a, u) => a + (unitDef(game, u).weapons.length ? unitDef(game, u).cost * u.hp / game.registry.rules.maxHp : 0), 0);
    const ours = worth(this.mine.filter((u) => !isStructure(game, u) && !hasAttribute(unitDef(game, u), 'mine')));
    this.strength = ours / Math.max(1000, worth(this.army));
  }

  /** What the army is after: the strategy's target, or the enemy HQ once we are far enough ahead to finish the game (params.finish). */
  get target() {
    return this.strength >= this.params.finish ? 'hq' : (this.tactics.target ?? 'balanced');
  }

  threatAt(unit, x, y) {
    const { game } = this;
    const k = y * game.map.width + x;
    const def = unitDef(game, unit);
    const stars = hasAttribute(def, 'ignoresTerrainDefense') ? 0 : terrainAt(game, x, y).defense * (attributeConfig(def, 'terrainDefenseMultiplier') ?? 1);
    const cover = Math.max(0, 1 - stars * unit.hp / 100);
    let hp = 0;
    for (const t of this.threats) {
      if (!t.mask[k] || !game.state.units.includes(t.unit)) continue;
      hp += matchup(game, t.unit.type, unit.type) * (t.unit.hp / this.maxHp) * cover;
    }
    return Math.min(unit.hp, hp) / this.maxHp * def.cost / 1000;
  }

  field(moveClass, goals) {
    let key = moveClass;
    for (const g of goals) key += `|${g[0]},${g[1]},${g[2] ?? 0}`;
    let f = this.fields.get(key);
    if (!f) this.fields.set(key, (f = distanceField(this.game, moveClass, goals)));
    return f;
  }
}

const isWall = (game, u) => hasAttribute(unitDef(game, u), 'wallSection') || hasAttribute(unitDef(game, u), 'mine') || !unitDef(game, u).weapons.length;

/**
 * Tiles enemy `e` could fire at in its next turn, as a 0/1 mask, or null when it has no weapon. A turret fires from where it stands;
 * an indirect weapon only from where the unit starts; a direct one from anywhere it can move to.
 */
function hitMask(game, e) {
  const def = unitDef(game, e);
  const { max } = reachOf(game.registry, def);
  if (!max) return null;
  const { map } = game;
  const mask = new Uint8Array(map.width * map.height);
  const mark = (x, y, lo, hi) => {
    for (let dy = -hi; dy <= hi; dy++) {
      for (let dx = -hi; dx <= hi; dx++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d > hi || d < lo || !inBounds(map, x + dx, y + dy)) continue;
        mask[(y + dy) * map.width + x + dx] = 1;
      }
    }
  };
  const fixed = isStructure(game, e) || !def.move;
  let reach = null;
  for (const w of weaponsOf(game, e)) {
    if (!(w.damage > 0)) continue;
    const [lo, hi] = w.range;
    if (fixed || isIndirect(game, e, w)) { mark(e.x, e.y, Math.max(1, lo), hi); continue; }
    reach ??= computeReach(game, { ...e, halted: null });
    for (const { x, y } of reach.tiles()) mark(x, y, Math.max(1, lo), hi);
  }
  return mask;
}

export { roles };

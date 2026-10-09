// Player-facing facts about a tile, a unit or a unit type, as plain data. The info boxes and the build menu draw these;
// nothing here touches the DOM, so the numbers are tested without one. Everything is read from the registry and the game
// state: no unit or terrain ids are compared here (labels for attributes live in the attribute catalogue).

import { attributeHelp, attributeLabel, TERRAIN_ATTRIBUTES, UNIT_ATTRIBUTES } from '../engine/attributes.js';
import { ammoConfig, ammoOf } from '../engine/ammo.js';
import { fuelConfig, fuelOf } from '../engine/fuel.js';
import { calcDamage, terrainStars, weaponFor } from '../engine/combat.js';
import { factionOf, isInertDef, layerInfo, ownerAt, propertyAt, skinAt, terrainAt, unitCost, unitDef } from '../engine/queries.js';

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const MOVE_LABELS = { foot: 'Foot', wheels: 'Wheels', tread: 'Treads', air: 'Air', naval: 'Naval', amphibious: 'Amphibious', hover: 'Hover', amphibious_tread: 'Amphibious tread' };
const CATEGORY_LABELS = { infantry: 'Infantry', aircraft: 'Aircraft', naval: 'Ships', amphibious: 'Amphibious' };
/** "vehicle" -> "Vehicles": a unit category as a heading (unknown names are capitalised and pluralised). */
const categoryLabel = (c) => CATEGORY_LABELS[c] || `${cap(c)}s`;
/** A move class as a short word for the terrain's move-cost chips. */
const moveLabel = (c) => MOVE_LABELS[c] || cap(c);

/** A labelled attribute as a tag: the short name and the sentence that explains it. */
const tagOf = (catalogue, name, cfg, registry) => ({ label: attributeLabel(catalogue, name, cfg, registry), help: attributeHelp(catalogue, name, cfg, registry) });

export const fmtMoney = (n) => Number(n).toLocaleString('en-US');

/** What a weapon can shoot at, as words: the layer of each target mode ("Ground", "Low air"). */
function hitsOf(game, weapon) {
  const { layers, targetModes } = game.registry.rules;
  const out = [];
  for (const m of weapon.targets) {
    const layer = targetModes[m].layer;
    const word = layers[layer]?.label ? cap(layers[layer].label) : cap(layer);
    if (!out.includes(word)) out.push(word);
  }
  return out;
}

/** Stats of a unit TYPE: what the build menu shows, and the base of the unit info box. */
export function unitStats(game, def) {
  const { registry } = game;
  const tags = Object.entries(def.attributes).map(([name, cfg]) => tagOf(UNIT_ATTRIBUTES, name, cfg, registry));
  const layer = registry.rules.layers[def.layer];
  return {
    id: def.id, name: def.name, category: def.category, cost: def.cost, move: def.move,
    toughness: def.toughness, armor: Math.round(def.armor * 100),
    durability: def.attributes.structure ? def.attributes.structure.durability ?? 1 : null,   // structures take their own kind of damage (combat.js)
    layer: layer?.label ? cap(layer.label) : null,
    weapons: def.weapons.map((id) => {
      const w = registry.weapon(id);
      return { name: w.name, damage: w.damage, min: w.range[0], max: w.range[1], hits: hitsOf(game, w) };
    }),
    tags,
  };
}

/** Facts about one tile's terrain, including who owns it when it is a property. */
export function terrainInfo(game, x, y) {
  const { registry } = game;
  const t = terrainAt(game, x, y);
  const prop = propertyAt(game, x, y);
  const owner = prop ? ownerAt(game, x, y) : undefined;
  const notes = Object.entries(t.attributes).filter(([name]) => name !== 'property').map(([name, cfg]) => tagOf(TERRAIN_ATTRIBUTES, name, cfg, registry));
  return {
    x, y, name: skinAt(game, x, y).name, color: skinAt(game, x, y).render.base ?? registry.groundDef(game.map.ground?.[y]?.[x])?.render.base ?? '#86b95c', defense: t.defense,
    moves: registry.rules.moveClasses.map((c) => ({ id: c, label: moveLabel(c), cost: t.moveCost[c] ?? null })),
    property: prop ? {
      income: prop.income, repair: prop.repair, capturePoints: prop.capturePoints, builds: prop.builds.map(categoryLabel),
      owner: owner === null ? null : { player: owner, name: factionOf(game, owner).name, color: factionOf(game, owner).color },
    } : null,
    notes,
  };
}

/**
 * Facts about a unit standing on the map. `at` is where it stands for the cover number (a unit previewing a move is
 * still on its old tile in the game state); `attacker` adds the damage it would take from that unit.
 */
export function unitInfo(game, unit, { at = unit, attacker = null, attackerAt = attacker } = {}) {
  const def = unitDef(game, unit);
  const faction = unit.owner === null ? null : factionOf(game, unit.owner);
  const prop = propertyAt(game, at.x, at.y);
  const where = { ...unit, x: at.x, y: at.y };
  const weapon = attacker ? weaponFor(game, attacker, where, attackerAt) : null;
  return {
    ...unitStats(game, def),
    cost: unitCost(game, unit),   // what its owner pays for it: a troop carrier costs by the infantry its leader loads it with
    unitId: unit.id, owner: unit.owner,
    faction: faction ? { name: faction.name, color: faction.color, dark: faction.dark } : null,
    hp: Math.ceil(unit.hp - 1e-9), maxHp: game.registry.rules.maxHp,
    layerLabel: layerInfo(game, unit).label,
    ammo: ammoConfig(game, unit) ? { now: ammoOf(game, unit), max: ammoConfig(game, unit).max, low: ammoConfig(game, unit).low } : null,
    fuel: fuelConfig(game, unit) ? { now: fuelOf(game, unit), max: fuelConfig(game, unit).max, low: fuelConfig(game, unit).low } : null,
    fresh: !!unit.fresh && unit.owner === game.state.turn,
    acted: !!unit.done && unit.owner === game.state.turn && !isInertDef(def),
    cover: terrainStars(game, where),
    capture: unit.capture && prop ? { progress: unit.capture, needed: prop.capturePoints } : null,
    forecast: attacker ? calcDamage(game, attacker, where, attackerAt) : null,
    forecastWeapon: attacker && weapon && game.registry.unit(attacker.type).weapons.length > 1 ? weapon.name : null,
  };
}

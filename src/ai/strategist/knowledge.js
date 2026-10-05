// What the strategist knows about the unit types, worked out from the data rather than written by hand, so a new unit or a balance
// change is understood the moment it is in data/units.json and data/weapons.json.
//
//   matchup(game, a, b)    HP a full-strength `a` takes off a full-strength `b` standing in the open, in one attack (0: it cannot hurt it)
//   reachOf(def)           { min, max } of its weapons' ranges (0, 0 for an unarmed unit)
//   roles(def)             the jobs a type can do: { capture, carrier, healer, supplier, layer, radar, indirect, structure, combat }
//
// Matchups are computed once per registry with phantom units on an open tile of the first map seen (only the terrain stars of
// that tile matter, and an open tile has none).

import { attributeConfig, hasAttribute } from '../../engine/attributes.js';
import { weaponDamage } from '../../engine/combat.js';
import { makeUnit } from '../../engine/state.js';

const cache = new WeakMap();   // registry -> { damage: Map<'a>b', number> }

function store(game) {
  let s = cache.get(game.registry);
  if (!s) cache.set(game.registry, (s = { damage: new Map(), open: openTile(game) }));
  return s;
}

/** A tile with no terrain defense (a plain, a road, the sea), for phantom fights. */
function openTile(game) {
  const { map, registry } = game;
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (!registry.terrainDef(map.terrain[y][x]).defense) return { x, y };
  return { x: 0, y: 0 };
}

const layerOf = (registry, def) => def.layer;

export function matchup(game, a, b) {
  const s = store(game);
  const key = `${a}>${b}`;
  let v = s.damage.get(key);
  if (v !== undefined) return v;
  const { registry } = game;
  const da = registry.unit(a);
  const db = registry.unit(b);
  v = 0;
  if (da.weapons.length) {
    const layer = layerOf(registry, db);
    const attacker = { ...makeUnit(registry, game.map, -1, { type: a, owner: -1, x: s.open.x, y: s.open.y }), submerged: false };
    const defender = { ...makeUnit(registry, game.map, -2, { type: b, owner: -2, x: s.open.x, y: s.open.y }), submerged: false };
    for (const id of da.weapons) {
      const w = registry.weapon(id);
      if (!(w.damage > 0)) continue;
      if (w.onlyTags && !w.onlyTags.some((t) => db.tags?.includes(t))) continue;
      if (!w.targets.some((m) => registry.rules.targetModes[m].layer === layer)) continue;
      const indirect = !!w.indirect || hasAttribute(da, 'indirect');
      v = Math.max(v, weaponDamage(game, w, attacker, defender, !indirect));   // a direct-fire unit usually moves before it fires
    }
  }
  s.damage.set(key, v);
  return v;
}

export function reachOf(registry, def) {
  let min = Infinity;
  let max = 0;
  for (const id of def.weapons) {
    const w = registry.weapon(id);
    if (!(w.damage > 0)) continue;
    min = Math.min(min, w.range[0]);
    max = Math.max(max, w.range[1]);
  }
  return max ? { min, max } : { min: 0, max: 0 };
}

export function roles(def) {
  return {
    capture: hasAttribute(def, 'capture'),
    carrier: !!attributeConfig(def, 'deploy'),
    healer: hasAttribute(def, 'heal'),
    supplier: hasAttribute(def, 'supply'),
    layer: hasAttribute(def, 'layMines'),
    radar: hasAttribute(def, 'radar'),
    indirect: hasAttribute(def, 'indirect'),
    structure: hasAttribute(def, 'structure'),
    mine: hasAttribute(def, 'mine'),
    combat: def.weapons.length > 0,
  };
}

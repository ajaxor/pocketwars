// The Registry is the read-only, validated view of all entity definitions (units, terrain, factions,
// rules, AI profile). The engine and renderer only ever talk to a Registry, never to raw JSON.

import { DataError, validateData } from './validate.js';

const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o).forEach(deepFreeze);
  }
  return o;
};

const withDefaults = (units) => Object.fromEntries(Object.entries(units).map(([id, u]) => [id, { toughness: 1, armor: 0, weapons: [], ...u }]));
const withIds = (obj) => Object.fromEntries(Object.entries(obj).map(([id, def]) => [id, { ...def, id, attributes: def.attributes || {} }]));

/**
 * Resolve loadouts.json: every leader's kit with the default's parts filled in. A kit is { build: { <terrain id>: [unit ids] },
 * start: { hq|<building id>: [{ unit, at }] } }. Without loadouts.json there are no leaders, and every building gives the menu of its `builds` categories.
 */
function resolveLoadouts(raw) {
  const base = { build: raw?.default?.build ?? {}, start: raw?.default?.start ?? {} };
  const kit = (own = {}) => ({ build: { ...base.build, ...(own.build ?? {}) }, start: { ...base.start, ...(own.start ?? {}) } });
  return { default: kit(), leaders: Object.fromEntries(Object.entries(raw?.leaders ?? {}).map(([id, own]) => [id, kit(own)])) };
}

/**
 * @param {{rules:object, factions:object, terrain:object, weapons:object, units:object, ai:object, loadouts?:object}} raw parsed JSON files
 * @throws {DataError} when the data is invalid
 */
export function createRegistry(raw) {
  const problems = validateData(raw);
  if (problems.length) throw new DataError(problems);

  const rules = deepFreeze(structuredClone(raw.rules));
  const factions = deepFreeze(withIds(structuredClone(raw.factions)));
  const terrain = deepFreeze(withIds(structuredClone(raw.terrain)));
  const units = deepFreeze(withDefaults(withIds(structuredClone(raw.units))));
  const weapons = deepFreeze(Object.fromEntries(Object.entries(structuredClone(raw.weapons)).map(([id, w]) => [id, { armorPiercing: 0, ...w, id }])));
  const ground = deepFreeze(withIds(structuredClone(raw.ground || {})));
  const ai = deepFreeze(structuredClone(raw.ai));
  const unitIds = Object.keys(units); // JSON order = build-menu order
  const terrainIds = Object.keys(terrain);
  const groundIds = Object.keys(ground);
  const factionIds = Object.keys(factions); // JSON order = the order colours are offered in
  const loadouts = deepFreeze(resolveLoadouts(structuredClone(raw.loadouts)));
  const leaderIds = Object.keys(loadouts.leaders); // JSON order = the order leaders are offered in

  return Object.freeze({
    rules, factions, terrain, ground, units, weapons, ai, unitIds, terrainIds, groundIds, factionIds, loadouts, leaderIds,
    /** The kit a leader brings: { build, start } (see resolveLoadouts). No leader (null) gets the default kit. */
    loadoutFor: (leaderId) => {
      if (leaderId == null) return loadouts.default;
      const k = loadouts.leaders[leaderId];
      if (!k) throw new Error(`Unknown leader "${leaderId}"`);
      return k;
    },
    /** The ground under every tile that a map does not say otherwise about (null when the data has no ground at all). */
    defaultGround: groundIds.includes(rules.defaultGround) ? rules.defaultGround : null,
    groundDef: (id) => (id == null ? null : ground[id] || null),
    unit: (id) => { const u = units[id]; if (!u) throw new Error(`Unknown unit "${id}"`); return u; },
    terrainDef: (id) => { const t = terrain[id]; if (!t) throw new Error(`Unknown terrain "${id}"`); return t; },
    weapon: (id) => { const w = weapons[id]; if (!w) throw new Error(`Unknown weapon "${id}"`); return w; },
    faction: (id) => { const f = factions[id]; if (!f) throw new Error(`Unknown faction "${id}"`); return f; },
    /** Unit definitions belonging to any of the given categories, in build-menu order. */
    unitsInCategories: (categories) => unitIds.map((id) => units[id]).filter((u) => categories.includes(u.category)),
  });
}

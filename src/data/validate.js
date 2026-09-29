// Validation of the entity JSON files. Returns a list of human-readable problems (empty = valid).
// Pure functions: no DOM, no fs, so they run in the browser, in Node tests and in tools/validate-data.mjs.

import { UNIT_ATTRIBUTES, TERRAIN_ATTRIBUTES, checkAttributes } from '../engine/attributes.js';
import { AI_CONDITIONS } from '../engine/ai-conditions.js';

export class DataError extends Error {
  constructor(problems) {
    super(`Invalid game data:\n - ${problems.join('\n - ')}`);
    this.name = 'DataError';
    this.problems = problems;
  }
}

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.length > 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isColor = (v) => typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v);

export function validateRules(rules, problems) {
  if (!isObj(rules)) return problems.push('rules.json must be an object');
  if (!Number.isInteger(rules.maxHp) || rules.maxHp < 1) problems.push('rules: maxHp must be a positive integer');
  if (!isColor(rules.neutralColor)) problems.push('rules: neutralColor must be a hex color');
  if (!Array.isArray(rules.moveClasses) || !rules.moveClasses.length || new Set(rules.moveClasses).size !== rules.moveClasses.length
    || rules.moveClasses.some((m) => !isStr(m))) problems.push('rules: moveClasses must be a non-empty array of unique names');
  if (!isObj(rules.layers) || !Object.keys(rules.layers).length) problems.push('rules: layers must be a non-empty object');
  else {
    for (const [id, l] of Object.entries(rules.layers)) {
      if (!isObj(l)) { problems.push(`rules: layer "${id}" must be an object`); continue; }
      if (l.label !== null && !isStr(l.label)) problems.push(`rules: layer "${id}" label must be a string or null`);
      if (l.airborne !== undefined && typeof l.airborne !== 'boolean') problems.push(`rules: layer "${id}" airborne must be a boolean`);
    }
  }
}

export function validateFactions(factions, problems) {
  if (!isObj(factions) || !Object.keys(factions).length) return problems.push('factions.json must be a non-empty object');
  for (const [id, f] of Object.entries(factions)) {
    if (!isObj(f)) { problems.push(`faction "${id}" must be an object`); continue; }
    if (!isStr(f.name)) problems.push(`faction "${id}": name is required`);
    if (!isColor(f.color)) problems.push(`faction "${id}": color must be a hex color`);
    if (!isColor(f.dark)) problems.push(`faction "${id}": dark must be a hex color`);
  }
}

export function validateTerrain(terrain, rules, problems) {
  if (!isObj(terrain) || !Object.keys(terrain).length) return problems.push('terrain.json must be a non-empty object');
  for (const [id, t] of Object.entries(terrain)) {
    if (!isObj(t)) { problems.push(`terrain "${id}" must be an object`); continue; }
    if (!isStr(t.name)) problems.push(`terrain "${id}": name is required`);
    if (!isNum(t.defense) || t.defense < 0) problems.push(`terrain "${id}": defense must be a non-negative number`);
    if (!isObj(t.moveCost)) problems.push(`terrain "${id}": moveCost must be an object keyed by move class`);
    else {
      for (const mc of rules.moveClasses || []) {
        const c = t.moveCost[mc];
        if (c === undefined) problems.push(`terrain "${id}": moveCost is missing move class "${mc}" (use null for impassable)`);
        else if (c !== null && !(isNum(c) && c > 0)) problems.push(`terrain "${id}": moveCost.${mc} must be a positive number or null`);
      }
      for (const mc of Object.keys(t.moveCost)) {
        if (!(rules.moveClasses || []).includes(mc)) problems.push(`terrain "${id}": moveCost has unknown move class "${mc}"`);
      }
    }
    if (!isObj(t.render) || !isColor(t.render.base)) problems.push(`terrain "${id}": render.base must be a hex color`);
    checkAttributes('terrain', id, t, TERRAIN_ATTRIBUTES, problems);
  }
}

export function validateUnits(units, terrain, rules, problems) {
  if (!isObj(units) || !Object.keys(units).length) return problems.push('units.json must be a non-empty object');
  const ids = Object.keys(units);
  const layers = Object.keys(rules.layers || {});
  for (const [id, u] of Object.entries(units)) {
    if (!isObj(u)) { problems.push(`unit "${id}" must be an object`); continue; }
    if (!isStr(u.name)) problems.push(`unit "${id}": name is required`);
    if (!isStr(u.category)) problems.push(`unit "${id}": category is required`);
    if (!Number.isInteger(u.cost) || u.cost < 1) problems.push(`unit "${id}": cost must be a positive integer`);
    if (!Number.isInteger(u.move) || u.move < 0) problems.push(`unit "${id}": move must be a non-negative integer`);
    if (!(rules.moveClasses || []).includes(u.moveClass)) problems.push(`unit "${id}": unknown moveClass "${u.moveClass}"`);
    if (!Array.isArray(u.range) || u.range.length !== 2 || !u.range.every(Number.isInteger) || u.range[0] < 1 || u.range[0] > u.range[1]) {
      problems.push(`unit "${id}": range must be [min, max] integers with 1 <= min <= max`);
    }
    if (!layers.includes(u.layer)) problems.push(`unit "${id}": unknown layer "${u.layer}"`);
    if (!Array.isArray(u.targetLayers) || !u.targetLayers.length || u.targetLayers.some((l) => !layers.includes(l))) {
      problems.push(`unit "${id}": targetLayers must be a non-empty list of known layers`);
    }
    if (!isObj(u.damage)) problems.push(`unit "${id}": damage must be an object keyed by target unit id`);
    if (!isObj(u.render) || !isStr(u.render.sprite)) problems.push(`unit "${id}": render.sprite is required`);
    checkAttributes('unit', id, u, UNIT_ATTRIBUTES, problems);
  }
  // Cross-checks that need every unit to have been read.
  for (const [id, u] of Object.entries(units)) {
    if (!isObj(u) || !isObj(u.damage) || !Array.isArray(u.targetLayers)) continue;
    for (const [target, value] of Object.entries(u.damage)) {
      if (!ids.includes(target)) { problems.push(`unit "${id}": damage references unknown unit "${target}"`); continue; }
      if (!isNum(value) || value <= 0) problems.push(`unit "${id}": damage.${target} must be a positive number (omit the entry to forbid the attack)`);
      if (!u.targetLayers.includes(units[target].layer)) {
        problems.push(`unit "${id}": has damage vs "${target}" but cannot target layer "${units[target].layer}" (targetLayers)`);
      }
    }
    for (const [target, t] of Object.entries(units)) {
      if (u.targetLayers.includes(t.layer) && !(u.damage[target] > 0)) {
        problems.push(`unit "${id}": can target layer "${t.layer}" but has no damage entry vs "${target}"`);
      }
    }
  }
  // Every category a property can build must contain at least one unit.
  const categories = new Set(Object.values(units).filter(isObj).map((u) => u.category));
  for (const [id, t] of Object.entries(terrain || {})) {
    const builds = t && t.attributes && t.attributes.property && t.attributes.property.builds;
    if (Array.isArray(builds)) for (const c of builds) if (!categories.has(c)) problems.push(`terrain "${id}": builds unknown unit category "${c}"`);
  }
}

export function validateAi(ai, units, problems) {
  if (!isObj(ai)) return problems.push('ai.json must be an object');
  const weightKeys = ['distanceToGoal', 'unreachableDistance', 'terrainDefense', 'attackBase', 'killBonus', 'captureBase', 'victoryCaptureBonus', 'costUnit'];
  if (!isObj(ai.weights)) problems.push('ai: weights must be an object');
  else for (const k of weightKeys) if (!isNum(ai.weights[k])) problems.push(`ai: weights.${k} must be a number`);
  if (!isObj(ai.build)) return problems.push('ai: build must be an object keyed by unit category');
  for (const [category, rules] of Object.entries(ai.build)) {
    if (!Array.isArray(rules)) { problems.push(`ai: build.${category} must be an array`); continue; }
    rules.forEach((r, i) => {
      const where = `ai: build.${category}[${i}]`;
      if (!isObj(units) || !units[r.unit]) problems.push(`${where}: unknown unit "${r.unit}"`);
      else if (units[r.unit].category !== category) problems.push(`${where}: unit "${r.unit}" is in category "${units[r.unit].category}", not "${category}"`);
      if (!Number.isInteger(r.max) || r.max < 1) problems.push(`${where}: max must be a positive integer`);
      if (r.when !== undefined && !AI_CONDITIONS[r.when]) problems.push(`${where}: unknown condition "${r.when}" (known: ${Object.keys(AI_CONDITIONS).join(', ')})`);
    });
  }
}

/** Validate a full raw data bundle: { rules, factions, terrain, units, ai }. */
export function validateData(raw) {
  const problems = [];
  validateRules(raw.rules, problems);
  const rules = isObj(raw.rules) ? raw.rules : {};
  validateFactions(raw.factions, problems);
  validateTerrain(raw.terrain, rules, problems);
  validateUnits(raw.units, raw.terrain, rules, problems);
  validateAi(raw.ai, raw.units, problems);
  return problems;
}

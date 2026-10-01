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
      if (l.hidden !== undefined && typeof l.hidden !== 'boolean') problems.push(`rules: layer "${id}" hidden must be a boolean`);
    }
  }
  if (!isObj(rules.targetModes) || !Object.keys(rules.targetModes).length) problems.push('rules: targetModes must be a non-empty object');
  else {
    for (const [id, m] of Object.entries(rules.targetModes)) {
      if (!isObj(m)) { problems.push(`rules: target mode "${id}" must be an object`); continue; }
      if (!isObj(rules.layers) || !(m.layer in rules.layers)) problems.push(`rules: target mode "${id}" refers to unknown layer "${m.layer}"`);
      if (m.lineOfSight !== undefined && typeof m.lineOfSight !== 'boolean') problems.push(`rules: target mode "${id}" lineOfSight must be a boolean`);
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

export function validateTerrain(terrain, rules, problems, hasGround = false) {
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
    // render.base is the terrain's own ground colour (sea, road). Terrain without one is drawn on the map's ground (ground.json).
    if (!isObj(t.render) || (t.render.base !== undefined && !isColor(t.render.base))) problems.push(`terrain "${id}": render.base must be a hex color when given`);
    else if (t.render.base === undefined && !hasGround) problems.push(`terrain "${id}": render.base is required when there is no ground.json`);
    else if (t.render.group !== undefined && !isStr(t.render.group)) problems.push(`terrain "${id}": render.group must be a name (terrains with the same group are drawn as one shape)`);
    else if (t.render.mini !== undefined && !isColor(t.render.mini)) problems.push(`terrain "${id}": render.mini (the colour on the map preview) must be a hex color`);
    checkAttributes('terrain', id, t, TERRAIN_ATTRIBUTES, problems);
  }
}

/** ground.json (optional): the surface under a tile, which terrain without its own render.base is drawn on. */
export function validateGround(ground, rules, problems) {
  if (ground === undefined) return;
  if (!isObj(ground) || !Object.keys(ground).length) return problems.push('ground.json must be a non-empty object');
  for (const [id, gr] of Object.entries(ground)) {
    if (!isObj(gr) || !isStr(gr.name)) { problems.push(`ground "${id}": name is required`); continue; }
    if (!isObj(gr.render) || !isColor(gr.render.base)) problems.push(`ground "${id}": render.base must be a hex color`);
    else {
      if (gr.render.mini !== undefined && !isColor(gr.render.mini)) problems.push(`ground "${id}": render.mini must be a hex color`);
      if (gr.render.decor !== undefined && !isStr(gr.render.decor)) problems.push(`ground "${id}": render.decor must be a name`);
    }
  }
  if (!(rules.defaultGround in ground)) problems.push(`rules: defaultGround must name a ground in ground.json (got ${JSON.stringify(rules.defaultGround)})`);
}

export function validateWeapons(weapons, rules, problems) {
  if (!isObj(weapons)) return problems.push('weapons.json must be an object');
  const modes = Object.keys(rules.targetModes || {});
  for (const [id, w] of Object.entries(weapons)) {
    if (!isObj(w)) { problems.push(`weapon "${id}" must be an object`); continue; }
    if (!isStr(w.name)) problems.push(`weapon "${id}": name is required`);
    if (w.indirect !== undefined && w.indirect !== true) problems.push(`weapon "${id}": indirect must be true when present`);
    if (w.indirect && Array.isArray(w.range) && w.range[0] < 2) problems.push(`weapon "${id}": an indirect weapon needs a minimum range of at least 2`);
    if (w.fx !== undefined && !isStr(w.fx)) problems.push(`weapon "${id}": fx (the attack animation, overriding the unit's) must be a name`);
    if (!isNum(w.damage) || w.damage <= 0) problems.push(`weapon "${id}": damage must be a positive number`);
    if (w.armorPiercing !== undefined && !(isNum(w.armorPiercing) && w.armorPiercing >= 0 && w.armorPiercing <= 1)) problems.push(`weapon "${id}": armorPiercing must be a number from 0 to 1`);
    if (w.targetMultipliers !== undefined) {
      const m = w.targetMultipliers;
      if (!isObj(m) || Object.entries(m).some(([mode, f]) => !(Array.isArray(w.targets) && w.targets.includes(mode)) || !isNum(f) || f <= 0)) {
        problems.push(`weapon "${id}": targetMultipliers must map target modes the weapon can fire at to positive numbers`);
      }
    }
    if (!Array.isArray(w.range) || w.range.length !== 2 || !w.range.every(Number.isInteger) || w.range[0] < 1 || w.range[0] > w.range[1]) {
      problems.push(`weapon "${id}": range must be [min, max] integers with 1 <= min <= max`);
    }
    if (!Array.isArray(w.targets) || !w.targets.length || w.targets.some((m) => !modes.includes(m))) {
      problems.push(`weapon "${id}": targets must be a non-empty list of known target modes (known: ${modes.join(', ')})`);
    }
  }
}

export function validateUnits(units, terrain, rules, weapons, problems) {
  if (!isObj(units) || !Object.keys(units).length) return problems.push('units.json must be a non-empty object');
  const layers = Object.keys(rules.layers || {});
  for (const [id, u] of Object.entries(units)) {
    if (!isObj(u)) { problems.push(`unit "${id}" must be an object`); continue; }
    if (!isStr(u.name)) problems.push(`unit "${id}": name is required`);
    if (!isStr(u.category)) problems.push(`unit "${id}": category is required`);
    if (!Number.isInteger(u.cost) || u.cost < 1) problems.push(`unit "${id}": cost must be a positive integer`);
    if (!Number.isInteger(u.move) || u.move < 0) problems.push(`unit "${id}": move must be a non-negative integer`);
    if (!(rules.moveClasses || []).includes(u.moveClass)) problems.push(`unit "${id}": unknown moveClass "${u.moveClass}"`);
    if (!layers.includes(u.layer)) problems.push(`unit "${id}": unknown layer "${u.layer}"`);
    if (u.weapons !== undefined && (!Array.isArray(u.weapons) || u.weapons.some((w) => !isObj(weapons) || !weapons[w]))) {
      problems.push(`unit "${id}": weapons must be a list of weapon ids from weapons.json`);
    }
    if (u.toughness !== undefined && !(isNum(u.toughness) && u.toughness > 0)) problems.push(`unit "${id}": toughness must be a positive number (1 = no bonus)`);
    if (u.armor !== undefined && !(isNum(u.armor) && u.armor >= 0 && u.armor <= 1)) problems.push(`unit "${id}": armor must be a number from 0 to 1`);
    if (u.attributes && u.attributes.indirect && Array.isArray(u.weapons) && isObj(weapons)) {
      for (const w of u.weapons) if (weapons[w] && Array.isArray(weapons[w].range) && weapons[w].range[0] < 2) problems.push(`unit "${id}": attribute "indirect" requires every weapon to have a minimum range of at least 2 ("${w}" does not)`);
    }
    if (!isObj(u.render) || !isStr(u.render.sprite)) problems.push(`unit "${id}": render.sprite is required`);
    const dive = u.attributes && u.attributes.submerge;
    if (isObj(dive) && isStr(dive.layer)) {
      if (!layers.includes(dive.layer)) problems.push(`unit "${id}": attribute "submerge" names unknown layer "${dive.layer}"`);
      else if (dive.layer === u.layer) problems.push(`unit "${id}": attribute "submerge" must name a layer other than the unit's own ("${u.layer}")`);
    }
    checkAttributes('unit', id, u, UNIT_ATTRIBUTES, problems);
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
  else {
    for (const k of weightKeys) if (!isNum(ai.weights[k])) problems.push(`ai: weights.${k} must be a number`);
    if (ai.weights.blockCapture !== undefined && !isNum(ai.weights.blockCapture)) problems.push('ai: weights.blockCapture must be a number');
    if (ai.weights.crowFlies !== undefined && !isNum(ai.weights.crowFlies)) problems.push('ai: weights.crowFlies must be a number');
  }
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

/** Validate a full raw data bundle: { rules, factions, terrain, weapons, units, ai } plus an optional `ground`. */
export function validateData(raw) {
  const problems = [];
  validateRules(raw.rules, problems);
  const rules = isObj(raw.rules) ? raw.rules : {};
  validateFactions(raw.factions, problems);
  validateTerrain(raw.terrain, rules, problems, raw.ground !== undefined);
  validateGround(raw.ground, rules, problems);
  validateWeapons(raw.weapons, rules, problems);
  validateUnits(raw.units, raw.terrain, rules, raw.weapons, problems);
  validateAi(raw.ai, raw.units, problems);
  return problems;
}

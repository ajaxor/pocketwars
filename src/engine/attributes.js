// Attribute catalogue.
//
// Any special-case rule for a unit or terrain is expressed as a named *attribute* in the entity's
// JSON (`"attributes": { ... }`) instead of an `if (unit.id === 'tank')` check in code. This file is
// the single place that declares which attributes exist, what they mean and how their config is
// validated. Engine code asks `hasAttribute(def, 'capture')`; it never looks at ids.
//
// Adding a new attribute:
//   1. Add an entry below (doc + check).
//   2. Enforce it in the relevant engine module.
//   3. Add a test in tests/attributes/ that proves the attribute (and only the attribute) changes behaviour.

const isFlag = (v) => v === true;

/** Attributes that may appear in units.json -> attributes. */
export const UNIT_ATTRIBUTES = {
  capture: {
    label: 'Captures',
    help: 'Can capture the property it stands on. Each turn adds its current HP to the capture points; when they reach the total the property changes hands.',
    doc: 'Can capture properties (cities, HQ, factories...) it stands on. Progress per capture action equals the unit\'s current HP.',
    check: (v, e, fail) => { if (!isFlag(v)) fail('must be true'); },
  },
  indirect: {
    label: 'Indirect fire',
    help: 'Fires over a distance. It cannot move and attack in the same turn, and it never counterattacks or gets counterattacked.',
    doc: 'Artillery-style fire: cannot move and attack in the same turn, never counterattacks, and is never counterattacked by the unit it hits. Every weapon of the unit needs a minimum range of at least 2 (checked with the weapons table). Unrelated to the weapon target modes direct_ground / indirect_ground, which decide whether obstacles block a shot.',
    check: (v, e, fail) => { if (!isFlag(v)) fail('must be true'); },
  },
  ignoresTerrainDefense: {
    label: 'Ignores cover',
    help: 'Terrain gives it no protection, so it takes full damage wherever it is.',
    doc: 'Terrain defense stars do not reduce damage this unit takes (e.g. aircraft).',
    check: (v, e, fail) => { if (!isFlag(v)) fail('must be true'); },
  },
  terrainDefenseMultiplier: {
    label: (v) => `Cover x${v}`,
    help: (v) => `Gets ${v} times the defense from terrain, so cover helps it far more.`,
    doc: 'Multiplies the terrain defense this unit gets (e.g. 2 doubles it). Does nothing on 0-defense terrain, and is moot with ignoresTerrainDefense.',
    check: (v, e, fail) => { if (typeof v !== 'number' || !Number.isFinite(v) || v <= 1) fail('must be a number greater than 1'); },
  },
};

/** Attributes that may appear in terrain.json -> attributes. */
export const TERRAIN_ATTRIBUTES = {
  property: {
    label: 'Property',
    help: 'Can be owned and captured. It earns income and repairs units standing on it.',
    doc: 'An ownable, capturable tile. Config: income (funds per turn), capturePoints (needed to flip owner), repair (HP restored each turn to units on it, if owned), builds (unit categories the owner may build here).',
    check: (v, e, fail) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return fail('must be an object');
      if (!Number.isInteger(v.income) || v.income < 0) fail('income must be a non-negative integer');
      if (!Number.isInteger(v.capturePoints) || v.capturePoints < 1) fail('capturePoints must be a positive integer');
      if (typeof v.repair !== 'number' || v.repair < 0) fail('repair must be a non-negative number');
      if (!Array.isArray(v.builds) || v.builds.some((c) => typeof c !== 'string')) fail('builds must be an array of unit category names');
    },
  },
  blocksLineOfSight: {
    label: 'Blocks line of sight',
    help: 'Blocks direct fire passing over it, so units behind it cannot be hit from the far side.',
    doc: 'An obstacle: direct fire cannot pass over this tile. The number is its height (forest 1, mountain and buildings 2); a firer standing on a tile whose `vantage` is higher shoots over it. The tiles at either end of a shot never block it, and units never block.',
    check: (v, e, fail) => { if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) fail('must be a positive number'); },
  },
  vantage: {
    label: 'High ground',
    help: 'High ground: a direct-fire unit standing here can shoot over obstacles lower than this.',
    doc: 'A high position: a direct-fire unit standing here is not blocked by obstacles (blocksLineOfSight) lower than this number.',
    check: (v, e, fail) => { if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) fail('must be a positive number'); },
  },
  victoryOnCapture: {
    label: 'Capture to win',
    help: 'Capture it to win the game.',
    doc: 'Capturing this tile wins the game for the capturing player (an HQ). Requires the property attribute.',
    check: (v, e, fail) => {
      if (!isFlag(v)) fail('must be true');
      if (!e.attributes || !e.attributes.property) fail('requires the property attribute');
    },
  },
};

/** Short player-facing name of an attribute (catalogue `label`: a string, or a function of the attribute's config). */
export function attributeLabel(catalogue, name, config) {
  const label = catalogue[name]?.label;
  return typeof label === 'function' ? label(config) : label || name;
}

/** A sentence telling the player what an attribute does (catalogue `help`: a string, or a function of the config). */
export function attributeHelp(catalogue, name, config) {
  const help = catalogue[name]?.help;
  return typeof help === 'function' ? help(config) : help || null;
}

export const hasAttribute = (def, name) => !!def.attributes && def.attributes[name] != null && def.attributes[name] !== false;
export const attributeConfig = (def, name) => (hasAttribute(def, name) ? def.attributes[name] : undefined);

/** Validate an entity's `attributes` block against a catalogue; pushes messages onto `problems`. */
export function checkAttributes(kind, id, entity, catalogue, problems) {
  const attrs = entity.attributes;
  if (attrs === undefined) return;
  if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs)) {
    problems.push(`${kind} "${id}": attributes must be an object`);
    return;
  }
  for (const [name, value] of Object.entries(attrs)) {
    const spec = catalogue[name];
    if (!spec) {
      problems.push(`${kind} "${id}": unknown attribute "${name}" (known: ${Object.keys(catalogue).join(', ')})`);
      continue;
    }
    spec.check(value, entity, (msg) => problems.push(`${kind} "${id}": attribute "${name}" ${msg}`));
  }
}

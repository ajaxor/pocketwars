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
    doc: 'Can capture properties (cities, HQ, factories...) it stands on. Progress per capture action equals the unit\'s current HP.',
    check: (v, e, fail) => { if (!isFlag(v)) fail('must be true'); },
  },
  indirect: {
    doc: 'Artillery-style fire: cannot move and attack in the same turn, never counterattacks, and is never counterattacked by the unit it hits.',
    check: (v, e, fail) => {
      if (!isFlag(v)) fail('must be true');
      if (e.range && e.range[0] < 2) fail('requires a minimum range of at least 2');
    },
  },
  ignoresTerrainDefense: {
    doc: 'Terrain defense stars do not reduce damage this unit takes (e.g. aircraft).',
    check: (v, e, fail) => { if (!isFlag(v)) fail('must be true'); },
  },
};

/** Attributes that may appear in terrain.json -> attributes. */
export const TERRAIN_ATTRIBUTES = {
  property: {
    doc: 'An ownable, capturable tile. Config: income (funds per turn), capturePoints (needed to flip owner), repair (HP restored each turn to units on it, if owned), builds (unit categories the owner may build here).',
    check: (v, e, fail) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return fail('must be an object');
      if (!Number.isInteger(v.income) || v.income < 0) fail('income must be a non-negative integer');
      if (!Number.isInteger(v.capturePoints) || v.capturePoints < 1) fail('capturePoints must be a positive integer');
      if (typeof v.repair !== 'number' || v.repair < 0) fail('repair must be a non-negative number');
      if (!Array.isArray(v.builds) || v.builds.some((c) => typeof c !== 'string')) fail('builds must be an array of unit category names');
    },
  },
  victoryOnCapture: {
    doc: 'Capturing this tile wins the game for the capturing player (an HQ). Requires the property attribute.',
    check: (v, e, fail) => {
      if (!isFlag(v)) fail('must be true');
      if (!e.attributes || !e.attributes.property) fail('requires the property attribute');
    },
  },
};

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

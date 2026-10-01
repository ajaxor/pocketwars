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
  submerge: {
    label: 'Submerges',
    help: 'Can dive in deep water. A submerged unit is hidden from enemies unless one of them is next to it (or has sonar in range), and only weapons that can reach submerged targets can hit it.',
    doc: 'Can dive as an order (after moving), and surface again. Config: { layer } names the layer the unit is on while submerged (rules.json -> layers). If that layer is `hidden`, the unit is invisible to other players unless one of their units is adjacent or within `sonar` range. Diving needs a tile with the terrain attribute `submergible`; ending a move on any other tile brings the unit back up.',
    check: (v, e, fail) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return fail('must be an object like { "layer": "underwater" }');
      if (typeof v.layer !== 'string' || !v.layer) fail('layer must name a layer from rules.json');
    },
  },
  sonar: {
    label: (v) => `Sonar ${v}`,
    help: (v) => `Spots submerged enemies up to ${v} tiles away.`,
    doc: 'Detects hidden (submerged) enemy units within this many tiles. Every unit already notices hidden units on an adjacent tile; sonar extends that. The number is the range in tiles.',
    check: (v, e, fail) => { if (!Number.isInteger(v) || v < 2) fail('must be a whole number of tiles, at least 2 (adjacent units are always noticed)'); },
  },
  ammo: {
    label: (v) => `Ammo ${v.max}`,
    help: (v) => `Carries up to ${v.max} rounds. When it is down to ${v.low} or fewer a bullet flashes on its tile, and at 0 the bullet stays red. It is refilled by ending a turn next to a friendly property that resupplies it (an airfield, for aircraft).`,
    doc: 'A limited supply. Config: { max, low }. The unit starts full (`unit.ammo`). Weapons with an `ammo` cost spend it per shot and cannot fire without enough; the `deploy` attribute spends it too. It is shown on the tile as a bullet: flashing when ammo <= `low` (and above 0), steady red at 0. It is refilled by a terrain with the `resupply` attribute: see ammo.js.',
    check: (v, e, fail) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return fail('must be an object like { "max": 3, "low": 1 }');
      if (!Number.isInteger(v.max) || v.max < 1) fail('max must be a positive whole number');
      if (!Number.isInteger(v.low) || v.low < 0 || (Number.isInteger(v.max) && v.low >= v.max)) fail('low must be a whole number from 0 up to (not including) max');
    },
  },
  deploy: {
    label: (v, registry) => `Deploys ${registry?.units?.[v.unit]?.name ?? v.unit}`,
    help: (v, registry) => `Carries ${registry?.units?.[v.unit]?.name ?? v.unit} troops as ammo. Instead of waiting it can drop one onto a free tile next to it (the new unit gets a free move, but cannot attack that turn).`,
    doc: 'An order (after moving): put a new unit of type `unit` on a free tile next to where this one stopped, spending `ammo` (default 1) of its ammo. The new unit belongs to the same player, is at full HP, and gets a free move like a unit just built (`fresh`: move and Wait only). The tile must be enterable by the new unit. Requires the `ammo` attribute.',
    check: (v, e, fail) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return fail('must be an object like { "unit": "soldier", "ammo": 1 }');
      if (typeof v.unit !== 'string' || !v.unit) fail('unit must name a unit from units.json');
      if (v.ammo !== undefined && (!Number.isInteger(v.ammo) || v.ammo < 1)) fail('ammo (the cost of one drop) must be a positive whole number');
      if (!e.attributes || !e.attributes.ammo) fail('requires the ammo attribute');
      else if (Number.isInteger(v.ammo) && Number.isInteger(e.attributes.ammo.max) && v.ammo > e.attributes.ammo.max) fail('ammo (the cost of one drop) is more than the unit can carry');
    },
  },
};

/** Attributes that may appear in terrain.json -> attributes. */
export const TERRAIN_ATTRIBUTES = {
  property: {
    label: 'Property',
    help: 'Can be owned and captured. It earns income and repairs units standing on it.',
    doc: 'An ownable, capturable tile. Config: income (funds per turn), capturePoints (needed to flip owner), repair (HP restored each turn to units on it, if owned), builds (unit categories the owner may build here). A unit built here appears on the property itself and gets one free move (see `fresh` in game.js); each property builds at most one unit per turn.',
    check: (v, e, fail) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return fail('must be an object');
      if (!Number.isInteger(v.income) || v.income < 0) fail('income must be a non-negative integer');
      if (!Number.isInteger(v.capturePoints) || v.capturePoints < 1) fail('capturePoints must be a positive integer');
      if (typeof v.repair !== 'number' || v.repair < 0) fail('repair must be a non-negative number');
      if (!Array.isArray(v.builds) || v.builds.some((c) => typeof c !== 'string')) fail('builds must be an array of unit category names');
    },
  },
  resupply: {
    label: 'Resupplies',
    help: (v) => `Refills the ammo of friendly ${v.categories.join(' and ')} units that end a turn ${v.range === 0 ? 'on it' : v.range === 1 ? 'on or next to it' : `within ${v.range} tiles`}.`,
    doc: 'Refills ammo (see the unit attribute `ammo`). Config: { range, categories }: a unit of one of those categories, owned by the same player as this property, is resupplied when it stops within `range` tiles (Manhattan; 1 = on or next to it) and at the start of its owner\'s turn. When the stop is a Wait the unit also gets its move back (see ammo.js). Requires the `property` attribute.',
    check: (v, e, fail) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return fail('must be an object like { "range": 1, "categories": ["aircraft"] }');
      if (!Number.isInteger(v.range) || v.range < 0) fail('range must be a whole number of tiles (0 = only a unit standing on it)');
      if (!Array.isArray(v.categories) || !v.categories.length || v.categories.some((c) => typeof c !== 'string')) fail('categories must be a non-empty array of unit category names');
      if (!e.attributes || !e.attributes.property) fail('requires the property attribute');
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
  submergible: {
    label: 'Deep water',
    help: 'Deep enough for submarines to dive.',
    doc: 'A unit with the `submerge` attribute can only dive on tiles with this attribute (deep water). It is brought back up when its move ends anywhere else.',
    check: (v, e, fail) => { if (!isFlag(v)) fail('must be true'); },
  },
  victoryOnCapture: {
    label: 'Capture to win',
    help: 'Capture it to knock its owner out of the game.',
    doc: 'Capturing this tile eliminates the player it was taken from (an HQ): their units leave the board and their properties go neutral. The last player left wins. Requires the property attribute.',
    check: (v, e, fail) => {
      if (!isFlag(v)) fail('must be true');
      if (!e.attributes || !e.attributes.property) fail('requires the property attribute');
    },
  },
};

/** Short player-facing name of an attribute (catalogue `label`: a string, or a function of the attribute's config and the registry, for names of other entities). */
export function attributeLabel(catalogue, name, config, registry) {
  const label = catalogue[name]?.label;
  return typeof label === 'function' ? label(config, registry) : label || name;
}

/** A sentence telling the player what an attribute does (catalogue `help`: a string, or a function of the config and the registry). */
export function attributeHelp(catalogue, name, config, registry) {
  const help = catalogue[name]?.help;
  return typeof help === 'function' ? help(config, registry) : help || null;
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

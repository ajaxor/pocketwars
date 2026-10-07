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
    help: 'Can capture the property it stands on. Each turn adds its current HP (plus any bonus) to the capture points; when they reach the total the property changes hands.',
    doc: 'Can capture properties (cities, HQ, factories...) it stands on. Config: true, or { bonus } (a whole number of 1 or more). Progress per capture action equals the unit\'s current HP, plus the bonus (the flamethrower\'s 5).',
    check: (v, e, fail) => { if (isFlag(v)) return; if (!v || typeof v !== 'object' || Object.keys(v).some((k) => k !== 'bonus') || !Number.isInteger(v.bonus) || v.bonus < 1) fail('must be true or { bonus: whole number >= 1 }'); },
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
    help: (v) => v.auto ? 'Swims below the surface of deep water, hidden from enemies unless one of them is next to it (or has sonar in range); only weapons that reach submerged targets can hit it. On land it is an ordinary unit.' : 'Can dive in deep water. A submerged unit is hidden from enemies unless one of them is next to it (or has sonar in range), and only weapons that can reach submerged targets can hit it.',
    doc: 'Can dive as an order (after moving), and surface again. Config: { layer } names the layer the unit is on while submerged (rules.json -> layers). If that layer is `hidden`, the unit is invisible to other players unless one of their units is adjacent or within `sonar` range. Diving needs a tile with the terrain attribute `submergible`; ending a move on any other tile brings the unit back up. `auto: true` (the diver) removes the Submerge and Surface orders: the unit is down whenever it stands on submergible terrain and up everywhere else.',
    check: (v, e, fail) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return fail('must be an object like { "layer": "underwater" }');
      if (typeof v.layer !== 'string' || !v.layer) fail('layer must name a layer from rules.json');
      if (v.auto !== undefined && typeof v.auto !== 'boolean') fail('auto must be true or false');
      if (v.move !== undefined && (!Number.isInteger(v.move) || v.move < 1)) fail('move (the speed while down) must be a positive whole number');
    },
  },
  surfacesToFire: {
    label: 'Surfaces to fire',
    help: 'If it fires while submerged it comes up, and stays exposed until it dives again.',
    doc: 'A unit that is submerged and attacks is brought up by the attack (a \'surface\' event follows the strike): it stays visible and can be hit by anything that reaches surface ships until it dives again (the missile sub). Requires the `submerge` attribute.',
    check: (v, e, fail) => {
      if (!isFlag(v)) fail('must be true');
      if (!e.attributes || !e.attributes.submerge) fail('requires the submerge attribute');
    },
  },
  supply: {
    label: 'Supplies',
    help: (v) => `Supply order (after moving, instead of Wait): refills the ammo of friendly ${v.categories.join(', ')} units next to it${v.repair ? ` and repairs them ${v.repair} HP` : ''}, paying the usual price per round.`,
    doc: 'A support order. Config: { categories, repair?, fuelTags? }. It also refuels units that use fuel (free): all of them, or only those with one of the unit tags in `fuelTags` (the supply truck refuels helicopters but not planes), and the same units are refuelled at the start of their owner\'s turn when next to this unit (fuel.js). After moving (or staying put) a `supply` order refills the ammo of every friendly unit of one of those categories on a tile next to the unit, charging the owner the price of each round that stands for a unit (ammo.js roundCost; plain ammunition is free), and heals them `repair` HP (free) when given. Only offered when someone nearby needs it. See supply.js.',
    check: (v, e, fail) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return fail('must be an object like { "categories": ["aircraft"], "repair": 2 }');
      if (!Array.isArray(v.categories) || !v.categories.length || v.categories.some((c) => typeof c !== 'string' || !c)) fail('categories must be a non-empty array of unit category names');
      if (v.repair !== undefined && (!Number.isInteger(v.repair) || v.repair < 1)) fail('repair must be a positive whole number of HP');
      if (v.fuelTags !== undefined && (!Array.isArray(v.fuelTags) || !v.fuelTags.length || v.fuelTags.some((t) => typeof t !== 'string' || !t))) fail('fuelTags must be a non-empty array of unit tags (only units with one of them are refuelled; without it every unit of the categories is)');
    },
  },
  structure: {
    label: 'Structure',
    help: (v) => `A fixed structure: it never moves and takes no orders, and cannot be captured, carried, healed or built. Artillery, bombs and missiles hit it ${'hard'}; everything else barely scratches it${v?.durability ? ` (durability ${v.durability})` : ''}. A neutral one (dark grey) belongs to nobody and is hostile to everyone.`,
    doc: 'A fixed defence or a breakable wall section, placed by the map (structures.js). Config: true, or { durability } (default 1). It never moves (move 0) and takes no orders (turrets fire by themselves at the end of their owner\'s turn), is never built (keep it `exclusive` and out of every menu), cannot be captured, carried, healed or supplied, and does not count as a unit when deciding whether its owner is defeated. Leader formations keep it. DAMAGE: a structure ignores armor, toughness and terrain; a hit does weapon damage x attacker HP / 10 x `rules.structureDamage.siege` for a `siege` weapon (artillery, bombs, missiles) or `.other` for anything else, divided by the durability. A map may give it no owner (`owner: null`): a neutral structure is an enemy of every player. When its owner is knocked out it turns neutral.',
    check: (v, e, fail) => {
      if (v !== true && !(v && typeof v === 'object' && !Array.isArray(v) && typeof v.durability === 'number' && v.durability > 0)) fail('must be true or { "durability": <positive number> }');
      if (e.move !== 0) fail('requires move 0 (a structure never moves)');
    },
  },
  wallSection: {
    label: 'Wall section',
    help: 'A breakable piece of wall: once destroyed it leaves rubble that units can cross.',
    doc: 'A breakable section of a wall (the cracked wall). It is drawn by the wall layer (with `render.inWall`), turrets never shoot at it, and the AI only shoots it when nothing better is in reach, to open the way (`breakWall` in ai.json). Requires `structure`.',
    check: (v, e, fail) => { if (!isFlag(v)) fail('must be true'); if (!e.attributes?.structure) fail('requires the structure attribute'); },
  },
  jammer: {
    label: 'Jammer',
    help: 'While any jammer stands on the map, human players fight in fog of war. Destroy every jammer to lift it.',
    doc: 'Fog of war (fog.js): while at least one unit with this attribute is on the board, every human player only sees what their units and properties see. Computer players are never fogged. Who owns the jammer does not matter.',
    check: (v, e, fail) => { if (!isFlag(v)) fail('must be true'); },
  },
  blocksLineOfSight: {
    label: 'Blocks line of sight',
    help: 'Blocks direct fire and sight passing over it, like a wall.',
    doc: 'The unit is an obstacle for line of sight while it stands, with this height, exactly like the terrain attribute of the same name (sight.js). Meant for structures such as the cracked wall.',
    check: (v, e, fail) => { if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) fail('must be a positive number'); },
  },
  reloads: {
    label: 'Reloads',
    help: 'If it does not move during a turn it is fully reloaded at the start of the next.',
    doc: 'Free self-resupply while still: at the start of its owner\'s turn a unit that did not change tile during its last turn gets its ammo back to full (heal.js). Requires the `ammo` attribute.',
    check: (v, e, fail) => {
      if (!isFlag(v)) fail('must be true');
      if (!e.attributes || !e.attributes.ammo) fail('requires the ammo attribute');
    },
  },
  layMines: {
    label: 'Lays mines',
    help: (v, registry) => `Lay order (after moving, instead of Wait): puts a hidden ${registry?.units?.[v.unit]?.name ?? v.unit} on any empty sea tile within ${v.range} tiles. Each mine uses one round of ammo; Resupply next to a shipyard buys more (${(registry?.units?.[v.unit]?.cost ?? 0).toLocaleString('en-US')} credits each).`,
    doc: 'Config: { unit, range }. A `lay` order (after moving, ends the unit\'s turn) puts a new unit of type `unit` (which needs the `mine` attribute) on an empty tile within `range` tiles that its move class can enter, costing one round of the layer\'s ammo (so it needs the `ammo` attribute); a round is bought back at that unit\'s price (ammo.js roundCost). See mines.js.',
    check: (v, e, fail) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return fail('must be an object like { "unit": "sea_mine", "range": 2 }');
      if (typeof v.unit !== 'string' || !v.unit) fail('unit must name a unit from units.json');
      if (!Number.isInteger(v.range) || v.range < 1) fail('range must be a positive whole number of tiles');
      if (!e.attributes || !e.attributes.ammo) fail('requires the ammo attribute (each mine costs a round)');
    },
  },
  mine: {
    label: 'Mine',
    help: (v) => `Hidden unless an enemy unit is next to it. When an enemy ${v.triggers.join(' or ')} unit runs into it the mine explodes for ${v.damage} damage and the rest of that unit's move is cancelled. It never moves or acts. Aircraft fly over it and infantry do not set it off.`,
    doc: 'A mine. Config: { damage, triggers }. The unit never acts (it starts and stays `done`). It sits on a hidden layer; when an enemy move is interrupted by it (game.js act) and the mover\'s category is one of `triggers` (and the mover lacks `ignoresMines`), the mine detonates: `damage` HP off the mover (it can kill), the mine is removed, and the mover\'s move is cancelled where it stands. Other movers are simply stopped, revealing the mine. Aircraft (airborne layers) pass over mines. See mines.js.',
    check: (v, e, fail) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return fail('must be an object like { "damage": 4, "triggers": ["naval", "vehicle"] }');
      if (typeof v.damage !== 'number' || !(v.damage > 0)) fail('damage must be a positive number of HP');
      if (!Array.isArray(v.triggers) || !v.triggers.length || v.triggers.some((c) => typeof c !== 'string' || !c)) fail('triggers must be a non-empty array of unit category names');
    },
  },
  ignoresMines: {
    label: 'Mine-proof',
    help: 'Floats clear of mines: they never go off under it, and it is not stopped by them.',
    doc: 'Mines do not detonate for this unit (the hover tank). It still cannot stop on a hidden mine\'s tile.',
    check: (v, e, fail) => { if (!isFlag(v)) fail('must be true'); },
  },
  sonar: {
    label: (v) => `Sonar ${v}`,
    help: (v) => `Spots submerged enemies up to ${v} tiles away.`,
    doc: 'Detects hidden (submerged) enemy units within this many tiles. Every unit already notices hidden units on an adjacent tile; sonar extends that. The number is the range in tiles.',
    check: (v, e, fail) => { if (!Number.isInteger(v) || v < 2) fail('must be a whole number of tiles, at least 2 (adjacent units are always noticed)'); },
  },
  ammo: {
    label: (v) => `Ammo ${v.max}`,
    help: (v) => `Carries up to ${v.max} rounds. When it is down to ${v.low} or fewer a bullet flashes on its tile, and at 0 the bullet stays red. It is refilled by choosing Resupply (free, except for rounds that are soldiers or mines) (in place of Wait, and it ends the turn) next to a friendly property that resupplies it (an airfield, for aircraft).`,
    doc: 'A limited supply. Config: { max, low }. Refilling is free, except that a round standing for a unit (`deploy`, `layMines`) costs the price of that unit. The unit starts full (`unit.ammo`). Weapons with an `ammo` cost spend it per shot and cannot fire without enough; the `deploy` attribute spends it too. It is shown on the tile as a bullet: flashing when ammo <= `low` (and above 0), steady red at 0. It is refilled by a terrain with the `resupply` attribute: see ammo.js.',
    check: (v, e, fail) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return fail('must be an object like { "max": 3, "low": 1 }');
      if (!Number.isInteger(v.max) || v.max < 1) fail('max must be a positive whole number');
      if (!Number.isInteger(v.low) || v.low < 0 || (Number.isInteger(v.max) && v.low >= v.max)) fail('low must be a whole number from 0 up to (not including) max');
    },
  },
  fuel: {
    label: (v) => `Fuel ${v.max}`,
    help: (v) => `Burns 1 fuel every turn, whether it flies or sits still; it can still fly on an empty tank. A can flashes on its tile when it is down to ${v.low} or fewer, and stays red at 0. It refuels for free at the start of its owner's turn on or next to an airfield of theirs, an aircraft carrier of theirs (or, for helicopters, a supply truck), and when it Resupplies. A unit that begins its turn with an empty tank crashes when the turn ends.`,
    doc: 'A limited range for flyers. Config: { max, low }. The unit starts full (`unit.fuel`); the unit burns 1 as its owner\'s turn ends, moved or not (fuel.js burnFuel; the tank never limits a move, it floors at 0), and it is shown as a fuel can bottom left of its tile: flashing when fuel <= `low` (and above 0), steady red at 0. Refuelling is free: at the start of its owner\'s turn, when a terrain with the `resupply` attribute for its category is in range, an aircraft carrier (a friendly unit whose `supply` covers its category) is next to it, or a friendly supply unit whose `supply` has `fuelTags` matching the unit\'s tags is next to it; also by the Resupply and Supply orders. A unit that starts its turn at 0 (`unit.fuelOut`) is destroyed when that turn ends unless it was refuelled. Only meaningful for units that move without touching the ground.',
    check: (v, e, fail) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return fail('must be an object like { "max": 30, "low": 6 }');
      if (!Number.isInteger(v.max) || v.max < 1) fail('max must be a positive whole number of tiles');
      if (!Number.isInteger(v.low) || v.low < 0 || (Number.isInteger(v.max) && v.low >= v.max)) fail('low must be a whole number from 0 up to (not including) max');
    },
  },
  attacksPerTurn: {
    label: (v) => `Attacks x${v}`,
    help: (v) => `Can attack ${v} times in one turn, at the same or different targets. It cannot move between the attacks, so after the first one it fires again from where it stands (or waits).`,
    doc: 'Several attacks per turn. Config: a whole number of at least 2. An order that ends in an attack does not end the unit\'s turn while it has attacks left (`unit.attacks` counts them, cleared when its owner\'s turn starts): the unit is `halted` where it stands, exactly as after an interrupted move (it keeps whether it moved, so a unit that moved still cannot use indirect weapons), and its next order can only be another attack or Wait from the same tile. Each attack is resolved on its own, counterattack included, and spends ammo normally. See game.js act.',
    check: (v, e, fail) => { if (!Number.isInteger(v) || v < 2) fail('must be a whole number of at least 2 (the attacks per turn)'); },
  },
  deploy: {
    label: (v, registry) => `Deploys ${registry?.units?.[v.unit]?.name ?? v.unit}`,
    help: (v, registry) => `Carries ${v.basic ? 'its leader\'s basic infantry' : registry?.units?.[v.unit]?.name ?? v.unit} troops as ammo. Once a turn, before or after it moves, Deploy places one on it, and you then move and order it as normal (it can attack). Cancel puts it back.`,
    doc: 'A separate action, like a factory building a unit: before or after the carrier\'s own move-and-act order (not part of it), once per turn, spending `ammo` (default 1) of its ammo. With `basic: true` the type is the basic infantry of the carrier\'s leader (loadouts.json -> infantry; `unit` is the fallback for a player without one). A new unit of that type is placed on the carrier\'s tile and is ordered with the normal move-and-act order (it must leave the tile; it can attack); until ordered it can be put back (game.cancelDeploy, which returns the ammo). It belongs to the same player at full HP. A carrier that was just built cannot deploy. Requires the `ammo` attribute. See deploy.js.',
    check: (v, e, fail) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return fail('must be an object like { "unit": "soldier", "ammo": 1 }');
      if (typeof v.unit !== 'string' || !v.unit) fail('unit must name a unit from units.json');
      if (v.basic !== undefined && typeof v.basic !== 'boolean') fail('basic must be true or false');
      if (v.ammo !== undefined && (!Number.isInteger(v.ammo) || v.ammo < 1)) fail('ammo (the cost of one drop) must be a positive whole number');
      if (!e.attributes || !e.attributes.ammo) fail('requires the ammo attribute');
      else if (Number.isInteger(v.ammo) && Number.isInteger(e.attributes.ammo.max) && v.ammo > e.attributes.ammo.max) fail('ammo (the cost of one drop) is more than the unit can carry');
    },
  },
  cloak: {
    label: 'Cloaked',
    help: (v) => (v === true ? 'Hidden from the enemy unless one of their units is next to it or has radar in range. A hidden unit cannot be targeted, and what it hits cannot answer unless it can see the attacker.'
      : `Hidden from the enemy while on ${v.terrain.join(' or ')}${v.revealedByFiring ? ', until it fires (it stays visible through the enemy\'s next turn)' : ''}, unless an enemy unit is next to it or has radar in range.`),
    doc: 'Always hidden (like a submerged unit, but on its own layer): other players cannot see it, target it or plan around it unless one of their units is adjacent or within `radar` range. The owner always sees it. It is found out when an enemy move runs into it (an interrupt). A cloaked unit that attacks is not answered by a counterattack unless the defender can see it (an adjacent defender can). Config `true`: cloaked everywhere. Config `{ terrain: [ids], revealedByFiring? }`: cloaked only while standing on one of those terrains (a sniper in the woods); with `revealedByFiring` an attack lifts the cloak (`unit.revealed`) until the start of its owner\'s next turn. See detection.js.',
    check: (v, e, fail) => {
      if (isFlag(v)) return;
      if (!v || typeof v !== 'object' || Array.isArray(v)) return fail('must be true or an object like { "terrain": ["forest"], "revealedByFiring": true }');
      if (!Array.isArray(v.terrain) || !v.terrain.length || v.terrain.some((t) => typeof t !== 'string' || !t)) fail('terrain must be a non-empty array of terrain ids');
      if (v.revealedByFiring !== undefined && typeof v.revealedByFiring !== 'boolean') fail('revealedByFiring must be true or false');
    },
  },
  radar: {
    label: (v) => `Radar ${v}`,
    help: (v) => `Spots cloaked enemies up to ${v} tiles away.`,
    doc: 'Detects cloaked (`cloak`) enemy units within this many tiles. Adjacent units are always noticed, as with sonar; sonar is the same for submerged units. The number is the range in tiles.',
    check: (v, e, fail) => { if (!Number.isInteger(v) || v < 2) fail('must be a whole number of tiles, at least 2 (adjacent units are always noticed)'); },
  },
  moveFirePenalty: {
    label: (v) => `Moving: x${v.multiplier}`,
    help: (v) => `Its weapon does ${Math.round(v.multiplier * 100)}% damage when it moved this turn before firing; standing still it hits at full strength. Counterattacks are never reduced.`,
    doc: 'Config: { multiplier } (0 to 1). When the unit fires after changing tile this turn (`unit.moved`, or a hypothetical firing tile that differs from where it stands) its weapon damage is multiplied by `multiplier`. A counterattack is never reduced. See combat.js.',
    check: (v, e, fail) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return fail('must be an object like { "multiplier": 0.5 }');
      if (typeof v.multiplier !== 'number' || !(v.multiplier > 0 && v.multiplier <= 1)) fail('multiplier must be a number above 0 and up to 1');
    },
  },
  heal: {
    label: (v) => `Heals ${v.amount}`,
    help: (v) => `Heal order (after moving, instead of Wait): each damaged friendly ${v.categories.join(' or ')} unit next to it regains up to ${v.amount} HP${v.costRate ? `, for ${Math.round(v.costRate * 100)}% of the unit's price per HP` : ''}.`,
    doc: 'Support healing. Config: { amount, categories, costRate? }. A `heal` order (after moving, like capture or resupply) restores up to `amount` HP (not above max) to every damaged friendly unit of one of those categories on a tile next to the healer. `costRate` is the price of one HP as a fraction of the healed unit\'s cost, paid from the owner\'s funds (0 or absent: free); with too little money it heals what it can pay for. The order is only offered when someone can be healed. See heal.js.',
    check: (v, e, fail) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return fail('must be an object like { "amount": 2, "categories": ["infantry"], "costRate": 0.1 }');
      if (!Number.isInteger(v.amount) || v.amount < 1) fail('amount must be a positive whole number of HP');
      if (!Array.isArray(v.categories) || !v.categories.length || v.categories.some((c) => typeof c !== 'string' || !c)) fail('categories must be a non-empty array of unit category names');
      if (v.costRate !== undefined && !(typeof v.costRate === 'number' && v.costRate >= 0 && v.costRate <= 1)) fail('costRate must be a number from 0 to 1');
    },
  },
  rest: {
    label: (v) => `Rests +${v.heal}`,
    help: (v) => `If it does not move during a turn it regains ${v.heal} HP at the start of the next.`,
    doc: 'Self-healing while still. Config: { heal }. At the start of its owner\'s turn a unit that did not change tile during its last turn regains `heal` HP (not above max). Attacking or waiting in place counts as still. See heal.js.',
    check: (v, e, fail) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return fail('must be an object like { "heal": 1 }');
      if (!Number.isInteger(v.heal) || v.heal < 1) fail('heal must be a positive whole number of HP');
    },
  },
};

/** Attributes that may appear in terrain.json -> attributes. */
export const TERRAIN_ATTRIBUTES = {
  property: {
    label: 'Property',
    help: 'Can be owned and captured. It earns income and repairs units standing on it.',
    doc: 'An ownable, capturable tile. Config: income (funds per turn), capturePoints (needed to flip owner), repair (HP restored each turn to units on it, if owned), builds (unit categories the owner may build here; a leader\'s loadout in data/loadouts.json can give the building its own list of units instead, see economy.js). A unit built here appears on the property itself and gets one free move (see `fresh` in game.js); each property builds at most one unit per turn.',
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
    help: (v) => `Refills the ammo of friendly ${v.categories.join(' and ')} units that Resupply ${v.range === 0 ? 'on it' : v.range === 1 ? 'on or next to it' : `within ${v.range} tiles`}.`,
    doc: 'Refills ammo (see the unit attribute `ammo`). Config: { range, categories }: a unit of one of those categories, owned by the same player as this property, is resupplied when it stops within `range` tiles (Manhattan; 1 = on or next to it) and takes the Resupply action (offered in place of Wait while it is short); nothing is refilled automatically. Resupply costs money and ends the unit\'s turn (see ammo.js). Requires the `property` attribute.',
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
  wall: {
    label: (v) => (v === true ? 'Wall' : 'Breakable wall'),
    help: (v) => (v === true ? 'A wall: nothing can cross it.' : 'Where a cracked wall stands. Once the cracked wall is destroyed, units can cross the rubble.'),
    doc: 'A wall tile, drawn as linked pipes (render/walls.js); walls link to every neighbouring tile with this attribute. `true`: a solid wall (give it null move costs). `{ structure: <unit id> }`: a breakable section: when the game starts a neutral unit of that type (a structure, e.g. the cracked wall) is placed on it unless the map already put a unit there; while it stands it blocks the tile, and once it is destroyed the tile is open rubble with this terrain\'s own move costs.',
    check: (v, e, fail) => {
      if (v === true) return;
      if (!v || typeof v !== 'object' || Array.isArray(v) || typeof v.structure !== 'string' || !v.structure) fail('must be true or { "structure": "<unit id>" }');
    },
  },
  visionBonus: {
    label: (v) => `Sight +${v}`,
    help: (v) => `In fog of war, a ground unit standing here sees ${v} tiles further.`,
    doc: 'Fog of war (fog.js): a unit that is not airborne sees this many tiles further from this tile (mountains).',
    check: (v, e, fail) => { if (!Number.isInteger(v) || v < 1) fail('must be a positive whole number'); },
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

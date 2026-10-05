// Every number the strategist plays by, with the range the tuner (tools/ai/tune.mjs) may move it in. data/ai.json engines.strategist
// holds the tuned values (`params`), a bias per unit type (`unitBias`, 0 = none; a unit that is not listed has none, so a new unit
// starts neutral and its worth comes from its stats) and a weight per strategy (`strategyWeight`, 1 = as written). Anything missing
// takes the default below, so the profile can be empty.

export const PARAMS = {
  // ---- moving and fighting (tactics.js) ----
  distance:       { def: 2,    min: 0.5, max: 5,    doc: 'per move point of distance to the unit\'s goal' },
  terrain:        { def: 0.5,  min: 0,   max: 3,    doc: 'per terrain defense star where the unit stops' },
  attack:         { def: 10,   min: 2,   max: 30,   doc: 'per 1000 of enemy value an attack takes off' },
  counter:        { def: 0.8,  min: 0,   max: 2,    doc: 'times the value the counterattack takes off the attacker' },
  kill:           { def: 8,    min: 0,   max: 30,   doc: 'bonus for destroying the target' },
  focus:          { def: 6,    min: 0,   max: 20,   doc: 'bonus for hitting a target the rest of the army can then finish' },
  threat:         { def: 4,    min: 0,   max: 20,   doc: 'per 1000 of own value the enemy could take off next turn where the unit stops' },
  balance:        { def: 1,    min: 0,   max: 2,    doc: 'how much the balance of forces changes caution (0: not at all): stronger presses on, weaker holds back' },
  capture:        { def: 40,   min: 10,  max: 100,  doc: 'for capturing (or carrying on capturing) a property' },
  captureIncome:  { def: 8,    min: 0,   max: 30,   doc: 'more per 1000 income the property earns' },
  hqCapture:      { def: 120,  min: 20,  max: 300,  doc: 'more for capturing the enemy HQ' },
  blockCapture:   { def: 6,    min: 0,   max: 20,   doc: 'cost of parking on someone else\'s property without capturing it' },
  retreatHp:      { def: 3.5,  min: 0,   max: 7,    doc: 'HP at or under which a unit goes home to be repaired' },
  heal:           { def: 2,    min: 0,   max: 6,    doc: 'per HP x 1000 of value healed or supplied' },
  guard:          { def: 1.5,  min: 0,   max: 6,    doc: 'per own unit nearby (a unit on its own is easier to gang up on)' },
  land:           { def: 25,   min: 0,   max: 80,   doc: 'for a carrier dropping troops where they can reach a property' },
  unreachable:    { def: 60,   min: 10,  max: 150,  doc: 'distance assumed when there is no route at all to a goal' },
  // ---- production (production.js) ----
  costExponent:   { def: 0.55, min: 0.2, max: 1,    doc: 'utility is divided by cost to this power: 1 favours cheap units, 0 expensive ones' },
  minUtility:     { def: 0.08, min: 0,   max: 1,    doc: 'a unit worth less than this (for its price) is not built: the money is kept' },
  offense:        { def: 1,    min: 0.2, max: 3,    doc: 'weight of the damage a type deals to what the enemy fields' },
  defense:        { def: 0.6,  min: 0,   max: 2,    doc: 'weight of the damage the enemy deals to it' },
  captureNeed:    { def: 1.2,  min: 0,   max: 4,    doc: 'worth of a capturer per property it could still take' },
  carrierNeed:    { def: 1.5,  min: 0,   max: 5,    doc: 'worth of a carrier when there is land worth taking that walkers cannot reach' },
  support:        { def: 0.4,  min: 0,   max: 2,    doc: 'worth of a healer, supplier or radar per unit it would look after' },
  sameType:       { def: 0.8,  min: 0.4, max: 1,    doc: 'each unit of the same type already owned multiplies a type\'s worth by this' },
  potential:      { def: 0.35, min: 0,   max: 1,    doc: 'how much what the enemy COULD build counts next to what they have' },
  // ---- strategy (selector.js) ----
  reviewDays:     { def: 3,    min: 1,   max: 8,    doc: 'days between reviews of how the strategy is going' },
  switchShare:    { def: 0.42, min: 0.2, max: 0.5,  doc: 'share of the total worth under which a failing strategy is dropped' },
  holdDays:       { def: 5,    min: 2,   max: 12,   doc: 'days a strategy is given before it may be dropped' },
  novelty:        { def: 0.6,  min: 0,   max: 2,    doc: 'how much strategies the opponent has seen less of are preferred' },
};

/** The full parameter set for a profile: the profile's values over the defaults. */
export function paramsOf(profile) {
  const out = {};
  for (const [k, spec] of Object.entries(PARAMS)) out[k] = profile?.params?.[k] ?? spec.def;
  return out;
}

export function validateParams(profile, units, strategies, problems, at) {
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  for (const key of ['params', 'unitBias', 'strategyWeight']) if (profile[key] !== undefined && !isObj(profile[key])) problems.push(`${at}: ${key} must be an object`);
  for (const [k, v] of Object.entries(profile.params ?? {})) {
    if (!PARAMS[k]) problems.push(`${at}: params.${k}: unknown parameter`);
    else if (!isNum(v)) problems.push(`${at}: params.${k} must be a number`);
  }
  for (const [k, v] of Object.entries(profile.unitBias ?? {})) {
    if (!units?.[k]) problems.push(`${at}: unitBias.${k}: unknown unit`);
    else if (!isNum(v)) problems.push(`${at}: unitBias.${k} must be a number`);
  }
  const ids = new Set((strategies ?? []).map((s) => s.id));
  for (const [k, v] of Object.entries(profile.strategyWeight ?? {})) {
    if (!ids.has(k)) problems.push(`${at}: strategyWeight.${k}: unknown strategy`);
    else if (!isNum(v) || v < 0) problems.push(`${at}: strategyWeight.${k} must be a number of 0 or more`);
  }
}

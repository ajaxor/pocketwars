// Skirmish setup: the choices a player makes on the skirmish page, checked and applied to a map. Pure data in, data out (no
// DOM), so the rules live in one tested place and the page only has to show them.
//
//   settings = { mapId, funds, players: [{ faction, controller }, ...] }   one player entry per slot on the map
//     funds   null to keep each player's own starting funds from the map file, or a number every player starts with
//     players the colour (faction) and who plays it ('human' or 'ai'); slots keep the map's order, so slot 0 moves first
//
//   defaultSkirmish(map)                 the map's own setup as settings
//   skirmishProblems(map, registry, s)   every reason the settings cannot be played ([] when fine)
//   applySkirmish(map, s)                a copy of the map (frozen, like every GameMap) with the settings in place
//   swapFaction(players, slot, faction)  give a slot a colour; if another slot had it, that slot gets the old colour

export const FUNDS_CHOICES = [null, 5000, 10000, 15000, 20000];

export const defaultSkirmish = (map) => ({
  mapId: map.id,
  funds: null,
  players: map.players.map((p) => ({ faction: p.faction, controller: p.controller })),
});

export function skirmishProblems(map, registry, s) {
  const problems = [];
  if (!s || typeof s !== 'object') return ['no settings'];
  if (!Array.isArray(s.players) || s.players.length !== map.players.length) {
    problems.push(`this map has ${map.players.length} player slots`);
    return problems;
  }
  const seen = new Set();
  s.players.forEach((p, i) => {
    if (!registry.factions[p.faction]) problems.push(`slot ${i + 1}: unknown colour "${p.faction}"`);
    else if (seen.has(p.faction)) problems.push(`slot ${i + 1}: ${registry.factions[p.faction].name} is already taken`);
    seen.add(p.faction);
    if (p.controller !== 'human' && p.controller !== 'ai') problems.push(`slot ${i + 1}: must be a player or the computer`);
  });
  if (!s.players.some((p) => p.controller === 'human')) problems.push('at least one player must be human');
  if (s.funds !== null && !(Number.isInteger(s.funds) && s.funds >= 0)) problems.push('starting funds must be a whole number or the map default');
  return problems;
}

const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); }
  return o;
};

export function applySkirmish(map, s) {
  return deepFreeze({
    ...map,
    players: map.players.map((p, i) => ({ faction: s.players[i].faction, controller: s.players[i].controller, funds: s.funds ?? p.funds })),
  });
}

/** A new players list in which slot `slot` has colour `faction`; a slot that already had it takes the colour slot gave up. */
export function swapFaction(players, slot, faction) {
  const out = players.map((p) => ({ ...p }));
  const other = out.findIndex((p, i) => i !== slot && p.faction === faction);
  if (other >= 0) out[other].faction = out[slot].faction;
  out[slot].faction = faction;
  return out;
}

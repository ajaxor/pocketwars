// Skirmish setup: the choices a player makes on the skirmish page, checked and applied to a map. Pure data in, data out (no
// DOM), so the rules live in one tested place and the page only has to show them.
//
//   settings = { mapId, funds, players: [{ faction, controller, leader }, ...] }   one player entry per slot on the map
//     funds   null to keep each player's own starting funds from the map file, or a number every player starts with
//     players the colour (faction) and who plays it ('human' or 'ai'); slots keep the map's order, so slot 0 moves first
//     leader  the leader the team fights with: a leader id (data/loadouts.json), 'random' (picked when the battle starts), or
//             null for none (the map's own units and the standard menus)
//
//   defaultSkirmish(map, leaderIds, starter)    the map's own setup as settings; a human gets `starter`, the computer 'random'
//   skirmishProblems(map, registry, s)          every reason the settings cannot be played ([] when fine)
//   resolveLeaders(players, pool, random)       the leader id (or null) each slot fights with, with every 'random' rolled
//   applySkirmish(map, s, registry, random)     a copy of the map (frozen, like every GameMap) with the settings in place
//   swapFaction(players, slot, faction)         give a slot a colour; if another slot had it, that slot gets the old colour

import { withLeaders } from './formation.js';
import { RANDOM_LEADER } from './validate.js';

export { RANDOM_LEADER };
export const FUNDS_CHOICES = [null, 5000, 10000, 15000, 20000];

/**
 * @param {object} map
 * @param {string[]} [leaderIds]   the leaders that can be picked (none: nobody gets a leader)
 * @param {string|null} [starter]  the leader a human team starts with (default: the first one)
 */
export const defaultSkirmish = (map, leaderIds = [], starter = leaderIds[0] ?? null) => ({
  mapId: map.id,
  funds: null,
  players: map.players.map((p) => ({
    faction: p.faction,
    controller: p.controller,
    leader: !leaderIds.length ? null : p.controller === 'ai' ? RANDOM_LEADER : starter,
  })),
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
    if (p.leader === RANDOM_LEADER) { if (!registry.leaderIds.length) problems.push(`slot ${i + 1}: there are no leaders to pick from`); }
    else if (p.leader != null && !registry.leaderIds.includes(p.leader)) problems.push(`slot ${i + 1}: unknown leader "${p.leader}"`);
  });
  if (!s.players.some((p) => p.controller === 'human')) problems.push('at least one player must be human');
  if (s.funds !== null && !(Number.isInteger(s.funds) && s.funds >= 0)) problems.push('starting funds must be a whole number or the map default');
  return problems;
}

/**
 * The leader each slot fights with. A slot set to 'random' rolls one from `pool`, avoiding leaders another team has picked or
 * rolled for as long as there are any left (so a random opponent is not a mirror of you unless there is no other choice).
 * @param {{leader?: string|null}[]} players
 * @param {string[]} pool  every leader id that can be rolled
 * @param {() => number} [random]  returns a number in [0, 1)
 */
export function resolveLeaders(players, pool, random = Math.random) {
  const used = new Set(players.map((p) => p.leader).filter((l) => l && l !== RANDOM_LEADER));
  return players.map((p) => {
    if (p.leader !== RANDOM_LEADER) return p.leader ?? null;
    const fresh = pool.filter((id) => !used.has(id));
    const from = fresh.length ? fresh : pool;
    const pick = from[Math.min(from.length - 1, Math.floor(random() * from.length))];
    used.add(pick);
    return pick;
  });
}

const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); }
  return o;
};

/**
 * The map with the settings applied. Teams with a leader (rolled now for 'random') get that leader's build menus and the leader's
 * starting formation around their HQ in place of the map's own units for them (see formation.js); the registry is only needed then.
 */
export function applySkirmish(map, s, registry, random = Math.random) {
  const wanted = s.players.some((p) => p.leader);
  if (wanted && !registry) throw new Error('applySkirmish needs the registry to give teams their leaders');
  const leaders = wanted ? resolveLeaders(s.players, registry.leaderIds, random) : s.players.map(() => null);
  const set = {
    ...map,
    players: map.players.map((p, i) => ({ faction: s.players[i].faction, controller: s.players[i].controller, funds: s.funds ?? p.funds })),
  };
  return leaders.some(Boolean) ? withLeaders(set, registry, leaders) : deepFreeze(set);
}

/** A new players list in which slot `slot` has colour `faction`; a slot that already had it takes the colour slot gave up. */
export function swapFaction(players, slot, faction) {
  const out = players.map((p) => ({ ...p }));
  const other = out.findIndex((p, i) => i !== slot && p.faction === faction);
  if (other >= 0) out[other].faction = out[slot].faction;
  out[slot].faction = faction;
  return out;
}

// What each character says. Every character has a speech file (data/speech/<id>.json) with a `voice` note (how they talk) and, for each
// situation below, a handful of lines. The game asks a Talker for a line for a situation and gets a random one, never the same
// line twice in a row, and every line is used once before any repeats. 
//
//   SITUATIONS                       the situations, with what each means
//   speechProblems(speech, id)       a list of human-readable problems (empty = valid)
//   new Talker(speechById, random?)  .say(characterId, situation) -> a line;  .reset()

export const SITUATIONS = {
  greeting: 'meeting someone, or opening a conversation',
  battle_start: 'the start of a battle',
  attack: 'attacking an enemy unit',
  unit_lost: 'losing one of their own units',
  capture: 'capturing a building',
  danger: 'their headquarters or army is in trouble',
  victory: 'winning a battle',
  defeat: 'losing a battle',
  taunt: 'taunting an enemy',
  praise: 'praising an ally or the player',
  idle: 'an idle remark: just who they are',
  tech: 'reacting to technology, the Chorus and the Gift',
  joined: 'joining the player after being freed (for the Envoy: welcoming someone into the Chorus)',
  assimilated: 'what they say while under the Chorus (for Harlan, who is never taken: turning down the Chorus)',
  first_blood: 'landing their first kill of a battle',
  first_loss: 'losing their first unit of a battle',
  hq_threat: 'an enemy closing in on their headquarters',
  building_lost: 'having a building captured',
  outnumbered: 'being badly outnumbered',
  dominant: 'having the upper hand over the enemy',
  killing_spree: 'a run of kills',
  heavy_losses: 'a run of losses',
  first_turn: 'the first move of a battle',
};

export const MIN_LINES = 4;

export function speechProblems(speech, id) {
  const p = [], at = `speech "${id}"`;
  if (!speech || typeof speech !== 'object') return [`${at} must be an object`];
  if (speech.id !== id) p.push(`${at}: id must be "${id}"`);
  if (typeof speech.voice !== 'string' || speech.voice.length < 10) p.push(`${at}: needs a voice note`);
  const lines = speech.lines || {};
  for (const sit of Object.keys(SITUATIONS)) {
    const l = lines[sit];
    if (!Array.isArray(l) || l.length < MIN_LINES) { p.push(`${at}: situation "${sit}" needs at least ${MIN_LINES} lines`); continue; }
    if (l.some((x) => typeof x !== 'string' || x.trim().length < 3)) p.push(`${at}: situation "${sit}" has an empty or non-text line`);
    if (new Set(l).size !== l.length) p.push(`${at}: situation "${sit}" repeats a line`);
  }
  for (const sit of Object.keys(lines)) if (!SITUATIONS[sit]) p.push(`${at}: unknown situation "${sit}"`);
  return p;
}

export class Talker {
  constructor(speechById, random = Math.random) { this.speech = speechById; this.random = random; this.bags = new Map(); this.last = new Map(); }

  say(characterId, situation) {
    const lines = this.speech[characterId] && this.speech[characterId].lines[situation];
    if (!lines || !lines.length) return '';
    const key = characterId + '|' + situation;
    let bag = this.bags.get(key);
    if (!bag || !bag.length) {                       // a fresh shuffled bag; the last line said is kept off the top so it never repeats at the seam
      bag = lines.slice();
      for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
      if (bag.length > 1 && bag[bag.length - 1] === this.last.get(key)) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      this.bags.set(key, bag);
    }
    const line = bag.pop();
    this.last.set(key, line);
    return line;
  }

  reset() { this.bags.clear(); this.last.clear(); }
}

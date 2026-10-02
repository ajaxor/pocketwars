// What a leader says during a battle. Pure logic (no DOM, no clock of its own): the session tells it what happened and when, and it
// answers with the line to show, if any.
//
//   new Commentator(game, voices)        voices: { say(leaderId, situation) -> a line }  (a campaign Talker, see speech.js)
//   .opening()                           [{ owner, leader, situation: 'battle_start', line }] one per team that has a leader, in turn order
//   .turnStart(owner, now)               what a leader says as their turn begins: a taunt, or a worried line when they are outnumbered
//   .react(owner, events, now)           what they say about what just happened in their turn: a loss, a capture or an attack (or null)
//
// A comment is { owner, leader, situation, line }. Between comments there is a pause of MIN_GAP ms (in the `now` the caller uses)
// and a leader says at most MAX_PER_TURN things in one turn, so the commentary never turns into a wall of talk.

export const MIN_GAP = 3200;
export const MAX_PER_TURN = 4;

export class Commentator {
  constructor(game, voices) {
    this.game = game;
    this.voices = voices;
    this.quietUntil = 0;
    this.spoken = 0;
  }

  leaderOf(owner) { return this.game.map.players[owner]?.leader ?? null; }

  #comment(owner, situation) {
    const leader = this.leaderOf(owner);
    if (!leader) return null;
    const line = this.voices.say(leader, situation);
    return line ? { owner, leader, situation, line } : null;
  }

  opening() {
    return this.game.map.players.map((_, owner) => this.#comment(owner, 'battle_start')).filter(Boolean);
  }

  turnStart(owner, now) {
    this.spoken = 0;
    const units = this.game.state.units;
    const count = (o) => units.filter((u) => u.owner === o).length;
    const mine = count(owner);
    const strongest = Math.max(0, ...this.game.map.players.map((_, o) => (o === owner ? 0 : count(o))));
    const c = this.#comment(owner, mine * 2 < strongest ? 'danger' : 'taunt');
    if (c) { this.quietUntil = now + MIN_GAP; this.spoken = 1; }
    return c;
  }

  react(owner, events, now) {
    if (now < this.quietUntil || this.spoken >= MAX_PER_TURN) return null;
    let situation = null, rank = 0;
    const want = (s, r) => { if (r > rank) { situation = s; rank = r; } };
    for (const ev of events) {
      if (ev.type === 'strike') {
        if (ev.destroyed && ev.defender.owner === owner) want('unit_lost', 3);
        else if (ev.attacker.owner === owner) want('attack', 1);
      } else if (ev.type === 'capture' && ev.completed && ev.unit.owner === owner) want('capture', 2);
    }
    const c = situation && this.#comment(owner, situation);
    if (c) { this.quietUntil = now + MIN_GAP; this.spoken++; }
    return c;
  }
}

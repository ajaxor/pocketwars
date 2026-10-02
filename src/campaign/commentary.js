// What a leader says during a battle. Pure logic (no DOM, no clock of its own): the session tells it what happened and when, and it
// answers with the line to show, if any.
//
//   new Commentator(game, voices)        voices: { say(leaderId, situation) -> a line }  (a campaign Talker, see speech.js)
//   .opening()                           [{ owner, leader, situation: 'battle_start', line }] one per team that has a leader, in turn order
//   .turnStart(owner, now)               a comment as `owner`'s turn begins (or null)
//   .react(events, now, prefer)          a comment on what just happened (or null); `prefer` is the owner whose turn it is
//   .ending(winner)                      [{ owner, leader, situation: 'victory' | 'defeat', line }] when the battle is over
//
// MILESTONES. A leader does not comment on every blow. Each leader keeps count of what has happened (attacks made, enemies destroyed,
// units lost, buildings captured or lost, ...) and a milestone fires once, the first time its condition holds: the first kill, the
// third loss, the first building lost, an enemy starting to capture their HQ, being outnumbered... Each milestone is a situation of the
// speech file (so the line is picked by the Talker, which never repeats one soon). After any comment the leader keeps quiet for MIN_GAP ms;
// a milestone that comes true meanwhile simply waits for the next chance. A comment is { owner, leader, situation, line }.

export const MIN_GAP = 3200;

/** In priority order (the first that is due is the one said). `n` counts the leader's own tally; `ctx` has { mine, strongest, turns, hqThreat }. */
export const MILESTONES = [
  { id: 'hq_threat', situation: 'hq_threat', due: (n, ctx) => ctx.hqThreat },
  { id: 'first_loss', situation: 'first_loss', due: (n) => n.losses >= 1 },
  { id: 'first_kill', situation: 'first_blood', due: (n) => n.kills >= 1 },
  { id: 'first_capture', situation: 'capture', due: (n) => n.captures >= 1 },
  { id: 'first_building_lost', situation: 'building_lost', due: (n) => n.buildingsLost >= 1 },
  { id: 'outnumbered', situation: 'outnumbered', due: (n, ctx) => ctx.turns >= 2 && ctx.mine * 2 < ctx.strongest },
  { id: 'dominant', situation: 'dominant', due: (n, ctx) => ctx.turns >= 2 && ctx.strongest > 0 && ctx.mine >= ctx.strongest * 2 },
  { id: 'first_attack', situation: 'attack', due: (n) => n.attacks >= 1 },
  { id: 'third_kill', situation: 'killing_spree', due: (n) => n.kills >= 3 },
  { id: 'third_loss', situation: 'heavy_losses', due: (n) => n.losses >= 3 },
  { id: 'third_capture', situation: 'capture', due: (n) => n.captures >= 3 },
  { id: 'sixth_kill', situation: 'taunt', due: (n) => n.kills >= 6 },
  { id: 'first_turn', situation: 'first_turn', due: (n, ctx) => ctx.turns >= 1 },
  { id: 'long_battle', situation: 'idle', due: (n, ctx) => ctx.turns >= 6 },
];

export class Commentator {
  constructor(game, voices) {
    this.game = game;
    this.voices = voices;
    this.owners = game.map.players.map(() => ({
      tally: { attacks: 0, kills: 0, losses: 0, captures: 0, buildingsLost: 0 },
      turns: 0, hqThreat: false, fired: new Set(), quietUntil: 0,
    }));
  }

  leaderOf(owner) { return this.game.map.players[owner]?.leader ?? null; }

  #line(owner, situation) {
    const leader = this.leaderOf(owner);
    if (!leader) return null;
    const line = this.voices.say(leader, situation);
    return line ? { owner, leader, situation, line } : null;
  }

  opening() {
    return this.game.map.players.map((_, owner) => this.#line(owner, 'battle_start')).filter(Boolean);
  }

  /** Count what the events say happened, for every team. */
  #tally(events) {
    for (const ev of events) {
      if (ev.type === 'strike') {
        const a = this.owners[ev.attacker.owner], d = this.owners[ev.defender.owner];
        if (a) a.tally.attacks++;
        if (ev.destroyed) { if (a) a.tally.kills++; if (d) d.tally.losses++; }
      } else if (ev.type === 'capture') {
        if (ev.completed) {
          const taker = this.owners[ev.unit.owner], loser = this.owners[ev.previousOwner];
          if (taker) taker.tally.captures++;
          if (loser && ev.previousOwner !== ev.unit.owner) { loser.tally.buildingsLost++; loser.hqThreat = false; }
        } else if (ev.hq && ev.previousOwner !== null && ev.previousOwner !== ev.unit.owner && this.owners[ev.previousOwner]) {
          this.owners[ev.previousOwner].hqThreat = true;
        }
      }
    }
  }

  #due(owner, now) {
    const me = this.owners[owner];
    if (!this.leaderOf(owner) || now < me.quietUntil) return null;
    const units = this.game.state.units;
    const count = (o) => units.filter((u) => u.owner === o).length;
    const ctx = {
      turns: me.turns, hqThreat: me.hqThreat, mine: count(owner),
      strongest: Math.max(0, ...this.owners.map((_, o) => (o === owner ? 0 : count(o)))),
    };
    for (const m of MILESTONES) {
      if (me.fired.has(m.id) || !m.due(me.tally, ctx)) continue;
      const c = this.#line(owner, m.situation);
      if (!c) continue;
      me.fired.add(m.id);
      me.quietUntil = now + MIN_GAP;
      return c;
    }
    return null;
  }

  #first(order, now) {
    for (const owner of order) { const c = this.#due(owner, now); if (c) return c; }
    return null;
  }

  turnStart(owner, now) {
    this.owners[owner].turns++;
    return this.#due(owner, now);
  }

  react(events, now, prefer = 0) {
    this.#tally(events);
    const order = this.owners.map((_, o) => o).sort((a, b) => (a === prefer ? -1 : b === prefer ? 1 : a - b));
    return this.#first(order, now);
  }

  ending(winner) {
    if (typeof winner !== 'number') return [];
    return this.game.map.players.map((_, owner) => this.#line(owner, owner === winner ? 'victory' : 'defeat')).filter(Boolean);
  }
}

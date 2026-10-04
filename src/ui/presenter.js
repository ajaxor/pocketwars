import { MINE_SHOWN } from '../render/effects.js';

// Presenter: turns engine events into animations and timing. It is the only bridge between the pure
// engine and the effects/animation objects.

export class Presenter {
  constructor({ effects, animator }) {
    this.effects = effects;
    this.animator = animator;
  }

  /**
   * Play `events` starting at `now`. 'move' events slide the unit (unless `animateMoves` is false, e.g. the
   * player already previewed the move; `onMoveDone` runs when a slide that was started here finishes); strikes, captures,
   * dives and interrupts then follow in sequence.
   */
  present(events, { now, animateMoves = true, onMoveDone }) {
    let t = now;
    for (const ev of events) {
      if (ev.type === 'move') {
        if (!animateMoves || ev.path.length < 2) continue;
        this.animator.start(ev.unitId, ev.path, now, onMoveDone);
        t = Math.max(t, this.animator.endsAt);
      } else if (ev.type === 'interrupt') {
        this.effects.interrupt(ev, t);
        t += 500;
      } else if (ev.type === 'detonate') {
        // the mine appears together with the 'Contact!' call-out of the interrupt just before (500 ms), then goes off
        this.effects.detonate(ev, t - 500);
        t += MINE_SHOWN - 500 + 600;
      } else if (ev.type === 'crash') {
        this.effects.crash(ev, t);
        t += 1100;
      } else if (ev.type === 'supply') {
        this.effects.supplied(ev, t);
      } else if (ev.type === 'dive') {
        this.effects.dive(ev, t, true);
      } else if (ev.type === 'surface') {
        this.effects.dive(ev, t, false);
      } else if (ev.type === 'strike') {
        t = this.effects.strike(ev, t);
      } else if (ev.type === 'capture') {
        this.effects.capture(ev, t);
        t += 400;
      } else if (ev.type === 'resupply') {
        this.effects.resupply(ev.unit, t, ev.cost);
      } else if (ev.type === 'heal') {
        this.effects.healed(ev, t);
      } else if (ev.type === 'deploy') {
        this.effects.deploy(ev, t);
      } else if (ev.type === 'turnStart') {
        this.effects.income(ev, t);
        this.effects.healed(ev, t);
        this.effects.refuelled(ev, t);
      }
    }
  }
}

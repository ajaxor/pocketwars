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
      } else if (ev.type === 'dive') {
        this.effects.dive(ev, t, true);
      } else if (ev.type === 'surface') {
        this.effects.dive(ev, t, false);
      } else if (ev.type === 'strike') {
        t = this.effects.strike(ev, t);
      } else if (ev.type === 'capture') {
        this.effects.capture(ev, t);
      } else if (ev.type === 'resupply') {
        this.effects.resupply(ev.unit, t);
      } else if (ev.type === 'deploy') {
        this.effects.deploy(ev, t);
      } else if (ev.type === 'turnStart') {
        this.effects.income(ev, t);
        (ev.resupplied || []).forEach((u) => this.effects.resupply(u, t + 200));
      }
    }
  }
}

// Presenter: turns engine events into animations and timing. It is the only bridge between the pure
// engine and the effects/animation objects.

export class Presenter {
  constructor({ effects, animator }) {
    this.effects = effects;
    this.animator = animator;
  }

  /**
   * Play `events` starting at `now`. 'move' events slide the unit (unless `animateMoves` is false, e.g. the
   * player already previewed the move); strikes and captures then follow in sequence.
   */
  present(events, { now, animateMoves = true }) {
    let t = now;
    for (const ev of events) {
      if (ev.type === 'move') {
        if (!animateMoves || ev.path.length < 2) continue;
        this.animator.start(ev.unitId, ev.path, now);
        t = Math.max(t, this.animator.endsAt);
      } else if (ev.type === 'strike') {
        t = this.effects.strike(ev, t);
      } else if (ev.type === 'capture') {
        this.effects.capture(ev, t);
      }
    }
  }
}

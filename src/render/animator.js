// Unit movement animation state shared by the player (previewing a move) and the AI: which unit is sliding
// along which path, plus the yellow path arrow that stays on screen after the slide.

export const MS_PER_TILE = 110;

export class MoveAnimator {
  constructor() {
    this.current = null; // { unitId, path, t, d, onDone }
    this.arrow = null;   // path shown as an arrow, or null
  }

  get active() { return this.current !== null; }
  get endsAt() { return this.current ? this.current.t + this.current.d : 0; }

  /** Slide `unitId` along `path` ([[x,y],...]) starting at `now`; shows the arrow; calls onDone when finished. */
  start(unitId, path, now, onDone) {
    this.arrow = path;
    this.current = { unitId, path, t: now, d: (path.length - 1) * MS_PER_TILE, onDone };
  }

  clear() { this.current = null; this.arrow = null; }

  /** Pixel position of the unit at `now` while it is sliding, or null when it is not. */
  positionOf(unitId, now, S) {
    const a = this.current;
    if (!a || a.unitId !== unitId) return null;
    const n = a.path.length - 1;
    const f = Math.min(1, (now - a.t) / a.d) * n;
    const i = Math.min(n - 1, Math.floor(f));
    const [ax, ay] = a.path[i];
    const [bx, by] = a.path[i + 1];
    const r = f - i;
    return [(ax + (bx - ax) * r) * S, (ay + (by - ay) * r) * S];
  }

  /** Call once per frame; fires the completion callback when the slide has finished. */
  update(now) {
    const a = this.current;
    if (a && now >= a.t + a.d) {
      this.current = null;
      if (a.onDone) a.onDone();
    }
  }
}

// Pacing of the computer's turn: a clock that can run fast, and waits that vanish while it does.
//
//   const pacer = new Pacer({ clock, setTimer, clearTimer, factor })
//   pacer.now()          the game clock in ms: the real clock, but running `factor` times as fast while fast-forwarding
//   pacer.fast           true while fast-forwarding;  pacer.setFast(on)
//   pacer.wait(ms)       a promise that resolves after ms (real time), at once while fast, and as soon as fast-forwarding starts
//
// Animations and effects are timed against now(), so they play faster by themselves; only the pauses between units need wait().

export const FAST_FACTOR = 4;

export class Pacer {
  constructor({ clock = () => performance.now(), setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (id) => clearTimeout(id), factor = FAST_FACTOR } = {}) {
    Object.assign(this, { clock, setTimer, clearTimer, factor });
    this.fast = false;
    this.real = clock();
    this.virtual = this.real;   // starts equal to the real clock, so anything timed with performance.now() is on the same scale
    this.waiters = new Set();
  }

  now() {
    const r = this.clock();
    this.virtual += (r - this.real) * (this.fast ? this.factor : 1);
    this.real = r;
    return this.virtual;
  }

  setFast(on) {
    on = !!on;
    if (on === this.fast) return;
    this.now();   // bring the clock up to date at the old speed first
    this.fast = on;
    if (on) for (const done of [...this.waiters]) done();
  }

  wait(ms) {
    if (this.fast || ms <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      let timer = null;
      const done = () => { this.clearTimer(timer); this.waiters.delete(done); resolve(); };
      timer = this.setTimer(done, ms);
      this.waiters.add(done);
    });
  }
}

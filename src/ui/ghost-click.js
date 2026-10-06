// Drops the "ghost click" that follows a tap on the map.
//
// The map reacts to a tap when the finger lifts (pointerup), and the reaction can put a button right where the finger is: a tap on your
// factory opens the build menu over the very spot you touched. Touch browsers (iOS Safari above all) then send the click that belongs to
// that tap, and hit-test it against the page as it is NOW, so it lands on the new button and, for the build menu, builds whatever unit
// happened to be under the finger.
//
// The rule that tells a ghost from a real click: a real click is preceded by a press (pointerdown) of its own. So the map arms the guard
// when a press on it ends, any new press disarms it, and a click that arrives while it is still armed, from a pointer, aimed at anything but
// the map itself, is the ghost. A click from the keyboard or from code (detail 0) is never one.

export class GhostClickGuard {
  constructor() { this.armed = false; }

  /** A press began anywhere on the page: the click that follows it is its own, not a leftover. */
  press() { this.armed = false; }

  /** A press on the map just ended (whatever the map did with it): the click the browser sends for it is not meant for what appeared. */
  mapRelease() { this.armed = true; }

  /**
   * @param {{detail?:number, target?:any}} e a click event
   * @param {any} map the map's element: a click that is aimed at it (browsers that keep it on the pressed element) is simply used up
   * @returns {boolean} true when this click is the ghost and must not reach its target
   */
  swallows(e, map) {
    if (!this.armed || !(e.detail > 0)) return false;   // not waiting for a ghost, or a keyboard / programmatic click
    this.armed = false;                                  // one press sends one click
    return e.target !== map;
  }
}

// A stack of full-page screens that sit on top of the title screen (skirmish setup, the map editor, the campaign intro and map).
// The first screen pushed covers the title screen (onCover); when the last one goes the title screen is uncovered again (onUncover).
// Starting a game clears the stack without uncovering, because the title screen goes away too.
//
//   push(screen)      add a screen on top; `screen.root` is appended to the document body
//   replace(screen)   swap the top screen for another without uncovering in between (intro -> world map)
//   pop()             remove the top screen; uncovers the title when none is left
//   clear()           remove every screen and leave the title covered (a game is starting)
//   active            true while any screen is showing
//
// A screen is any object with `root` and `remove()`.

export class ScreenStack {
  /**
   * @param {Document} doc
   * @param {{onCover?: () => void, onUncover?: () => void}} [hooks]
   */
  constructor(doc, { onCover = () => {}, onUncover = () => {} } = {}) {
    this.doc = doc;
    this.onCover = onCover;
    this.onUncover = onUncover;
    this.screens = [];
  }

  get active() { return this.screens.length > 0; }
  get top() { return this.screens[this.screens.length - 1] ?? null; }

  push(screen) {
    if (!this.screens.length) this.onCover();
    this.screens.push(screen);
    this.doc.body.append(screen.root);
    return screen;
  }

  replace(screen) {
    const old = this.screens.pop();
    old?.remove();
    if (!old) this.onCover();
    this.screens.push(screen);
    this.doc.body.append(screen.root);
    return screen;
  }

  pop() {
    const old = this.screens.pop();
    if (!old) return;
    old.remove();
    if (!this.screens.length) this.onUncover();
  }

  clear() {
    while (this.screens.length) this.screens.pop().remove();
  }
}

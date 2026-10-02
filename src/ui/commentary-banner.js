// The commentary banner: a leader's portrait and what they are saying, at the bottom of the screen during a battle.
//
//   const banner = new CommentaryBanner(doc)
//   banner.say({ leader, name, color, text })      show a leader (portrait traits) saying `text`; it is typed out and the mouth moves meanwhile
//   banner.ask({ leader, name, color, text })      the same as a card to be read: it takes taps, and the promise resolves when it is tapped
//   banner.tick(now, fast)                         call every frame (now in ms); `fast` shows the whole text at once
//   banner.hide();  banner.setFast(on)             hide it;  show or hide the "fast forward" mark
//
// While it only comments (say) it ignores touches, so the map under it can still be scrolled and held. The text is `text` with " / "
// (verse) turned into line breaks.

import { drawPortrait } from '../render/portrait-art.js';
import { h, setVar, toggle } from './kit.js';

export const CPS = 38;          // characters typed per second
export const MOUTH_MS = 130;    // how long the mouth stays open or shut while talking

export class CommentaryBanner {
  constructor(doc) {
    this.doc = doc;
    this.root = h(doc, 'div', 'cm cm--hidden');
    this.face = h(doc, 'canvas', 'cm-face');
    this.name = h(doc, 'div', 'cm-name');
    this.text = h(doc, 'div', 'cm-text');
    this.hint = h(doc, 'div', 'cm-hint', 'Tap to continue');
    this.ff = h(doc, 'div', 'cm-ff cm-ff--hidden', '▶▶ Fast forward');
    const body = h(doc, 'div', 'cm-body');
    body.append(this.name, this.text, this.hint);
    this.root.append(this.face, body);
    this.root.addEventListener('click', () => this.#tapped());
    this.current = null;     // { leader, full, t0, mouth, drawn }
    this.pending = null;     // resolves the promise of ask()
    this.modal = false;
  }

  /** Where the banner goes: append `banner.root` and `banner.ff` to the page. */
  get elements() { return [this.root, this.ff]; }

  get visible() { return !!this.current; }
  /** The text on show in full (what is being typed out). */
  get fullText() { return this.current ? this.current.full : ''; }
  /** The text on screen right now. */
  get shownText() { return this.text.textContent; }
  get typing() { return !!this.current && this.current.shown < this.current.full.length; }

  say({ leader, name, color, text }) { this.#show({ leader, name, color, text, modal: false }); }

  ask(line) {
    this.#show({ ...line, modal: true });
    return new Promise((resolve) => { this.pending = resolve; });
  }

  #show({ leader, name, color, text, modal }) {
    this.#settle();
    const full = String(text).replace(/ \/ /g, '\n');
    this.current = { leader, full, shown: 0, t0: null, mouth: 0, drawn: null };
    this.modal = modal;
    this.name.textContent = name || '';
    this.text.textContent = '';
    if (color) setVar(this.root, '--accent', color);
    toggle(this.root, 'cm--modal', modal);
    toggle(this.root, 'cm--hidden', false);
    this.#paint(0);
  }

  hide() {
    this.#settle();
    this.current = null;
    this.modal = false;
    toggle(this.root, 'cm--hidden', true);
    toggle(this.root, 'cm--modal', false);
  }

  setFast(on) { toggle(this.ff, 'cm-ff--hidden', !on); }

  tick(now, fast = false) {
    const c = this.current;
    if (!c) return;
    c.t0 ??= now;
    const total = c.full.length;
    const shown = fast ? total : Math.max(c.shown, Math.min(total, Math.floor(((now - c.t0) / 1000) * CPS)));   // never goes back (a tap shows it all)
    if (shown !== c.shown) { c.shown = shown; this.text.textContent = c.full.slice(0, shown); }
    this.#paint(shown < total ? (Math.floor((now - c.t0) / MOUTH_MS) % 2 ? 1 : 0) : 0);
  }

  /** Skip the typing, or (on a card) answer it. */
  #tapped() {
    const c = this.current;
    if (!c || !this.modal) return;
    if (c.shown < c.full.length) { c.shown = c.full.length; this.text.textContent = c.full; this.#paint(0); return; }
    this.#settle();
  }

  #settle() { const done = this.pending; this.pending = null; if (done) done(); }

  #paint(mouth) {
    const c = this.current;
    if (!c || c.drawn === mouth || !c.leader || !c.leader.skin) return;
    const g = this.face.getContext?.('2d');
    if (!g) return;
    const px = 72 * Math.min(2, globalThis.devicePixelRatio || 1);
    if (this.face.width !== px) this.face.width = this.face.height = px;
    g.clearRect(0, 0, px, px);
    drawPortrait(g, c.leader, { px, style: 'flat', expr: 'neutral', talk: mouth });
    c.drawn = mouth;
  }
}

// The intro cutscene: a full-screen canvas that plays the script in data/campaign.json (src/campaign/cutscene.js says what is on
// screen at each moment, src/render/campaign-art.js draws it). Skippable: the Skip button, Escape, or Enter all end it.
// Tapping the picture during a conversation jumps to the next line.
//
//   new IntroScreen(doc, { campaign, colors(factionId), onDone, raf?, caf?, win? })
//   screen.root        the element to add to the page
//   screen.start()     begin playing (it also starts on its own when added with `play()`)
//   screen.advance(dt) move the clock on by dt seconds and draw (the animation loop calls this; tests call it directly)
//   screen.skip()      end now; onDone runs once, however the cutscene ended
//   screen.remove()    stop and take it off the page

import { buildTimeline, nextLineTime, stateAt } from '../campaign/cutscene.js';
import { renderFrame } from '../render/campaign-art.js';
import { button, h } from './kit.js';

export class IntroScreen {
  constructor(doc, { campaign, colors, onDone = () => {}, raf = (f) => requestAnimationFrame(f), caf = (i) => cancelAnimationFrame(i), win = globalThis }) {
    this.doc = doc; this.campaign = campaign; this.colors = colors; this.onDone = onDone; this.raf = raf; this.caf = caf; this.win = win;
    this.tl = buildTimeline(campaign.intro.scenes);
    this.time = 0; this.finished = false; this.running = false; this.last = 0; this.handle = 0;
    this.root = h(doc, 'div', 'cine');
    this.canvas = h(doc, 'canvas', 'cine-canvas');
    this.skipBtn = button(doc, { label: 'Skip', variant: 'ghost', size: 'sm', cls: 'cine-skip', onClick: () => this.skip() });
    this.root.append(this.canvas, this.skipBtn);
    this.canvas.addEventListener('click', () => this.tap());
    this.onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter') this.skip(); };
    if (doc.addEventListener) doc.addEventListener('keydown', this.onKey);
    this.g = this.canvas.getContext ? this.canvas.getContext('2d') : null;
  }

  /** Match the canvas to the window, in device pixels. */
  fit() {
    const dpr = Math.min(2, this.win.devicePixelRatio || 1), w = this.win.innerWidth || 390, h = this.win.innerHeight || 700;
    this.w = Math.round(w * dpr); this.h = Math.round(h * dpr);
    this.canvas.width = this.w; this.canvas.height = this.h;
  }

  start() {
    if (this.running || this.finished) return;
    this.running = true; this.fit();
    if (this.win.addEventListener) { this.onResize = () => { this.fit(); this.draw(); }; this.win.addEventListener('resize', this.onResize); }
    this.draw();
    let prev = null;
    const loop = (now) => {
      if (!this.running) return;
      if (prev != null) this.advance(Math.min(0.1, (now - prev) / 1000));
      prev = now;
      if (this.running) this.handle = this.raf(loop);
    };
    this.handle = this.raf(loop);
  }

  advance(dt) {
    if (this.finished) return;
    this.time += dt;
    try { this.draw(); } catch (e) { if (!this.drawFailed) console.error('Intro frame failed:', e); this.drawFailed = true; }   // never let a drawing bug trap the player in the cutscene
    if (this.time >= this.tl.total) this.skip();
  }

  draw() {
    if (!this.g) return;
    renderFrame(this.g, this.w, this.h, stateAt(this.tl, this.time), { campaign: this.campaign, tl: this.tl, colors: this.colors }, this.time);
  }

  /** Tapping the picture: during a conversation, go to the next line. */
  tap() {
    const next = nextLineTime(this.tl, this.time);
    if (next != null) this.time = next + 0.01;
  }

  skip() {
    if (this.finished) return;
    this.finished = true; this.running = false;
    this.stop();
    this.onDone();
  }

  stop() {
    this.running = false;
    if (this.handle) this.caf(this.handle);
    if (this.doc.removeEventListener) this.doc.removeEventListener('keydown', this.onKey);
    if (this.win.removeEventListener && this.onResize) this.win.removeEventListener('resize', this.onResize);
  }

  remove() { this.stop(); this.root.remove(); }
}

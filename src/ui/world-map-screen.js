// The campaign world map: the continent with its five nations. Your homeland is free; the other four are assimilated by the
// Chorus. Tap a nation to see its leader and what it will offer. There are no missions yet, so the mission button is a
// disabled "coming soon" placeholder; the campaign design (docs/campaign-design.md) says what it becomes.
//
//   new WorldMapScreen(doc, { campaign, colors(factionId), onBack, onReplay, raf?, caf?, win? })
//   screen.root / screen.selected / screen.select(id) / screen.remove()
//
// The map is drawn by src/render/campaign-art.js (the same code the intro uses), and a tap is hit-tested against the same polygons.

import { drawContinent, mapFit, nationAt, drawSea } from '../render/campaign-art.js';
import { drawPortrait } from '../render/portrait-art.js';
import { button, h } from './kit.js';

export class WorldMapScreen {
  constructor(doc, { campaign, colors, onBack = () => {}, onReplay = () => {}, raf = (f) => requestAnimationFrame(f), caf = (i) => cancelAnimationFrame(i), win = globalThis }) {
    this.doc = doc; this.campaign = campaign; this.colors = colors; this.raf = raf; this.caf = caf; this.win = win;
    this.selected = null; this.time = 0; this.handle = 0; this.running = false;
    this.assim = Object.fromEntries(campaign.nations.map((n) => [n.id, n.home ? 0 : 1]));

    const head = h(doc, 'header', 'sk-head');
    this.back = button(doc, { label: 'Back', variant: 'ghost', size: 'sm', onClick: () => onBack() });
    this.replay = button(doc, { label: 'Replay intro', variant: 'ghost', size: 'sm', cls: 'wm-replay', onClick: () => onReplay() });
    head.append(this.back, h(doc, 'h2', 'sk-title', 'Campaign'), this.replay);

    this.canvas = h(doc, 'canvas', 'wm-canvas');
    this.canvas.addEventListener('click', (e) => this.tap(e));
    this.g = this.canvas.getContext ? this.canvas.getContext('2d') : null;

    this.card = h(doc, 'div', 'wm-card');
    this.portrait = h(doc, 'canvas', 'wm-portrait');
    this.name = h(doc, 'div', 'wm-name'); this.status = h(doc, 'div', 'wm-status');
    this.leader = h(doc, 'div', 'wm-leader'); this.bio = h(doc, 'div', 'wm-theme'); this.gift = h(doc, 'div', 'wm-gift'); this.theme = h(doc, 'div', 'wm-theme');
    const who = h(doc, 'div', 'wm-who'); who.append(this.name, this.status, this.leader);
    this.mission = button(doc, { label: 'Missions coming soon', variant: 'primary', size: 'lg', disabled: true, cls: 'wm-go' });
    const row = h(doc, 'div', 'wm-row'); row.append(this.portrait, who);
    this.card.append(row, this.bio, this.gift, this.theme, this.mission);

    this.root = h(doc, 'div', 'wm');
    this.root.append(head, this.canvas, this.card);
    this.select(campaign.nations.find((n) => n.home).id);
  }

  nation(id) { return this.campaign.nations.find((n) => n.id === id); }

  select(id) {
    const n = this.nation(id); if (!n) return;
    this.selected = id;
    const free = !!n.home, L = n.leaderData;
    this.card.className = 'wm-card' + (free ? ' is-free' : ' is-taken');
    this.name.textContent = n.name;
    this.status.textContent = free ? 'Free - your homeland' : 'Assimilated by the Chorus';
    this.leader.textContent = `${L.name} - ${L.tag}`;
    this.bio.textContent = L.bio;
    this.gift.textContent = free ? 'Refused the Chorus\' Gift.' : `Accepted the Gift. ${L.taken ? '"' + L.taken + '"' : ''}`;
    this.theme.textContent = free ? n.theme : `${n.theme} Defeat them to free them.`;
    this.drawPortrait();
  }

  drawPortrait() {
    const n = this.nation(this.selected); if (!n || !this.portrait.getContext) return;
    const g = this.portrait.getContext('2d'); if (!g) return;
    const px = 96 * Math.min(2, this.win.devicePixelRatio || 1);
    this.portrait.width = this.portrait.height = px;
    drawPortrait(g, n.leaderData, { px, style: 'flat', expr: n.home ? 'smile' : 'neutral', assim: !n.home });
  }

  fit() {
    if (!this.canvas.getBoundingClientRect) return;
    const r = this.canvas.getBoundingClientRect(), dpr = Math.min(2, this.win.devicePixelRatio || 1);
    this.cssW = r.width || 390; this.cssH = r.height || 400;
    this.canvas.width = Math.round(this.cssW * dpr); this.canvas.height = Math.round(this.cssH * dpr); this.dpr = dpr;
  }

  draw() {
    if (!this.g || !this.canvas.width) return;
    const { width: w, height: h } = this.canvas;
    drawSea(this.g, w, h, this.time, 0.3);
    drawContinent(this.g, w, h, { nations: this.campaign.nations, colors: this.colors, assim: this.assim, t: this.time, fit: mapFit(w, h, { pad: 0.07 }), selected: this.selected, islands: this.campaign.islands, labels: true });
  }

  /** Which nation is under a click at (x, y) in CSS pixels of the canvas, or null. */
  hit(x, y) {
    const w = this.canvas.width, h = this.canvas.height, f = mapFit(w, h, { pad: 0.07 }), dpr = this.dpr || 1;
    return nationAt(this.campaign.nations, [(x * dpr - f.ox) / f.s, (y * dpr - f.oy) / f.s]);
  }
  tap(e) {
    const r = this.canvas.getBoundingClientRect ? this.canvas.getBoundingClientRect() : { left: 0, top: 0 };
    const n = this.hit(e.clientX - r.left, e.clientY - r.top);
    if (n) this.select(n.id);
  }

  start() {
    if (this.running) return;
    this.running = true; this.fit(); this.draw();
    if (this.win.addEventListener) { this.onResize = () => { this.fit(); this.draw(); }; this.win.addEventListener('resize', this.onResize); }
    let prev = null;
    const loop = (now) => {
      if (!this.running) return;
      if (prev != null) this.time += Math.min(0.1, (now - prev) / 1000);
      prev = now; this.draw(); this.handle = this.raf(loop);
    };
    this.handle = this.raf(loop);
  }

  remove() {
    this.running = false;
    if (this.handle) this.caf(this.handle);
    if (this.win.removeEventListener && this.onResize) this.win.removeEventListener('resize', this.onResize);
    this.root.remove();
  }
}

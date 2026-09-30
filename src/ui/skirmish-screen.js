// The skirmish page: pick a map, then set who plays each team and in which colour, and the starting funds. It is a full-screen
// overlay (like the title screen) built from the UI kit; the rules for what is allowed live in src/data/skirmish.js.
//
//   new SkirmishScreen(doc, { registry, maps, selectedId, onStart(map, settings), onBack() })
//   screen.root         the element to add to the page
//   screen.map          the map that is picked
//   screen.settings     the current choices (see skirmish.js)
//   screen.remove()     take it off the page
//
// Every change redraws the parts that depend on it from `this.map` and `this.settings`, which keeps the code simple: there is no
// other state to fall out of step.

import { drawMinimap, miniTile } from '../render/minimap.js';
import { FUNDS_CHOICES, defaultSkirmish, skirmishProblems, swapFaction } from '../data/skirmish.js';
import { button, h, toggle } from './kit.js';

const fmtFunds = (n) => (n === null ? 'Map default' : Number(n).toLocaleString('en-US'));

export class SkirmishScreen {
  /**
   * @param {Document} doc
   * @param {{registry:object, maps:object[], selectedId?:string, onStart:(map:object, settings:object)=>void, onBack:()=>void}} o
   */
  constructor(doc, { registry, maps, selectedId, onStart, onBack }) {
    this.doc = doc;
    this.registry = registry;
    this.maps = maps;
    this.onStart = onStart;
    this.onBack = onBack;
    this.map = maps.find((m) => m.id === selectedId) || maps[0];
    this.settings = defaultSkirmish(this.map);

    const head = h(doc, 'header', 'sk-head');
    this.back = button(doc, { label: 'Back', variant: 'ghost', size: 'sm', onClick: () => this.onBack() });
    head.append(this.back, h(doc, 'h2', 'sk-title', 'Skirmish'));

    this.el = {
      maps: h(doc, 'div', 'sk-maps'),
      preview: h(doc, 'div', 'sk-preview'),
      teams: h(doc, 'div', 'sk-teams'),
      rules: h(doc, 'div', 'sk-rules'),
    };
    const body = h(doc, 'div', 'sk-body');
    body.append(
      this.#section('Map', this.el.maps, this.el.preview),
      this.#section('Teams', this.el.teams),
      this.#section('Rules', this.el.rules),
    );

    const foot = h(doc, 'footer', 'sk-foot');
    this.note = h(doc, 'div', 'sk-note');
    this.go = button(doc, { label: 'Start battle', variant: 'primary', size: 'lg', onClick: () => this.#start() });
    foot.append(this.note, this.go);

    this.root = h(doc, 'div', 'sk');
    this.root.append(head, body, foot);
    this.#renderMaps();
    this.#render();
  }

  remove() { this.root.remove(); }

  #section(title, ...kids) {
    const s = h(this.doc, 'section', 'sk-sec');
    s.append(h(this.doc, 'h3', 'sk-sec-title', title), ...kids);
    return s;
  }

  /** Pick a map: its own teams and colours become the settings; the funds choice is kept. */
  pick(mapId) {
    const map = this.maps.find((m) => m.id === mapId);
    if (!map || map === this.map) return;
    const funds = this.settings.funds;
    this.map = map;
    this.settings = { ...defaultSkirmish(map), funds };
    this.#render();
  }

  setController(slot, controller) { this.settings.players[slot].controller = controller; this.#render(); }
  setFaction(slot, faction) { this.settings = { ...this.settings, players: swapFaction(this.settings.players, slot, faction) }; this.#render(); }
  setFunds(funds) { this.settings.funds = funds; this.#render(); }

  get problems() { return skirmishProblems(this.map, this.registry, this.settings); }

  #start() {
    if (this.problems.length) return;
    this.onStart(this.map, structuredClone(this.settings));
  }

  colorOf(owner) {
    return owner === null ? this.registry.rules.neutralColor : this.registry.faction(this.settings.players[owner].faction).color;
  }

  /** The list of maps. It only changes when a map is picked (the picked card is marked), so its thumbnails are drawn once. */
  #renderMaps() {
    const { doc, registry } = this;
    this.cards = new Map();
    for (const map of this.maps) {
      const card = h(doc, 'button', 'sk-map');
      card.setAttribute('type', 'button');
      const thumb = this.#canvas(map, (o) => (o === null ? registry.rules.neutralColor : registry.faction(map.players[o].faction).color), 'sk-thumb');
      const text = h(doc, 'span', 'sk-map-text');
      text.append(h(doc, 'span', 'sk-map-name', map.name), h(doc, 'span', 'sk-map-meta', `${map.width} x ${map.height} - ${map.players.length} players`));
      if (thumb) card.append(thumb);
      card.append(text);
      card.addEventListener('click', () => this.pick(map.id));
      this.cards.set(map.id, card);
      this.el.maps.append(card);
    }
  }

  /** A canvas with `map` drawn on it, or null where there is no canvas (tests). */
  #canvas(map, colorOf, cls) {
    const c = this.doc.createElement('canvas');
    const g = c.getContext?.('2d');
    if (!g) return null;
    const px = miniTile(map);
    c.className = cls;
    c.width = map.width * px; c.height = map.height * px;
    c.style.width = c.width + 'px'; c.style.height = c.height + 'px';
    drawMinimap(g, map, this.registry, colorOf, px);
    return c;
  }

  #segmented(options, value, onPick, label) {
    const { doc } = this;
    const box = h(doc, 'div', 'sk-seg');
    box.setAttribute('role', 'group');
    if (label) box.setAttribute('aria-label', label);
    for (const [val, text] of options) {
      const b = h(doc, 'button', 'sk-opt' + (val === value ? ' is-picked' : ''), text);
      b.setAttribute('type', 'button');
      b.addEventListener('click', () => onPick(val));
      box.append(b);
    }
    return box;
  }

  #render() {
    const { doc, registry, map, settings } = this;
    for (const [id, card] of this.cards) toggle(card, 'is-picked', id === map.id);

    // the picked map, in the colours chosen below
    this.el.preview.replaceChildren();
    const pic = this.#canvas(map, (o) => this.colorOf(o), 'sk-big');
    if (pic) this.el.preview.append(pic);
    const info = h(doc, 'div', 'sk-info');
    info.append(h(doc, 'div', 'sk-info-name', map.name), h(doc, 'div', 'sk-desc', map.description || 'No description.'));
    this.el.preview.append(info);

    // one row per team: who plays it, and a colour
    this.el.teams.replaceChildren();
    settings.players.forEach((p, i) => {
      const faction = registry.faction(p.faction);
      const row = h(doc, 'div', 'sk-slot');
      const top = h(doc, 'div', 'sk-slot-top');
      const name = h(doc, 'span', 'sk-slot-name', `Team ${i + 1}`);
      name.append(h(doc, 'span', 'sk-slot-faction', faction.name));
      top.append(name, this.#segmented([['human', 'Player'], ['ai', 'Computer']], p.controller, (v) => this.setController(i, v), `Team ${i + 1} is played by`));
      const swatches = h(doc, 'div', 'sk-swatches');
      for (const id of registry.factionIds) {
        const f = registry.faction(id);
        const b = h(doc, 'button', 'sk-swatch' + (id === p.faction ? ' is-picked' : ''));
        b.setAttribute('type', 'button');
        b.setAttribute('aria-label', f.name);
        b.style.setProperty('--swatch', f.color);
        b.style.setProperty('--swatch-dark', f.dark);
        b.addEventListener('click', () => this.setFaction(i, id));
        swatches.append(b);
      }
      const accent = row.style;
      accent.setProperty('--accent', faction.color);
      row.append(top, swatches);
      this.el.teams.append(row);
    });

    // rules
    this.el.rules.replaceChildren();
    const funds = h(doc, 'div', 'sk-rule');
    funds.append(h(doc, 'span', 'sk-rule-name', 'Starting funds'), this.#segmented(FUNDS_CHOICES.map((f) => [f, fmtFunds(f)]), settings.funds, (v) => this.setFunds(v), 'Starting funds'));
    this.el.rules.append(funds);

    const problems = this.problems;
    this.go.disabled = problems.length > 0;
    this.note.textContent = problems[0] || '';
  }
}

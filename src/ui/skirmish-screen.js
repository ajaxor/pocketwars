// The skirmish page: pick a map, then set who plays each team, in which colour and with which leader, and the starting funds. It is a
// full-screen overlay (like the title screen) built from the UI kit; the rules for what is allowed live in src/data/skirmish.js.
//
//   new SkirmishScreen(doc, { registry, maps, selectedId, leaders, speech, onStart(map, settings), onBack() })
//   screen.root         the element to add to the page
//   screen.map          the map that is picked
//   screen.settings     the current choices (see skirmish.js)
//   screen.roster       the leaders that can be picked, each { id, name, faction?, tag?, ...portrait traits }
//   screen.remove()     take it off the page
//
// `leaders` is the campaign's leader list (names and portraits); the leaders that can actually be picked are the ones that have a
// loadout in the registry, so without it they are still offered, by id and without a face. `speech` is the leaders' speech files (a line is
// quoted in the selection box). Colour and leader are one choice: each colour is a nation with one leader, so the team's leader is always the leader of the colour picked, and the selection box shows a line they say. Every change redraws the parts that depend on it from `this.map` and `this.settings`, which
// keeps the code simple: there is no other state to fall out of step.

import { drawPortrait } from '../render/portrait-art.js';
import { drawMinimap, miniTile } from '../render/minimap.js';
import { FUNDS_CHOICES, defaultSkirmish, hasJammers, skirmishProblems, swapFaction } from '../data/skirmish.js';
import { button, h, toggle } from './kit.js';

const fmtFunds = (n) => (n === null ? 'Map default' : Number(n).toLocaleString('en-US'));
const titleCase = (id) => id.charAt(0).toUpperCase() + id.slice(1);
const surname = (name) => name.split(' ').slice(-1)[0];

export class SkirmishScreen {
  /**
   * @param {Document} doc
   * @param {{registry:object, maps:object[], selectedId?:string, leaders?:object[], speech?:object, onStart:(map:object, settings:object)=>void, onBack:()=>void}} o
   */
  constructor(doc, { registry, maps, selectedId, leaders = [], speech = {}, onStart, onBack }) {
    this.doc = doc;
    this.registry = registry;
    this.maps = maps;
    this.onStart = onStart;
    this.onBack = onBack;
    const known = new Map(leaders.map((l) => [l.id, l]));
    this.roster = registry.leaderIds.map((id) => known.get(id) ?? { id, name: titleCase(id) });
    this.speech = speech;
    this.quotes = new Map();   // the line each team's leader says in the selection box, drawn again whenever the colour changes
    this.map = maps.find((m) => m.id === selectedId) || maps[0];
    this.settings = { ...this.#defaults(this.map), fog: this.#fogFor(this.map) };
    this.strips = [];   // the leader strip of each team, kept between redraws so a strip you scrolled stays where it was

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

  #defaults(map) { return this.#byColour(defaultSkirmish(map, this.roster.map((l) => l.id))); }

  /** The leader of a colour (the nation's own leader), or null when it has none to pick. */
  #leaderOf(faction) { return this.roster.find((l) => l.faction === faction)?.id ?? null; }

  /** The settings with every team led by the leader of its colour: the colour decides the leader, never the other way round. */
  #byColour(settings) { return { ...settings, players: settings.players.map((p) => ({ ...p, leader: this.#leaderOf(p.faction) })) }; }

  /** Pick a map: its own teams and colours become the settings (each team led by the leader of its colour); the funds are kept. */
  pick(mapId) {
    const map = this.maps.find((m) => m.id === mapId);
    if (!map || map === this.map) return;
    const { funds, startUnits, dialogue } = this.settings;
    this.map = map;
    this.settings = { ...this.#defaults(map), funds, startUnits, dialogue, fog: this.#fogFor(map) };
    this.quotes.clear();
    this.#render();
  }

  setController(slot, controller) { this.settings.players[slot].controller = controller; this.#render(); }
  /** Give a team a colour (swapping with whoever had it); each team's leader follows its colour. */
  setFaction(slot, faction) {
    this.settings = this.#byColour({ ...this.settings, players: swapFaction(this.settings.players, slot, faction) });
    this.quotes.clear();
    this.#render();
  }
  setFunds(funds) { this.settings.funds = funds; this.#render(); }
  /** Start with each team's starting units (on) or with none, only what the buildings can build (off). */
  setStartUnits(on) { this.settings.startUnits = on; this.#render(); }
  /** The leaders talk during the battle (on) or stay silent (off). */
  setDialogue(on) { this.settings.dialogue = on; this.#render(); }
  /** Fog of war on (the map's jammers stay) or off (they are taken off the map). A map without jammers has no fog: it stays off. */
  setFog(on) {
    if (!hasJammers(this.map, this.registry)) return;
    this.fogWanted = on;
    this.settings.fog = on;
    this.#render();
  }

  /** The fog setting for `map`: the player's last choice (on to begin with), or off when the map has no jammer to cause fog. */
  #fogFor(map) { return hasJammers(map, this.registry) ? this.fogWanted !== false : false; }

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

  /** A row of buttons, one picked; `disabled` lists the values that cannot be picked. */
  #segmented(options, value, onPick, label, disabled = []) {
    const { doc } = this;
    const box = h(doc, 'div', 'sk-seg');
    box.setAttribute('role', 'group');
    if (label) box.setAttribute('aria-label', label);
    for (const [val, text] of options) {
      const b = h(doc, 'button', 'sk-opt' + (val === value ? ' is-picked' : ''), text);
      b.setAttribute('type', 'button');
      b.disabled = disabled.includes(val);
      b.addEventListener('click', () => onPick(val));
      box.append(b);
    }
    return box;
  }

  /** The picture of a leader: a portrait, or null where there is no canvas (tests) or no face to draw (a leader without portrait traits). */
  #face(leader) {
    if (!leader.skin) return null;
    const c = this.doc.createElement('canvas');
    const g = c.getContext?.('2d');
    if (!g) return null;
    const px = 56 * Math.min(2, globalThis.devicePixelRatio || 1);
    c.className = 'sk-leader-pic';
    c.width = c.height = px;
    drawPortrait(g, leader, { px, style: 'flat' });
    return c;
  }

  /** The leader of a team's colour, shown as one card (there is nothing to pick: the colour chooses). */
  #leaderStrip(slot) {
    const { doc, roster } = this;
    const id = this.settings.players[slot].leader ?? null;
    const leader = roster.find((l) => l.id === id);
    const strip = this.strips[slot] ??= h(doc, 'div', 'sk-leaders');
    strip.setAttribute('role', 'group');
    strip.setAttribute('aria-label', `Team ${slot + 1} leader`);
    strip.replaceChildren();
    const card = h(doc, 'div', 'sk-leader is-picked');
    const face = leader ? this.#face(leader) : null;
    card.append(face ?? h(doc, 'span', 'sk-leader-glyph', '-'), h(doc, 'span', 'sk-leader-name', leader ? surname(leader.name) : 'None'));
    strip.append(card);
    return strip;
  }

  /** A line the team's leader says, kept until the colour changes. */
  #quote(slot, id) {
    const key = `${slot}:${id}`;
    if (!this.quotes.has(key)) {
      const lines = this.speech[id]?.lines;
      const pool = lines?.greeting?.length ? lines.greeting : lines?.battle_start ?? [];
      this.quotes.set(key, pool.length ? pool[Math.floor(Math.random() * pool.length)] : '');
    }
    return this.quotes.get(key);
  }

  /** What the selection box says about a team's leader: who they are, and a line in their own voice. */
  #leaderNote(slot, leader) {
    const { doc } = this;
    const box = h(doc, 'div', 'sk-leader-note');
    const l = this.roster.find((x) => x.id === leader);
    if (!l) { box.textContent = "No leader for this colour: this map's own units and the standard buildings."; return box; }
    const nation = this.registry.factions[l.faction]?.name;
    box.append(h(doc, 'div', 'sk-leader-who', [l.name, nation, l.tag].filter(Boolean).join(' - ')));
    const quote = this.#quote(slot, l.id);
    if (quote) box.append(h(doc, 'div', 'sk-leader-quote', `\u201c${quote}\u201d`));
    return box;
  }

  #render() {
    const { doc, registry, map, settings } = this;
    for (const [id, card] of this.cards) toggle(card, 'is-picked', id === map.id);
    const scrolled = this.strips.map((s) => s.scrollLeft || 0);   // replacing the rows detaches the strips, which forgets how far they were scrolled

    // the picked map, in the colours chosen below
    this.el.preview.replaceChildren();
    const pic = this.#canvas(map, (o) => this.colorOf(o), 'sk-big');
    if (pic) this.el.preview.append(pic);
    const info = h(doc, 'div', 'sk-info');
    info.append(h(doc, 'div', 'sk-info-name', map.name), h(doc, 'div', 'sk-desc', map.description || 'No description.'));
    this.el.preview.append(info);

    // one row per team: who plays it, a colour and a leader
    this.el.teams.replaceChildren();
    this.strips.length = settings.players.length;
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
      if (this.roster.length) row.append(this.#leaderStrip(i), this.#leaderNote(i, p.leader ?? null));
      this.el.teams.append(row);
    });
    this.strips.forEach((s, i) => { s.scrollLeft = scrolled[i] ?? 0; });

    // rules
    this.el.rules.replaceChildren();
    const funds = h(doc, 'div', 'sk-rule');
    funds.append(h(doc, 'span', 'sk-rule-name', 'Starting funds'), this.#segmented(FUNDS_CHOICES.map((f) => [f, fmtFunds(f)]), settings.funds, (v) => this.setFunds(v), 'Starting funds'));
    this.el.rules.append(funds);
    const fog = h(doc, 'div', 'sk-rule');
    const jammed = hasJammers(map, registry);
    fog.append(h(doc, 'span', 'sk-rule-name', 'Fog of war'));
    fog.append(this.#segmented([[true, 'On'], [false, 'Off']], jammed && settings.fog !== false, (v) => this.setFog(v), 'Fog of war', jammed ? [] : [true]),
      h(doc, 'span', 'sk-rule-note', !jammed ? 'Off: this map has no jammers.' : settings.fog !== false ? 'Jammers on this map hide what your units cannot see. Destroy them all to lift it.' : 'The jammers are taken off the map.'));
    this.el.rules.append(fog);
    const start = h(doc, 'div', 'sk-rule');
    start.append(h(doc, 'span', 'sk-rule-name', 'Starting units'), this.#segmented([[true, 'On'], [false, 'Off']], settings.startUnits !== false, (v) => this.setStartUnits(v), 'Starting units'),
      h(doc, 'span', 'sk-rule-note', settings.startUnits !== false ? 'Each team begins with its starting army.' : 'Nobody starts with any units: build everything.'));
    this.el.rules.append(start);
    const talk = h(doc, 'div', 'sk-rule');
    talk.append(h(doc, 'span', 'sk-rule-name', 'Dialogue'), this.#segmented([[true, 'On'], [false, 'Off']], settings.dialogue !== false, (v) => this.setDialogue(v), 'Dialogue'),
      h(doc, 'span', 'sk-rule-note', settings.dialogue !== false ? 'The computer\'s leaders speak during the battle.' : 'Nobody speaks during the battle.'));
    this.el.rules.append(talk);

    const problems = this.problems;
    this.go.disabled = problems.length > 0;
    this.note.textContent = problems[0] || '';
  }
}

// The skirmish page: three steps, one after the other. 1 Map (a scrollable grid), 2 Teams (who plays each one, in which colour and with
// which leader) and 3 Options (starting funds, fog, starting units, dialogue). Back and Next move between them (Back on the first step
// leaves the page); the last step has Start battle instead of Next. It is a full-screen overlay (like the title screen) built from the UI
// kit; the rules for what is allowed live in src/data/skirmish.js. On a wide window the picked map stays in a panel beside the steps.
//
//   new SkirmishScreen(doc, { registry, maps, selectedId, leaders, speech, onStart(map, settings), onBack() })
//   screen.root         the element to add to the page
//   screen.map          the map that is picked
//   screen.settings     the current choices (see skirmish.js)
//   screen.step         the step shown: 0 Map, 1 Teams, 2 Options
//   screen.back/next/go the footer buttons (Start battle, `go`, only shows on the last step)
//   screen.roster       the leaders that can be picked, each { id, name, faction?, tag?, ...portrait traits }
//   screen.remove()     take it off the page
//
// `leaders` is the campaign's leader list (names and portraits); the leaders that can actually be picked are the ones that have a
// loadout in the registry, so without it they are still offered, by id and without a face. `speech` is the leaders' speech files (a line is
// quoted in the selection box). Colour and leader are one choice: each colour is a nation with one leader, so the team's leader is always the leader of the colour picked, and the selection box shows a line they say. Every change redraws the parts that depend on it from `this.map` and `this.settings`, which
// keeps the code simple: there is no other state to fall out of step.

import { drawPortrait } from '../render/portrait-art.js';
import { MINI_BOX, drawMinimap, miniTile } from '../render/minimap.js';
import { FUNDS_CHOICES, defaultSkirmish, hasJammers, skirmishProblems, swapFaction } from '../data/skirmish.js';
import { button, h, toggle } from './kit.js';

const fmtFunds = (n) => (n === null ? 'Map default' : Number(n).toLocaleString('en-US'));
const titleCase = (id) => id.charAt(0).toUpperCase() + id.slice(1);
const surname = (name) => name.split(' ').slice(-1)[0];
/** The steps, in order: the name on the step bar and the heading above the page. */
const STEPS = [['Map', 'Choose a map'], ['Teams', 'Set up the teams'], ['Options', 'Choose the rules']];
/** A window this wide keeps the picked map beside the steps, so its preview can be bigger. */
export const WIDE = 880;   // keep in step with the (min-width: 880px) media query in style.css (a test checks)
const ALL = ['preview', 'teams', 'rules'];

export class SkirmishScreen {
  /**
   * @param {Document} doc
   * @param {{registry:object, maps:object[], selectedId?:string, leaders?:object[], speech?:object, onStart:(map:object, settings:object)=>void, onBack:()=>void}} o
   */
  constructor(doc, { registry, maps, selectedId, leaders = [], speech = {}, engines = [], defaultEngine = null, onStart, onBack }) {
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
    this.engines = engines;            // the computer opponents to choose between (none: the rule is not shown)
    this.defaultEngine = defaultEngine;
    this.stale = new Set();   // the parts (preview, teams, rules) that need redrawing before they next show
    this.strips = [];   // the leader strip of each team, kept between redraws so a strip you scrolled stays where it was

    this.step = 0;
    const head = h(doc, 'header', 'screen-head');
    this.bar = h(doc, 'ol', 'sk-steps');
    this.pips = STEPS.map(([name], i) => { const li = h(doc, 'li', 'sk-step'); li.append(h(doc, 'span', 'sk-step-n', String(i + 1)), h(doc, 'span', 'sk-step-name', name)); this.bar.append(li); return li; });
    head.append(h(doc, 'h2', 'screen-title', 'Skirmish'), this.bar);

    this.el = {
      maps: h(doc, 'div', 'sk-maps'),
      preview: h(doc, 'aside', 'sk-preview'),
      teams: h(doc, 'div', 'sk-teams'),
      rules: h(doc, 'div', 'sk-rules'),
    };
    this.pages = [this.el.maps, this.el.teams, this.el.rules].map((content, i) => {
      const page = h(doc, 'section', `sk-page sk-page--${['map', 'teams', 'rules'][i]}`);
      page.append(h(doc, 'h3', 'sk-sec-title', STEPS[i][1]), content);
      return page;
    });
    const main = h(doc, 'div', 'sk-main');
    const pages = h(doc, 'div', 'sk-pages');
    pages.append(...this.pages);
    main.append(this.el.preview, pages);

    const foot = h(doc, 'footer', 'sk-foot');
    this.note = h(doc, 'div', 'sk-note');
    const nav = h(doc, 'div', 'sk-nav');
    this.back = button(doc, { label: 'Back', variant: 'ghost', size: 'lg', onClick: () => this.prev() });
    this.next = button(doc, { label: 'Next', variant: 'primary', size: 'lg', onClick: () => this.advance() });
    this.go = button(doc, { label: 'Start battle', variant: 'primary', size: 'lg', onClick: () => this.#start() });
    nav.append(this.back, this.next, this.go);
    foot.append(this.note, nav);

    this.root = h(doc, 'div', 'sk');
    this.root.append(head, main, foot);
    this.#renderMaps();
    this.#render(ALL);
    // crossing the wide breakpoint (a rotation, a resized window) changes the preview's resolution, so it is drawn again
    this.wide = this.#isWide();
    this.onResize = () => { const w = this.#isWide(); if (w !== this.wide) { this.wide = w; this.#render('preview'); } };
    globalThis.addEventListener?.('resize', this.onResize);
    (globalThis.requestAnimationFrame ?? globalThis.setTimeout)?.(() => this.#reveal());   // bring the picked map into view once the page is on screen
  }

  remove() { globalThis.removeEventListener?.('resize', this.onResize); this.root.remove(); }

  #defaults(map) { return this.#byColour(defaultSkirmish(map, this.roster.map((l) => l.id))); }

  /** The leader of a colour (the nation's own leader), or null when it has none to pick. */
  #leaderOf(faction) { return this.roster.find((l) => l.faction === faction)?.id ?? null; }

  /** The settings with every team led by the leader of its colour: the colour decides the leader, never the other way round. */
  #byColour(settings) { return { ...settings, players: settings.players.map((p) => ({ ...p, leader: this.#leaderOf(p.faction) })) }; }

  /** Pick a map: its own teams and colours become the settings (each team led by the leader of its colour); the funds are kept. */
  pick(mapId) {
    const map = this.maps.find((m) => m.id === mapId);
    if (!map || map === this.map) return;
    const { funds, startUnits, dialogue, computer } = this.settings;
    this.map = map;
    this.settings = { ...this.#defaults(map), funds, startUnits, dialogue, computer, fog: this.#fogFor(map) };
    this.quotes.clear();
    this.#render(ALL);
  }

  /** Show a step (0 to 2). */
  goTo(step) {
    const next = Math.max(0, Math.min(STEPS.length - 1, step));
    if (next === this.step) return;
    this.step = next;
    this.#render();   // a part that changed while its page was hidden is built now that it shows
    if (next === 0) this.#reveal();
  }
  /** Back: the step before, or off the page from the first one. */
  prev() { if (this.step === 0) this.onBack(); else this.goTo(this.step - 1); }
  /** Next: the step after (not past the last, and not while the teams have a problem). */
  advance() { if (this.step === 1 && this.problems.length) return; this.goTo(this.step + 1); }

  setController(slot, controller) { this.settings.players[slot].controller = controller; this.#render('teams', 'rules'); }
  /** Give a team a colour (swapping with whoever had it); each team's leader follows its colour. */
  setFaction(slot, faction) {
    this.settings = this.#byColour({ ...this.settings, players: swapFaction(this.settings.players, slot, faction) });
    this.quotes.clear();
    this.#render('preview', 'teams');
  }
  setFunds(funds) { this.settings.funds = funds; this.#render('rules'); }
  /** Start with each team's starting units (on) or with none, only what the buildings can build (off). */
  setStartUnits(on) { this.settings.startUnits = on; this.#render('rules'); }
  /** The leaders talk during the battle (on) or stay silent (off). */
  setDialogue(on) { this.settings.dialogue = on; this.#render('rules'); }
  /** Which engine plays the computer teams (an id from `engines`). */
  setComputer(id) { this.settings.computer = id; this.#render('rules'); }
  /** Fog of war on (the map's jammers stay) or off (they are taken off the map). A map without jammers has no fog: it stays off. */
  setFog(on) {
    if (!hasJammers(this.map, this.registry)) return;
    this.fogWanted = on;
    this.settings.fog = on;
    this.#render('rules');
  }

  /** The fog setting for `map`: the player's last choice (on to begin with), or off when the map has no jammer to cause fog. */
  #fogFor(map) { return hasJammers(map, this.registry) ? this.fogWanted !== false : false; }

  get problems() { return skirmishProblems(this.map, this.registry, this.settings); }

  #start() {
    if (this.step !== STEPS.length - 1 || this.problems.length) return;
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

  /** Scroll the map grid so the picked card is in view. */
  #reveal() { this.cards.get(this.map.id)?.scrollIntoView?.({ block: 'nearest' }); }

  /** A canvas with `map` drawn on it, or null where there is no canvas (tests). */
  #canvas(map, colorOf, cls, box = MINI_BOX) {
    const c = this.doc.createElement('canvas');
    const g = c.getContext?.('2d');
    if (!g) return null;
    const px = miniTile(map, box);
    c.className = cls;
    c.width = map.width * px; c.height = map.height * px;
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

  /**
   * Redraw what changed. Parts named here are marked stale; a stale part is rebuilt only while it shows (the preview always, the
   * teams on step 2, the rules on step 3), so a change on one step does not redraw the others and a rules toggle does not repaint
   * the portraits. A page is built the first time it is shown after a change.
   */
  #render(...parts) {
    for (const p of parts.flat()) this.stale.add(p);
    const { map } = this;
    for (const [id, card] of this.cards) toggle(card, 'is-picked', id === map.id);
    this.root.setAttribute('data-step', String(this.step));
    this.pages.forEach((page, i) => { page.hidden = i !== this.step; });
    this.pips.forEach((pip, i) => { toggle(pip, 'is-on', i === this.step); toggle(pip, 'is-done', i < this.step); if (i === this.step) pip.setAttribute('aria-current', 'step'); else pip.setAttribute('aria-current', 'false'); });
    if (this.stale.delete('preview')) this.#drawPreview();
    if (this.step === 1 && this.stale.delete('teams')) this.#drawTeams();
    if (this.step === 2 && this.stale.delete('rules')) this.#drawRules();
    const problems = this.problems, last = this.step === STEPS.length - 1;
    this.next.hidden = last;
    this.go.hidden = !last;
    this.next.disabled = this.step === 1 && problems.length > 0;
    this.go.disabled = problems.length > 0;
    this.note.textContent = this.step > 0 ? problems[0] || '' : '';
  }

  #isWide() { return (globalThis.innerWidth || 0) >= WIDE; }

  #drawPreview() {
    const { doc, map } = this;
    // the picked map, in the colours chosen below
    this.el.preview.replaceChildren();
    const wide = this.#isWide();
    const pic = this.#canvas(map, (o) => this.colorOf(o), 'sk-big', wide ? { w: 320, h: 260 } : MINI_BOX);
    if (pic) this.el.preview.append(pic);
    const info = h(doc, 'div', 'sk-info');
    info.append(h(doc, 'div', 'sk-info-name', map.name), h(doc, 'div', 'sk-desc', map.description || 'No description.'));
    this.el.preview.append(info);

  }

  #drawTeams() {
    const { doc, registry, settings } = this;
    const scrolled = this.strips.map((s) => s.scrollLeft || 0);   // replacing the rows detaches the strips, which forgets how far they were scrolled
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

  }

  #drawRules() {
    const { doc, registry, map, settings } = this;
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
    if (this.engines.length > 1 && settings.players.some((p) => p.controller === 'ai')) {
      const chosen = settings.computer ?? this.defaultEngine ?? this.engines[0].id;
      const opp = h(doc, 'div', 'sk-rule');
      opp.append(h(doc, 'span', 'sk-rule-name', 'Computer'), this.#segmented(this.engines.map((e) => [e.id, e.name]), chosen, (v) => this.setComputer(v), 'Computer opponent'),
        h(doc, 'span', 'sk-rule-note', this.engines.find((e) => e.id === chosen)?.description ?? ''));
      this.el.rules.append(opp);
    }

  }
}

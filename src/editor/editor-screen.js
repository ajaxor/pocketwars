// The map editor: a full-screen page (like the skirmish page) that edits one map with the game's own drawing, so what you paint is what
// you will play. Opened from the title screen.
//
//   new EditorScreen(doc, { registry, maps, store, onBack, onPlay(gameMap) })   maps: the game's maps (to open); store: localStorage
//   screen.root          the element to add to the page;  screen.remove() takes it off again (and stops its frame loop)
//   screen.model         the EditorModel being edited (model.js)
//
// Layout: a bar at the top (back, the map's name, undo/redo, problems, Map settings, File, Play), the board in the middle (drawn by the game's
// Renderer from a throw-away game state built from the model), and a dock at the bottom: the palette tabs (Terrain, Buildings, Units,
// Defences), the palette, whose it is (Neutral or a player), the tool (Brush, Fill, Erase, Pick, Pan), the brush size and the symmetry.
//
// Input on the board: one finger or the left mouse button uses the tool (drag to paint a line); two fingers pan and pinch-zoom; the mouse
// wheel zooms, the right or middle button or Space-and-drag pans, as does the Pan tool. Keys: Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z or Ctrl+Y
// redo, B brush, F fill, E erase, I pick, H pan, 1/3 brush size, Escape closes a sheet.
//
// The map being edited is saved in the browser after every change (storage.js), so leaving the editor, playing the map or reloading the
// page loses nothing. "Save to My maps" keeps a copy that the skirmish page lists; Download gives the .map.json file to add to the game.

import { Renderer } from '../render/renderer.js';
import { Camera } from '../render/camera.js';
import { drawTerrainLayer } from '../render/terrain-layer.js';
import { drawWall } from '../render/walls.js';
import { drawUnit } from '../render/unit-sprites.js';
import { drawMinimap } from '../render/minimap.js';
import { createState } from '../engine/state.js';
import { parseMap, serializeMap } from '../data/map-format.js';
import { EditorModel, MAX_PLAYERS, MAX_SIZE, MIN_SIZE, SYMMETRY, ownerInCopy, symmetryPoints } from './model.js';
import { TABS, palette } from './palette.js';
import { deleteMap, loadDraft, saveDraft, saveMap, savedMaps } from './storage.js';
import { button, h, toggle, windowBox } from '../ui/kit.js';

const TOOLS = [
  { id: 'brush', label: 'Brush', key: 'b', help: 'Paint what is picked in the palette. Drag to paint a line.' },
  { id: 'fill', label: 'Fill', key: 'f', help: 'Fill the area of matching terrain under your finger.' },
  { id: 'erase', label: 'Erase', key: 'e', help: 'Remove a unit, or turn the tile back to plain.' },
  { id: 'pick', label: 'Pick', key: 'i', help: 'Pick up the unit or terrain on a tile, then paint with it.' },
  { id: 'pan', label: 'Pan', key: 'h', help: 'Drag to move the map.' },
];
const ANCHORS = [['Top left', { x: 0, y: 0 }], ['Centre', { x: .5, y: .5 }], ['Bottom right', { x: 1, y: 1 }]];
const NO_VIEW = { selectedId: null, dest: null, reach: null, attackTiles: null, targets: [], showTargets: false, pendingTargetId: null, cursor: null, sonar: null, layTiles: null };
const ICON = 40;

export class EditorScreen {
  constructor(doc, { registry, maps = [], store, onBack = () => {}, onPlay = () => {}, win = globalThis } = {}) {
    Object.assign(this, { doc, registry, maps, store, onBack, onPlay, win });
    this.items = palette(registry);
    this.tab = 'terrain';
    this.picked = { terrain: this.items.terrain[0], buildings: this.items.buildings.find((i) => i.id === 'hq') ?? this.items.buildings[0], units: this.items.units[0], defences: this.items.defences[0] };
    this.owner = 0;
    this.tool = 'brush';
    this.size = 1;
    this.symmetry = 'none';
    this.hover = null;          // the tile under the mouse, for the brush outline
    this.disposed = false;
    const draft = loadDraft(store);
    this.model = this.#open(draft, () => EditorModel.blank(registry));

    this.#build();
    this.#setupBoard();
    this.#renderAll();
    this.#frame();
  }

  /** A model from a raw map file object, or `fallback()` when there is none or it cannot be read. */
  #open(raw, fallback) {
    if (raw) { try { return EditorModel.fromRaw(raw, this.registry); } catch (e) { this.win.console?.warn?.('Editor: could not open map', e); } }
    return fallback();
  }

  remove() {
    this.disposed = true;
    this.root.remove();
    this.doc.removeEventListener?.('keydown', this.onKey);
    this.doc.removeEventListener?.('keyup', this.onKeyUp);
    this.win.removeEventListener?.('resize', this.onResize);
  }

  // ---- building the page ---------------------------------------------------------------------------------------------------------
  #build() {
    const { doc } = this;
    const bar = h(doc, 'header', 'ed-head');
    const sm = (label, onClick, variant = null, title = null) => { const b = button(doc, { label, size: 'sm', variant, onClick }); if (title) b.setAttribute('title', title); return b; };
    this.el = {};
    this.el.back = sm('Back', () => this.onBack(), 'ghost');
    this.el.back.classList.add('ed-back');
    this.el.name = h(doc, 'button', 'ed-name');
    this.el.name.setAttribute('type', 'button');
    this.el.name.addEventListener('click', () => this.openMapSheet());
    this.el.undo = sm('Undo', () => this.undo(), null, 'Undo (Ctrl+Z)');
    this.el.redo = sm('Redo', () => this.redo(), null, 'Redo (Shift+Ctrl+Z)');
    this.el.problems = sm('', () => this.openProblems(), null, 'What stops this map from being played');
    this.el.problems.classList.add('ed-problems');
    this.el.mapBtn = sm('Map', () => this.openMapSheet(), null, 'Name, size and players');
    this.el.file = sm('File', () => this.openFileSheet(), null, 'New, open, save, download');
    this.el.play = sm('Play', () => this.play(), 'primary', 'Play this map now');
    const grow = h(doc, 'span', 'ed-grow');
    const tools = h(doc, 'div', 'ed-head-tools');   // on a phone these go on a second row under the name
    tools.append(this.el.undo, this.el.redo, this.el.problems, this.el.mapBtn, this.el.file);
    bar.append(this.el.back, this.el.name, grow, tools, this.el.play);

    this.stage = h(doc, 'div', 'ed-stage');
    this.canvas = doc.createElement('canvas');
    this.canvas.className = 'ed-canvas';
    this.toast = h(doc, 'div', 'ed-toast');
    this.toast.hidden = true;
    const zoom = h(doc, 'div', 'ed-zoom');
    const zb = (label, title, fn) => { const b = h(doc, 'button', 'ed-zoom-btn', label); b.setAttribute('type', 'button'); b.setAttribute('title', title); b.setAttribute('aria-label', title); b.addEventListener('click', fn); return b; };
    const cam = () => this.renderer.camera;
    zoom.append(
      zb('+', 'Zoom in', () => cam().zoomTo(cam().steps.find((v) => v > cam().S) ?? cam().S)),
      zb('-', 'Zoom out', () => cam().zoomTo([...cam().steps].reverse().find((v) => v < cam().S) ?? cam().S)),
      zb('Fit', 'Show the whole map', () => cam().zoomTo(cam().fitSize)),
    );
    this.stage.append(this.canvas, this.toast, zoom);

    const dock = h(doc, 'div', 'ed-dock');
    this.el.tabs = h(doc, 'div', 'ed-tabs');
    this.el.palette = h(doc, 'div', 'ed-palette');
    const controls = h(doc, 'div', 'ed-controls');
    this.el.owners = h(doc, 'div', 'ed-owners');
    this.el.tools = h(doc, 'div', 'ed-seg');
    this.el.sizes = h(doc, 'div', 'ed-seg');
    this.el.sym = h(doc, 'select', 'ed-select');
    this.el.sym.setAttribute('aria-label', 'Symmetry');
    for (const [id, s] of Object.entries(SYMMETRY)) { const o = h(doc, 'option', null, `Symmetry: ${s.label}`); o.value = id; this.el.sym.append(o); }
    this.el.sym.addEventListener('change', () => { this.symmetry = this.el.sym.value; });
    controls.append(this.el.owners, this.el.tools, this.el.sizes, this.el.sym);
    dock.append(this.el.tabs, this.el.palette, controls);

    this.sheet = h(doc, 'div', 'ed-scrim');
    this.sheet.hidden = true;
    this.sheet.addEventListener('pointerdown', (e) => { if (e.target === this.sheet) this.closeSheet(); });

    this.root = h(doc, 'div', 'ed');
    this.root.append(bar, this.stage, dock, this.sheet);

    this.onKey = (e) => this.#key(e);
    this.onKeyUp = (e) => { if (e.key === ' ') this.spaceDown = false; };
    doc.addEventListener?.('keydown', this.onKey);
    doc.addEventListener?.('keyup', this.onKeyUp);
  }

  // ---- the parts that change -------------------------------------------------------------------------------------------------------
  #renderAll() { this.#renderTabs(); this.#renderPalette(); this.#renderControls(); this.#renderBar(); }

  #renderBar() {
    const m = this.model;
    this.el.name.replaceChildren(h(this.doc, 'span', 'ed-name-main', m.name || 'Untitled'), h(this.doc, 'span', 'ed-name-sub', `${m.width} x ${m.height} - ${m.players.length} players`));
    this.el.undo.disabled = !m.canUndo;
    this.el.redo.disabled = !m.canRedo;
    const n = m.problems().length;
    this.problemCount = n;
    this.el.problems.replaceChildren(h(this.doc, 'span', 'btn-label', n ? `${n} problem${n > 1 ? 's' : ''}` : 'Ready'));
    toggle(this.el.problems, 'is-bad', n > 0);
  }

  #renderTabs() {
    const { doc } = this;
    this.el.tabs.replaceChildren();
    for (const t of TABS) {
      const b = h(doc, 'button', 'ed-tab' + (t.id === this.tab ? ' is-picked' : ''), t.label);
      b.setAttribute('type', 'button');
      b.addEventListener('click', () => { this.tab = t.id; if (this.tool === 'pick' || this.tool === 'erase') this.tool = 'brush'; this.#renderAll(); });
      this.el.tabs.append(b);
    }
  }

  get item() { return this.picked[this.tab]; }

  #renderPalette() {
    const { doc } = this;
    this.el.palette.replaceChildren();
    this.icons = [];
    for (const it of this.items[this.tab]) {
      const b = h(doc, 'button', 'ed-item' + (this.item?.key === it.key ? ' is-picked' : ''));
      b.setAttribute('type', 'button');
      b.setAttribute('title', it.label);
      const c = doc.createElement('canvas');
      c.className = 'ed-icon';
      const d = Math.min(2, this.win.devicePixelRatio || 1);
      c.width = c.height = ICON * d;
      c.style.width = c.style.height = ICON + 'px';
      b.append(c, h(doc, 'span', 'ed-item-name', it.label));
      b.addEventListener('click', () => { this.picked[this.tab] = it; if (this.tool !== 'fill' && this.tool !== 'pan') this.tool = 'brush'; if (!it.neutralOk && this.owner === null) this.owner = 0; this.#renderPalette(); this.#renderControls(); });
      this.el.palette.append(b);
      this.icons.push({ canvas: c, it, d });
    }
    this.#drawIcons(0);
    const picked = Array.from(this.el.palette.children ?? []).find((c) => c.classList.contains('is-picked'));
    picked?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }

  #colors(owner) {
    const { registry, model } = this;
    if (owner === null || owner === undefined) return registry.rules.neutralUnitColors ?? { color: '#3e4045', dark: '#1b1c1f' };
    return registry.faction(model.players[owner]?.faction ?? registry.factionIds[0]);
  }

  /** Draw the palette's pictures: a tile of each terrain (a building in the chosen owner's colour), a wall piece, a unit in its colours. */
  #drawIcons(now) {
    const { registry } = this;
    for (const { canvas, it, d } of this.icons ?? []) {
      const g = canvas.getContext?.('2d');
      if (!g) continue;
      g.setTransform(d, 0, 0, d, 0, 0);
      g.clearRect(0, 0, ICON, ICON);
      const owner = it.owned ? (this.owner === null && !it.neutralOk ? 0 : this.owner) : null;
      if (it.kind === 'unit') {
        const def = registry.unit(it.id);
        drawUnit(g, { type: it.id, x: 0, y: 0, hp: 10 }, { def, colors: this.#colors(owner), px: 0, py: 0, size: ICON, now, animate: true, moving: false, showHp: false });
        continue;
      }
      const grass = registry.groundDef(registry.defaultGround);
      const set = this.model?.tileset ?? registry.defaultTileset;
      const tdef = registry.skin(set, it.kind === 'terrain' ? it.id : 'plain');
      const gdef = it.kind === 'ground' ? registry.groundDef(it.id) : grass;
      const ownerColor = tdef.attributes.property ? (owner === null ? registry.rules.neutralColor : this.#colors(owner).color) : null;
      drawTerrainLayer(g, { width: 1, height: 1, S: ICON, now, terrainAt: () => tdef, ownerColorAt: () => ownerColor, groundAt: () => gdef });
      if (tdef.attributes.wall) drawWall(g, 0, 0, ICON, null, { links: { e: true, w: true }, cracked: !!tdef.attributes.wall.structure });
    }
  }

  #renderControls() {
    const { doc, model } = this;
    const it = this.item;
    // whose: Neutral and each player (only for things that have an owner)
    this.el.owners.replaceChildren();
    const owned = it?.owned && this.tool !== 'erase' && this.tool !== 'pan';
    this.el.owners.hidden = !owned;
    if (owned) {
      const opts = [[null, 'Neutral'], ...model.players.map((p, i) => [i, `Player ${i + 1}`])];
      for (const [o, label] of opts) {
        if (o === null && !it.neutralOk) continue;
        const col = o === null ? (it.kind === 'terrain' ? this.registry.rules.neutralColor : this.#colors(null).color) : this.#colors(o).color;
        const b = h(doc, 'button', 'ed-owner' + (this.owner === o ? ' is-picked' : ''));
        b.setAttribute('type', 'button');
        b.setAttribute('title', label);
        b.setAttribute('aria-label', label);
        b.style.setProperty('--swatch', col);
        b.append(h(doc, 'span', 'ed-owner-label', o === null ? 'N' : String(o + 1)));
        b.addEventListener('click', () => { this.owner = o; this.#renderControls(); this.#drawIcons(this.#now()); });
        this.el.owners.append(b);
      }
    }
    this.el.tools.replaceChildren();
    for (const t of TOOLS) {
      const b = h(doc, 'button', 'ed-opt' + (this.tool === t.id ? ' is-picked' : ''), t.label);
      b.setAttribute('type', 'button');
      b.setAttribute('title', `${t.help} (${t.key.toUpperCase()})`);
      b.addEventListener('click', () => this.setTool(t.id));
      this.el.tools.append(b);
    }
    this.el.sizes.replaceChildren();
    for (const s of [1, 3]) {
      const b = h(doc, 'button', 'ed-opt' + (this.size === s ? ' is-picked' : ''), s === 1 ? '1x1' : '3x3');
      b.setAttribute('type', 'button');
      b.setAttribute('title', `Brush size ${s} (${s})`);
      b.addEventListener('click', () => { this.size = s; this.#renderControls(); });
      this.el.sizes.append(b);
    }
    this.el.sizes.hidden = it?.kind === 'unit' || this.tool === 'pan' || this.tool === 'pick';
    this.el.sym.value = this.symmetry;
  }

  setTool(id) { this.tool = id; this.#renderControls(); }

  /** A short message over the board that goes away by itself. */
  say(text) {
    this.toast.textContent = text;
    this.toast.hidden = !text;
    clearTimeout(this.toastTimer);
    if (text) this.toastTimer = setTimeout(() => { this.toast.hidden = true; }, 2600);
  }

  // ---- edits -------------------------------------------------------------------------------------------------------------------------
  /** The model changed: redraw the board next frame, refresh the bar, keep the draft. */
  #changed() {
    this.#renderBar();
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => saveDraft(this.model.toRaw(), this.store), 300);
  }

  undo() { if (this.model.undo()) { this.#afterHistory(); } }
  redo() { if (this.model.redo()) { this.#afterHistory(); } }
  #afterHistory() { this.#renderControls(); this.#changed(); }

  /** Replace the map being edited (New, Open, Import): the draft becomes the new map. */
  load(model) {
    this.model = model;
    if (this.owner !== null && this.owner >= model.players.length) this.owner = 0;
    this.#renderAll();
    this.#changed();
    this.#fit();
  }

  /** Use the tool on tile (x, y), with every symmetric copy. `first` is the tap that starts a stroke (fill and pick only act on it). */
  #apply(x, y, first) {
    const m = this.model, it = this.item;
    if (!m.inBounds(x, y)) return;
    if (this.tool === 'pick') { if (first) this.#pick(x, y); return; }
    if (this.tool === 'fill' && !first) return;
    const copies = SYMMETRY[this.symmetry].copies, n = m.players.length;
    let removed = 0, refused = null;
    for (const p of symmetryPoints(m, x, y, this.symmetry)) {
      const owner = ownerInCopy(this.owner, p.copy, copies, n);
      if (this.tool === 'erase') {
        if (!m.removeUnit(p.x, p.y)) removed += m.paintTerrain(p.x, p.y, 'plain').length;
        continue;
      }
      if (this.tool === 'fill') {
        if (it.kind === 'unit') { refused = 'Fill works with terrain. Use the brush for units.'; break; }
        removed += m.fill(p.x, p.y, { kind: it.kind, id: it.id, owner }).length;
        continue;
      }
      if (it.kind === 'unit') {
        const why = m.placeUnit(p.x, p.y, it.id, it.neutralOk ? owner : owner ?? 0);
        if (why === 'cannot-stand') refused = `${it.label} cannot stand on ${m.terrainDef(p.x, p.y).name}.`;
        else if (why) refused = why === 'needs-owner' ? `${it.label} needs an owner.` : 'That player does not exist.';
        continue;
      }
      const r = this.size === 3 ? 1 : 0;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (it.kind === 'ground') m.paintGround(p.x + dx, p.y + dy, it.id);
          else removed += m.paintTerrain(p.x + dx, p.y + dy, it.id, owner).length;
        }
      }
    }
    if (refused && first) this.say(refused);
    else if (removed) this.say(`${removed} unit${removed > 1 ? 's' : ''} removed (they cannot stand there).`);
    this.#changed();
  }

  #pick(x, y) {
    const m = this.model;
    const u = m.unitAt(x, y);
    const find = (key) => { for (const t of TABS) { const it = this.items[t.id].find((i) => i.key === key); if (it) return [t.id, it]; } return null; };
    const hit = (u && find(`u:${u.type}`)) || find(`t:${m.terrain[y][x]}`);
    if (!hit) return;
    const [tab, it] = hit;
    this.tab = tab;
    this.picked[tab] = it;
    if (it.owned) this.owner = u ? u.owner : m.owners[y][x];
    this.tool = 'brush';
    this.#renderAll();
    this.say(`Picked ${it.label}.`);
  }

  // ---- the board ---------------------------------------------------------------------------------------------------------------------
  #setupBoard() {
    const effects = { unitOffset: () => [0, 0], displayHp: (u) => u.hp, draw() {}, isLocked: () => false };
    const animator = { current: null, active: false, arrow: null, positionOf: () => null, facingOf: () => null };
    this.built = -1;
    this.renderer = new Renderer(this.canvas, this.#game(), effects, animator);
    this.renderer.viewer = null;   // the editor shows everything: no fog, no hidden units
    this.onResize = () => this.#fit();
    this.win.addEventListener?.('resize', this.onResize);
    this.pointers = new Map();
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => this.#down(e));
    c.addEventListener('pointermove', (e) => this.#move(e));
    c.addEventListener('pointerup', (e) => this.#up(e));
    c.addEventListener('pointercancel', (e) => this.#up(e, true));
    c.addEventListener('pointerleave', () => { this.hover = null; });
    c.addEventListener('wheel', (e) => this.#wheel(e), { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    this.win.requestAnimationFrame?.(() => this.#fit());
  }

  /** A game made from the model, only to be drawn (the renderer reads registry, map and state). Rebuilt when the model changes. */
  #game() {
    const map = this.model.asGameMap();
    const state = createState(map, this.registry);   // also puts the cracked walls on breakable wall tiles, as the game will
    state.turn = -1;                                  // nobody's turn: no unit is drawn as having acted
    this.built = this.model.version;
    this.builtModel = this.model;
    return { registry: this.registry, map, state };
  }

  /** Size the canvas to the board area and fit the camera to it (a new map is shown whole when it fits). */
  #fit() {
    const r = this.stage.getBoundingClientRect?.();
    if (!r || !this.canvas.getContext) return;
    const d = this.win.devicePixelRatio || 1;
    this.canvas.width = Math.round(r.width * d);
    this.canvas.height = Math.round(r.height * d);
    this.canvas.style.width = r.width + 'px';
    this.canvas.style.height = r.height + 'px';
    this.renderer.dpr = d;
    const m = this.model;
    const fresh = this.cameraFor !== m || this.renderer.camera.mapW !== m.width || this.renderer.camera.mapH !== m.height;
    if (fresh) { this.renderer.camera = new Camera(m.width, m.height); this.cameraFor = m; }
    this.renderer.camera.setViewport(r.width, r.height, 0);
    if (fresh) this.renderer.camera.zoomTo(this.renderer.camera.fitSize);   // a map is first shown whole (pinch or wheel to zoom in)
  }

  #now() { return this.win.performance?.now?.() ?? Date.now(); }

  #frame() {
    if (this.disposed) return;
    if (this.built !== this.model.version || this.builtModel !== this.model) {
      const sized = this.renderer.game.map.width !== this.model.width || this.renderer.game.map.height !== this.model.height;
      this.renderer.game = this.#game();
      if (sized) this.#fit();
    }
    const now = this.#now();
    if (this.renderer.g && this.renderer.camera.W) {
      this.renderer.draw(NO_VIEW, now);
      this.#overlay();
      if (Math.floor(now / 120) !== this.iconTick) { this.iconTick = Math.floor(now / 120); this.#drawIcons(now); }
    }
    this.win.requestAnimationFrame?.(() => this.#frame());
  }

  /** Over the board: a faint grid, and the outline of what the tool would touch under the mouse (every symmetric copy). */
  #overlay() {
    const { renderer, model } = this;
    const g = renderer.g, S = renderer.S, { ox, oy, d } = renderer.layout;
    g.setTransform(d, 0, 0, d, ox * d, oy * d);
    g.save();
    g.strokeStyle = 'rgba(0,0,0,.14)'; g.lineWidth = 1; g.beginPath();
    for (let x = 1; x < model.width; x++) { g.moveTo(x * S + .5, 0); g.lineTo(x * S + .5, model.height * S); }
    for (let y = 1; y < model.height; y++) { g.moveTo(0, y * S + .5); g.lineTo(model.width * S, y * S + .5); }
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; g.strokeRect(0, 0, model.width * S, model.height * S);
    const hv = this.hover;
    if (hv && model.inBounds(hv.x, hv.y) && this.tool !== 'pan') {
      const r = this.tool === 'brush' && this.size === 3 && this.item?.kind !== 'unit' ? 1 : 0;
      for (const p of this.tool === 'pick' ? [{ x: hv.x, y: hv.y, copy: 0 }] : symmetryPoints(model, hv.x, hv.y, this.symmetry)) {
        g.strokeStyle = p.copy ? 'rgba(255,228,92,.6)' : '#ffe45c'; g.lineWidth = 3;
        g.strokeRect((p.x - r) * S + 2, (p.y - r) * S + 2, (2 * r + 1) * S - 4, (2 * r + 1) * S - 4);
      }
    }
    if (this.symmetry !== 'none') {   // the mirror lines
      g.strokeStyle = 'rgba(255,228,92,.45)'; g.lineWidth = 2; g.setLineDash([6, 6]); g.beginPath();
      if (this.symmetry === 'mirror_x' || this.symmetry === 'quad') { g.moveTo(model.width * S / 2, 0); g.lineTo(model.width * S / 2, model.height * S); }
      if (this.symmetry === 'mirror_y' || this.symmetry === 'quad') { g.moveTo(0, model.height * S / 2); g.lineTo(model.width * S, model.height * S / 2); }
      if (this.symmetry === 'rotate') { const cx = model.width * S / 2, cy = model.height * S / 2; g.moveTo(cx - 8, cy); g.lineTo(cx + 8, cy); g.moveTo(cx, cy - 8); g.lineTo(cx, cy + 8); }
      g.stroke();
    }
    g.restore();
  }

  #local(e) { const r = this.canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  #tile(e) { const p = this.#local(e); return this.renderer.camera.tileAt(p.x, p.y); }

  #down(e) {
    this.canvas.setPointerCapture?.(e.pointerId);
    const p = this.#local(e);
    this.pointers.set(e.pointerId, { ...p });
    if (this.pointers.size === 2) {           // a second finger: this is a pinch, not a stroke
      this.#cancelStroke();
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      return;
    }
    if (this.pointers.size > 2) return;
    const panning = this.tool === 'pan' || e.button === 1 || e.button === 2 || this.spaceDown;
    if (panning) { this.drag = { pan: true }; return; }
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const t = this.#tile(e);
    this.model.begin();
    this.drag = { pan: false, last: t, painted: 1, from: this.model.version };
    this.#apply(t.x, t.y, true);
  }

  #move(e) {
    const p = this.#local(e);
    const prev = this.pointers.get(e.pointerId);
    if (e.pointerType === 'mouse') this.hover = this.renderer.camera.tileAt(p.x, p.y);
    if (!prev) return;
    this.pointers.set(e.pointerId, { ...p });
    if (this.pointers.size >= 2 && this.pinch) {
      const [a, b] = [...this.pointers.values()];
      const now = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      if (this.pinch.d > 0 && now.d > 0) this.renderer.camera.zoomBy(now.d / this.pinch.d, now.cx, now.cy);
      this.renderer.camera.panBy(now.cx - this.pinch.cx, now.cy - this.pinch.cy);
      this.pinch = now;
      return;
    }
    if (!this.drag) return;
    if (this.drag.pan) { this.renderer.camera.panBy(p.x - prev.x, p.y - prev.y); return; }
    const t = this.renderer.camera.tileAt(p.x, p.y);
    const { last } = this.drag;
    if (t.x === last.x && t.y === last.y) return;
    // every tile on the line from the last one, so a fast drag leaves no gaps
    const steps = Math.max(Math.abs(t.x - last.x), Math.abs(t.y - last.y));
    for (let i = 1; i <= steps; i++) {
      const x = Math.round(last.x + (t.x - last.x) * i / steps), y = Math.round(last.y + (t.y - last.y) * i / steps);
      this.#apply(x, y, false);
      this.drag.painted++;
    }
    this.drag.last = t;
  }

  #up(e) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (this.pointers.size === 0) {
      if (this.drag && !this.drag.pan) { this.model.settle(); this.#renderBar(); }
      this.drag = null;
    }
  }

  /** A stroke that turned out to be the first finger of a pinch is taken back (it painted at most a tile or two). */
  #cancelStroke() {
    if (!this.drag || this.drag.pan) { this.drag = null; return; }
    if (this.model.version !== this.drag.from) { this.model.undo(); this.model.future.pop(); this.#changed(); }
    else this.model.settle();
    this.drag = null;
  }

  #wheel(e) {
    e.preventDefault();
    const p = this.#local(e);
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
    const notched = !e.deltaX && (e.deltaMode !== 0 || (Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 40));
    if (e.ctrlKey || e.metaKey) this.renderer.camera.zoomBy(Math.exp(-dy * .01), p.x, p.y);
    else if (notched) this.renderer.camera.zoomBy(Math.exp(-dy * .0015), p.x, p.y);
    else this.renderer.camera.panBy(-e.deltaX, -e.deltaY);
  }

  #key(e) {
    const tag = e.target?.tagName;
    const mod = e.ctrlKey || e.metaKey, k = (e.key || '').toLowerCase();
    if (k === 'escape' && !this.sheet.hidden) { e.target?.blur?.(); this.closeSheet(); return; }   // a field's change is committed as it loses focus
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (!this.sheet.hidden) return;
    if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) this.redo(); else this.undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); this.redo(); return; }
    if (mod) return;
    if (e.key === ' ') { this.spaceDown = true; e.preventDefault(); return; }
    const tool = TOOLS.find((t) => t.key === k);
    if (tool) { this.setTool(tool.id); return; }
    if (k === '1' || k === '3') { this.size = Number(k); this.#renderControls(); }
  }

  // ---- sheets (Map, File, Problems) ----------------------------------------------------------------------------------------------
  #sheet(title) {
    const w = windowBox(this.doc, { title, cls: 'ed-sheet' });
    const close = button(this.doc, { label: 'Close', size: 'sm', variant: 'ghost', onClick: () => this.closeSheet() });
    w.head.append(close);
    this.sheet.replaceChildren(w.root);
    this.sheet.hidden = false;
    return w.body;
  }
  closeSheet() { this.sheet.hidden = true; this.sheet.replaceChildren(); }

  #field(label, input) { const f = h(this.doc, 'label', 'ed-field'); f.append(h(this.doc, 'span', 'ed-field-name', label), input); return f; }
  #input(type, value, attrs = {}) {
    const i = this.doc.createElement(type === 'textarea' ? 'textarea' : 'input');
    if (type !== 'textarea') i.type = type;
    i.className = 'ed-input';
    i.value = value;
    for (const [k, v] of Object.entries(attrs)) i.setAttribute(k, v);
    return i;
  }
  #heading(text) { return h(this.doc, 'h4', 'ed-sub', text); }

  /** Name, id, description, size and players. */
  openMapSheet() {
    const { doc, model: m, registry } = this;
    const body = this.#sheet('Map');
    const name = this.#input('text', m.name, { maxlength: '60' });
    const id = this.#input('text', m.id, { maxlength: '40', pattern: '[a-z0-9_-]+' });
    const desc = this.#input('textarea', m.description, { rows: '3', maxlength: '400' });
    const commitInfo = () => { m.begin(); m.setInfo({ name: name.value, id: id.value || name.value, description: desc.value }); m.settle(); id.value = m.id; this.#changed(); };
    for (const el of [name, id, desc]) el.addEventListener('change', commitInfo);
    body.append(this.#field('Name', name), this.#field('File id (lowercase, used for the file name)', id), this.#field('Description', desc));

    body.append(this.#heading('Size'));
    const wIn = this.#input('number', String(m.width), { min: String(MIN_SIZE), max: String(MAX_SIZE) });
    const hIn = this.#input('number', String(m.height), { min: String(MIN_SIZE), max: String(MAX_SIZE) });
    const anchor = h(doc, 'select', 'ed-select');
    ANCHORS.forEach(([label], i) => { const o = h(doc, 'option', null, `Keep the ${label.toLowerCase()} corner`); o.value = String(i); anchor.append(o); });
    const row = h(doc, 'div', 'ed-row');
    row.append(this.#field('Width', wIn), this.#field('Height', hIn));
    const apply = button(doc, { label: 'Resize', size: 'sm', onClick: () => {
      m.begin(); m.resize(Number(wIn.value), Number(hIn.value), ANCHORS[Number(anchor.value)][1]); m.settle();
      wIn.value = String(m.width); hIn.value = String(m.height); this.#changed(); this.#fit();
    } });
    body.append(row, anchor, apply);

    body.append(this.#heading('Players'));
    const list = h(doc, 'div', 'ed-players');
    const draw = () => {
      list.replaceChildren();
      m.players.forEach((p, i) => {
        const r = h(doc, 'div', 'ed-player');
        r.style.setProperty('--accent', registry.faction(p.faction).color);
        const fac = h(doc, 'select', 'ed-select');
        for (const fid of registry.factionIds) { const o = h(doc, 'option', null, registry.faction(fid).name); o.value = fid; fac.append(o); }
        fac.value = p.faction;
        fac.addEventListener('change', () => { m.begin(); m.setPlayer(i, { faction: fac.value }); this.#changed(); this.#renderControls(); this.#drawIcons(this.#now()); draw(); });
        const ctl = h(doc, 'select', 'ed-select');
        for (const [v, t] of [['human', 'Player'], ['ai', 'Computer']]) { const o = h(doc, 'option', null, t); o.value = v; ctl.append(o); }
        ctl.value = p.controller;
        ctl.addEventListener('change', () => { m.begin(); m.setPlayer(i, { controller: ctl.value }); this.#changed(); });
        const funds = this.#input('number', String(p.funds), { min: '0', step: '500' });
        funds.addEventListener('change', () => { m.begin(); m.setPlayer(i, { funds: Math.max(0, Math.round(Number(funds.value) || 0)) }); this.#changed(); });
        r.append(h(doc, 'span', 'ed-player-name', `Player ${i + 1}${i === 0 ? ' (moves first)' : ''}`), fac, ctl, this.#field('Funds', funds));
        if (m.players.length > 2) r.append(button(doc, { label: 'Remove', size: 'sm', variant: 'danger', onClick: () => { m.begin(); m.removePlayer(i); if (this.owner !== null && this.owner >= m.players.length) this.owner = 0; this.#changed(); this.#renderControls(); draw(); } }));
        list.append(r);
      });
      add.disabled = m.players.length >= MAX_PLAYERS;
    };
    const add = button(doc, { label: 'Add player', size: 'sm', onClick: () => { m.begin(); m.addPlayer(); this.#changed(); this.#renderControls(); draw(); } });
    body.append(list, add);
    draw();
  }

  /** New, open, import, save, download, copy. */
  openFileSheet() {
    const { doc, registry } = this;
    const body = this.#sheet('File');

    body.append(this.#heading('Save'));
    const saves = h(doc, 'div', 'ed-row ed-wrap');
    saves.append(
      button(doc, { label: 'Save to My maps', size: 'sm', variant: 'primary', onClick: () => { const ok = saveMap(this.model.toRaw(), this.store); this.say(ok ? `Saved "${this.model.name}" to My maps. It is in the skirmish list once it is playable.` : 'This browser would not save it. Download the file instead.'); this.openFileSheet(); } }),
      button(doc, { label: 'Download .map.json', size: 'sm', onClick: () => this.download() }),
      button(doc, { label: 'Copy JSON', size: 'sm', onClick: () => this.copy() }),
    );
    body.append(saves, h(doc, 'p', 'ed-note', 'My maps live in this browser. To add a map to the game for everyone, download it and put it in data/maps/ (see docs/map-format.md).'));

    body.append(this.#heading('New map'));
    const wIn = this.#input('number', '20', { min: String(MIN_SIZE), max: String(MAX_SIZE) });
    const hIn = this.#input('number', '14', { min: String(MIN_SIZE), max: String(MAX_SIZE) });
    const row = h(doc, 'div', 'ed-row');
    row.append(this.#field('Width', wIn), this.#field('Height', hIn), button(doc, { label: 'Create', size: 'sm', onClick: () => {
      if (!this.#confirmReplace()) return;
      const w = Math.max(MIN_SIZE, Math.min(MAX_SIZE, Number(wIn.value) || 20)), hh = Math.max(MIN_SIZE, Math.min(MAX_SIZE, Number(hIn.value) || 14));
      this.load(EditorModel.blank(registry, { width: w, height: hh })); this.closeSheet();
    } }));
    body.append(row);

    const mine = savedMaps(this.store);
    body.append(this.#heading('My maps'));
    if (!Object.keys(mine).length) body.append(h(doc, 'p', 'ed-note', 'Nothing saved yet.'));
    const mineList = h(doc, 'div', 'ed-maps');
    for (const raw of Object.values(mine)) {
      const r = h(doc, 'div', 'ed-maprow');
      r.append(this.#mapCard(raw.name || raw.id, `${raw.tiles?.[0]?.length ?? '?'} x ${raw.tiles?.length ?? '?'}`, () => this.#openRaw(raw)),
        button(doc, { label: 'Delete', size: 'sm', variant: 'danger', onClick: () => { if (this.win.confirm?.(`Delete "${raw.name}" from My maps?`) === false) return; deleteMap(raw.id, this.store); this.openFileSheet(); } }));
      mineList.append(r);
    }
    body.append(mineList);

    body.append(this.#heading('Game maps (open a copy)'));
    const gameList = h(doc, 'div', 'ed-maps');
    for (const map of this.maps) gameList.append(this.#mapCard(map.name, `${map.width} x ${map.height} - ${map.players.length} players`, () => this.#openRaw(serializeMap(map, { defaultGround: registry.tilesetDef(map.tileset)?.ground ?? registry.defaultGround ?? undefined, defaultTileset: registry.defaultTileset ?? undefined })), map));
    body.append(gameList);

    body.append(this.#heading('Import'));
    const file = this.#input('file', '', { accept: '.json,application/json' });
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      if (!f) return;
      try { this.#openRaw(JSON.parse(await f.text())); } catch (e) { this.say(`Could not read that file: ${e.message}`); }
    });
    const paste = this.#input('textarea', '', { rows: '3', placeholder: 'Or paste a map file here' });
    body.append(file, paste, button(doc, { label: 'Open pasted map', size: 'sm', onClick: () => { try { this.#openRaw(JSON.parse(paste.value)); } catch (e) { this.say(`That is not a map file: ${e.message}`); } } }));
  }

  #mapCard(name, meta, onClick, map = null) {
    const { doc } = this;
    const b = h(doc, 'button', 'ed-mapcard');
    b.setAttribute('type', 'button');
    if (map) {
      const c = doc.createElement('canvas');
      const g = c.getContext?.('2d');
      if (g) {
        const px = Math.max(2, Math.floor(Math.min(64 / map.width, 44 / map.height)));
        c.width = map.width * px; c.height = map.height * px; c.className = 'ed-thumb';
        drawMinimap(g, map, this.registry, (o) => (o === null ? this.registry.rules.neutralColor : this.registry.faction(map.players[o].faction).color), px);
        b.append(c);
      }
    }
    const t = h(doc, 'span', 'ed-mapcard-text');
    t.append(h(doc, 'span', 'ed-mapcard-name', name), h(doc, 'span', 'ed-mapcard-meta', meta));
    b.append(t);
    b.addEventListener('click', onClick);
    return b;
  }

  #confirmReplace() { return this.win.confirm?.('Replace the map you are editing? Save it to My maps first if you want to keep it.') !== false; }

  #openRaw(raw) {
    if (!this.#confirmReplace()) return;
    try { this.load(EditorModel.fromRaw(raw, this.registry)); this.closeSheet(); this.say(`Opened "${this.model.name}".`); } catch (e) { this.say(String(e.message || e)); }
  }

  /** The map file as text, the way the game's own maps are written. */
  json() { return JSON.stringify(this.model.toRaw(), null, 2) + '\n'; }

  download() {
    const blob = new Blob([this.json()], { type: 'application/json' });
    const a = this.doc.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${this.model.id}.map.json`;
    this.doc.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  async copy() {
    try { await this.win.navigator.clipboard.writeText(this.json()); this.say('Map JSON copied.'); } catch { this.say('Could not copy: use Download instead.'); }
  }

  openProblems(heading = null) {
    const body = this.#sheet('Problems');
    const list = this.model.problems();
    if (heading) body.append(h(this.doc, 'p', 'ed-note', heading));
    if (!list.length) body.append(h(this.doc, 'p', 'ed-note', 'None. This map is ready to play.'));
    const ul = h(this.doc, 'ul', 'ed-list');
    for (const p of list) ul.append(h(this.doc, 'li', null, p));
    body.append(ul);
  }

  /** Play the map now (the editor keeps it as its draft, so coming back resumes it). */
  play() {
    const problems = this.model.problems();
    if (problems.length) { this.openProblems('Fix these before playing:'); return; }
    saveDraft(this.model.toRaw(), this.store);
    this.onPlay(parseMap(this.model.toRaw(), this.registry));
  }
}

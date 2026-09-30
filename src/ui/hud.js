// All DOM access for the in-game UI lives here (and in kit.js, which makes the pieces): the status bar, the dock of floating
// windows and the game-over box. Nothing else in the game touches `document`.
//
//   status bar   pinned to the top: whose turn, day, funds, properties, Undo and End turn
//   dock         floating windows over the map, on the edge AWAY from the tile the player is working on
//                (setSide): the info boxes, the order buttons (action menu), the build menu and message toasts
//   game over    a centred box over a dimmed screen
//
// The controller and session tell the Hud WHAT to show with plain data (models from info.js / build-menu.js); the Hud decides
// how it looks. Every window is rebuilt from its model whenever it is shown, which is cheap and keeps the code simple.

import { drawUnit } from '../render/unit-sprites.js';
import { fmtMoney } from './info.js';
import { button, chip, h, meter, setMeter, setVar, stars, toggle, windowBox } from './kit.js';

const ICON = 46;
const BUILD_ICON = 50;
const TOAST_MS = 3600;

const weaponRange = (w) => (w.min === w.max ? `${w.min}` : `${w.min}-${w.max}`);

/** Weapon chips: Range and Attack for a one-weapon unit; one "Name  damage, range" chip per weapon when there are several. */
function weaponChips(d, weapons) {
  if (weapons.length === 1) return [chip(d, 'Range', weaponRange(weapons[0])), chip(d, 'Attack', weapons[0].damage)];
  return weapons.map((w) => chip(d, w.name, `${w.damage} / ${weaponRange(w)}`));
}

const GEAR_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M19.14 12.94a7.5 7.5 0 0 0 .05-.94 7.5 7.5 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7 7 0 0 0-1.62-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 0 0-.61.22L2.66 8.48a.5.5 0 0 0 .12.64l2.03 1.58a7.5 7.5 0 0 0-.05.94c0 .32.02.63.05.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.3.61.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.09.48 0 .61-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"/></svg>';

export class Hud {
  /**
   * @param {Document} doc
   * @param {{registry?: object, clock?: () => number}} [opts]  registry: to draw unit pictures; clock: ms clock (tests pass one)
   */
  constructor(doc, { registry = null, clock = () => performance.now() } = {}) {
    this.doc = doc;
    this.registry = registry;
    this.clock = clock;
    this.icons = [];
    this.shown = {};
    this.focusTile = null;
    this.toastUntil = 0;
    this.buildState = null;

    const mount = doc.getElementById('ui') || doc.body.appendChild(h(doc, 'div'));
    mount.id = 'ui';
    mount.replaceChildren();
    this.root = mount;

    // status bar
    this.el = {};
    const bar = this.el.bar = h(doc, 'div', 'bar');
    const turn = h(doc, 'div', 'bar-turn');
    this.el.pip = h(doc, 'span', 'pip');
    this.el.day = h(doc, 'span', 'bar-day');
    this.el.who = h(doc, 'span', 'bar-who');
    const who = h(doc, 'span', 'bar-id'); who.append(this.el.day, this.el.who);
    turn.append(this.el.pip, who);
    this.el.funds = h(doc, 'span', 'bar-num');
    this.el.props = h(doc, 'span', 'bar-num');
    const money = h(doc, 'div', 'bar-stat'); money.append(h(doc, 'i', 'icon icon--coin'), this.el.funds);
    const props = h(doc, 'div', 'bar-stat'); props.append(h(doc, 'i', 'icon icon--flag'), this.el.props);
    this.el.undo = button(doc, { label: 'Undo', size: 'sm', disabled: true });
    this.el.end = button(doc, { label: 'End turn', variant: 'primary', size: 'sm' });
    this.el.gear = button(doc, { size: 'sm', cls: 'btn--icon' });
    this.el.gear.setAttribute('aria-label', 'Menu');
    this.el.gear.innerHTML = GEAR_SVG;
    const actions = h(doc, 'div', 'bar-actions'); actions.append(this.el.undo, this.el.end, this.el.gear);
    bar.append(turn, money, props, actions);

    // dock: edge first (actions / build), then info, then toast. CSS flips the order for the bottom edge.
    this.el.dock = h(doc, 'div', 'dock dock--bottom');
    this.el.main = h(doc, 'div', 'dock-slot dock-main');
    this.el.info = h(doc, 'div', 'dock-slot dock-info');
    this.el.toast = h(doc, 'div', 'dock-slot dock-toast');
    this.el.dock.append(this.el.main, this.el.info, this.el.toast);

    this.el.modal = h(doc, 'div', 'scrim'); this.el.modal.hidden = true;
    this.root.append(bar, this.el.dock, this.el.modal);
  }

  /** Height of the status bar in px (the renderer keeps the map below it). */
  barHeight() {
    const px = this.el.bar.offsetHeight || 52;
    setVar(this.root, '--bar-h', `${px}px`);   // the dock sits just below the bar
    return px;
  }

  /** Update a property only when it changed (status() runs every frame). */
  #set(key, node, prop, value) {
    if (this.shown[key] !== value) { this.shown[key] = value; node[prop] = value; }
  }

  // ---- status bar ----------------------------------------------------------------------------------------------------------

  /** @param {{day:number, name:string, color:string, funds:number, props:number}} s */
  status(s) {
    this.#set('day', this.el.day, 'textContent', `Day ${s.day}`);
    this.#set('who', this.el.who, 'textContent', s.name);
    this.#set('funds', this.el.funds, 'textContent', fmtMoney(s.funds));
    this.#set('props', this.el.props, 'textContent', String(s.props));
    if (this.shown.color !== s.color) { this.shown.color = s.color; setVar(this.el.bar, '--accent', s.color); }
  }
  setUndoDisabled(v) { this.#set('undo', this.el.undo, 'disabled', v); }
  setEndDisabled(v) { this.#set('end', this.el.end, 'disabled', v); }
  onUndo(fn) { this.el.undo.onclick = fn; }
  onEnd(fn) { this.el.end.onclick = fn; }
  onMenu(fn) { this.el.gear.onclick = fn; }

  // ---- where the dock sits -------------------------------------------------------------------------------------------------

  /** The tile the player is working on; the session turns it into a screen edge with setSide(). */
  focus(tile) { this.focusTile = tile; }

  /** Put the dock at the 'top' (below the status bar) or the 'bottom' of the screen. */
  setSide(side) {
    if (this.shown.side === side) return;
    this.shown.side = side;
    toggle(this.el.dock, 'dock--top', side === 'top');
    toggle(this.el.dock, 'dock--bottom', side !== 'top');
  }

  // ---- toast ---------------------------------------------------------------------------------------------------------------

  /** A line of news ("Tank hits Soldier -4"). It fades after a few seconds unless `sticky` (used while the enemy moves). */
  message(text, { sticky = false } = {}) {
    this.toastUntil = !text ? 0 : sticky ? Infinity : this.clock() + TOAST_MS;
    this.el.toast.replaceChildren();
    if (!text) return;
    this.el.toast.append(h(this.doc, 'div', 'toast', text));
  }

  /** Called every frame: fades old toasts. */
  tick(now) {
    if (this.toastUntil !== 0 && now >= this.toastUntil) this.message(null);
  }

  // ---- info boxes ----------------------------------------------------------------------------------------------------------

  /** Show what is on a tile: `terrain` (info.js terrainInfo) and/or `unit` (unitInfo). Both null clears the boxes. */
  info({ terrain = null, unit = null } = {}) {
    this.el.info.replaceChildren();
    if (unit) this.el.info.append(this.#unitBox(unit));
    if (terrain) this.el.info.append(this.#terrainBox(terrain));
  }

  /** The terrain card: name, who owns it, defense stars, what it costs to cross and (for a property) what it gives. */
  #terrainBox(t) {
    const d = this.doc;
    const owner = t.property?.owner;
    const w = windowBox(d, { accent: owner ? owner.color : t.color, cls: 'win--terrain' });
    const top = h(d, 'div', 'row');
    const name = h(d, 'span', 'card-name', t.name);
    if (t.property) name.append(h(d, 'span', 'card-sub', owner ? owner.name : 'Neutral'));
    top.append(name, stars(d, t.defense));
    w.body.append(top);
    const chips = h(d, 'div', 'chips');
    for (const m of t.moves) chips.append(chip(d, m.label, m.cost == null ? '-' : m.cost, m.cost == null ? 'chip--no' : ''));
    if (t.property) {
      const p = t.property;
      chips.append(chip(d, 'Income', `+${fmtMoney(p.income)}`, 'chip--gold'), chip(d, 'Repair', `+${p.repair}`), chip(d, 'Capture', p.capturePoints));
    }
    w.body.append(chips);
    const notes = [...t.notes];
    if (t.property && t.property.builds.length) notes.unshift(`Builds ${t.property.builds.join(', ').toLowerCase()}`);
    if (notes.length) w.body.append(this.#tags(notes));
    return w.root;
  }

  /** The unit card: picture, name, owner, HP bar and the numbers that decide a fight. */
  #unitBox(u) {
    const d = this.doc;
    const w = windowBox(d, { accent: u.faction ? u.faction.color : null, cls: 'win--unit' });
    w.body.classList.add('card-split');
    w.body.append(this.#icon(u, ICON));
    const col = h(d, 'div', 'card-col');
    const top = h(d, 'div', 'row');
    const name = h(d, 'span', 'card-name', u.name);
    if (u.faction) name.append(h(d, 'span', 'card-sub', u.faction.name));
    top.append(name, h(d, 'span', 'v', `${u.hp}/${u.maxHp}`));
    col.append(top, meter(d, u.hp / u.maxHp).root);
    const weapon = u.weapons[0];
    const stats = h(d, 'div', 'chips');
    stats.append(chip(d, 'Move', u.move));
    if (weapon) stats.append(...weaponChips(d, u.weapons));
    stats.append(chip(d, 'Armor', `${u.armor}%`));
    const cover = h(d, 'span', 'chip');
    cover.append(h(d, 'span', 'chip-k', 'Cover'), stars(d, u.cover));
    stats.append(cover);
    col.append(stats);
    const tags = [...u.tags];
    if (u.layerLabel) tags.unshift(u.layerLabel);
    if (tags.length) col.append(this.#tags(tags));
    if (u.capture) col.append(h(d, 'div', 'note note--hot', `Capturing ${u.capture.progress}/${u.capture.needed}`));
    if (u.forecast != null) col.append(h(d, 'div', 'note note--hot', u.forecast > 0 ? `Your attack: -${u.forecast} HP${u.forecastWeapon ? ` (${u.forecastWeapon})` : ''}` : 'Cannot be hurt from here'));
    else if (u.acted) col.append(h(d, 'div', 'note', 'Already moved'));
    w.body.append(col);
    return w.root;
  }

  /**
   * A row of small tags. Each is a string or { label, help }; tapping one that has `help` shows the sentence under the row
   * (tap it again, or another tag, to change or hide it).
   */
  #tags(list) {
    const d = this.doc;
    const box = h(d, 'div', 'tags-box');
    const row = h(d, 'div', 'tags');
    const help = h(d, 'div', 'note tag-help');
    help.hidden = true;
    let open = null;
    for (const t of list) {
      const tag = typeof t === 'string' ? { label: t, help: null } : t;
      if (!tag.help) { row.append(h(d, 'span', 'tag', tag.label)); continue; }
      const b = h(d, 'button', 'tag tag--help', tag.label);
      b.setAttribute('type', 'button');
      b.addEventListener('click', () => {
        const same = open === b;
        if (open) toggle(open, 'is-open', false);
        open = same ? null : b;
        help.hidden = same;
        if (!same) { help.textContent = tag.help; toggle(b, 'is-open', true); }
      });
      row.append(b);
    }
    box.append(row, help);
    return box;
  }

  // ---- order buttons (the action menu) -------------------------------------------------------------------------------------

  /**
   * The buttons for what the selected unit can do now. `items`: { label, variant?, onClick }. null removes the window.
   * `hint` is a line of instruction above the buttons.
   */
  actions(spec) {
    this.el.main.replaceChildren();
    this.buildState = null;
    if (!spec || !spec.items.length) return;
    const w = windowBox(this.doc, { accent: spec.accent, cls: 'win--actions' });
    if (spec.hint) w.body.append(h(this.doc, 'div', 'hint', spec.hint));
    const row = h(this.doc, 'div', 'btn-row');
    for (const it of spec.items) row.append(button(this.doc, { label: it.label, variant: it.variant, onClick: it.onClick }));
    w.body.append(row);
    this.el.main.append(w.root);
  }

  // ---- build menu ----------------------------------------------------------------------------------------------------------

  /**
   * The build menu. `model` is buildMenuModel(); `choice` the id shown selected; `onBuild(id)` and `onClose()` are the two
   * ways out. Tapping a row selects it (details appear under the list); tapping the selected row again, or the big
   * button, builds it, so a single stray tap never spends money.
   */
  build(model, { choice, faction, onBuild, onClose }) {
    this.el.main.replaceChildren();
    this.buildList = null;
    if (!model) { this.buildState = null; return; }
    this.buildState = { model, choice, faction, onBuild, onClose };
    this.#drawBuild();
  }

  #drawBuild() {
    const d = this.doc;
    const { model, choice, faction, onBuild, onClose } = this.buildState;
    const scrolled = this.buildList ? this.buildList.scrollTop : 0;   // choosing a row redraws the window: keep the list where it was
    this.el.main.replaceChildren();
    const w = windowBox(d, { title: model.title, accent: faction?.color, cls: 'win--build' });
    const list = h(d, 'div', 'build-list');
    list.setAttribute('role', 'listbox');
    const picked = model.options.find((o) => o.id === choice) || model.options[0];
    for (const o of model.options) {
      const row = button(d, {
        cls: `build-row${o.id === picked?.id ? ' is-picked' : ''}${o.affordable ? '' : ' is-poor'}`,
        kids: [this.#icon({ ...o, faction }, BUILD_ICON)],
        onClick: () => {
          // a second tap on a row the player has already picked builds it; the first tap only selects
          if (this.buildState.armed === o.id && o.affordable) { onBuild(o.id); return; }
          this.buildState.choice = o.id; this.buildState.armed = o.id; this.#drawBuild();
        },
      });
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', o.id === picked?.id ? 'true' : 'false');
      const main = h(d, 'span', 'build-main');
      main.append(h(d, 'span', 'build-name', o.name));
      const weapon = o.weapons[0];
      const chips = h(d, 'span', 'chips');
      chips.append(chip(d, 'Move', o.move));
      if (weapon) chips.append(...weaponChips(d, o.weapons));
      main.append(chips);
      row.append(main, h(d, 'span', 'build-cost', fmtMoney(o.cost)));
      list.append(row);
    }
    w.body.append(list);
    if (picked) w.body.append(this.#buildDetail(picked));
    const foot = h(d, 'div', 'btn-row');
    foot.append(button(d, { label: 'Close', variant: 'ghost', onClick: () => onClose() }));
    const buy = picked && picked.affordable;
    foot.append(button(d, {
      label: !picked ? 'Nothing to build' : buy ? `Build ${picked.name} - ${fmtMoney(picked.cost)}` : `Need ${fmtMoney(picked.missing)} more`,
      variant: 'primary', disabled: !buy, cls: 'btn--grow', onClick: () => onBuild(picked.id),
    }));
    w.body.append(foot);
    this.el.main.append(w.root);
    list.scrollTop = scrolled;
    this.buildList = list;
  }

  #buildDetail(o) {
    const d = this.doc;
    const box = h(d, 'div', 'build-detail');
    for (const wpn of o.weapons) {
      box.append(h(d, 'div', 'note', `${wpn.name}: ${wpn.damage} damage, range ${weaponRange(wpn)}. Hits ${wpn.hits.join(', ').toLowerCase()}.`));
    }
    const tags = [...o.tags];
    if (o.layer) tags.unshift(o.layer);
    tags.push(`Armor ${o.armor}%`, `Toughness x${o.toughness}`);
    box.append(this.#tags(tags));
    return box;
  }

  // ---- game over -----------------------------------------------------------------------------------------------------------

  /** A centred box over a dimmed screen. null hides it. */
  gameOver(spec) {
    this.el.modal.replaceChildren();
    this.el.modal.hidden = !spec;
    this.gameOverShown = !!spec;
    this.menuOpen = false;
    if (!spec) return;
    const w = windowBox(this.doc, { title: spec.title, accent: spec.color, cls: 'win--modal' });
    w.body.append(h(this.doc, 'div', 'big', spec.text));
    w.body.append(button(this.doc, { label: spec.buttonLabel || 'Play again', variant: 'primary', size: 'lg', onClick: spec.onClick }));
    this.el.modal.append(w.root);
  }

  // ---- in-game menu --------------------------------------------------------------------------------------------------------

  /**
   * The gear menu: a centred window over the dimmed screen. `items`: { label, variant?, onClick, confirm? }; an item with
   * `confirm` (a question) asks "Are you sure?" inside the window first. null closes it. Never replaces a game-over box.
   */
  menu(spec) {
    if (this.gameOverShown) return;
    this.el.modal.replaceChildren();
    this.el.modal.hidden = !spec;
    this.menuOpen = !!spec;
    if (!spec) return;
    const d = this.doc;
    const w = windowBox(d, { title: spec.title || 'Menu', cls: 'win--modal' });
    const col = h(d, 'div', 'btn-col');
    for (const it of spec.items) {
      col.append(button(d, {
        label: it.label, variant: it.variant, size: 'lg',
        onClick: () => (it.confirm ? this.#confirm(spec, it) : it.onClick()),
      }));
    }
    w.body.append(col);
    this.el.modal.append(w.root);
  }

  #confirm(spec, it) {
    const d = this.doc;
    this.el.modal.replaceChildren();
    const w = windowBox(d, { title: it.label, cls: 'win--modal' });
    w.body.append(h(d, 'div', 'big', it.confirm));
    const row = h(d, 'div', 'btn-row');
    row.append(
      button(d, { label: 'Back', variant: 'ghost', size: 'lg', onClick: () => this.menu(spec) }),
      button(d, { label: 'Yes', variant: 'danger', size: 'lg', cls: 'btn--grow', onClick: it.onClick }),
    );
    w.body.append(row);
    this.el.modal.append(w.root);
  }

  /** Remove the info boxes, the order buttons and the build menu (toasts stay until they fade). */
  clear() {
    this.info({});
    this.actions(null);
    this.build(null, {});
    this.focusTile = null;
  }

  // ---- unit pictures -------------------------------------------------------------------------------------------------------

  #icon(u, size) {
    const r = globalThis.devicePixelRatio || 1;
    const c = this.doc.createElement('canvas');
    c.className = 'unit-icon';
    c.width = c.height = Math.round(size * r);
    c.style.width = c.style.height = `${size}px`;
    if (this.registry && u.id && u.faction !== undefined) this.icons.push({ canvas: c, def: this.registry.unit(u.id), colors: u.faction || { color: '#b9b9b9', dark: '#8a8a8a' }, size });
    return c;
  }

  /** Redraw the animated pictures of every visible unit (they idle like units on the map). */
  drawIcons(now) {
    const d = globalThis.devicePixelRatio || 1;
    this.icons = this.icons.filter((i) => i.canvas.isConnected);
    for (const i of this.icons) {
      const g = i.canvas.getContext?.('2d');
      if (!g) continue;
      g.setTransform(d, 0, 0, d, 0, 0);
      g.clearRect(0, 0, i.size, i.size);
      drawUnit(g, { type: i.def.id, x: 0, y: 0, hp: 10 }, { def: i.def, colors: i.colors, px: 0, py: 0, size: i.size, now, animate: true, moving: false, showHp: false });
    }
  }
}

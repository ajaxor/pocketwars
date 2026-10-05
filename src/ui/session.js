// Session: owns one running game (Game + Renderer + HUD + Controller) and drives the frame loop,
// the End-turn button and the AI's turns with their pacing delays.

import { buildPhase, chooseOrder, surfaceToTravel, tryDeploy, wantsOrder } from '../engine/ai.js';
import { hasAttribute } from '../engine/attributes.js';
import { canSee } from '../engine/detection.js';
import { allProperties, factionOf, propertiesOwnedBy, unitById } from '../engine/queries.js';
import { MoveAnimator } from '../render/animator.js';
import { Arrivals, planEntrances } from '../render/arrivals.js';
import { Effects } from '../render/effects.js';
import { Renderer } from '../render/renderer.js';
import { Controller } from './controller.js';
import { Gestures } from './gestures.js';
import { Hud } from './hud.js';
import { describeEvents } from './messages.js';
import { Presenter } from './presenter.js';
import { Commentator } from '../campaign/commentary.js';
import { CPS, CommentaryBanner } from './commentary-banner.js';
import { Pacer } from './pacing.js';

export class Session {
  /**
   * @param {import('../engine/game.js').Game} game
   * @param {{canvas:HTMLCanvasElement, doc:Document, restart:()=>void, quit?:()=>void, leaderName?:(id:string)=>string|null,
   *   voices?:{leader:(id:string)=>object|null, say:(id:string, situation:string)=>string}, pacer?:Pacer}} host
   *   leaderName gives a leader's display name, for the line at the start of a battle that says who leads whom.
   *   voices lets the leaders of the teams speak: opening lines before the battle and commentary in the computer's turns
   *   (leader gives a leader's portrait traits, say a line for a situation, see src/campaign/speech.js).
   */
  constructor(game, { canvas, doc, restart, quit = restart, leaderName = () => null, voices = null, pacer = new Pacer() }) {
    this.game = game;
    this.canvas = canvas;
    this.restart = restart;
    this.quit = quit;
    this.leaderName = leaderName;
    this.voices = voices;
    this.pacer = pacer;      // the game clock, which runs fast while the player holds the screen during the computer's turn
    this.doc = doc;
    this.busy = false;
    this.bannerUntil = 0;    // when a comment made in the player's turn goes away (0: it stays)
    this.disposed = false;
    this.endArmed = false;   // End turn was pressed with units still to move: the next press really ends it

    this.animator = new MoveAnimator();
    this.renderer = null;
    this.effects = new Effects(game.registry, (owner) => this.renderer.unitColorsOf(owner));
    this.renderer = new Renderer(canvas, game, this.effects, this.animator);
    this.arrivals = new Arrivals();   // reinforcements sliding in from off screen (see reinforce())
    this.renderer.arrivals = this.arrivals;
    this.intro = false;               // the opening (reinforcements and dialogue) is playing
    this.hud = new Hud(doc, { registry: game.registry, clock: () => this.pacer.now() });
    this.commentator = voices ? new Commentator(game, voices) : null;
    this.banner = voices ? new CommentaryBanner(doc) : null;
    this.presenter = new Presenter({ effects: this.effects, animator: this.animator });
    this.controller = new Controller({
      game, hud: this.hud, presenter: this.presenter, animator: this.animator,
      colorsOf: (owner) => this.renderer.colorsOf(owner), onEvents: (events) => this.#handleEvents(events), clock: () => this.pacer.now(),
    });

    // Touch, mouse and trackpad on the map: a tap selects, a drag scrolls, a pinch (or the mouse wheel, or ctrl + wheel) zooms. Scrolling and zooming
    // work at any time (also while the computer moves); only taps are held back until it is a human's turn.
    this.gestures = new Gestures({
      onTap: (cx, cy) => {
        if (this.intro) { this.arrivals.finish(); return; }   // a tap during the opening brings the reinforcements in at once
        if (!this.#inputAllowed()) return;
        if (this.endArmed) { this.endArmed = false; this.hud.message(null); }
        const { x, y } = this.renderer.tileAt(cx, cy);
        this.controller.tap(x, y);
      },
      onPan: (dx, dy) => this.renderer.pan(dx, dy),
      onZoom: (factor, x, y) => this.renderer.zoom(factor, x, y),
      onHold: (on) => this.#onHold(on),
    });
    this.onContextMenu = (e) => e.preventDefault();   // a long press must not open the browser's menu
    this.onPointerDown = (e) => { e.preventDefault(); this.canvas.setPointerCapture?.(e.pointerId); this.gestures.down(e); };
    this.onPointerMove = (e) => this.gestures.move(e);
    this.onPointerUp = (e) => this.gestures.up(e);
    this.onPointerCancel = (e) => this.gestures.cancel(e);
    // iOS Safari scrolls (rubber-bands) the whole page on a touch drag unless the touchmove is cancelled; only the lists that scroll themselves are exempt
    this.onTouchMove = (e) => { if (!e.target.closest?.('.build-list, .sk-body, .sk-maps, .title')) e.preventDefault(); };
    this.onWheel = (e) => { e.preventDefault(); this.gestures.wheel(e); };
    this.onResize = () => this.#fit();
    this.lastFrame = 0;
  }

  #fit() { this.renderer.fit({ top: this.hud.barHeight() }); }

  /** On a map bigger than the screen, open on the viewing player's HQ (or their first unit). */
  #centerOnStart() {
    const home = this.#home();
    if (home) this.renderer.centerOn(home.x, home.y);
  }

  /** The viewing player's HQ (or their first unit). */
  #home() {
    const { game } = this;
    const viewer = this.#viewer();
    return allProperties(game).find((p) => p.owner === viewer && hasAttribute(p.terrain, 'victoryOnCapture'))
      || game.state.units.find((u) => u.owner === viewer);
  }

  /** The dock floats over the map on the edge away from the tile being worked on: the top half of the screen -> bottom edge. */
  #placeDock() {
    const tile = this.hud.focusTile;
    if (!tile) return;
    const r = this.renderer.tileRect(tile.x, tile.y);
    this.hud.setSide(r.top + r.size / 2 < this.renderer.layout.H / 2 ? 'bottom' : 'top');
  }

  #now() { return this.pacer.now(); }
  #humanTurn() { return this.game.controllerOf(this.game.currentPlayer) === 'human'; }
  #inputAllowed() { return this.#humanTurn() && !this.game.isOver && !this.busy && !this.effects.isLocked(this.#now()); }

  start() {
    const { hud, game } = this;
    this.#fit();
    this.#centerOnStart();
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerCancel);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
    addEventListener('resize', this.onResize);
    globalThis.document?.addEventListener?.('touchmove', this.onTouchMove, { passive: false });
    hud.onEnd(() => this.#onEndTurn());
    hud.onUndo(() => this.#onUndo());
    hud.onMenu(() => this.#openMenu());
    hud.message(this.#introText());
    if (this.banner) this.doc.body.append(...this.banner.elements);
    void this.#intro();
    requestAnimationFrame(() => this.#frame());
    void game;
  }

  dispose() {
    this.disposed = true;
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.pacer.setFast(false);
    this.banner?.hide();
    for (const el of this.banner?.elements ?? []) el.remove();
    removeEventListener('resize', this.onResize);
    globalThis.document?.removeEventListener?.('touchmove', this.onTouchMove);
    this.hud.onEnd(null);
    this.hud.onUndo(null);
    this.hud.onMenu(null);
  }

  #openMenu() {
    const { hud } = this;
    if (hud.menuOpen) { hud.menu(null); return; }
    hud.menu({
      title: 'Menu',
      items: [
        { label: 'Resume', variant: 'primary', onClick: () => hud.menu(null) },
        { label: 'Reset mission', confirm: 'Restart this mission from the beginning?', variant: 'danger', onClick: () => this.restart() },
        { label: 'Quit to title', confirm: 'Leave this mission and go back to the title screen?', variant: 'danger', onClick: () => this.quit() },
      ],
    });
  }

  #introText() {
    const { registry } = this.game;
    const builders = registry.terrainIds.map((id) => registry.terrain[id]).filter((t) => t.attributes.property && t.attributes.property.builds.length).map((t) => t.name.toLowerCase());
    const list = builders.length > 1 ? `${builders.slice(0, -1).join(', ')} or ${builders[builders.length - 1]}` : builders[0] || 'building';
    return `${this.#matchup()}Tap a unit to move it. Tap a ${list} you own to build units. Capture the enemy HQ!`;
  }

  // ---- pacing and fast-forward ------------------------------------------------------------------------------------------------------
  /** A pause in the computer's turn. While the player holds the screen it is skipped, but a unit still finishes its move first. */
  async #pause(ms) {
    await this.pacer.wait(ms);
    if (!this.pacer.fast) return;
    while ((this.animator.active || this.effects.isLocked(this.#now())) && !this.disposed) await new Promise((resolve) => setTimeout(resolve, 16));
  }

  /** Pressing and holding the screen during the computer's turn fast-forwards it; returns whether the hold was used. */
  #onHold(on) {
    if (on && (this.#humanTurn() || !this.busy || this.game.isOver)) return false;
    this.pacer.setFast(on);
    this.banner?.setFast(on);
    return true;
  }

  // ---- what the leaders say ----------------------------------------------------------------------------------------------------------
  #line(c) {
    const { game } = this;
    return { leader: this.voices.leader(c.leader) || { id: c.leader }, name: this.leaderName(c.leader) || '', color: factionOf(game, c.owner).color, text: c.line };
  }

  /** Show a comment. During the player's own turn it sits at the top (the dock is at the bottom) and goes away by itself. */
  #comment(c) {
    if (!c || !this.banner) return;
    const mine = this.#humanTurn();
    this.banner.setSide(mine ? 'top' : 'bottom');
    this.banner.say(this.#line(c));
    this.bannerUntil = mine ? this.#now() + (c.line.length / CPS) * 1000 + 3000 : 0;
  }

  // ---- the opening and scripted reinforcements ---------------------------------------------------------------------------------------
  /**
   * Bring `units` (game units that already exist) onto the map from off screen, several at once, and resolve when the last has arrived.
   * They are drawn on their way in; the game state is not touched. A campaign script spawns its reinforcements and calls this.
   *   from  'left' | 'right' | 'top' | 'bottom' to choose the edge, or (unit) => [[x, y], ...] for a path of your own (tiles, may start
   *         off the map and may have waypoints); by default each comes from the nearest edge it can drive in from without turning round
   */
  reinforce(units, { from = null, gap, msPerTile } = {}) {
    return new Promise((resolve) => {
      this.arrivals.enter(planEntrances(units, this.renderer.viewBounds(), { from, gap, msPerTile }), this.#now(), resolve);
    });
  }

  /** The start of a battle: the human players' units drive in from off screen while the leaders say their opening lines. */
  async #intro() {
    const { game } = this;
    const humans = new Set(game.map.players.map((p, i) => (p.controller === 'human' ? i : -1)));
    const mine = game.state.units.filter((u) => humans.has(u.owner));
    this.busy = true;
    this.intro = true;
    await Promise.all([this.reinforce(mine), this.commentator ? this.#opening() : null]);
    this.intro = false;
    if (this.disposed) return;
    this.banner?.hide();
    this.busy = false;
  }

  /** Every leader says an opening line. Tap a card to read on; they also move on by themselves. */
  async #opening() {
    for (const c of this.commentator.opening()) {
      if (this.disposed) return;
      const line = this.#line(c);
      const reading = (line.text.length / CPS) * 1000 + 1800 + line.text.length * 25;
      await Promise.race([this.banner.ask(line), this.pacer.wait(reading)]);
    }
  }

  /** "Col. Harlan vs Adm. Rex. " when the teams have leaders (a random pick is only known now), else nothing. */
  #matchup() {
    const names = this.game.map.players.map((p) => (p.leader ? this.leaderName(p.leader) : null)).filter(Boolean);
    return names.length ? `${names.join(' vs ')}. ` : '';
  }

  #viewer() {
    const { game } = this;
    if (this.#humanTurn()) return game.currentPlayer;
    const human = game.map.players.findIndex((p) => p.controller === 'human');
    return human >= 0 ? human : game.currentPlayer;
  }

  #frame() {
    if (this.disposed) return;
    const { game, hud, controller } = this;
    const now = this.#now();
    this.renderer.updateCamera(this.lastFrame ? Math.min(50, now - this.lastFrame) : 0);
    this.lastFrame = now;
    hud.setUndoDisabled(!(game.canUndo && this.#humanTurn() && !this.busy && controller.mode === 'idle' && !this.effects.isLocked(now)));
    this.animator.update(now);
    this.arrivals.update(now);
    this.banner?.tick(now, this.pacer.fast);
    if (this.bannerUntil && now >= this.bannerUntil) { this.bannerUntil = 0; this.banner.hide(); }
    const viewer = this.#viewer();
    this.renderer.viewer = viewer;
    const faction = factionOf(game, game.currentPlayer);
    hud.status({ day: game.state.day, name: faction.name, color: faction.color, funds: game.state.funds[viewer], props: propertiesOwnedBy(game, viewer).length });
    hud.setEndDisabled(this.busy);
    this.#placeDock();
    this.renderer.draw(controller.view, now);
    hud.tick(now);
    hud.drawIcons(now);
    requestAnimationFrame(() => this.#frame());
  }

  #onUndo() {
    const { game, hud, controller } = this;
    const now = this.#now();
    if (!game.canUndo || !this.#humanTurn() || this.busy || controller.mode !== 'idle' || this.effects.isLocked(now)) return;
    this.endArmed = false;
    game.undo();
    this.effects.clear();
    this.animator.clear();
    controller.cancelAll();
    hud.message('Move undone.');
  }

  #handleEvents(events) {
    if (this.commentator && this.#humanTurn() && !this.busy) this.#comment(this.commentator.react(events, this.#now(), this.game.currentPlayer));
    const over = events.find((e) => e.type === 'gameOver');
    if (over) this.#showGameOver();
  }

  #showGameOver() {
    const { game, hud } = this;
    const winner = game.state.winner;
    const faction = winner === 'draw' || winner === null ? null : factionOf(game, winner);
    hud.clear();
    const parting = this.commentator?.ending(winner).find((c) => c.situation === 'victory');   // the winner has the last word
    if (parting) { this.banner.setSide('top'); this.banner.say(this.#line(parting)); this.bannerUntil = 0; }
    hud.gameOver({ title: faction ? 'Victory' : 'Draw', text: faction ? `${faction.name} wins!` : 'Nobody wins.', color: faction?.color, onClick: () => this.restart() });
  }

  async #onEndTurn() {
    const { game, hud } = this;
    if (game.isOver || this.busy || this.effects.isLocked(this.#now())) return;
    // Units that have not acted yet: the first press shows one and asks; a second press ends the turn anyway.
    const idle = this.#humanTurn() ? game.state.units.filter((u) => u.owner === game.currentPlayer && !u.done && wantsOrder(game, u)) : [];   // turrets and jammers take no orders
    if (idle.length && !this.endArmed) {
      this.endArmed = true;
      this.controller.cancelAll();
      this.renderer.reveal([[idle[0].x, idle[0].y]]);
      this.controller.cursor = { x: idle[0].x, y: idle[0].y };
      hud.message('Are you sure? Tap again to end turn.', { sticky: true });
      return;
    }
    this.endArmed = false;
    this.controller.cancelAll();
    this.busy = true;
    await this.#advanceTurns();
    this.busy = false;
    if (!game.isOver && !this.disposed) {
      const home = this.#home();
      if (home) this.renderer.camera.glideTo(home.x, home.y);   // a new turn starts at the HQ
      const humans = game.map.players.filter((p) => p.controller === 'human').length;
      hud.message(humans > 1 ? `${factionOf(game, game.currentPlayer).name}: your turn.` : 'Your turn.');
    }
  }

  /** End the current turn, then keep playing computer turns until it is a human's turn (or the game ends). */
  async #advanceTurns() {
    const { game, hud } = this;
    do {
      const res = game.endTurn();
      this.presenter.present(res.events, { now: this.#now() });   // income numbers float up from the properties
      this.#handleEvents(res.events);
      const shots = res.events.filter((e) => e.auto);   // turrets fired by themselves as the turn ended: let it play out
      if (shots.length) {
        const text = describeEvents(game, shots);
        if (text) hud.message(text);
        await this.#pause(400 + Math.max(0, this.effects.lockUntil - this.#now()));
      }
      if (game.isOver || this.disposed) return;
      if (!this.#humanTurn()) {
        hud.message(`${factionOf(game, game.currentPlayer).name} is moving...`, { sticky: true });
        this.bannerUntil = 0;
        this.#comment(this.commentator?.turnStart(game.currentPlayer, this.#now()));
        await this.#playAiTurn();
        if (game.isOver || this.disposed) return;
        await this.#pause(500 + Math.max(0, this.effects.lockUntil - this.#now()));
        this.animator.arrow = null;
      }
    } while (!this.#humanTurn());
    this.banner?.hide();
    this.#comment(this.commentator?.turnStart(game.currentPlayer, this.#now()));
  }

  /**
   * The part of an AI order's events the human may see. Something the computer does out of sight (a submarine moving or diving
   * under water nobody is watching) must not show up as an animation, a ripple or a message, or it would give it away.
   */
  #visibleTo(viewer, events, wasVisible = false) {
    const { game } = this;
    // a unit the human could see before the order may dive during it: its move and its dive are still shown (it then fades away)
    const seen = (id) => { const u = unitById(game, id); return !u || wasVisible || canSee(game, viewer, u); };
    return events.filter((ev) => {
      if (ev.type === 'move' || ev.type === 'interrupt') return seen(ev.unitId);
      if (ev.type === 'dive' || ev.type === 'surface') return seen(ev.unit.id);
      if (ev.type === 'lay') return false;   // nobody sees a mine go down
      return true;
    });
  }

  async #playAiTurn() {
    const { game } = this;
    const player = game.currentPlayer;
    for (const unit of game.state.units.filter((u) => u.owner === player)) {
      if (game.isOver || this.disposed) return;
      if (!game.state.units.includes(unit) || !wantsOrder(game, unit)) continue;   // turrets fire by themselves at the end of the turn
      await this.#playAiUnit(unit);
      const drop = tryDeploy(game, unit);   // a carrier drops its troops after its own move; they are then ordered like any unit
      if (drop) {
        const viewer = this.#viewer();
        const events = this.#visibleTo(viewer, drop.events, canSee(game, viewer, unit));
        this.presenter.present(events, { now: this.#now() });
        this.#handleEvents(drop.events);
        await this.#playAiUnit(drop.dropped);
      }
    }
    if (game.isOver || this.disposed) return;
    buildPhase(game);
    // the units just built use their free move (they come out of the factory and drive off it)
    for (const unit of game.state.units.filter((u) => u.owner === player && u.fresh)) {
      if (game.isOver || this.disposed) return;
      await this.#playAiUnit(unit);
    }
  }

  async #playAiUnit(unit) {
    const { game, hud, animator, effects, presenter } = this;
    const viewer = this.#viewer();
    animator.arrow = null;
    let shown = false;   // did the human get to see this unit act?
    if (!unit.fresh) {   // a submarine that is not threatened comes up to travel at the surface speed
      const wasVisible = canSee(game, viewer, unit);
      const up = surfaceToTravel(game, unit);
      if (up.length) { presenter.present(this.#visibleTo(viewer, up, wasVisible), { now: this.#now() }); shown = wasVisible; }
    }
    // An order can be cut short by a hidden unit; the unit then gets another order.
    for (let step = 0; step < 2 && game.state.units.includes(unit) && !unit.done; step++) {
      const order = chooseOrder(game, unit);
      // on a map bigger than the screen, bring the unit, where it is going and what it shoots at into view first
      // (not for a submarine the human cannot see: the camera would point at it)
      const visible = canSee(game, viewer, unit);
      const target = order.action.targetId ? unitById(game, order.action.targetId) : null;
      if (visible) {
        this.renderer.reveal([[unit.x, unit.y], [order.to.x, order.to.y], ...(target ? [[target.x, target.y]] : [])]);
        if (this.renderer.camera.glide) await this.#pause(350);
      }
      if (game.isOver || this.disposed) return;
      const res = game.act(order);
      if (!res.ok) throw new Error(`AI produced an invalid order: ${res.error}`);
      const events = this.#visibleTo(viewer, res.events, visible);
      shown = shown || visible || !game.state.units.includes(unit) || canSee(game, viewer, unit);
      presenter.present(events, { now: this.#now() });
      this.#comment(this.commentator?.react(events, this.#now(), unit.owner));
      const text = describeEvents(game, events);
      if (text) hud.message(text);
      this.#handleEvents(res.events);
      if (!res.interrupted) break;
      await this.#pause(Math.max(animator.active ? animator.current.d + 500 : 400, effects.lockUntil - this.#now() + 250));
    }
    // no waiting around for a unit the human could not see do anything (a pause would also give it away)
    await this.#pause(!shown ? 0 : Math.max(animator.active ? animator.current.d + 450 : 250, effects.lockUntil - this.#now() + 250));
  }
}

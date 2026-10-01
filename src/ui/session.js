// Session: owns one running game (Game + Renderer + HUD + Controller) and drives the frame loop,
// the End-turn button and the AI's turns with their pacing delays.

import { buildPhase, chooseOrder } from '../engine/ai.js';
import { hasAttribute } from '../engine/attributes.js';
import { canSee } from '../engine/detection.js';
import { allProperties, factionOf, propertiesOwnedBy, unitById } from '../engine/queries.js';
import { MoveAnimator } from '../render/animator.js';
import { Effects } from '../render/effects.js';
import { Renderer } from '../render/renderer.js';
import { Controller } from './controller.js';
import { Gestures } from './gestures.js';
import { Hud } from './hud.js';
import { describeEvents } from './messages.js';
import { Presenter } from './presenter.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class Session {
  /**
   * @param {import('../engine/game.js').Game} game
   * @param {{canvas:HTMLCanvasElement, doc:Document, restart:()=>void, quit?:()=>void}} host
   */
  constructor(game, { canvas, doc, restart, quit = restart }) {
    this.game = game;
    this.canvas = canvas;
    this.restart = restart;
    this.quit = quit;
    this.busy = false;
    this.disposed = false;

    this.animator = new MoveAnimator();
    this.renderer = null;
    this.effects = new Effects(game.registry, (owner) => this.renderer.colorsOf(owner));
    this.renderer = new Renderer(canvas, game, this.effects, this.animator);
    this.hud = new Hud(doc, { registry: game.registry });
    this.presenter = new Presenter({ effects: this.effects, animator: this.animator });
    this.controller = new Controller({
      game, hud: this.hud, presenter: this.presenter, animator: this.animator,
      colorsOf: (owner) => this.renderer.colorsOf(owner), onEvents: (events) => this.#handleEvents(events),
    });

    // Touch, mouse and trackpad on the map: a tap selects, a drag scrolls, a pinch (or ctrl + wheel) zooms. Scrolling and zooming
    // work at any time (also while the computer moves); only taps are held back until it is a human's turn.
    this.gestures = new Gestures({
      onTap: (cx, cy) => {
        if (!this.#inputAllowed()) return;
        const { x, y } = this.renderer.tileAt(cx, cy);
        this.controller.tap(x, y);
      },
      onPan: (dx, dy) => this.renderer.pan(dx, dy),
      onZoom: (factor, x, y) => this.renderer.zoom(factor, x, y),
    });
    this.onPointerDown = (e) => { e.preventDefault(); this.canvas.setPointerCapture?.(e.pointerId); this.gestures.down(e); };
    this.onPointerMove = (e) => this.gestures.move(e);
    this.onPointerUp = (e) => this.gestures.up(e);
    this.onPointerCancel = (e) => this.gestures.cancel(e);
    this.onWheel = (e) => { e.preventDefault(); this.gestures.wheel(e); };
    this.onResize = () => this.#fit();
    this.lastFrame = 0;
  }

  #fit() { this.renderer.fit({ top: this.hud.barHeight() }); }

  /** On a map bigger than the screen, open on the viewing player's HQ (or their first unit). */
  #centerOnStart() {
    const { game } = this;
    const viewer = this.#viewer();
    const home = allProperties(game).find((p) => p.owner === viewer && hasAttribute(p.terrain, 'victoryOnCapture'))
      || game.state.units.find((u) => u.owner === viewer);
    if (home) this.renderer.centerOn(home.x, home.y);
  }

  /** The dock floats over the map on the edge away from the tile being worked on: the top half of the screen -> bottom edge. */
  #placeDock() {
    const tile = this.hud.focusTile;
    if (!tile) return;
    const r = this.renderer.tileRect(tile.x, tile.y);
    this.hud.setSide(r.top + r.size / 2 < this.renderer.layout.H / 2 ? 'bottom' : 'top');
  }

  #now() { return performance.now(); }
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
    addEventListener('resize', this.onResize);
    hud.onEnd(() => this.#onEndTurn());
    hud.onUndo(() => this.#onUndo());
    hud.onMenu(() => this.#openMenu());
    hud.message(this.#introText());
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
    removeEventListener('resize', this.onResize);
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
    return `Tap a unit to move it. Tap a ${list} you own to build units. Capture the enemy HQ!`;
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
    game.undo();
    this.effects.clear();
    this.animator.clear();
    controller.cancelAll();
    hud.message('Move undone.');
  }

  #handleEvents(events) {
    const over = events.find((e) => e.type === 'gameOver');
    if (over) this.#showGameOver();
  }

  #showGameOver() {
    const { game, hud } = this;
    const winner = game.state.winner;
    const faction = winner === 'draw' || winner === null ? null : factionOf(game, winner);
    hud.clear();
    hud.gameOver({ title: faction ? 'Victory' : 'Draw', text: faction ? `${faction.name} wins!` : 'Nobody wins.', color: faction?.color, onClick: () => this.restart() });
  }

  async #onEndTurn() {
    const { game, hud } = this;
    if (game.isOver || this.busy || this.effects.isLocked(this.#now())) return;
    this.controller.cancelAll();
    this.busy = true;
    await this.#advanceTurns();
    this.busy = false;
    if (!game.isOver && !this.disposed) {
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
      if (game.isOver || this.disposed) return;
      if (!this.#humanTurn()) {
        hud.message(`${factionOf(game, game.currentPlayer).name} is moving...`, { sticky: true });
        await this.#playAiTurn();
        if (game.isOver || this.disposed) return;
        await sleep(500 + Math.max(0, this.effects.lockUntil - this.#now()));
        this.animator.arrow = null;
      }
    } while (!this.#humanTurn());
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
      return true;
    });
  }

  async #playAiTurn() {
    const { game } = this;
    const player = game.currentPlayer;
    for (const unit of game.state.units.filter((u) => u.owner === player)) {
      if (game.isOver || this.disposed) return;
      await this.#playAiUnit(unit);
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
    // An order can be cut short by a hidden unit, or be a pit stop that refills the unit (and its move); the unit then gets another order.
    for (let step = 0; step < 2 && game.state.units.includes(unit) && !unit.done; step++) {
      const order = chooseOrder(game, unit);
      // on a map bigger than the screen, bring the unit, where it is going and what it shoots at into view first
      // (not for a submarine the human cannot see: the camera would point at it)
      const visible = canSee(game, viewer, unit);
      const target = order.action.targetId ? unitById(game, order.action.targetId) : null;
      if (visible) {
        this.renderer.reveal([[unit.x, unit.y], [order.to.x, order.to.y], ...(target ? [[target.x, target.y]] : [])]);
        if (this.renderer.camera.glide) await sleep(350);
      }
      if (game.isOver || this.disposed) return;
      const res = game.act(order);
      if (!res.ok) throw new Error(`AI produced an invalid order: ${res.error}`);
      const events = this.#visibleTo(viewer, res.events, visible);
      shown = shown || visible || !game.state.units.includes(unit) || canSee(game, viewer, unit);
      presenter.present(events, { now: this.#now() });
      const text = describeEvents(game, events);
      if (text) hud.message(text);
      this.#handleEvents(res.events);
      if (!res.interrupted && !res.refreshed) break;
      await sleep(Math.max(animator.active ? animator.current.d + 500 : 400, effects.lockUntil - this.#now() + 250));
    }
    // no waiting around for a unit the human could not see do anything (a pause would also give it away)
    await sleep(!shown ? 0 : Math.max(animator.active ? animator.current.d + 450 : 250, effects.lockUntil - this.#now() + 250));
  }
}

// Session: owns one running game (Game + Renderer + HUD + Controller) and drives the frame loop,
// the End-turn button and the AI's turns with their pacing delays.

import { buildPhase, chooseOrder } from '../engine/ai.js';
import { propertiesOwnedBy, factionOf } from '../engine/queries.js';
import { MoveAnimator } from '../render/animator.js';
import { Effects } from '../render/effects.js';
import { Renderer } from '../render/renderer.js';
import { Controller } from './controller.js';
import { Hud } from './hud.js';
import { describeEvents } from './messages.js';
import { Presenter } from './presenter.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class Session {
  /**
   * @param {import('../engine/game.js').Game} game
   * @param {{canvas:HTMLCanvasElement, doc:Document, restart:()=>void, terrainTheme?:string}} host
   */
  constructor(game, { canvas, doc, restart, terrainTheme }) {
    this.game = game;
    this.canvas = canvas;
    this.restart = restart;
    this.busy = false;
    this.disposed = false;

    this.animator = new MoveAnimator();
    this.renderer = null;
    this.effects = new Effects(game.registry, (owner) => this.renderer.colorsOf(owner));
    this.renderer = new Renderer(canvas, game, this.effects, this.animator, { terrainTheme });
    this.hud = new Hud(doc);
    this.presenter = new Presenter({ effects: this.effects, animator: this.animator });
    this.controller = new Controller({
      game, hud: this.hud, presenter: this.presenter, animator: this.animator,
      colorsOf: (owner) => this.renderer.colorsOf(owner), onEvents: (events) => this.#handleEvents(events),
    });

    this.onPointerDown = (e) => {
      e.preventDefault();
      if (!this.#inputAllowed()) return;
      const { x, y } = this.renderer.tileAt(e.clientX, e.clientY);
      this.controller.tap(x, y);
    };
    this.onResize = () => this.renderer.fit();
  }

  #now() { return performance.now(); }
  #humanTurn() { return this.game.controllerOf(this.game.currentPlayer) === 'human'; }
  #inputAllowed() { return this.#humanTurn() && !this.game.isOver && !this.busy && !this.effects.isLocked(this.#now()); }

  start() {
    const { hud, game } = this;
    this.renderer.fit();
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    addEventListener('resize', this.onResize);
    hud.onEnd(() => this.#onEndTurn());
    hud.onUndo(() => this.#onUndo());
    hud.message(this.#introText());
    requestAnimationFrame(() => this.#frame());
    void game;
  }

  dispose() {
    this.disposed = true;
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    removeEventListener('resize', this.onResize);
    this.hud.onEnd(null);
    this.hud.onUndo(null);
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
    hud.setUndoDisabled(!(game.canUndo && this.#humanTurn() && !this.busy && controller.mode === 'idle' && !this.effects.isLocked(now)));
    this.animator.update(now);
    const viewer = this.#viewer();
    hud.status(`Day ${game.state.day} - ${factionOf(game, game.currentPlayer).name}`, `Funds ${game.state.funds[viewer]} - Props ${propertiesOwnedBy(game, viewer).length}`);
    hud.setEndDisabled(this.busy);
    this.renderer.draw(controller.view, now);
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
    this.hud.buttons([{ label: 'Play again', onClick: () => this.restart() }]);
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
      this.#handleEvents(res.events);
      if (game.isOver || this.disposed) return;
      if (!this.#humanTurn()) {
        hud.message(`${factionOf(game, game.currentPlayer).name} is moving...`);
        await this.#playAiTurn();
        if (game.isOver || this.disposed) return;
        await sleep(500 + Math.max(0, this.effects.lockUntil - this.#now()));
        this.animator.arrow = null;
      }
    } while (!this.#humanTurn());
  }

  async #playAiTurn() {
    const { game, hud, animator, effects, presenter } = this;
    const player = game.currentPlayer;
    for (const unit of game.state.units.filter((u) => u.owner === player)) {
      if (game.isOver || this.disposed) return;
      animator.arrow = null;
      if (game.state.units.includes(unit)) {
        const res = game.act(chooseOrder(game, unit));
        if (!res.ok) throw new Error(`AI produced an invalid order: ${res.error}`);
        presenter.present(res.events, { now: this.#now() });
        const text = describeEvents(game, res.events);
        if (text) hud.message(text);
        this.#handleEvents(res.events);
      }
      await sleep(Math.max(animator.active ? animator.current.d + 450 : 250, effects.lockUntil - this.#now() + 250));
    }
    if (!game.isOver && !this.disposed) buildPhase(game);
  }
}

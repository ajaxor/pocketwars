// Input controller: turns taps on the board into game orders.
//
// It is a small state machine:  idle -> move -> (anim) -> act -> commit -> idle
//   idle  nothing selected; tap a ready unit to select it, or a property you own to open the build menu
//   move  a unit is selected and its reachable tiles are highlighted; tap a tile to preview the move,
//         or tap an enemy to preview the best attack position
//   anim  the selected unit is sliding to the previewed tile (taps ignored)
//   act   the unit sits at its previewed tile; pick Wait / Capture / an enemy (tap twice to attack)
//   build the build menu is open
//
// Moves are only PREVIEWED (kept in `dest`): game state is untouched until an order is committed with
// game.act(), so cancelling is free and the engine never sees half-finished moves.

import { canCapture } from '../engine/capture.js';
import { canTarget } from '../engine/combat.js';
import { buildOptions } from '../engine/economy.js';
import { attackTiles, bestAttackTile, canFireAfterMoving, computeReach, targetsFrom } from '../engine/movement.js';
import { ownerAt, propertyAt, terrainAt, layerInfo, unitDef } from '../engine/queries.js';
import { describeEvents } from './messages.js';

export class Controller {
  /**
   * @param {object} deps
   * @param {import('../engine/game.js').Game} deps.game
   * @param {import('./hud.js').Hud} deps.hud
   * @param {import('./presenter.js').Presenter} deps.presenter
   * @param {import('../render/animator.js').MoveAnimator} deps.animator
   * @param {(owner:number)=>object} deps.colorsOf faction colours for a player
   * @param {(events:object[])=>void} deps.onEvents called with the events of each committed action
   */
  constructor({ game, hud, presenter, animator, colorsOf, onEvents }) {
    Object.assign(this, { game, hud, presenter, animator, colorsOf, onEvents });
    this.reset();
  }

  reset() {
    this.mode = 'idle';
    this.sel = null;
    this.dest = null; // previewed destination of the selected unit
    this.reach = null;
    this.attack = null;
    this.targets = [];
    this.pendingTargetId = null;
  }

  /** Snapshot of the selection state for the renderer. */
  get view() {
    return {
      selectedId: this.sel ? this.sel.id : null,
      dest: this.dest,
      reach: this.reach,
      attackTiles: this.attack,
      targets: this.targets,
      showTargets: this.mode === 'act',
      pendingTargetId: this.pendingTargetId,
    };
  }

  // The selected unit is drawn at `dest` while previewing, so hit-testing uses that position too.
  #posOf(u) { return this.sel && u.id === this.sel.id && this.dest ? this.dest : u; }
  #unitAt(x, y) { return this.game.state.units.find((u) => { const p = this.#posOf(u); return p.x === x && p.y === y; }); }
  #selPos() { return this.dest || { x: this.sel.x, y: this.sel.y }; }
  #msg(text) { this.hud.message(text); }

  cancelAll() {
    this.animator.arrow = null;
    this.reset();
    if (!this.game.isOver) this.hud.buttons([]);
  }

  tap(x, y) {
    const { game, hud } = this;
    if (x < 0 || y < 0 || x >= game.map.width || y >= game.map.height || this.mode === 'anim') return;
    if (this.mode === 'build') { this.mode = 'idle'; hud.buttons([]); }
    const u = this.#unitAt(x, y);

    if (this.mode === 'idle') {
      if (u && u.owner === game.currentPlayer && !u.done) this.#select(u);
      else if (u) this.#info(u);
      else {
        const options = ownerAt(game, x, y) === game.currentPlayer ? buildOptions(game, x, y) : [];
        if (options.length) this.#buildMenu(x, y, options);
        else { const t = terrainAt(game, x, y); this.#msg(`${t.name} def ${t.defense}`); }
      }
    } else if (this.mode === 'move') {
      const sel = this.sel;
      if (u && u.owner !== sel.owner && canTarget(game, sel, u)) {
        const spot = bestAttackTile(game, sel, u, this.reach);
        if (spot) {
          this.#previewMove(spot[0], spot[1], () => { this.pendingTargetId = u.id; this.#msg(this.#attackPrompt(u)); });
          return;
        }
      }
      if (this.reach.has(x, y)) {
        if (x === sel.x && y === sel.y) {
          if (canCapture(game, sel)) this.#commit({ type: 'capture' });
          else this.#actMenu();
          return;
        }
        this.#previewMove(x, y);
        return;
      }
      this.cancelAll();
    } else if (this.mode === 'act') {
      const pos = this.#selPos();
      const target = this.targets.find((e) => e.x === x && e.y === y);
      if (target) {
        if (this.pendingTargetId === target.id) { this.#commit({ type: 'attack', targetId: target.id }); return; }
        this.pendingTargetId = target.id;
        this.#msg(this.#attackPrompt(target));
      } else if (x === pos.x && y === pos.y) {
        this.#commit(canCapture(game, this.sel, pos.x, pos.y) ? { type: 'capture' } : { type: 'wait' });
      } else if (this.reach && this.reach.has(x, y) && !u) {
        this.#previewMove(x, y);
      } else this.pendingTargetId = null;
    }
  }

  #attackPrompt(enemy) { return `Attack ${this.game.registry.unit(enemy.type).name}? Tap it again to confirm`; }

  #info(u) {
    const { game } = this;
    const def = unitDef(game, u);
    const label = layerInfo(game, u).label;
    const t = terrainAt(game, u.x, u.y);
    const prop = propertyAt(game, u.x, u.y);
    this.#msg(`${def.name}${label ? ` (${label})` : ''} HP ${Math.ceil(u.hp)} - ${t.name} def ${t.defense}`
      + (u.capture && prop ? ` - capturing ${u.capture}/${prop.capturePoints}` : ''));
  }

  #select(u) {
    this.sel = u;
    this.dest = null;
    this.reach = computeReach(this.game, u);
    this.attack = attackTiles(this.game, u);
    this.mode = 'move';
    this.#info(u);
  }

  // Preview a move: the unit slides to the destination (from its ORIGINAL tile), then the action menu opens.
  #previewMove(x, y, then) {
    const u = this.sel;
    this.pendingTargetId = null;
    if (x === u.x && y === u.y) {
      this.dest = null;
      this.animator.arrow = null;
      this.#actMenu();
      if (then) then();
      return;
    }
    const path = this.reach.pathTo(x, y);
    this.dest = { x, y };
    this.attack = null;
    this.mode = 'anim';
    this.animator.start(u.id, path, performance.now(), () => { this.#actMenu(); if (then) then(); });
  }

  #actMenu() {
    const { game, sel } = this;
    const pos = this.#selPos();
    const blocked = !!this.dest && !canFireAfterMoving(game, sel); // indirect fire cannot follow a move
    this.mode = 'act';
    this.attack = blocked ? null : attackTiles(game, sel, pos.x, pos.y);
    this.targets = blocked ? [] : targetsFrom(game, sel, pos.x, pos.y);
    const capture = canCapture(game, sel, pos.x, pos.y);
    const buttons = [];
    if (capture) buttons.push({ label: 'Capture', onClick: () => this.#commit({ type: 'capture' }) });
    buttons.push({ label: 'Wait', onClick: () => this.#commit({ type: 'wait' }) });
    buttons.push({ label: 'Cancel', onClick: () => this.cancelAll() });
    this.hud.buttons(buttons);
    this.#msg(capture ? 'Tap your unit to capture - or pick an action'
      : this.targets.length ? 'Tap an enemy to target it (again to attack), or tap your unit to wait'
        : 'Tap your unit to confirm the move');
  }

  #commit(action) {
    const { game, sel } = this;
    const res = game.act({ unitId: sel.id, to: this.#selPos(), action });
    if (!res.ok) { this.#msg(`That order is not allowed (${res.error}).`); this.cancelAll(); return; }
    this.presenter.present(res.events, { now: performance.now(), animateMoves: false }); // move was already previewed
    const text = describeEvents(game, res.events);
    if (text) this.#msg(text);
    this.onEvents(res.events);
    this.cancelAll();
  }

  #buildMenu(x, y, options) {
    const { game, hud } = this;
    this.mode = 'build';
    this.#msg(`Funds ${game.state.funds[game.currentPlayer]}`);
    const colors = this.colorsOf(game.currentPlayer);
    hud.buttons(options.map((def) => ({
      label: `${def.name} ${def.cost / 1000}k`,
      onClick: () => {
        if (game.state.funds[game.currentPlayer] < def.cost) { this.#msg('Not enough funds'); return; }
        const res = game.build(x, y, def.id);
        if (!res.ok) { this.#msg(`Cannot build (${res.error}).`); return; }
        this.#msg('Built ' + def.name);
        this.mode = 'idle';
        hud.buttons([]);
      },
      icon: { def, colors },
      dim: game.state.funds[game.currentPlayer] < def.cost,
    })).concat([{ label: 'Close', onClick: () => { this.mode = 'idle'; hud.buttons([]); } }]));
  }
}

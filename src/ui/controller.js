// Input controller: turns taps on the board into game orders.
//
// It is a small state machine:  idle -> move -> (anim) -> act -> commit -> idle
//   idle  nothing selected; tap a ready unit to select it, or a property you own to open the build menu; tapping anything
//         else shows what is there (the info boxes)
//   move  a unit is selected and its reachable tiles are highlighted; tap a tile to preview the move,
//         or tap an enemy to preview the best attack position
//   anim  the selected unit is sliding to the previewed tile (taps ignored)
//   act   the unit sits at its previewed tile; pick Wait / Capture / an enemy (tap twice to attack)
//   build the build menu is open
//   deploy a unit with the `deploy` attribute (the transport copter) is dropping troops: tap one of the highlighted tiles next to it
//
// BUILDING: a unit is built on the property and the controller selects it at once, for its free move (it is `fresh`: it can only move and
// Wait, see engine/game.js). A Wait that refills ammo next to an airfield is a pit stop (`res.refreshed`): the unit is selected again.
//
// An order can come back INTERRUPTED (the path ran into a hidden unit, see engine/game.js): the unit has already moved, so the
// controller plays the partial move and goes straight to the act menu for it ('resume'); the player then attacks or waits.
//
// Moves are only PREVIEWED (kept in `dest`): game state is untouched until an order is committed with
// game.act(), so cancelling is free and the engine never sees half-finished moves.

import { canCapture } from '../engine/capture.js';
import { canTarget, forecastAttack } from '../engine/combat.js';
import { canSee } from '../engine/detection.js';
import { canDeploy, deployConfig, dropTiles } from '../engine/deploy.js';
import { buildOptions } from '../engine/economy.js';
import { attackTiles, bestAttackTile, canFireAfterMoving, computeReach, hasMovedAlready, targetsFrom } from '../engine/movement.js';
import { ownerAt, unitAt, unitById } from '../engine/queries.js';
import { canSubmergeAt, canSurface } from '../engine/submerge.js';
import { buildMenuModel, defaultChoice } from './build-menu.js';
import { terrainInfo, unitInfo } from './info.js';
import { describeEvents } from './messages.js';

export class Controller {
  /**
   * @param {object} deps
   * @param {import('../engine/game.js').Game} deps.game
   * @param {import('./hud.js').Hud} deps.hud   shows what the controller decides: info(), actions(), build(), message(), focus()
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
    this.preview = null; // { reach, attack }: where a tapped unit that cannot be ordered (an enemy's, say) could move and hit
    this.deploy = null; // tiles a new unit may appear on, while the player is choosing one
    this.cursor = null; // the tile last tapped, outlined on the board while nothing is selected
    this.cards = null;  // the info cards for the current selection; while orders are being given they start hidden (see #setCards)
    this.infoOn = false;
  }

  /** Snapshot of the selection state for the renderer. */
  get view() {
    return {
      selectedId: this.sel ? this.sel.id : null,
      dest: this.dest,
      reach: this.reach || (this.preview && this.preview.reach),
      attackTiles: this.attack || (this.preview && this.preview.attack),
      targets: this.targets,
      showTargets: this.mode === 'act',
      pendingTargetId: this.pendingTargetId,
      cursor: this.cursor,
      deploy: this.deploy,
      forecast: this.#forecast(),
    };
  }

  /** The damage preview for the picked target: { damage, destroyed, counter, at } (`at` = where the attacker stands), or null. */
  #forecast() {
    if (!this.sel || this.pendingTargetId === null) return null;
    const target = unitById(this.game, this.pendingTargetId);
    if (!target) return null;
    const at = this.#selPos();
    return { ...forecastAttack(this.game, this.sel, target, at), at };
  }

  // The selected unit is drawn at `dest` while previewing, so hit-testing uses that position too.
  #posOf(u) { return this.sel && u.id === this.sel.id && this.dest ? this.dest : u; }
  // Units the player cannot see are not there as far as taps are concerned: a tap must never confirm a hidden submarine.
  #unitAt(x, y) {
    const { game } = this;
    return game.state.units.find((u) => { const p = this.#posOf(u); return p.x === x && p.y === y && canSee(game, game.currentPlayer, u); });
  }
  #selPos() { return this.dest || { x: this.sel.x, y: this.sel.y }; }
  #msg(text) { this.hud.message(text); }

  cancelAll() {
    this.animator.arrow = null;
    this.reset();
    this.hud.clear();
  }

  tap(x, y) {
    const { game, hud } = this;
    if (x < 0 || y < 0 || x >= game.map.width || y >= game.map.height || this.mode === 'anim') return;
    if (this.mode === 'deploy') { this.#deployTap(x, y); return; }
    if (this.mode === 'build') { this.mode = 'idle'; hud.clear(); }
    const u = this.#unitAt(x, y);

    if (this.mode === 'idle') {
      this.cursor = { x, y };
      this.preview = null;
      if (u && u.owner === game.currentPlayer && !u.done) this.#select(u);
      else if (u) this.#show(x, y, u);
      else {
        const options = ownerAt(game, x, y) === game.currentPlayer ? buildOptions(game, x, y) : [];
        if (options.length) this.#buildMenu(x, y);
        else this.#show(x, y, null);
      }
    } else if (this.mode === 'move') {
      const sel = this.sel;
      if (u && u.owner !== sel.owner && !sel.fresh && canTarget(game, sel, u)) {
        const spot = bestAttackTile(game, sel, u, this.reach);
        if (spot) {
          this.#previewMove(spot[0], spot[1], () => this.#pend(u));
          return;
        }
      }
      if (this.reach.has(x, y)) {
        if (x === sel.x && y === sel.y) {
          if (!sel.fresh && canCapture(game, sel)) this.#commit({ type: 'capture' });
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
        this.#pend(target);
      } else if (x === pos.x && y === pos.y) {
        this.#commit(!this.sel.fresh && canCapture(game, this.sel, pos.x, pos.y) ? { type: 'capture' } : { type: 'wait' });
      } else if (this.reach && this.reach.has(x, y) && !u) {
        this.#previewMove(x, y);
      } else { this.pendingTargetId = null; this.#actMenu(); }
    }
  }

  // Info boxes -------------------------------------------------------------------------------------------------------------

  /** Show what is on tile (x, y): its unit (when there is one) and its terrain. */
  #show(x, y, unit) {
    if (unit) this.preview = this.#threat(unit);
    this.hud.focus({ x, y });
    this.hud.info({ unit: unit ? unitInfo(this.game, unit) : null, terrain: terrainInfo(this.game, x, y) });
    this.hud.message(null);
  }

  /** The ground a unit that is not being ordered could cover next turn: where it can move, and every tile it could then hit. */
  #threat(unit) {
    const { game } = this;
    const reach = computeReach(game, unit);
    const attack = new Set();
    // a unit that cannot fire after moving (artillery) only threatens from where it stands
    const from = canFireAfterMoving(game, unit) ? [...reach.tiles()] : [{ x: unit.x, y: unit.y }];
    for (const t of from) for (const k of attackTiles(game, unit, t.x, t.y)) attack.add(k);
    return { reach, attack };
  }

  /**
   * Info cards for the unit being ordered. They would cover the map while the player is choosing, so they start hidden and
   * the Info button on the order window toggles them. (Enemy units and units that have already moved, which get no orders,
   * show their cards straight away through #show.)
   */
  #setCards(cards) {
    this.cards = cards;
    this.hud.info(this.infoOn ? cards : {});
  }

  #toggleInfo() {
    this.infoOn = !this.infoOn;
    this.hud.info(this.infoOn ? this.cards : {});
    if (this.mode === 'move') this.#selectOrders(); else if (this.mode === 'act') this.#actions();
  }

  #infoButton() { return { label: this.infoOn ? 'Hide info' : 'Info', variant: 'ghost', onClick: () => this.#toggleInfo() }; }

  #selectOrders() {
    this.hud.actions({
      hint: this.sel.fresh ? 'Just built: tap a highlighted tile to move it out (it cannot attack yet).' : 'Tap a highlighted tile to move, or an enemy to attack it.',
      items: [this.#infoButton(), { label: 'Cancel', variant: 'ghost', onClick: () => this.cancelAll() }],
    });
  }

  /** The selected unit with the terrain at its (previewed) position. */
  #showSelected() {
    const pos = this.#selPos();
    this.hud.focus(pos);
    this.#setCards({ unit: unitInfo(this.game, this.sel, { at: pos }), terrain: terrainInfo(this.game, pos.x, pos.y) });
  }

  #select(u, text = null) {
    this.sel = u;
    this.dest = null;
    this.reach = computeReach(this.game, u);
    this.attack = u.fresh ? null : attackTiles(this.game, u);   // a freshly built unit only moves
    this.mode = 'move';
    this.hud.message(text);
    this.#showSelected();
    if (u.halted) { this.#actMenu(); return; }   // it already used its move (an interrupted one): only an action is left
    this.#selectOrders();
  }

  /** An enemy is picked as the target: show it (and the damage it would take) and offer the Attack button. */
  #pend(enemy) {
    this.pendingTargetId = enemy.id;
    const pos = this.#selPos();
    this.hud.focus({ x: enemy.x, y: enemy.y });
    this.#setCards({
      unit: unitInfo(this.game, enemy, { attacker: this.sel, attackerAt: pos }),
      terrain: terrainInfo(this.game, enemy.x, enemy.y),
    });
    this.#actions();
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
    const blocked = sel.fresh || ((!!this.dest || hasMovedAlready(sel)) && !canFireAfterMoving(game, sel)); // indirect fire cannot follow a move
    this.mode = 'act';
    this.attack = blocked ? null : attackTiles(game, sel, pos.x, pos.y);
    this.targets = blocked ? [] : targetsFrom(game, sel, pos.x, pos.y);
    if (!this.pendingTargetId) this.#showSelected();
    this.#actions();
  }

  /** The order buttons for the unit where it stands (or is previewed): Attack (once a target is picked), Capture, Wait, Cancel. */
  #actions() {
    const { game, sel, hud } = this;
    const pos = this.#selPos();
    const fresh = !!sel.fresh;   // a just-built unit has its free move only: Wait is its one action
    const capture = !fresh && canCapture(game, sel, pos.x, pos.y);
    const pending = this.pendingTargetId !== null ? this.targets.find((e) => e.id === this.pendingTargetId) : null;
    const items = [];
    if (pending) items.push({ label: 'Attack', variant: 'danger', onClick: () => this.#commit({ type: 'attack', targetId: pending.id }) });
    if (capture) items.push({ label: 'Capture', variant: pending ? undefined : 'primary', onClick: () => this.#commit({ type: 'capture' }) });
    if (!fresh && canDeploy(game, sel, pos.x, pos.y)) items.push({ label: `Deploy ${this.#carried().name}`, onClick: () => this.#chooseDrop() });
    if (!fresh && canSubmergeAt(game, sel, pos.x, pos.y)) items.push({ label: 'Submerge', onClick: () => this.#commit({ type: 'submerge' }) });
    if (!fresh && canSurface(sel)) items.push({ label: 'Surface', onClick: () => this.#commit({ type: 'surface' }) });
    items.push({ label: 'Wait', variant: pending || capture ? undefined : 'primary', onClick: () => this.#commit({ type: 'wait' }) });
    items.push(this.#infoButton(), { label: 'Cancel', variant: 'ghost', onClick: () => this.cancelAll() });
    const name = game.registry.unit(pending ? pending.type : sel.type).name;
    hud.actions({
      hint: pending ? `Attack ${name}? Tap it again or press Attack.`
        : capture ? 'Capture this property, or pick another action.'
          : fresh ? 'Tap your unit to confirm the move.'
          : this.targets.length ? 'Tap an enemy to target it, or tap your unit to wait.'
            : 'Tap your unit to confirm the move.',
      items,
    });
  }

  #commit(action) {
    const { game, sel } = this;
    const res = game.act({ unitId: sel.id, to: this.#selPos(), action });
    if (!res.ok) { this.cancelAll(); this.#msg(`That order is not allowed (${res.error}).`); return; }
    if (res.interrupted) { this.#interrupted(res); return; }
    this.presenter.present(res.events, { now: performance.now(), animateMoves: false }); // move was already previewed
    const text = describeEvents(game, res.events);
    this.cancelAll();
    if (text) this.#msg(text);
    this.onEvents(res.events);
    const drop = res.events.find((e) => e.type === 'deploy');
    if (drop) { const u = unitById(game, drop.dropped.id); if (u && !u.done) this.#select(u, `${text} - it is ready to move and attack.`); }   // the dropped unit can act at once
    else if (res.refreshed) this.#select(unitById(game, res.refreshed.unitId), text);   // a pit stop: it can move again
  }

  /** The move hit something hidden: slide the unit as far as it got, then let the player give it an order from there. */
  #interrupted(res) {
    const { game, hud } = this;
    const unit = unitById(game, res.interrupted.unitId);
    const text = describeEvents(game, res.events);
    this.animator.arrow = null;
    this.reset();
    hud.clear();
    this.mode = 'anim';
    this.presenter.present(res.events, {
      now: performance.now(), animateMoves: true,
      onMoveDone: () => this.#resume(unit, text),
    });
    if (!res.events.some((e) => e.type === 'move')) this.#resume(unit, text);   // it could not even leave its tile
    else if (text) this.#msg(text);
    this.onEvents(res.events);
  }

  #resume(unit, text) {
    if (this.mode !== 'anim') return;
    if (!this.game.state.units.includes(unit) || unit.done) { this.mode = 'idle'; return; }
    this.animator.arrow = null;
    this.#select(unit);
    if (text) this.#msg(text);
  }

  #buildMenu(x, y) {
    const { game, hud } = this;
    const player = game.currentPlayer;
    this.mode = 'build';
    hud.focus({ x, y });
    hud.info({});
    hud.message(null);
    const close = () => { this.mode = 'idle'; hud.clear(); };
    const model = buildMenuModel(game, player, x, y);
    hud.build(model, {
      choice: defaultChoice(model.options), faction: this.colorsOf(player),
      onClose: close,
      onBuild: (id) => {
        const def = game.registry.unit(id);
        const res = game.build(x, y, id);
        if (!res.ok) {
          this.#msg(res.error === 'not-enough-funds' ? 'Not enough funds' : res.error === 'already-built' ? 'This property already built a unit this turn.' : `Cannot build (${res.error}).`);
          return;
        }
        this.cancelAll();
        const unit = unitAt(game, x, y);
        // the new unit is ready: select it so the player moves it out of the factory (its free move)
        if (unit) this.#select(unit, `Built ${def.name}. Move it out - it cannot attack this turn.`);
        else this.#msg('Built ' + def.name);
      },
    });
  }

  /** The unit type the selected carrier drops. */
  #carried() { return this.game.registry.unit(deployConfig(this.game, this.sel).unit); }

  /** Highlight the free tiles next to the carrier (where it would stand) and wait for a tap on one. */
  #chooseDrop() {
    const { game, hud, sel } = this;
    const pos = this.#selPos();
    const tiles = dropTiles(game, sel, pos.x, pos.y);
    if (!tiles.length) { this.#msg('No room to drop troops here.'); return; }
    this.mode = 'deploy';
    this.deploy = tiles;
    this.attack = null;
    this.targets = [];
    hud.actions({
      hint: `Tap a highlighted tile to drop the ${this.#carried().name} there.`,
      items: [{ label: 'Back', variant: 'ghost', onClick: () => { this.deploy = null; this.#actMenu(); } }, { label: 'Cancel', variant: 'ghost', onClick: () => this.cancelAll() }],
    });
  }

  #deployTap(x, y) {
    const at = this.deploy.find((t) => t.x === x && t.y === y);
    if (!at) { this.deploy = null; this.#actMenu(); return; }
    this.deploy = null;
    this.#commit({ type: 'deploy', at });
  }
}

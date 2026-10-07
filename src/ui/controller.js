// Input controller: turns taps on the board into game orders.
//
// It is a small state machine:  idle -> move -> (anim) -> act -> commit -> idle
//   idle  nothing selected; tap a ready unit to select it, or a property you own to open the build menu; tapping anything
//         else shows what is there (the info boxes)
//   move  a unit is selected and its reachable tiles are highlighted; tap a tile to preview the move,
//         or tap an enemy to preview the best attack position
//   anim  the selected unit is sliding to the previewed tile (taps ignored)
//   act   the unit sits at its previewed tile; pick Wait / Capture / an enemy (tap twice to attack)
//   lay   a mine layer is choosing the tile for its mine (any free sea tile in range)
//   build the build menu is open
//
// BUILDING: a unit is built on the property and the controller selects it at once, for its free move (it is `fresh`: it can only move and
// Wait, see engine/game.js).
// DEPLOYING works the same way: the Deploy button of a carrier (transport copter) puts the new unit on the carrier's tile and selects it;
// it is then ordered with the normal move-and-attack interface. Cancelling (cancelAll) before it is ordered puts it back in the carrier.
// HEAL (a medic or mechanic next to damaged friends) is offered next to Wait, like Resupply (engine/heal.js).
// SUPPLY (a supply truck or carrier next to friends that need ammo or repairs) is offered next to Wait, like Heal (engine/supply.js).
// LAY (a mine layer): the Lay button highlights the tiles in range and the next tap on one lays the mine there (engine/mines.js).
// DIVING: a submarine that has not moved yet can Dive / Surface for free from the move window (game.setSubmerged); the unit is then
// re-selected, because its reach changes (slower under water). Diving after the move is the usual end-of-move order.
// SONAR: while a unit with sonar is selected the board shows the tiles its sonar covers (`view.sonar`).
// RESUPPLY replaces Wait next to a property that refills the unit; it costs money and ends the turn (engine/ammo.js).
//
// An order can come back INTERRUPTED (the path ran into a hidden unit, see engine/game.js): the unit has already moved, so the
// controller plays the partial move and goes straight to the act menu for it ('resume'); the player then attacks or waits.
//
// Moves are only PREVIEWED (kept in `dest`): game state is untouched until an order is committed with
// game.act(), so cancelling is free and the engine never sees half-finished moves.

import { canCapture } from '../engine/capture.js';
import { canHealAt, healPlan } from '../engine/heal.js';
import { joinPartner } from '../engine/join.js';
import { canTarget, forecastAttack } from '../engine/combat.js';
import { canSee, sonarTiles } from '../engine/detection.js';
import { isStructure } from '../engine/structures.js';
import { tileExplored } from '../engine/fog.js';

/** Structures take no orders (turrets fire by themselves at the end of the turn): tapping one only shows what it is and what it covers. */
const isIdleStructure = (game, u) => isStructure(game, u);
import { layConfig, layTiles } from '../engine/mines.js';
import { canSupplyAt, supplyPlan } from '../engine/supply.js';
import { ammoOf, canResupplyAt, resupplyCost } from '../engine/ammo.js';
import { canDeploy } from '../engine/deploy.js';
import { buildOptions } from '../engine/economy.js';
import { attackTiles, bestAttackTile, canFireAfterMoving, computeReach, hasMovedAlready, targetsFrom } from '../engine/movement.js';
import { deployedType, ownerAt, unitAt, unitById } from '../engine/queries.js';
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
  constructor({ game, hud, presenter, animator, colorsOf, onEvents, clock = () => performance.now() }) {
    Object.assign(this, { game, hud, presenter, animator, colorsOf, onEvents, clock });
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
    this.cursor = null; // the tile last tapped, outlined on the board while nothing is selected
    this.layTiles = null; // the tiles a mine layer can put its mine on (mode 'lay')
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
      forecast: this.#forecast(),
      sonar: this.sel && this.mode !== 'idle' ? sonarTiles(this.game, this.sel, this.#selPos()) : null,
      layTiles: this.mode === 'lay' ? this.layTiles : null,
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
    this.#undoPendingDeploy();
    this.animator.arrow = null;
    this.reset();
    this.hud.clear();
  }

  /** A unit that was just deployed and not yet ordered goes back into its carrier. */
  #undoPendingDeploy() {
    const s = this.sel;
    if (s && s.carriedBy && !s.done) this.game.cancelDeploy({ unitId: s.id });
  }

  tap(x, y) {
    const { game, hud } = this;
    if (x < 0 || y < 0 || x >= game.map.width || y >= game.map.height || this.mode === 'anim') return;
    if (this.mode === 'build') { this.mode = 'idle'; hud.clear(); }
    const u = this.#unitAt(x, y);

    if (this.mode === 'idle') {
      this.cursor = { x, y };
      this.preview = null;
      if (u && u.owner === game.currentPlayer && !u.done && !isIdleStructure(game, u)) this.#select(u);
      else if (u && u.owner === game.currentPlayer && canDeploy(game, u)) this.#offerDeploy(x, y, u);   // it has acted, but can still put a unit down
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
          if (sel.carriedBy) { this.cancelAll(); return; }   // tapping the carrier's tile again puts the unit back
          if (!sel.fresh && canCapture(game, sel)) this.#commit({ type: 'capture' });
          else this.#actMenu();
          return;
        }
        this.#previewMove(x, y);
        return;
      }
      this.cancelAll();
    } else if (this.mode === 'lay') {
      if (this.layTiles.some((t) => t.x === x && t.y === y)) this.#commit({ type: 'lay', at: { x, y } });
      else { this.layTiles = null; this.#actMenu(); }
    } else if (this.mode === 'act') {
      const pos = this.#selPos();
      const target = this.targets.find((e) => e.x === x && e.y === y);
      if (target) {
        if (this.pendingTargetId === target.id) { this.#commit({ type: 'attack', targetId: target.id }); return; }
        this.#pend(target);
      } else if (x === pos.x && y === pos.y) {
        this.#commit(this.#plainAction(pos));
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
    const known = tileExplored(this.game, this.game.currentPlayer, x, y);   // in fog of war a tile never seen tells nothing, not even its terrain
    this.hud.info({ unit: unit ? unitInfo(this.game, unit) : null, terrain: known ? terrainInfo(this.game, x, y) : null });
    this.hud.message(known ? null : 'Unexplored. Move a unit closer to see it.');
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

  /** What tapping the unit's own tile does: capture a property, take on ammo, or just wait. */
  #plainAction(pos) {
    const { game, sel } = this;
    if (joinPartner(game, sel, pos.x, pos.y)) return { type: 'join' };
    if (!sel.fresh && canCapture(game, sel, pos.x, pos.y)) return { type: 'capture' };
    if (!sel.fresh && canHealAt(game, sel, pos.x, pos.y)) return { type: 'heal' };
    if (!sel.fresh && canSupplyAt(game, sel, pos.x, pos.y)) return { type: 'supply' };
    return canResupplyAt(game, sel, pos.x, pos.y) ? { type: 'resupply' } : { type: 'wait' };
  }

  /** The Deploy button for a carrier that can put a unit down, or nothing. `onClick` decides where it leads from. */
  #deployItem(carrier, onClick) {
    if (!canDeploy(this.game, carrier)) return [];
    const name = this.game.registry.unit(deployedType(this.game, carrier)).name;
    return [{ label: `Deploy ${name}`, onClick }];
  }

  #selectOrders() {
    this.hud.actions({
      hint: this.sel.carriedBy ? 'Move it out and give it an order. Cancel puts it back in the transport.' : this.sel.fresh ? 'Just built: tap a highlighted tile to move it out (it cannot attack yet).' : 'Tap a highlighted tile to move, or an enemy to attack it.',
      items: [...this.#deployItem(this.sel, () => this.#deployNow(this.sel)), ...this.#diveItem(), this.#infoButton(), { label: 'Cancel', variant: 'ghost', onClick: () => this.cancelAll() }],
    });
  }

  /** The free Dive / Surface button of a submarine that has not moved yet (the move window): it changes how far and how fast the unit can go. */
  #diveItem() {
    const { game, sel } = this;
    if (sel.fresh || sel.carriedBy || sel.halted) return [];
    if (canSurface(game, sel)) return [{ label: 'Surface', onClick: () => this.#setDive(false) }];
    if (canSubmergeAt(game, sel)) return [{ label: 'Dive', onClick: () => this.#setDive(true) }];
    return [];
  }

  #setDive(down) {
    const { game } = this;
    const unit = this.sel;
    const res = game.setSubmerged({ unitId: unit.id, submerged: down });
    if (!res.ok) { this.cancelAll(); this.#msg(`Cannot do that (${res.error}).`); return; }
    this.presenter.present(res.events, { now: this.clock(), animateMoves: false });
    this.onEvents(res.events);
    this.animator.arrow = null;
    this.#select(unit, down ? 'Diving: it moves slower under water, and is hidden.' : 'On the surface: it moves faster, but can be seen.');
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
    this.reach = computeReach(this.game, u, { join: !u.fresh });   // a damaged friend of its own kind is a place to move to: Join
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
    this.animator.start(u.id, path, this.clock(), () => { this.#actMenu(); if (then) then(); });
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
    const partner = fresh ? null : joinPartner(game, sel, pos.x, pos.y);   // standing on a damaged friend of its own kind: the only order is to join it
    if (partner) {
      const max = game.registry.rules.maxHp;
      const total = Math.min(max, Math.round((sel.hp + partner.hp) * 10) / 10);
      hud.actions({
        hint: `Join the ${game.registry.unit(sel.type).name} here: ${sel.hp} + ${partner.hp} HP makes ${total}.`,
        items: [{ label: `Join (${total} HP)`, variant: 'primary', onClick: () => this.#commit({ type: 'join' }) }, this.#infoButton(), { label: 'Cancel', variant: 'ghost', onClick: () => this.cancelAll() }],
      });
      return;
    }
    const capture = !fresh && canCapture(game, sel, pos.x, pos.y);
    const heal = !fresh && canHealAt(game, sel, pos.x, pos.y);
    const healCost = heal ? healPlan(game, sel, pos.x, pos.y).reduce((a, p) => a + p.cost, 0) : 0;
    const supply = !fresh && canSupplyAt(game, sel, pos.x, pos.y);
    const supplyCost = supply ? supplyPlan(game, sel, pos.x, pos.y).reduce((a, p) => a + p.cost, 0) : 0;
    const lay = !fresh && !!layConfig(game, sel) && layTiles(game, sel, pos.x, pos.y).length > 0;
    const layLeft = lay ? ammoOf(game, sel) : 0;
    const pending = this.pendingTargetId !== null ? this.targets.find((e) => e.id === this.pendingTargetId) : null;
    const items = [];
    if (pending) items.push({ label: 'Attack', variant: 'danger', onClick: () => this.#commit({ type: 'attack', targetId: pending.id }) });
    if (capture) items.push({ label: 'Capture', variant: pending ? undefined : 'primary', onClick: () => this.#commit({ type: 'capture' }) });
    if (heal) items.push({ label: healCost ? `Heal ${healCost.toLocaleString('en-US')}` : 'Heal', variant: pending ? undefined : 'primary', onClick: () => this.#commit({ type: 'heal' }) });
    if (supply) items.push({ label: supplyCost ? `Supply ${supplyCost.toLocaleString('en-US')}` : 'Supply', variant: pending ? undefined : 'primary', onClick: () => this.#commit({ type: 'supply' }) });
    if (lay) items.push({ label: `Lay mine (${layLeft} left)`, variant: pending ? undefined : 'primary', disabled: layLeft < 1, onClick: () => this.#layMode() });
    if (!fresh) items.push(...this.#deployItem(sel, () => this.#deployAfterMove()));
    if (canSubmergeAt(game, sel, pos.x, pos.y)) items.push({ label: 'Submerge', onClick: () => this.#commit({ type: 'submerge' }) });
    if (canSurface(game, sel)) items.push({ label: 'Surface', onClick: () => this.#commit({ type: 'surface' }) });
    // Wait becomes Resupply when the unit is short on ammo and stops next to a property that resupplies it
    const resup = !fresh && canResupplyAt(game, sel, pos.x, pos.y);
    const price = resup ? resupplyCost(game, sel) : 0;
    items.push(resup ? { label: price ? `Resupply ${price.toLocaleString('en-US')}` : 'Resupply', variant: pending || capture || heal || supply ? undefined : 'primary', onClick: () => this.#commit({ type: 'resupply' }) }
      : { label: 'Wait', variant: pending || capture || heal || supply || lay ? undefined : 'primary', onClick: () => this.#commit({ type: 'wait' }) });
    items.push(this.#infoButton(), { label: 'Cancel', variant: 'ghost', onClick: () => this.cancelAll() });
    const name = game.registry.unit(pending ? pending.type : sel.type).name;
    hud.actions({
      hint: pending ? `Attack ${name}? Tap it again or press Attack.`
        : capture ? 'Capture this property, or pick another action.'
          : heal ? 'Heal the damaged units next to you, or pick another action.'
          : supply ? 'Resupply the friends next to you, or pick another action.'
          : lay ? 'Lay a mine, or pick another action.'
          : fresh ? 'Tap your unit to confirm the move.'
          : this.targets.length ? 'Tap an enemy to target it, or tap your unit to wait.'
            : 'Tap your unit to confirm the move.',
      items,
    });
  }

  /** The mine layer picks the tile for its mine: the free sea tiles in range are shown, and the next tap on one lays it. */
  #layMode() {
    const { game, sel } = this;
    const pos = this.#selPos();
    this.mode = 'lay';
    this.layTiles = layTiles(game, sel, pos.x, pos.y);
    this.attack = null;
    this.targets = [];
    this.pendingTargetId = null;
    this.hud.actions({
      hint: `Tap a highlighted sea tile to lay the ${game.registry.unit(layConfig(game, sel).unit).name}. Enemies only see it when they come next to it.`,
      items: [{ label: 'Back', variant: 'ghost', onClick: () => { this.layTiles = null; this.#actMenu(); } }, { label: 'Cancel', variant: 'ghost', onClick: () => this.cancelAll() }],
    });
  }

  #commit(action) {
    const { game, sel } = this;
    const res = game.act({ unitId: sel.id, to: this.#selPos(), action });
    if (!res.ok) { this.cancelAll(); this.#msg(`That order is not allowed (${res.error}).`); return; }
    if (res.interrupted) { this.#interrupted(res); return; }
    this.presenter.present(res.events, { now: this.clock(), animateMoves: false }); // move was already previewed
    const text = describeEvents(game, res.events);
    this.cancelAll();
    if (text) this.#msg(text);
    this.onEvents(res.events);
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
      now: this.clock(), animateMoves: true,
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

  /** A carrier that has already acted: show it, and offer Deploy if it still can. */
  #offerDeploy(x, y, u) {
    this.#show(x, y, u);
    this.hud.actions({
      hint: 'This unit has moved, but can still deploy.',
      items: [...this.#deployItem(u, () => this.#deployNow(u)), { label: 'Cancel', variant: 'ghost', onClick: () => this.cancelAll() }],
    });
  }

  /** Deploy from the order window after a previewed move: the move is made first (the carrier waits there), then the drop is chosen. */
  #deployAfterMove() {
    const { game, sel } = this;
    if (this.dest) {
      const res = game.act({ unitId: sel.id, to: this.dest, action: { type: 'wait' } });
      if (!res.ok) { this.cancelAll(); this.#msg(`That order is not allowed (${res.error}).`); return; }
      if (res.interrupted) { this.#interrupted(res); return; }
      this.presenter.present(res.events, { now: this.clock(), animateMoves: false });
      this.onEvents(res.events);
    }
    this.#deployNow(sel);
  }

  /** Put the carrier's unit on the carrier's tile and select it, like a freshly built unit (cancelling puts it back). */
  #deployNow(carrier) {
    const { game } = this;
    const res = game.deploy({ unitId: carrier.id });
    this.animator.arrow = null;
    this.reset();
    this.hud.clear();
    if (!res.ok) { this.#msg(`Cannot deploy (${res.error}).`); return; }
    this.presenter.present(res.events, { now: this.clock(), animateMoves: false });
    this.onEvents(res.events);
    const dropped = unitById(game, res.deployed.unitId);
    this.#select(dropped, `Deployed ${dropped ? game.registry.unit(dropped.type).name : 'unit'}. Move it out: it can attack. Cancel puts it back.`);
  }
}

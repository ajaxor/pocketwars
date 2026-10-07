// Game: the single entry point for changing game state. UI, AI and tests all go through these methods.
//
//   const game = new Game(registry, map);
//   game.act({ unitId, to: {x, y}, action: { type: 'wait' | 'capture' | 'heal' | 'supply' | 'lay' | 'attack' | 'submerge' | 'surface' | 'resupply', targetId, at } })
//   game.build(x, y, unitType)
//   game.setSubmerged({ unitId, submerged })   a submarine dives or surfaces for free before it moves
//   game.deploy({ unitId, to })        a carrier (transport copter) puts a unit down, apart from its own order
//   game.endTurn()
//   game.undo()
//
// Every mutating method returns { ok, error?, events }. `events` describe what happened (move, interrupt, detonate, dive, surface, strike,
// capture, heal, supply, lay, build, deploy, resupply, turnStart, eliminated, gameOver; endTurn may start with the 'strike' events of neutral
// turrets firing by themselves, marked `auto: true`) so the presentation layer can animate it without the engine
// knowing anything about drawing.
//
// BUILDING AND THE FREE MOVE. A unit is built on the property itself and is ready at once, but `fresh` (see state.js): its one order
// can only be a move followed by Wait or, for a submarine, Submerge ('just-built' otherwise), so it drives off the factory (swims off the
// shipyard, flies off the airfield) without attacking or capturing. A property builds one unit per turn (economy.js).
//
// RESUPPLY. A unit with ammo that is short, and ends an order next to a friendly property that resupplies it, can Resupply instead of
// Wait (the 'resupply' action; the UI offers it in place of Wait). It is refilled for a price (ammo.js) and its turn ends like any order.
// Without the funds nothing is refilled: the order is a Wait and a 'resupplyDenied' event says why.
//
// DEPLOYING. A carrier (transport copter) deploys like a factory builds: game.deploy puts the new unit on the carrier's tile, ready to be
// ordered with the normal move-and-act order; game.cancelDeploy puts it back in the carrier (deploy.js).
//
// INTERRUPTED MOVES. A player plans a move without knowing about hidden units (see detection.js), so the path can run into one.
// act() then stops the unit on the last free tile before it, reveals what it bumped into (an 'interrupt' event), and returns
// `{ ok: true, events, interrupted: { unitId, at, blocker } }`. The order's action is NOT carried out: the unit has used its move
// (`unit.halted`) but has not acted, and the caller must send a second order for it from where it stands (attack, wait, dive...).
// Its reach is only its own tile; a unit that got at least one tile cannot fire indirect weapons, like any unit that has moved.

import { canResupplyAt, resupply } from './ammo.js';
import { canHealAt, healPlan, healsAutomatically, resolveHeal } from './heal.js';
import { joinPartner, resolveJoin } from './join.js';
import { canCapture, resolveCapture } from './capture.js';
import { resolveAttack, canTarget, attackProblem } from './combat.js';
import { deployProblem, resolveDeploy, undoDeploy } from './deploy.js';
import { canSee, hiddenFrom, revealsWhenFiring } from './detection.js';
import { detonate, layProblem, passesOverMines, resolveLay, triggersMine } from './mines.js';
import { attacksPerTurn } from './combat.js';
import { canSupplyAt, resolveSupply } from './supply.js';
import { burnFuel } from './fuel.js';
import { buildUnit, startTurn } from './economy.js';
import { canFireAfterMoving, computeReach, hasMovedAlready } from './movement.js';
import { facingAlong, inBounds, snapshotUnit, unitAt, unitById } from './queries.js';
import { createState, restoreState, snapshotState } from './state.js';
import { canDive, canSubmergeAt, canSurface, divesByItself, submergibleAt, surfacesToFire } from './submerge.js';
import { evaluateVictory } from './victory.js';
import { isStructure, structureFire } from './structures.js';
import { explore, isFogged, revealsNew, visibleTiles } from './fog.js';

const fail = (error) => ({ ok: false, error, events: [] });

export class Game {
  constructor(registry, map) {
    this.registry = registry;
    this.map = map;
    this.state = createState(map, registry);
    this.undoSnapshot = null;
    this.revision = 0;   // bumped on every change (touch): what fog.js caches its sight on
    this.touch();
  }

  /**
   * Note that the state changed: drop cached sight (fog.js) and add what fogged players can now see to what they have seen. Every method below
   * calls it; code that edits `state` directly (tests, a campaign script) must call it too.
   */
  touch() {
    this.revision++;
    explore(this);
  }

  get currentPlayer() { return this.state.turn; }
  get isOver() { return this.state.winner !== null; }
  controllerOf(player) { return this.map.players[player].controller; }
  get canUndo() { return this.undoSnapshot !== null && !this.isOver; }

  /**
   * Check an order without applying it.
   * @returns {{ok:true, unit:object, reach:import('./movement.js').ReachMap, target?:object} | {ok:false, error:string}}
   */
  validateOrder(order) {
    const { state, map } = this;
    if (this.isOver) return fail('game-over');
    const unit = unitById(this, order.unitId);
    if (!unit) return fail('no-such-unit');
    if (unit.owner !== state.turn) return fail('not-your-turn');
    if (unit.done) return fail('unit-already-acted');
    if (isStructure(this, unit)) return fail('fires-by-itself');   // turrets take no orders: they fire when the turn ends (structureFire)
    const to = order.to;
    if (!to || !inBounds(map, to.x, to.y)) return fail('out-of-bounds');
    const reach = computeReach(this, unit, { join: true });
    if (!reach.has(to.x, to.y)) return fail('unreachable');
    const partner = (to.x !== unit.x || to.y !== unit.y) ? joinPartner(this, unit, to.x, to.y) : null;   // a damaged friend of the same kind standing there
    if (partner && order.action?.type !== 'join') return fail('tile-occupied');
    if (order.action?.type === 'join') {
      if (!partner || unit.fresh || unit.carriedBy) return fail('cannot-join');
      return { ok: true, unit, reach };
    }
    const moved = hasMovedAlready(unit) || to.x !== unit.x || to.y !== unit.y;
    const action = order.action || { type: 'wait' };
    if (unit.carriedBy && !moved) return fail('tile-occupied');   // a unit that was just deployed shares its carrier's tile and has to leave it
    if (unit.fresh && action.type !== 'wait' && action.type !== 'submerge') return fail('just-built');   // a freshly built unit only gets its free move (and may dive at the end of it)
    if (action.type === 'wait') return { ok: true, unit, reach };
    if (action.type === 'capture') {
      return canCapture(this, unit, to.x, to.y) ? { ok: true, unit, reach } : fail('cannot-capture');
    }
    if (action.type === 'submerge') {
      return canSubmergeAt(this, unit, to.x, to.y) ? { ok: true, unit, reach } : fail('cannot-submerge');
    }
    if (action.type === 'surface') {
      return canSurface(this, unit) ? { ok: true, unit, reach } : fail('cannot-surface');
    }
    if (action.type === 'heal') {
      return canHealAt(this, unit, to.x, to.y) ? { ok: true, unit, reach } : fail('cannot-heal');
    }
    if (action.type === 'resupply') {
      return canResupplyAt(this, unit, to.x, to.y) ? { ok: true, unit, reach } : fail('cannot-resupply');
    }
    if (action.type === 'supply') {
      return canSupplyAt(this, unit, to.x, to.y) ? { ok: true, unit, reach } : fail('cannot-supply');
    }
    if (action.type === 'lay') {
      const problem = layProblem(this, unit, to.x, to.y, action.at);
      return problem ? fail(problem) : { ok: true, unit, reach };
    }
    if (action.type === 'attack') {
      const target = unitById(this, action.targetId);
      if (!target || target.owner === unit.owner) return fail('invalid-target');
      if (!canSee(this, unit.owner, target)) return fail('invalid-target');   // what cannot be seen cannot be aimed at
      if (!canTarget(this, unit, target)) return fail('cannot-target');
      if (moved && !canFireAfterMoving(this, unit)) return fail('cannot-move-and-fire');
      const problem = attackProblem(this, unit, target, to.x, to.y);
      if (problem) return fail(problem);
      return { ok: true, unit, reach, target };
    }
    return fail('unknown-action');
  }

  /** Move a unit (optionally) and then wait, capture, attack, dive, surface or deploy. Ends that unit's turn, unless the move is interrupted. */
  act(order) {
    const v = this.validateOrder(order);
    if (!v.ok) return v;
    const { unit } = v;
    const events = [];
    const hiddenBefore = hiddenFrom(this, unit.owner);
    const sightBefore = isFogged(this, unit.owner) ? visibleTiles(this, unit.owner) : null;
    this.undoSnapshot = this.controllerOf(this.state.turn) === 'human' ? snapshotState(this.state) : null;
    const result = this.#act(order, v, events, hiddenBefore);
    this.touch();
    // In fog of war, an order that brings any tile into sight cannot be taken back either: undoing it would be free scouting.
    if (sightBefore && revealsNew(sightBefore, visibleTiles(this, unit.owner))) this.undoSnapshot = null;
    return result;
  }

  #act(order, { unit, reach, target }, events, hiddenBefore) {
    const { to } = order;
    const action = order.action || { type: 'wait' };

    if (to.x !== unit.x || to.y !== unit.y) {
      // Walk the path. A friend's tile can be crossed but not stopped on; an enemy on the way can only be a hidden one (the
      // planner did not know about it), and meeting it ends the move on the last tile the unit can stop on.
      const path = reach.pathTo(to.x, to.y);
      let last = 0;
      let blocker = null;
      for (let i = 1; i < path.length && !blocker; i++) {
        const there = unitAt(this, path[i][0], path[i][1]);
        if (there && there !== unit && there.owner !== unit.owner) {
          if (passesOverMines(this, unit, there) && i < path.length - 1) continue;   // flies or floats over a mine; it just cannot stop on it
          blocker = there;
        } else if (!there || (action.type === 'join' && i === path.length - 1)) last = i;   // a join ends on its partner's tile
      }
      if (last > 0) {
        unit.moved = true;   // read (and cleared) by heal.js at the start of its owner's next turn: a unit that stayed put can rest
        unit.x = path[last][0];
        unit.y = path[last][1];
        unit.capture = 0; // leaving a tile abandons capture progress
        unit.facing = facingAlong(path.slice(0, last + 1), unit.facing);   // faces the way it last moved sideways
        events.push({ type: 'move', unitId: unit.id, path: path.slice(0, last + 1) });
        this.touch();   // it stands somewhere else now: what it sees has changed
      }
      if (unit.submerged && canDive(this, unit) && !submergibleAt(this, unit.x, unit.y)) {   // a submarine that ends its move outside deep water comes up
        unit.submerged = false;
        events.push({ type: 'surface', unit: snapshotUnit(unit), forced: true });
      }
      if (divesByItself(this, unit) && !unit.submerged && submergibleAt(this, unit.x, unit.y)) {   // a diver goes under as soon as it is on deep water
        unit.submerged = true;
        events.push({ type: 'dive', unit: snapshotUnit(unit) });
      }
      if (blocker) {
        unit.halted = { moved: last > 0 };
        events.push({ type: 'interrupt', unitId: unit.id, at: { x: unit.x, y: unit.y }, blocker: snapshotUnit(blocker) });
        this.undoSnapshot = null; // the unit found something out: taking the move back would be free scouting
        if (triggersMine(this, unit, blocker)) {   // a mine: it goes off and the rest of the move is cancelled
          const boom = detonate(this, blocker, unit);
          events.push(boom);
          if (boom.destroyed) { events.push(...evaluateVictory(this)); return { ok: true, events }; }
        }
        return { ok: true, events, interrupted: { unitId: unit.id, at: { x: unit.x, y: unit.y }, blocker: snapshotUnit(blocker) } };
      }
    }
    if (action.type === 'join') events.push(...resolveJoin(this, unit, joinPartner(this, unit, unit.x, unit.y)));
    else if (action.type === 'capture') events.push(...resolveCapture(this, unit));
    else if (action.type === 'heal') events.push(...resolveHeal(this, unit));
    else if (action.type === 'supply') events.push(...resolveSupply(this, unit));
    else if (action.type === 'lay') events.push(...resolveLay(this, unit, action.at));
    else if (action.type === 'attack') {
      events.push(...resolveAttack(this, unit, target));
      if (revealsWhenFiring(this, unit)) unit.revealed = true;   // muzzle flash: visible until its owner's next turn starts
      if (unit.submerged && surfacesToFire(this, unit) && unitById(this, unit.id)) {   // firing gives the missile sub away: it comes up
        unit.submerged = false;
        events.push({ type: 'surface', unit: snapshotUnit(unit), forced: true });
      }
    }
    else if (action.type === 'submerge') { unit.submerged = true; events.push({ type: 'dive', unit: snapshotUnit(unit) }); }
    else if (action.type === 'surface') { unit.submerged = false; events.push({ type: 'surface', unit: snapshotUnit(unit), forced: false }); }
    if (action.type === 'attack' && unitById(this, unit.id) && (unit.attacks ?? 0) + 1 < attacksPerTurn(this, unit)) {
      unit.attacks = (unit.attacks ?? 0) + 1;   // it has another attack left: it stays where it is, its turn not over
      unit.halted = { moved: !!unit.moved };
    } else {
      unit.done = true;
      unit.halted = null;
    }
    delete unit.fresh;
    delete unit.carriedBy;   // a deployed unit has now been ordered: it cannot be put back
    if (unitById(this, unit.id) && healsAutomatically(this, unit) && healPlan(this, unit).length) events.push(...resolveHeal(this, unit));   // the medic: free, after every order
    if (action.type === 'resupply') {
      const filled = resupply(this, unit);   // paid for from the owner's funds; without enough it is only a Wait
      if (filled) events.push(filled);
    }
    events.push(...evaluateVictory(this));
    // An order that shows the player a hidden unit (by moving next to it, say) cannot be taken back either.
    if (hiddenBefore.some((id) => { const e = unitById(this, id); return e && canSee(this, unit.owner, e); })) this.undoSnapshot = null;
    return { ok: true, events };
  }

  /**
   * A submarine that has not moved or acted yet goes down or comes up for free, before its order (the order itself then moves it, slowly
   * under water or quickly on the surface). `submerged` true dives, false surfaces. Returns { ok, events }.
   */
  setSubmerged({ unitId, submerged }) {
    if (this.isOver) return fail('game-over');
    const unit = unitById(this, unitId);
    if (!unit) return fail('no-such-unit');
    if (unit.owner !== this.state.turn) return fail('not-your-turn');
    if (unit.done) return fail('unit-already-acted');
    if (unit.halted) return fail('unit-already-moved');
    if (submerged ? !canSubmergeAt(this, unit) : !canSurface(this, unit)) return fail(submerged ? 'cannot-submerge' : 'cannot-surface');
    this.undoSnapshot = this.controllerOf(this.state.turn) === 'human' ? snapshotState(this.state) : null;
    unit.submerged = submerged;
    this.touch();
    return { ok: true, events: [{ type: submerged ? 'dive' : 'surface', unit: snapshotUnit(unit), forced: false }] };
  }

  /**
   * `unitId` (a carrier such as the transport copter) deploys a new unit: it appears on the carrier's tile, ready for an ordinary
   * move-and-act order, exactly like a unit built on a factory (but it may attack). See deploy.js. Returns { ok, events, deployed: { unitId } }.
   */
  deploy({ unitId }) {
    if (this.isOver) return fail('game-over');
    const carrier = unitById(this, unitId);
    if (!carrier) return fail('no-such-unit');
    if (carrier.owner !== this.state.turn) return fail('not-your-turn');
    const problem = deployProblem(this, carrier);
    if (problem) return fail(problem);
    this.undoSnapshot = null;   // the ammo is spent
    const events = resolveDeploy(this, carrier);
    this.touch();
    return { ok: true, events, deployed: { unitId: events[0].dropped.id } };
  }

  /** Take a just-deployed unit that has not been ordered yet back into its carrier (the ammo and the turn's deploy are returned). */
  cancelDeploy({ unitId }) {
    const unit = unitById(this, unitId);
    if (!unit) return fail('no-such-unit');
    const events = undoDeploy(this, unit);
    if (events) this.touch();
    return events ? { ok: true, events } : fail('cannot-cancel-deploy');
  }

  /** Current player builds `unitType` on the property at (x, y): it appears there with a free move (see above). */
  build(x, y, unitType) {
    if (this.isOver) return fail('game-over');
    const result = buildUnit(this, this.state.turn, x, y, unitType);
    if (result.ok) { this.undoSnapshot = null; this.touch(); } // spending funds can't be undone
    return result;
  }

  /**
   * Pass play to the next player who has not been defeated; that player collects income and repairs.
   * A player who turns out to be defeated the moment their turn would begin is skipped straight away.
   */
  endTurn() {
    if (this.isOver) return fail('game-over');
    const { state, map } = this;
    this.undoSnapshot = null;
    const events = structureFire(this, state.turn);   // the player's turrets fire by themselves, then neutral ones fire at the player's units (structures.js)
    this.touch();
    if (events.length) { events.push(...evaluateVictory(this)); if (this.isOver) { this.touch(); return { ok: true, events }; } }
    burnFuel(this, state.turn);   // every flyer burns a turn of fuel, flown or not
    for (let tries = 0; tries < map.players.length; tries++) {
      let next = state.turn;
      do {
        next = (next + 1) % map.players.length;
        if (next === 0) state.day++;
      } while (state.defeated[next] && next !== state.turn);
      state.turn = next;
      events.push(...startTurn(this, next));
      events.push(...evaluateVictory(this));
      if (this.isOver || !state.defeated[next]) break;
    }
    this.touch();
    return { ok: true, events };
  }

  // UNDO (single level): a snapshot is taken just before each human order and cleared on build / end of turn.
  // HIDDEN UNITS: a move could show the player something they did not know (it bumps into a hidden submarine, or ends next to one),
  // and undoing it would make that free scouting. So an order that reveals a hidden unit, or is interrupted by one, clears the
  // snapshot (see act) and the Undo button goes dark. A move that finds nothing can still be taken back. In fog of war (fog.js) the same
  // goes for any order that brings a tile into sight that was out of sight before.
  undo() {
    if (!this.canUndo) return false;
    restoreState(this.state, this.undoSnapshot);
    this.undoSnapshot = null;
    this.touch();
    return true;
  }
}

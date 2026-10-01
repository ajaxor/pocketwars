// Game: the single entry point for changing game state. UI, AI and tests all go through these methods.
//
//   const game = new Game(registry, map);
//   game.act({ unitId, to: {x, y}, action: { type: 'wait' | 'capture' | 'attack' | 'submerge' | 'surface', targetId } })
//   game.build(x, y, unitType)
//   game.endTurn()
//   game.undo()
//
// Every mutating method returns { ok, error?, events }. `events` describe what happened (move, interrupt, dive, surface, strike,
// capture, build, turnStart, eliminated, gameOver) so the presentation layer can animate it without the engine
// knowing anything about drawing.
//
// INTERRUPTED MOVES. A player plans a move without knowing about hidden units (see detection.js), so the path can run into one.
// act() then stops the unit on the last free tile before it, reveals what it bumped into (an 'interrupt' event), and returns
// `{ ok: true, events, interrupted: { unitId, at, blocker } }`. The order's action is NOT carried out: the unit has used its move
// (`unit.halted`) but has not acted, and the caller must send a second order for it from where it stands (attack, wait, dive...).
// Its reach is only its own tile; a unit that got at least one tile cannot fire indirect weapons, like any unit that has moved.

import { canCapture, resolveCapture } from './capture.js';
import { resolveAttack, canTarget, attackProblem } from './combat.js';
import { canSee, hiddenFrom } from './detection.js';
import { buildUnit, startTurn } from './economy.js';
import { canFireAfterMoving, computeReach, hasMovedAlready } from './movement.js';
import { facingAlong, inBounds, snapshotUnit, unitAt, unitById } from './queries.js';
import { createState, restoreState, snapshotState } from './state.js';
import { canSubmergeAt, canSurface, submergibleAt } from './submerge.js';
import { evaluateVictory } from './victory.js';

const fail = (error) => ({ ok: false, error, events: [] });

export class Game {
  constructor(registry, map) {
    this.registry = registry;
    this.map = map;
    this.state = createState(map, registry);
    this.undoSnapshot = null;
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
    const to = order.to;
    if (!to || !inBounds(map, to.x, to.y)) return fail('out-of-bounds');
    const reach = computeReach(this, unit);
    if (!reach.has(to.x, to.y)) return fail('unreachable');
    const moved = hasMovedAlready(unit) || to.x !== unit.x || to.y !== unit.y;
    const action = order.action || { type: 'wait' };
    if (action.type === 'wait') return { ok: true, unit, reach };
    if (action.type === 'capture') {
      return canCapture(this, unit, to.x, to.y) ? { ok: true, unit, reach } : fail('cannot-capture');
    }
    if (action.type === 'submerge') {
      return canSubmergeAt(this, unit, to.x, to.y) ? { ok: true, unit, reach } : fail('cannot-submerge');
    }
    if (action.type === 'surface') {
      return canSurface(unit) ? { ok: true, unit, reach } : fail('cannot-surface');
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

  /** Move a unit (optionally) and then wait, capture, attack, dive or surface. Ends that unit's turn, unless the move is interrupted. */
  act(order) {
    const v = this.validateOrder(order);
    if (!v.ok) return v;
    const { unit, reach, target } = v;
    const { to } = order;
    const action = order.action || { type: 'wait' };
    const events = [];
    const hiddenBefore = hiddenFrom(this, unit.owner);
    this.undoSnapshot = this.controllerOf(this.state.turn) === 'human' ? snapshotState(this.state) : null;

    if (to.x !== unit.x || to.y !== unit.y) {
      // Walk the path. A friend's tile can be crossed but not stopped on; an enemy on the way can only be a hidden one (the
      // planner did not know about it), and meeting it ends the move on the last tile the unit can stop on.
      const path = reach.pathTo(to.x, to.y);
      let last = 0;
      let blocker = null;
      for (let i = 1; i < path.length && !blocker; i++) {
        const there = unitAt(this, path[i][0], path[i][1]);
        if (there && there !== unit && there.owner !== unit.owner) blocker = there;
        else if (!there) last = i;
      }
      if (last > 0) {
        unit.x = path[last][0];
        unit.y = path[last][1];
        unit.capture = 0; // leaving a tile abandons capture progress
        unit.facing = facingAlong(path.slice(0, last + 1), unit.facing);   // faces the way it last moved sideways
        events.push({ type: 'move', unitId: unit.id, path: path.slice(0, last + 1) });
      }
      if (unit.submerged && !submergibleAt(this, unit.x, unit.y)) {   // a submarine that ends its move outside deep water comes up
        unit.submerged = false;
        events.push({ type: 'surface', unit: snapshotUnit(unit), forced: true });
      }
      if (blocker) {
        unit.halted = { moved: last > 0 };
        events.push({ type: 'interrupt', unitId: unit.id, at: { x: unit.x, y: unit.y }, blocker: snapshotUnit(blocker) });
        this.undoSnapshot = null; // the unit found something out: taking the move back would be free scouting
        return { ok: true, events, interrupted: { unitId: unit.id, at: { x: unit.x, y: unit.y }, blocker: snapshotUnit(blocker) } };
      }
    }
    if (action.type === 'capture') events.push(...resolveCapture(this, unit));
    else if (action.type === 'attack') events.push(...resolveAttack(this, unit, target));
    else if (action.type === 'submerge') { unit.submerged = true; events.push({ type: 'dive', unit: snapshotUnit(unit) }); }
    else if (action.type === 'surface') { unit.submerged = false; events.push({ type: 'surface', unit: snapshotUnit(unit), forced: false }); }
    unit.done = true;
    unit.halted = null;
    events.push(...evaluateVictory(this));
    // An order that shows the player a hidden unit (by moving next to it, say) cannot be taken back either.
    if (hiddenBefore.some((id) => { const e = unitById(this, id); return e && canSee(this, unit.owner, e); })) this.undoSnapshot = null;
    return { ok: true, events };
  }

  /** Current player builds `unitType` on the property at (x, y); `at` picks the deploy tile when the property offers several (see economy.js deployTiles). */
  build(x, y, unitType, at = null) {
    if (this.isOver) return fail('game-over');
    const result = buildUnit(this, this.state.turn, x, y, unitType, at);
    if (result.ok) this.undoSnapshot = null; // spending funds can't be undone
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
    const events = [];
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
    return { ok: true, events };
  }

  // UNDO (single level): a snapshot is taken just before each human order and cleared on build / end of turn.
  // HIDDEN UNITS: a move could show the player something they did not know (it bumps into a hidden submarine, or ends next to one),
  // and undoing it would make that free scouting. So an order that reveals a hidden unit, or is interrupted by one, clears the
  // snapshot (see act) and the Undo button goes dark. A move that finds nothing can still be taken back. If real fog of war is ever
  // added (units hidden just for being far away), undo has to go entirely.
  undo() {
    if (!this.canUndo) return false;
    restoreState(this.state, this.undoSnapshot);
    this.undoSnapshot = null;
    return true;
  }
}

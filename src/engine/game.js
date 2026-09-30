// Game: the single entry point for changing game state. UI, AI and tests all go through these methods.
//
//   const game = new Game(registry, map);
//   game.act({ unitId, to: {x, y}, action: { type: 'wait' | 'capture' | 'attack', targetId } })
//   game.build(x, y, unitType)
//   game.endTurn()
//   game.undo()
//
// Every mutating method returns { ok, error?, events }. `events` describe what happened (move, strike,
// capture, build, turnStart, gameOver) so the presentation layer can animate it without the engine
// knowing anything about drawing.

import { canCapture, resolveCapture } from './capture.js';
import { resolveAttack, canTarget, attackProblem } from './combat.js';
import { buildUnit, startTurn } from './economy.js';
import { canFireAfterMoving, computeReach } from './movement.js';
import { inBounds, unitById } from './queries.js';
import { createState, restoreState, snapshotState } from './state.js';
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
    const moved = to.x !== unit.x || to.y !== unit.y;
    const action = order.action || { type: 'wait' };
    if (action.type === 'wait') return { ok: true, unit, reach };
    if (action.type === 'capture') {
      return canCapture(this, unit, to.x, to.y) ? { ok: true, unit, reach } : fail('cannot-capture');
    }
    if (action.type === 'attack') {
      const target = unitById(this, action.targetId);
      if (!target || target.owner === unit.owner) return fail('invalid-target');
      if (!canTarget(this, unit, target)) return fail('cannot-target');
      if (moved && !canFireAfterMoving(this, unit)) return fail('cannot-move-and-fire');
      const problem = attackProblem(this, unit, target, to.x, to.y);
      if (problem) return fail(problem);
      return { ok: true, unit, reach, target };
    }
    return fail('unknown-action');
  }

  /** Move a unit (optionally) and then wait, capture or attack. Ends that unit's turn. */
  act(order) {
    const v = this.validateOrder(order);
    if (!v.ok) return v;
    const { unit, reach, target } = v;
    const { to } = order;
    const action = order.action || { type: 'wait' };
    const events = [];
    this.undoSnapshot = this.controllerOf(this.state.turn) === 'human' ? snapshotState(this.state) : null;

    if (to.x !== unit.x || to.y !== unit.y) {
      const path = reach.pathTo(to.x, to.y);
      unit.x = to.x;
      unit.y = to.y;
      unit.capture = 0; // leaving a tile abandons capture progress
      events.push({ type: 'move', unitId: unit.id, path });
    }
    if (action.type === 'capture') events.push(...resolveCapture(this, unit));
    else if (action.type === 'attack') events.push(...resolveAttack(this, unit, target));
    unit.done = true;
    events.push(...evaluateVictory(this));
    return { ok: true, events };
  }

  /** Current player builds `unitType` on the property at (x, y). */
  build(x, y, unitType) {
    if (this.isOver) return fail('game-over');
    const result = buildUnit(this, this.state.turn, x, y, unitType);
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
  // !! FOG OF WAR: undo MUST be disabled if fog of war is ever added - moving would reveal hidden enemies
  // and undoing would give free scouting.
  undo() {
    if (!this.canUndo) return false;
    restoreState(this.state, this.undoSnapshot);
    this.undoSnapshot = null;
    return true;
  }
}

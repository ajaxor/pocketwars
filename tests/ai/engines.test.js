// AI engines side by side: the registry, the step runner, and that every engine plays legal turns.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, makeData } from '../helpers/fixtures.js';
import { createRegistry } from '../../src/data/registry.js';
import { validateData } from '../../src/data/validate.js';
import { ENGINES, engineIds, setupFor } from '../../src/ai/engines.js';
import { applyStep, memoryOf, playTurn, rngFor, startTurn } from '../../src/ai/runner.js';

const duel = (opts = {}) => makeGame({
  units: { grunt: { attributes: { capture: true } }, tank: { cost: 5000, hits: 70 } },
  rows: ['H.c..c.h', 'a......b'],
  unitsOnMap: [['grunt', 0, 1, 0], ['tank', 0, 1, 1], ['grunt', 1, 6, 0], ['tank', 1, 6, 1]],
  ...opts,
});

test('both engines are registered with the same interface', () => {
  assert.deepEqual(engineIds, ['greedy', 'strategist']);
  for (const e of Object.values(ENGINES)) {
    assert.equal(typeof e.turn, 'function', e.id);
    assert.equal(typeof e.name, 'string');
    assert.equal(typeof e.validateProfile, 'function');
  }
});

test('setupFor: the data\'s default engine, unless the game says otherwise for that player', () => {
  const g = duel();
  assert.equal(setupFor(g, 0).engine.id, 'greedy', 'the fixture data defaults to greedy');
  g.aiSetup = [{ engine: 'strategist' }, null];
  assert.equal(setupFor(g, 0).engine.id, 'strategist');
  assert.equal(setupFor(g, 1).engine.id, 'greedy');
  g.aiSetup = [{ engine: 'oracle' }];
  assert.throws(() => setupFor(g, 0), /Unknown AI engine "oracle"/);
});

test('every engine plays whole turns of legal orders, through the same runner', () => {
  for (const id of engineIds) {
    const g = duel();
    g.aiSetup = [{ engine: id }, { engine: id }];
    for (let t = 0; t < 12 && !g.isOver; t++) { playTurn(g); if (!g.isOver) g.endTurn(); }   // applyStep throws on an invalid order
    assert.ok(g.state.day > 1 || g.isOver, id);
  }
});

test('the runner hands out steps one at a time and reads the game afresh between them', () => {
  const g = duel();
  g.aiSetup = [{ engine: 'strategist' }, { engine: 'strategist' }];
  const turn = startTurn(g);
  let steps = 0;
  let result;
  for (let step = turn.next(); step; step = turn.next(result)) {
    assert.ok(['order', 'surface', 'deploy', 'build'].includes(step.type));
    result = applyStep(g, step);
    steps++;
  }
  assert.ok(steps >= 2);
  assert.equal(turn.next(), null, 'finished turns stay finished');
});

test('an engine\'s memory is plain data in the state, made only when used; its random numbers continue across turns', () => {
  const g = duel();
  playTurn(g);   // greedy: no memory
  assert.equal(g.state.ai, undefined);
  const s = duel();
  s.aiSeed = 42;
  s.aiSetup = [{ engine: 'strategist' }, { engine: 'strategist' }];
  playTurn(s);
  assert.equal(typeof s.state.ai[0].strategy.id, 'string', 'the strategist remembers its plan');
  const mem = memoryOf(s, 0);
  const a = rngFor(s, 0, mem)();
  const b = rngFor(s, 0, mem)();
  assert.notEqual(a, b, 'the stream continues from where it was');
  const again = duel();
  again.aiSeed = 42;
  again.aiSetup = s.aiSetup;
  playTurn(again);
  assert.deepEqual(again.state.ai[0].strategy, s.state.ai[0].strategy, 'the same seed makes the same choices');
});

test('ai.json: the default must be a known engine, every profile must belong to one and pass its checks', () => {
  const problems = (mutate) => { const d = makeData(); mutate(d); return validateData(d); };
  assert.deepEqual(problems(() => {}), []);
  assert.ok(problems((d) => { d.ai.default = 'oracle'; }).some((p) => /default must name an engine/.test(p)));
  assert.ok(problems((d) => { d.ai.engines.oracle = {}; }).some((p) => /engines.oracle: no such engine/.test(p)));
  assert.ok(problems((d) => { d.ai.engines.strategist = { params: { distance: 'far' } }; }).some((p) => /params.distance must be a number/.test(p)));
  assert.ok(problems((d) => { d.ai.engines.strategist = { params: { teleport: 1 } }; }).some((p) => /params.teleport: unknown parameter/.test(p)));
  assert.ok(problems((d) => { d.ai.engines.strategist = { unitBias: { tank: 1 } }; }).some((p) => /unitBias no longer exists/.test(p)));
  const withStrategies = (mutate) => problems((d) => { d['ai-strategies'] = { strategies: [{ id: 'rush', name: 'Rush' }] }; mutate(d); });
  assert.ok(withStrategies((d) => { d.ai.engines.strategist = { strategyWeight: { siege: 2 } }; }).some((p) => /strategyWeight.siege: unknown strategy/.test(p)));
  assert.deepEqual(withStrategies((d) => { d.ai.engines.strategist = { strategyWeight: { rush: 2 } }; }), []);
  assert.deepEqual(problems((d) => { d.ai.engines.strategist = { strategyWeight: { siege: 2 } }; }), [], 'without the strategy file the names are not checked');
  assert.ok(createRegistry(makeData()).ai.engines.greedy);
});

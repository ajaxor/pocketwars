// deploy.basic: a transport carries its leader's basic infantry (loadouts.json -> infantry), the attribute's `unit` when the leader names none.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame } from '../helpers/fixtures.js';

const units = {
  carrier: { category: 'air', moveClass: 'air', attributes: { ammo: { max: 2, low: 1 }, deploy: { unit: 'rookie', basic: true } } },
  rookie: { attributes: { capture: true } }, elite: { attributes: { capture: true } }, grunt: {},
};
const loadouts = { default: { build: {}, start: {} , infantry: 'rookie' }, leaders: { zed: { infantry: 'elite' } } };
const players = (leader) => [{ faction: 'red', controller: 'human', funds: 5000, ...(leader && { leader }) }, { faction: 'blue', controller: 'human', funds: 5000 }];
const drop = (leader) => {
  const g = makeGame({ units, loadouts, players: players(leader), rows: ['H....h'], unitsOnMap: [['carrier', 0, 1, 0], ['grunt', 1, 5, 0]] });
  const res = g.deploy({ unitId: g.state.units[0].id });
  assert.equal(res.ok, true);
  return res.events[0].dropped.type;
};

test('deploy.basic: the leader\'s own infantry is dropped, else the default kit\'s, else the attribute\'s unit', () => {
  assert.equal(drop('zed'), 'elite');
  assert.equal(drop(null), 'rookie');
});

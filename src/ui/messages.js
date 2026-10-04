// Turns engine events into the one-line status messages shown under the board.

import { factionOf } from '../engine/queries.js';

export function describeEvents(game, events) {
  const { registry } = game;
  const name = (u) => registry.unit(u.type).name;
  let text = null;
  for (const ev of events) {
    if (ev.type === 'strike' && !ev.counter) {
      text = `${name(ev.attacker)} hits ${name(ev.defender)} -${ev.damage}` + (ev.destroyed ? ' - destroyed!' : '');
    } else if (ev.type === 'strike' && ev.counter) {
      text += `, counter -${ev.damage}` + (ev.destroyed ? ' (attacker lost)' : '');
    } else if (ev.type === 'interrupt') {
      text = `Movement interrupted: hidden ${name(ev.blocker)}!`;
    } else if (ev.type === 'dive') {
      text = `${name(ev.unit)} submerges`;
    } else if (ev.type === 'surface') {
      text = ev.forced ? `${name(ev.unit)} is forced to surface` : `${name(ev.unit)} surfaces`;
    } else if (ev.type === 'capture') {
      text = ev.completed ? 'Captured!' : `Capturing ${ev.progress}/${ev.needed}`;
    } else if (ev.type === 'build') {
      text = 'Built ' + name(ev.unit);
    } else if (ev.type === 'deploy') {
      text = `${name(ev.unit)} drops a ${name(ev.dropped)} (${ev.ammo} left)`;
    } else if (ev.type === 'resupply') {
      text = `${name(ev.unit)} resupplied` + (ev.cost ? ` for ${ev.cost.toLocaleString('en-US')}` : '');
    } else if (ev.type === 'resupplyDenied') {
      text = 'Not enough credits';
    } else if (ev.type === 'detonate') {
      text = `${name(ev.mine)} explodes! ${name(ev.unit)} -${ev.damage}` + (ev.destroyed ? ' - destroyed!' : ', its move is cancelled');
    } else if (ev.type === 'supply') {
      const n = ev.supplied.length, cost = ev.supplied.reduce((a, s) => a + s.cost, 0);
      text = `${name(ev.unit)} supplies ${n} unit${n === 1 ? '' : 's'}` + (cost ? ` for ${cost.toLocaleString('en-US')}` : '');
    } else if (ev.type === 'lay') {
      text = `${name(ev.unit)} lays a mine`;
    } else if (ev.type === 'heal') {
      const n = ev.healed.length, cost = ev.healed.reduce((a, h) => a + h.cost, 0);
      text = `${name(ev.unit)} heals ${n} unit${n === 1 ? '' : 's'}` + (cost ? ` for ${cost.toLocaleString('en-US')}` : '');
    } else if (ev.type === 'turnStart' && ev.healed?.length) {
      text = `${ev.healed.length} unit${ev.healed.length === 1 ? '' : 's'} healed`;
    } else if (ev.type === 'eliminated') {
      text = `${factionOf(game, ev.player).name} is out of the game!`;
    } else if (ev.type === 'gameOver') {
      text = ev.winner === 'draw' ? 'Draw!' : `${factionOf(game, ev.winner).name} wins!`;
    }
  }
  return text;
}

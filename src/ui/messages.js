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
      text = `${name(ev.unit)} resupplied` + (ev.refreshed ? ' - ready to move again' : '');
    } else if (ev.type === 'eliminated') {
      text = `${factionOf(game, ev.player).name} is out of the game!`;
    } else if (ev.type === 'gameOver') {
      text = ev.winner === 'draw' ? 'Draw!' : `${factionOf(game, ev.winner).name} wins!`;
    }
  }
  return text;
}

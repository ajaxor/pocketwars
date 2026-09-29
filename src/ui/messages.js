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
    } else if (ev.type === 'capture') {
      text = ev.completed ? 'Captured!' : `Capturing ${ev.progress}/${ev.needed}`;
    } else if (ev.type === 'build') {
      text = 'Built ' + name(ev.unit);
    } else if (ev.type === 'gameOver') {
      text = ev.winner === 'draw' ? 'Draw!' : `${factionOf(game, ev.winner).name} wins!`;
    }
  }
  return text;
}

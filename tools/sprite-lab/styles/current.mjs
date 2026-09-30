// Style A — the game's existing sprites (src/render/unit-sprites.js), wrapped so they can be compared like-for-like.
import { pathToFileURL } from 'node:url';
import { units, REPO } from '../lib.mjs';
const { drawUnit } = await import(pathToFileURL(`${REPO}/src/render/unit-sprites.js`).href);

export const meta = { id: 'current', name: 'Current (flat)', blurb: 'the game today: flat shapes, no outlines' };

export function draw(g, id, o) {
  const { s, c, dk, w = 0 } = o;
  drawUnit(g, { type: id, x: 0, y: 0, hp: 10 }, { def: units[id], colors: { color: c, dark: dk }, px: -s / 2, py: -s / 2, size: s, now: w, animate: true, moving: false, alpha: 1, showHp: false });
}

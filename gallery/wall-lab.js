// The wall builder: a small map where tapping a tile cycles wall -> cracked wall -> destroyed wall -> empty, and every wall links to the walls beside it.
// A pure model (fortLayout, cycle) plus the DOM and canvas part. The drawing is drawWall in structure-art.js.
import { drawWall, wallLinks } from './structure-art.js';

export const COLS = 11, ROWS = 7;
const NEXT = { undefined: 'wall', wall: 'cracked', cracked: 'broken', broken: undefined };
/** Tapping a tile: nothing -> wall -> cracked wall -> destroyed wall (two jagged halves) -> nothing. */
export const cycle = (kind) => NEXT[kind];

/** The starting base: a ring of walls with a gate gap at the bottom, a few cracked sections, and the HQ and a factory inside. Cells are "x,y". */
export function fortLayout() {
  const m = new Map();
  for (let x = 1; x <= 9; x++) for (const y of [1, 5]) m.set(`${x},${y}`, 'wall');
  for (let y = 1; y <= 5; y++) for (const x of [1, 9]) m.set(`${x},${y}`, 'wall');
  m.delete('5,5');                                         // the gate
  for (const k of ['3,1', '7,5', '9,3']) m.set(k, 'cracked');
  m.set('1,3', 'broken');                                  // one already destroyed
  return m;
}
/** Fixed buildings inside the fort: { 'x,y': building id }. */
export const FORT_BUILDINGS = { '3,3': 'factory', '5,3': 'hq', '7,3': 'barracks' };

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

export function createWallLab(ctx, root) {
  const section = el('section', 'wall-lab');
  const head = el('div', 'wl-head');
  head.append(el('h3', null, 'Wall builder'), el('p', 'legend', 'Tap a tile to place a wall, again for a cracked wall (breakable), again for a destroyed wall (rubble with a gap), again to clear it. Walls link to their neighbours.'));
  const canvas = el('canvas', 'wl-canvas'); canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'A small base ringed by linked walls');
  const btns = el('div', 'chips');
  const mk = (label, fn) => { const b = el('button', 'chip', label); b.type = 'button'; b.addEventListener('click', fn); btns.append(b); };
  section.append(head, canvas, btns);
  root.prepend(section);

  let walls = fortLayout();
  const faction = () => ctx.factions[0];
  const TILE = () => Math.max(28, Math.min(52, Math.floor((Math.min(root.clientWidth || 360, 560) - 8) / COLS)));
  function draw() {
    const S = TILE(), dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(COLS * S * dpr); canvas.height = Math.round(ROWS * S * dpr);
    canvas.style.width = COLS * S + 'px'; canvas.style.height = ROWS * S + 'px';
    const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = ctx.terrain.plain; g.fillRect(0, 0, COLS * S, ROWS * S);
    const road = ctx.terrain.road; g.fillStyle = road; g.fillRect(5 * S, 5 * S, S, 2 * S);               // a road out of the gate
    const f = faction(), isWall = (x, y) => walls.has(`${x},${y}`);
    for (const [k, id] of Object.entries(FORT_BUILDINGS)) { const [x, y] = k.split(',').map(Number); ctx.buildings.game[id]?.(g, x * S, y * S, S, f.color); }
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const kind = walls.get(`${x},${y}`);
      if (kind) drawWall(g, x * S, y * S, S, f.color, { links: wallLinks(isWall, x, y), cracked: kind === 'cracked', broken: kind === 'broken' });
    }
  }
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect(), S = r.width / COLS;
    const x = Math.floor((e.clientX - r.left) / S), y = Math.floor((e.clientY - r.top) / S), k = `${x},${y}`;
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS || FORT_BUILDINGS[k]) return;
    const next = cycle(walls.get(k)); if (next) walls.set(k, next); else walls.delete(k);
    draw();
  });
  mk('Reset base', () => { walls = fortLayout(); draw(); });
  mk('Clear', () => { walls = new Map(); draw(); });
  mk('All cracked', () => { for (const k of walls.keys()) walls.set(k, 'cracked'); draw(); });
  addEventListener('resize', draw);
  return { el: section, draw, set hidden(v) { section.hidden = v; if (!v) draw(); } };
}

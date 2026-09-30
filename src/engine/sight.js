// Line of sight for direct fire. A shot is a straight line on the grid between two tiles. Terrain tiles with the
// `blocksLineOfSight` attribute (forest, mountain, buildings) are obstacles, each with a height; the firer's own tile may have
// a `vantage` that lets it shoot over lower obstacles (a unit on a mountain sees over forests, but not over other mountains or
// buildings). The two end tiles never block, and units never block. Indirect fire does not use any of this.

import { attributeConfig } from './attributes.js';
import { terrainAt } from './queries.js';

/**
 * The tiles strictly between two tiles along a straight grid line (Bresenham). The line is walked from the same end whichever
 * way round the arguments are given, so A to B and B to A always cross the same tiles.
 */
export function tilesBetween(a, b) {
  const [p, q] = a.y < b.y || (a.y === b.y && a.x <= b.x) ? [a, b] : [b, a];
  const dx = Math.abs(q.x - p.x);
  const dy = Math.abs(q.y - p.y);
  const sx = p.x < q.x ? 1 : -1;
  const sy = p.y < q.y ? 1 : -1;
  const out = [];
  let x = p.x;
  let y = p.y;
  let err = dx - dy;
  for (;;) {
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
    if (x === q.x && y === q.y) return out;
    out.push({ x, y });
  }
}

/** Can a direct-fire shot from tile `from` reach tile `to`? */
export function hasLineOfSight(game, from, to) {
  const vantage = attributeConfig(terrainAt(game, from.x, from.y), 'vantage') ?? 0;
  return tilesBetween(from, to).every(({ x, y }) => {
    const height = attributeConfig(terrainAt(game, x, y), 'blocksLineOfSight') ?? 0;
    return height === 0 || vantage > height;
  });
}

// One continuous outline round a set of tiles: the movement area and the attack range ring both use it.
//
//   outlineLoops(tiles)                          -> closed loops of [x, y] tile-corner points (clockwise, interior on the right)
//   tracePath(g, loops, S, { radius, inset })    -> adds the loops to the current path, corners rounded and the line pulled `inset` px inside
//
// The boundary is traced as unit edges between a tile in the set and one outside it, joined end to end, so a ring with a hole or two
// islands that touch at a corner still comes out as closed, unbroken lines, with no gaps or doubled-up segments where tiles meet.

/** Boundary loops of `tiles` (anything with x, y). Collinear points are dropped, so every segment is a whole straight run. */
export function outlineLoops(tiles) {
  const has = new Set(tiles.map(({ x, y }) => `${x},${y}`));
  const out = (x, y) => has.has(`${x},${y}`);
  const next = new Map();   // "x,y" of an edge's start -> its unused ends
  const add = (ax, ay, bx, by) => { const k = `${ax},${ay}`; if (!next.has(k)) next.set(k, []); next.get(k).push([bx, by]); };
  for (const { x, y } of tiles) {
    if (!out(x, y - 1)) add(x, y, x + 1, y);
    if (!out(x + 1, y)) add(x + 1, y, x + 1, y + 1);
    if (!out(x, y + 1)) add(x + 1, y + 1, x, y + 1);
    if (!out(x - 1, y)) add(x, y + 1, x, y);
  }
  const loops = [];
  for (const [startKey, ends] of next) {
    while (ends.length) {
      const [sx, sy] = startKey.split(',').map(Number), pts = [[sx, sy]];
      let [cx, cy] = ends.pop();
      while (cx !== sx || cy !== sy) {
        pts.push([cx, cy]);
        const opts = next.get(`${cx},${cy}`);
        // at a pinch point (two areas touching at a corner) either way on closes a loop, so just take the first
        const pick = 0;
        const [ex, ey] = opts.splice(pick, 1)[0];
        cx = ex; cy = ey;
      }
      loops.push(simplify(pts));
    }
  }
  return loops;
}

function simplify(pts) {
  const n = pts.length;
  return pts.filter((p, i) => {
    const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0;
  });
}

/** Add the loops to the path of `g` in pixels: `radius` rounds every corner, `inset` moves the line that far inside the area. */
export function tracePath(g, loops, S, { radius = 0, inset = 0 } = {}) {
  for (const loop of loops) {
    const n = loop.length;
    if (n < 3) continue;
    const pts = loop.map(([x, y], i) => {
      const [ax, ay] = loop[(i + n - 1) % n], [bx, by] = loop[(i + 1) % n];
      // the inward (right-hand) normal of the edge in plus that of the edge out: moves a corner diagonally in, or out at a notch
      const nx = -Math.sign(y - ay) + -Math.sign(by - y), ny = Math.sign(x - ax) + Math.sign(bx - x);
      return [x * S + nx * inset, y * S + ny * inset];
    });
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const m0 = mid(pts[0], pts[1]);
    g.moveTo(m0[0], m0[1]);
    for (let i = 1; i <= n; i++) g.arcTo(pts[i % n][0], pts[i % n][1], ...mid(pts[i % n], pts[(i + 1) % n]), Math.min(radius, S / 2));
    g.closePath();
  }
}

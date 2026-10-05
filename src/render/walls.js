// Walls: giant round pipes that come up out of the ground and lie along it, one per wall tile, linked to the wall tiles beside them.
//   drawWall(g, px, py, S, owner, { links, cracked, broken })   one wall tile; `links` = { n, e, s, w }: which neighbours are also walls
//   wallLinks(isWall, x, y)                                     the links of cell (x, y), given a predicate for "is there a wall here"
//   drawWalls(g, { width, height, S, wallAt, view })            every wall tile of a board (the game's wall layer), row by row from the top
// Designed in the gallery's wall builder (gallery/wall-lab.js). `wallAt(x, y)` says what is on a tile: null, 'wall', 'cracked' (a cracked wall
// still standing) or 'broken' (the rubble it leaves). Every one of those links to its neighbours.
import { shade } from './color.js';

// ---- one wall tile --------------------------------------------------------------------------------------------------------------------------
/** Which of the four neighbours of (x, y) are walls. */
export const wallLinks = (isWall, x, y) => ({ n: !!isWall(x, y - 1), e: !!isWall(x + 1, y), s: !!isWall(x, y + 1), w: !!isWall(x - 1, y) });

/** One wall tile: a giant round pipe that fills the tile, plain grey metal with no team colour. Where the line ends it comes up out of the ground in an
 *  elbow; at corners, branches and on its own it stands up as an upright riser; between those it lies along the ground. Flat-shaded like the units: one
 *  body colour and a slightly darker one for the rings at the joints and the ground, the dark hole where it goes into the earth, and a lighter flat top
 *  on an upright end. No gradients, highlights or stripes. Cracked walls are the breakable variant: the same shapes in rusty brown with a hole torn
 *  in the pipe. `owner` is unused (walls are neutral) and kept so the call matches the buildings'. Draw walls row by row from the top: a riser or
 *  elbow reaches a little into the tile above. */
export function drawWall(gIn, px, py, S, _owner, opts = {}) {
  let { links = {}, cracked = false, broken = false } = opts;
  let g = gIn;                                                                  // swapped for a recorder while the pipe's outline is gathered as one clip path
  const { n, e, s, w } = links;
  const R = .3, CX = .5, CY = .6, GY = CY + R;                                  // pipe radius (it fills the tile), centre lines, the ground line under a run
  const col = { body: '#646b78', hole: '#16181c', out: '#1f2228' };           // a cracked pipe is the same colour as a sound one
  const dark = shade('#646b78', -.14), SHD = .13, SHADOW = [.06, .1];                               // the shaded side's colour; how far the lit part is shifted up and left: the width of the shade
  const OW = .03, RC = .13, FR = .19;                                           // the dark outline's width; the radius of rounded corners; of the fillets in inner corners
  const X = (a) => px + a * S, Y = (b) => py + b * S;
  const rect = (x, y, w2, h, c) => { g.fillStyle = c; g.fillRect(X(x), Y(y), w2 * S, h * S); };
  const ell = (x, y, rx, ry, c, a0 = 0, a1 = 7) => { g.fillStyle = c; g.beginPath(); g.ellipse(X(x), Y(y), rx * S, ry * S, 0, a0, a1); g.fill(); };
  const count = [n, e, s, w].filter(Boolean).length;
  const straightH = w && e && !n && !s, straightV = n && s && !w && !e;
  const endH = count === 1 && (e || w), endN = count === 1 && n, endS = count === 1 && s;
  const lone = count === 0;
  if (!straightH && !straightV) { cracked = false; broken = false; }              // cracks and breaks exist only on straight pieces: a corner, junction or end is always whole
  const riser = !straightH && !straightV && !endH && !endN && !endS;          // corners, branches and a lone wall: an upright pipe
  const dir = e ? 1 : -1, pv = dir > 0 ? .62 : .38;                            // an elbow's pivot on the ground
  // The pipe is drawn three times: first every part grown by the outline width (`gr`) in the outline colour (pass 0), then every part in the shaded
  // colour (pass 1), then every part again in the body colour, shifted up and left by SHD and clipped to the pipe's own shape (pass 2). What the
  // shifted copy no longer covers is a crescent along every lower and right edge, which curves round every bend and corner by itself: light from the
  // upper left. Parts that run off a tile edge are not grown there (and in pass 2 run on past it), so neighbouring pipes join with no line between
  // them. Every free corner is rounded.
  const paint = (pass) => {
    const gr = pass ? 0 : OW, c = pass === 0 ? col.out : pass === 1 ? dark : col.body, ext = pass === 2 ? SHD : 0;
    // `round` = [top-left, top-right, bottom-right, bottom-left]: which corners of the part are free (not joined to another part or the tile edge)
    const box = (x0, y0, x1, y1, round = [0, 0, 0, 0], rc = RC) => {
      const a = x0 <= 0 ? 0 : x0 - gr, b = y0 <= 0 ? 0 : y0 - gr, d = x1 >= 1 ? 1 + ext : x1 + gr, f = y1 >= 1 ? 1 + ext : y1 + gr;
      g.fillStyle = c; g.beginPath(); g.roundRect(X(a), Y(b), (d - a) * S, (f - b) * S, round.map((r) => (r ? (rc + gr) * S : 0))); g.fill();
    };
    const lieH = (xa, xb) => box(xa, CY - R, xb, CY + R);                      // a pipe lying east-west from xa to xb
    const lieV = (ya, yb) => box(CX - R, ya, CX + R, yb);                      // a pipe lying north-south from ya to yb
    const foot = (cx) => ell(cx, GY, R + gr, .05 + gr, c, 0, Math.PI);         // the rounded bottom of a pipe that stands in the ground
    // a rounded inner corner at P: fills the notch between two arms with a quarter-round fillet (a, b = which way the empty corner lies)
    const fillet = (Px, Py, a, b) => {
      const r = FR - gr, Cx = Px + a * FR, Cy = Py + b * FR, ccw = a * b > 0;
      g.fillStyle = c; g.beginPath(); g.moveTo(X(Px), Y(Py)); g.lineTo(X(Cx), Y(Cy - b * r)); g.arc(X(Cx), Y(Cy), r * S, -b * Math.PI / 2, a > 0 ? Math.PI : 0, ccw); g.closePath(); g.fill();
    };
    if (broken && (straightH || straightV)) {                                    // a destroyed straight pipe: two halves, each ending in a jagged break
      const zig = (side) => {                                                    // [position along the pipe, -1..1 across it] of one piece's break
        const e0 = side < 0 ? .11 : .89, dirn = side < 0 ? 1 : -1;
        const offs = side < 0 ? [0, .09, -.04, .11, -.01, .08, -.05] : [-.02, .08, -.06, .05, .12, -.03, .07];
        return offs.map((o, i) => [e0 + dirn * o, (i / (offs.length - 1)) * 2 - 1]);
      };
      const piece = (side) => {
        const z = zig(side), outerAt = side < 0 ? 0 : 1 + ext;                    // the far end of the piece is the tile's edge
        const lift = pass === 2 && side < 0;                                      // the lit copy of a break that faces down or right is pre-shifted, so the break face itself is not shaded
        const P = (u, v, edge) => {
          const q = straightH ? [u, CY + v * R] : [CX + v * R, u];
          if (lift) { q[0] += straightH || !edge ? SHD : 0; q[1] += straightH && edge ? 0 : SHD; }   // an interior vertex moves both ways, a vertex on the pipe's edge only along it
          return q;
        };
        const pts = [P(outerAt, -1, true), ...z.map(([u, v], i) => P(u, v, i === 0 || i === z.length - 1)), P(outerAt, 1, true)];
        if (pass === 0) {                                                         // the border: the pipe's outline, stroked at one even width along its two sides and the break
          g.strokeStyle = c; g.lineWidth = 2 * OW * S; g.lineJoin = 'round'; g.lineCap = 'butt'; g.beginPath();
          pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
          g.stroke();
        }
        g.fillStyle = c; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.closePath(); g.fill();
      };
      piece(-1); piece(1);
    } else if (straightH) lieH(0, 1);
    else if (straightV) lieV(0, 1);
    else if (endH) {                                                              // an elbow: the pipe rises from the ground beside the run and bends over into it
      const a0 = dir > 0 ? Math.PI : -Math.PI / 2, a1 = dir > 0 ? Math.PI * 1.5 : 0;
      g.fillStyle = c; g.beginPath(); g.moveTo(X(pv), Y(GY)); g.arc(X(pv), Y(GY), (2 * R + gr) * S, a0, a1); g.closePath(); g.fill();
      if (dir > 0) lieH(pv - .03, 1); else lieH(0, pv + .03);                    // overlaps the bend a little so no seam shows
      foot(dir > 0 ? pv - R : pv + R);
    } else if (endN) box(CX - R, 0, CX + R, GY + .03, [0, 0, 1, 1], .27);                                  // runs toward us, then goes into the ground, like the sideways ends
    else if (endS) {                                                              // comes out of the ground at the back and runs toward us
      box(CX - R, CY - .1, CX + R, 1, [1, 1, 0, 0], .24);                         // a well-rounded top, sunk into the hole behind
    } else if (lone) box(CX - R, CY - R, CX + R, GY + .03, [1, 1, 1, 1], .25);   // a standing stump
    else {
      if (n) lieV(0, CY); if (s) lieV(CY, 1);
      if (w) lieH(0, CX); if (e) lieH(CX, 1);
      box(CX - R, CY - R, CX + R, GY, [!n && !w, !n && !e, !s && !e, !s && !w], .3);   // as round as a pipe's own bend   // the junction block: free corners rounded
      if (n && w) fillet(CX - R, CY - R, -1, -1);                                  // and the inner corners between two arms
      if (n && e) fillet(CX + R, CY - R, 1, -1);
      if (s && e) fillet(CX + R, GY, 1, 1);
      if (s && w) fillet(CX - R, GY, -1, 1);
    }
  };
  // the pipe's whole silhouette as one path (the real context gathers it: shapes are added, not filled)
  const real = g;
  const rec = {
    set fillStyle(_v) {}, beginPath() {}, fill() {}, closePath: () => real.closePath(), moveTo: (x, y) => real.moveTo(x, y), lineTo: (x, y) => real.lineTo(x, y),
    arc: (...a) => real.arc(...a), roundRect: (...a) => real.roundRect(...a), fillRect: (x, y, w2, h) => real.rect(x, y, w2, h),
    ellipse: (x, y, rx, ry, rot, a0, a1) => { real.moveTo(x + rx * Math.cos(a0), y + ry * Math.sin(a0)); real.ellipse(x, y, rx, ry, rot, a0, a1); },
  };
  // the drop shadow: the whole pipe pushed down and to the right (out over the neighbouring tiles; walls are drawn row by row from the top, so a neighbour's pipe
  // is drawn over it), before anything else
  real.save(); real.translate(SHADOW[0] * S, SHADOW[1] * S); real.beginPath(); g = rec; paint(1); g = real;
  real.fillStyle = 'rgba(0,0,0,.3)'; real.fill();
  real.restore();
  paint(0); paint(1);
  real.save(); real.beginPath(); g = rec; paint(1); g = real; real.clip();
  real.translate(-SHD * S, -SHD * S); paint(2);
  real.translate(SHD * S, SHD * S);
  // the two inner corners that face away from the light (up-right, down-left) have no shade of their own, so the band along the arm is carried round the
  // inner curve (the fillet), thinning to nothing where the curve meets the other arm
  g.fillStyle = dark;
  const NS = 14, poly2 = (pts) => { real.beginPath(); pts.forEach(([x, y], i) => (i ? real.lineTo(X(x), Y(y)) : real.moveTo(X(x), Y(y)))); real.closePath(); real.fill(); };
  if (n && e && !(straightH || straightV)) {                                   // up-right: the band down the up arm's right side, round the fillet, ending on the right arm's top
    const Cx = CX + R + FR, Cy = CY - R - FR, outer = [], inner = [];
    for (let k = 0; k <= NS; k++) { const th = Math.PI - (Math.PI / 2) * k / NS, wd = SHD * -Math.cos(th); outer.push([Cx + FR * Math.cos(th), Cy + FR * Math.sin(th)]); inner.push([Cx + (FR + wd) * Math.cos(th), Cy + (FR + wd) * Math.sin(th)]); }
    poly2([[CX + R - SHD, 0], [CX + R, 0], ...outer, ...inner.reverse(), [CX + R - SHD, Cy]]);
  }
  if (s && w && !(straightH || straightV)) {                                   // down-left: the band along the left arm's underside, round the fillet, ending on the down arm's left
    const Cx = CX - R - FR, Cy = GY + FR, outer = [], inner = [];
    for (let k = 0; k <= NS; k++) { const th = -Math.PI / 2 + (Math.PI / 2) * k / NS, wd = SHD * -Math.sin(th); outer.push([Cx + FR * Math.cos(th), Cy + FR * Math.sin(th)]); inner.push([Cx + (FR + wd) * Math.cos(th), Cy + (FR + wd) * Math.sin(th)]); }
    poly2([[0, GY - SHD], [Cx, GY - SHD], ...inner, ...outer.reverse(), [0, GY]]);
  }
  real.restore();
  if (cracked) {
    // the same pipe, with a crack that starts at its edge and runs part of the way in
    const ink = col.out, lw = Math.max(1.2, .026 * S);
    const crack = (pts) => { g.strokeStyle = ink; g.lineWidth = lw; g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.stroke(); };
    if (straightV) {                                                             // a pipe lying north-south is cracked in from its left side
      const y = .45;
      crack([[CX - R + .01, y - .02], [CX - .17, y + .04], [CX - .09, y - .01], [CX - .01, y + .05]]);
      crack([[CX - .09, y - .01], [CX - .06, y - .09]]);
    } else {
      const x = .7;
      crack([[x - .02, CY - R + .01], [x + .05, CY - .2], [x - .02, CY - .12], [x + .04, CY - .03]]);
      crack([[x - .02, CY - .12], [x - .11, CY - .09]]);
    }
  }
}

/**
 * The wall layer: every wall tile in view, row by row from the top (a riser or elbow reaches a little into the tile above, and a pipe's drop
 * shadow falls on the tile below and to the right, which the next row then covers). Drawn after the terrain and before the units.
 * `view` = { x0, y0, x1, y1 } limits it to the tiles on screen (all of them when absent).
 */
export function drawWalls(g, { width, height, S, wallAt, view = null }) {
  const isWall = (x, y) => x >= 0 && y >= 0 && x < width && y < height && !!wallAt(x, y);
  const x0 = Math.max(0, (view?.x0 ?? 0) - 1), x1 = Math.min(width - 1, (view?.x1 ?? width - 1) + 1);
  const y0 = Math.max(0, (view?.y0 ?? 0) - 1), y1 = Math.min(height - 1, (view?.y1 ?? height - 1) + 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const kind = wallAt(x, y);
      if (kind) drawWall(g, x * S, y * S, S, null, { links: wallLinks(isWall, x, y), cracked: kind === 'cracked', broken: kind === 'broken' });
    }
  }
}

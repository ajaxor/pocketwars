// Experimental structures (NOT in the game): bases and labs drawn like the game's buildings (src/render/buildings.js: flat-shaded, seen from
// the front-left and above, a soft shadow to the lower right), and linkable walls.
//   BASES[id](g, px, py, S, owner)               draws a building into the square (px, py, S), in the owner's colour
//   drawWall(g, px, py, S, owner, { links, cracked })   one wall tile; `links` = { n, e, s, w }: which neighbours are also walls
//   wallLinks(isWall, x, y)                      the links of cell (x, y), given a predicate for "is there a wall here"
// The rule (docs/unit-art-lessons.md): few shapes, one idea per building, no windows or small fittings.
import { kit } from '../src/render/buildings.js';
import { shade } from '../src/render/color.js';

const DIRT = '#7a6a4a', STEEL = '#8d93a0', DARK = '#2b2d33', GLASSY = '#bfe0f2', WHITE = '#f1f1ec', RED = '#d4442e';
const disc = (g, x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, Math.max(.5, r), 0, 7); g.fill(); };

export const BASES = {
  // Training Ground: a hut, a dirt yard and a target post.
  training_ground(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    k.rect(.46, .76, .5, .12, DIRT);                                                     // the yard
    k.boxShadow(.08, .52, .34, .36, .1); k.box(.08, .52, .34, .36, .1, owner);            // the hut
    k.rect(.2, .68, .1, .2, DARK);                                                       // its door
    k.line([[.78, .76], [.78, .4]], '#4a3a26', .035);                                    // target post
    disc(g, k.X(.78), k.Y(.36), .09 * S, WHITE); disc(g, k.X(.78), k.Y(.36), .055 * S, RED); disc(g, k.X(.78), k.Y(.36), .02 * S, WHITE);
  },
  // Hover Lab: a low hall with a glass dome and a glowing launch pad.
  hover_lab(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    k.boxShadow(.08, .6, .6, .28, .12); k.box(.08, .6, .6, .28, .12, owner);
    g.fillStyle = GLASSY; g.beginPath(); g.arc(k.X(.38), k.Y(.6), .2 * S, Math.PI, 0); g.fill();   // the dome
    g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(k.X(.38), k.Y(.6), .2 * S, Math.PI * 1.1, Math.PI * 1.4); g.lineTo(k.X(.38), k.Y(.6)); g.fill();
    g.fillStyle = '#5fd0ff'; g.beginPath(); g.ellipse(k.X(.84), k.Y(.86), .14 * S, .05 * S, 0, 0, 7); g.fill();   // the pad
    g.fillStyle = '#dff6ff'; g.beginPath(); g.ellipse(k.X(.84), k.Y(.86), .08 * S, .028 * S, 0, 0, 7); g.fill();
  },
  // Mech Factory: a tall hall with a big bay door and a robot standing in it.
  mech_factory(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    k.boxShadow(.1, .34, .62, .54, .12); k.box(.1, .34, .62, .54, .12, owner);
    k.rect(.22, .46, .3, .42, DARK);                                                     // the bay
    k.rect(.3, .54, .14, .1, STEEL); k.rect(.27, .64, .2, .16, STEEL);                   // the robot: head and body
    k.rect(.29, .8, .06, .08, STEEL); k.rect(.39, .8, .06, .08, STEEL);                  // its legs
    k.line([[.62, .34], [.62, .1], [.84, .1]], shade(owner, -.4), .04);                  // a crane arm
  },
  // Stealth Lab: a dark angular bunker with a slit and a dish.
  stealth_lab(g, px, py, S, owner) {
    const k = kit(g, px, py, S), d = shade(owner, -.55);
    k.poly([[.1, .9], [.84, .9], [.92, .8], [.2, .8]], 'rgba(0,0,0,.2)');
    k.poly([[.08, .88], [.08, .6], [.3, .44], [.66, .44], [.86, .6], [.86, .88]], d);     // the faceted body
    k.poly([[.08, .6], [.3, .44], [.66, .44], [.86, .6]], shade(owner, -.25));           // its roof planes
    k.poly([[.3, .44], [.66, .44], [.58, .6], [.38, .6]], shade(owner, -.4));
    k.rect(.3, .7, .4, .04, shade(owner, .35));                                          // one lit slit
    k.line([[.5, .44], [.5, .26]], '#222', .025); disc(g, k.X(.5), k.Y(.24), .05 * S, '#c9ccd2');   // a mast and dish
  },
  // Glider Field: a launch ramp with a glider on it, and a windsock.
  glider_field(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    k.poly([[.04, .9], [.16, .9], [.92, .46], [.92, .38]], '#7d838e');                  // the ramp
    k.poly([[.04, .9], [.04, .84], [.92, .38], [.92, .4]], '#a0a6b0');
    k.poly([[.46, .62], [.7, .52], [.64, .44], [.4, .58]], owner); k.line([[.46, .62], [.6, .53]], WHITE, .035);   // a glider
    k.line([[.14, .86], [.14, .5]], '#4a3a26', .03); k.poly([[.14, .5], [.34, .54], [.14, .6]], '#ffb347');         // windsock
  },
  // Space Port: a launch tower beside a rocket on its pad.
  space_port(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    k.boxShadow(.2, .86, .6, .04, .1); k.box(.2, .86, .6, .04, .1, '#6a6e78');
    k.rect(.64, .2, .1, .68, shade(owner, -.2)); for (let i = 0; i < 5; i++) k.rect(.64, .26 + i * .13, .1, .03, shade(owner, .2));   // the gantry
    k.rect(.34, .36, .14, .5, WHITE); k.poly([[.34, .36], [.41, .16], [.48, .36]], owner);                              // the rocket
    k.poly([[.34, .86], [.28, .9], [.34, .74]], owner); k.poly([[.48, .86], [.54, .9], [.48, .74]], shade(owner, -.3));
  },
  // Drone Bay: a flat hall with an open roof hatch and a drone on a pad.
  drone_bay(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    k.boxShadow(.08, .56, .6, .32, .12); k.box(.08, .56, .6, .32, .12, owner);
    k.poly([[.2, .56], [.54, .56], [.62, .44], [.28, .44]], DARK);                       // the hatch, open
    k.rect(.34, .44, .12, .03, STEEL); k.line([[.3, .42], [.5, .42]], STEEL, .02);        // a drone rising out of it
    g.fillStyle = shade(owner, -.2); g.beginPath(); g.ellipse(k.X(.84), k.Y(.84), .12 * S, .045 * S, 0, 0, 7); g.fill();   // the pad
    k.rect(.8, .81, .08, .02, WHITE);
  },
  // Engineer Works: a hall with a gear on its front and a stack of wall blocks.
  engineer_works(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    k.boxShadow(.08, .5, .56, .38, .12); k.box(.08, .5, .56, .38, .12, owner);
    const cx = k.X(.36), cy = k.Y(.69), r = .11 * S;
    g.fillStyle = shade(owner, -.4);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.fillRect(cx + Math.cos(a) * r * 1.15 - r * .22, cy + Math.sin(a) * r * 1.15 - r * .22, r * .44, r * .44); }
    disc(g, cx, cy, r, shade(owner, -.4)); disc(g, cx, cy, r * .4, owner);               // a gear
    k.box(.76, .74, .16, .14, .06, '#a9a79e'); k.box(.78, .6, .12, .14, .06, '#c2c0b6');  // stacked wall blocks
  },
  // Underwater Lab: two domes at the waterline joined by a tube (needs a sea backdrop).
  underwater_lab(g, px, py, S, owner) {
    const X = (a) => px + a * S, Y = (b) => py + b * S;
    g.fillStyle = shade(owner, -.35); g.fillRect(X(.28), Y(.58), .44 * S, .1 * S);        // the tube, under the water
    for (const [cx, r] of [[.26, .22], [.72, .16]]) {
      g.fillStyle = shade(owner, -.35); g.beginPath(); g.arc(X(cx), Y(.56), r * S, 0, Math.PI); g.fill();   // the half below the surface
      g.fillStyle = owner; g.beginPath(); g.arc(X(cx), Y(.56), r * S, Math.PI, 0); g.fill();               // the dome above
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(X(cx), Y(.56), r * S, Math.PI * 1.1, Math.PI * 1.4); g.lineTo(X(cx), Y(.56)); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(X(.02), Y(.555), .96 * S, .022 * S);                   // the waterline
    g.strokeStyle = '#222'; g.lineWidth = Math.max(1, .02 * S); g.beginPath(); g.moveTo(X(.26), Y(.34)); g.lineTo(X(.26), Y(.2)); g.stroke();
  },
  // Radar Station: a block base, a mast and a big dish.
  radar_station(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    k.boxShadow(.18, .68, .5, .2, .1); k.box(.18, .68, .5, .2, .1, owner);
    k.line([[.43, .68], [.43, .34]], '#555a64', .04);
    g.fillStyle = '#e6e8ee'; g.beginPath(); g.ellipse(k.X(.5), k.Y(.3), .26 * S, .12 * S, -.35, 0, 7); g.fill();
    g.fillStyle = shade(owner, -.1); g.beginPath(); g.ellipse(k.X(.5), k.Y(.3), .14 * S, .06 * S, -.35, 0, 7); g.fill();
  },
  // Supply Depot: stacked crates and a fuel drum.
  supply_depot(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    k.boxShadow(.08, .62, .34, .26, .1); k.box(.08, .62, .34, .26, .1, owner);
    k.boxShadow(.46, .66, .3, .22, .1); k.box(.46, .66, .3, .22, .1, shade(owner, -.25));
    k.box(.14, .42, .24, .2, .08, shade(owner, -.25));
    k.rect(.82, .62, .12, .26, '#5a6b3a'); k.rect(.82, .72, .12, .03, '#3a4626');
  },
  // Bunker: the defences' language at building size: a poured pad, a squat block in the owner's colour under a thick concrete roof slab, and one
  // dark firing slit. No gun: it is a property a unit shelters in.
  bunker(g, px, py, S, owner) {
    const k = kit(g, px, py, S), CONC = '#c9c5b8';
    k.boxShadow(.06, .82, .82, .07, .2);
    k.box(.06, .82, .82, .07, .2, CONC);                                                  // the pad
    k.box(.14, .52, .62, .3, .16, owner);                                                 // the block
    k.box(.1, .44, .7, .09, .19, CONC);                                                   // the roof slab, overhanging
    k.rect(.1, .5, .7, .03, shade(CONC, -.15));
    k.rect(.24, .62, .42, .07, '#23252b');                                                // the firing slit
    k.rect(.38, .74, .14, .08, shade(owner, -.35));                                       // a low door
  },
};

// ---- walls --------------------------------------------------------------------------------------------------------------------------
/** Which of the four neighbours of (x, y) are walls. */
export const wallLinks = (isWall, x, y) => ({ n: !!isWall(x, y - 1), e: !!isWall(x + 1, y), s: !!isWall(x, y + 1), w: !!isWall(x - 1, y) });

/** One wall tile: a giant round pipe that fills the tile. Where the line turns, ends, branches or stands alone, the pipe comes straight up out of
 *  the ground (a riser: a fat upright cylinder in a team-coloured collar, with a dark hole round its foot) and from there runs flat along the
 *  ground to every linked neighbour. A straight run is just the pipe, lying along the ground. Every linked tile edge has a team-coloured flange,
 *  half drawn by each tile, so a line of walls reads as one long pipe with team-coloured joints. Flat-shaded like the units: a base colour, a
 *  lit band, a thin shine and a shaded band, no gradients. Cracked walls are the breakable variant: rusted, split, with a hole torn in the pipe.
 *  Draw walls row by row from the top: a riser reaches a little into the tile above. */
export function drawWall(g, px, py, S, owner, { links = {}, cracked = false } = {}) {
  const { n, e, s, w } = links;
  const R = .3, CX = .5, CY = .6, GY = CY + R;                                  // pipe radius (it fills the tile), centre lines, the ground line under a run
  const col = cracked ? { body: '#6e5545', hi: '#93735c', shine: '#bf9f84', lo: '#45362b', hole: '#1d1712' }
                      : { body: '#5d6471', hi: '#848d9d', shine: '#c3cad6', lo: '#3b4049', hole: '#16181c' };
  const X = (a) => px + a * S, Y = (b) => py + b * S;
  const rect = (x, y, w2, h, c) => { g.fillStyle = c; g.fillRect(X(x), Y(y), w2 * S, h * S); };
  const ell = (x, y, rx, ry, c, a0 = 0, a1 = 7) => { g.fillStyle = c; g.beginPath(); g.ellipse(X(x), Y(y), rx * S, ry * S, 0, a0, a1); g.fill(); };
  const count = [n, e, s, w].filter(Boolean).length;
  const straightH = w && e && !n && !s, straightV = n && s && !w && !e;
  const endH = count === 1 && (e || w), endN = count === 1 && n, endS = count === 1 && s;
  const riser = !straightH && !straightV && !endH && !endN && !endS;          // corners, branches and a lone wall: an upright pipe
  // shadows: below the lying pipes and to the right of the upright ones
  g.fillStyle = 'rgba(0,0,0,.2)';
  if (w || e) g.fillRect(X(w ? 0 : endH ? .02 : CX), Y(GY), ((w && e) ? 1 : endH ? .98 : .5) * S, .05 * S);
  if (n || s) g.fillRect(X(CX + R), Y(n ? 0 : CY - .1), .06 * S, ((n && s) ? 1 : n ? GY : 1 - CY + .1) * S);
  if (riser) ell(CX + .07, GY + .02, R + .1, .07, 'rgba(0,0,0,.2)');
  // a pipe lying east-west from xa to xb: lit along the top, shaded along the bottom
  const lieH = (xa, xb) => {
    rect(xa, CY - R, xb - xa, 2 * R, col.body); rect(xa, CY - R + .05, xb - xa, .08, col.hi); rect(xa, CY - R + .085, xb - xa, .025, col.shine);
    rect(xa, CY + R - .12, xb - xa, .12, col.lo);
  };
  // a pipe lying north-south from ya to yb, seen from above: lit on the left, shaded on the right
  const lieV = (ya, yb) => {
    rect(CX - R, ya, 2 * R, yb - ya, col.body); rect(CX - R + .05, ya, .08, yb - ya, col.hi); rect(CX - R + .085, ya, .025, yb - ya, col.shine);
    rect(CX + R - .12, ya, .12, yb - ya, col.lo);
  };
  // the team-coloured collar where a pipe goes into the ground, from x0 to x1, with the dark hole round it
  const flangeH = (x) => { rect(x, CY - R - .03, .045, 2 * R + .06, owner); rect(x, CY + R - .06, .045, .09, shade(owner, -.35)); };   // at a left or right tile edge
  const flangeV = (y) => { rect(CX - R - .03, y, 2 * R + .06, .045, owner); rect(CX + R - .06, y, .09, .045, shade(owner, -.35)); };  // at a top or bottom tile edge
  const collar = (x0, x1) => {
    ell((x0 + x1) / 2, GY, (x1 - x0) / 2 + .05, .06, col.hole);
    rect(x0 - .02, GY - .08, x1 - x0 + .04, .08, owner); ell((x0 + x1) / 2, GY, (x1 - x0) / 2 + .02, .045, owner, 0, Math.PI);
    rect(x1 - .08, GY - .08, .1, .08, shade(owner, -.35));
  };
  // an elbow out of the ground: the pipe rises from the ground beside the run and bends over into it. `dir` 1 runs east, -1 west
  const elbow = (dir) => {
    const pv = dir > 0 ? .62 : .38, a0 = dir > 0 ? Math.PI : -Math.PI / 2, a1 = dir > 0 ? Math.PI * 1.5 : 0, ccw = false;
    const arc = (r, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(X(pv), Y(GY)); g.arc(X(pv), Y(GY), r * S, a0, a1, ccw); g.closePath(); g.fill(); };
    const band = (r, wd, c) => { g.strokeStyle = c; g.lineWidth = wd * S; g.lineCap = 'butt'; g.beginPath(); g.arc(X(pv), Y(GY), r * S, a0, a1, ccw); g.stroke(); };
    arc(2 * R, col.body); band(2 * R - .09, .08, col.hi); band(2 * R - .075, .025, col.shine); arc(.12, col.lo);
    if (dir > 0) lieH(pv, 1); else lieH(0, pv);
    collar(dir > 0 ? pv - 2 * R : pv, dir > 0 ? pv : pv + 2 * R);
  };
  if (straightH) lieH(0, 1);
  else if (straightV) lieV(0, 1);
  else if (endH) elbow(e ? 1 : -1);
  else if (endN) { lieV(0, GY - .08); collar(CX - R, CX + R); }                                              // runs toward us, then dives into the ground
  else if (endS) {                                                                                          // rises out of the ground at the back, then runs toward us
    ell(CX, CY - .14, R + .06, .07, col.hole);
    lieV(CY - .12, 1);
    ell(CX, CY - .12, R, .07, col.hi); ell(CX - .05, CY - .125, R * .5, .035, col.shine);
    rect(CX - R - .02, CY - .06, 2 * R + .04, .06, owner); rect(CX + R - .06, CY - .06, .08, .06, shade(owner, -.35));
  } else {
    if (n) lieV(0, CY); if (s) lieV(CY, 1);
    if (w) lieH(0, CX); if (e) lieH(CX, 1);
  }
  if (w) flangeH(0); if (e) flangeH(.955);
  if (n) flangeV(0); if (s) flangeV(.955);
  if (riser) {
    // the pipe coming up out of the ground: a dark hole, the upright cylinder, a team-coloured collar at its foot and a rounded top
    const RR = R + .05, top = CY - R - .06;
    ell(CX, GY, RR + .05, .08, col.hole);
    rect(CX - RR, top, 2 * RR, GY - top, col.body);
    rect(CX - RR + .05, top, .09, GY - top, col.hi); rect(CX - RR + .09, top, .025, GY - top, col.shine); rect(CX + RR - .13, top, .13, GY - top, col.lo);
    ell(CX, GY, RR, .07, col.body, 0, Math.PI);                                                                  // the round foot
    rect(CX - RR - .02, GY - .1, 2 * (RR + .02), .1, owner); ell(CX, GY, RR + .02, .07, owner, 0, Math.PI);     // the collar, in the team colour
    rect(CX + RR - .1, GY - .1, .12, .1, shade(owner, -.35));
    ell(CX, top, RR, .1, col.hi); ell(CX - .04, top - .01, RR * .6, .05, col.shine);                            // the rounded top
    rect(CX - RR, top + .07, 2 * RR, .05, owner);                                                               // and a team band near it
  }
  if (cracked) {
    const ink = '#1d1712', rust = '#b0662e';
    const crack = (pts) => { g.strokeStyle = ink; g.lineWidth = Math.max(1, .022 * S); g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.stroke(); };
    const [hx, hy] = riser ? [CX + .06, CY - .02] : (n || s) && !w && !e ? [CX - .02, .45] : [w && !e ? .3 : .7, CY - .02];
    ell(hx, hy, .1, .075, col.hole);                                                                             // a hole torn in the pipe
    g.fillStyle = col.hi; g.beginPath();
    [[-.1, 0], [-.06, -.1], [-.02, -.06], [.03, -.12], [.07, -.05], [.1, 0], [.12, -.03], [.06, -.13], [-.08, -.13], [-.12, -.03]].forEach(([a, b], i) => (i ? g.lineTo(X(hx + a), Y(hy + b)) : g.moveTo(X(hx + a), Y(hy + b))));
    g.fill();                                                                                                     // its torn, peeled-back edge
    crack([[hx - .1, hy], [hx - .18, hy + .06], [hx - .22, hy + .02], [hx - .3, hy + .1]]);
    crack([[hx + .1, hy + .02], [hx + .17, hy + .1], [hx + .22, hy + .08]]);
    for (const [x, y] of [[.2, .4], [.8, .5], [.3, .74]]) rect(x, y, .07, .04, rust);                           // rust patches
    for (const [x, y, r] of [[.18, .96, .025], [.78, .97, .02], [.88, .94, .016]]) ell(x, y, r, r, col.hi);     // flakes on the ground
  }
}

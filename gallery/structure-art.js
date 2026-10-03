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
  // Bunker: a low concrete pillbox with a slit.
  bunker(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    k.boxShadow(.1, .56, .72, .32, .12);
    k.box(.1, .56, .72, .32, .12, '#a9a79e');
    k.rect(.1, .66, .72, .05, owner);                                                     // team stripe
    k.rect(.3, .76, .32, .05, DARK);                                                      // the firing slit
  },
};

// ---- walls --------------------------------------------------------------------------------------------------------------------------
/** Which of the four neighbours of (x, y) are walls. */
export const wallLinks = (isWall, x, y) => ({ n: !!isWall(x, y - 1), e: !!isWall(x + 1, y), s: !!isWall(x, y + 1), w: !!isWall(x - 1, y) });

/** One wall tile: a giant dark pipe. A hub at the middle of the tile and a pipe to every linked neighbour, so a run of walls draws as one long
 *  pipe and a ring of them as a fort. Cracked walls are the breakable variant: rusted and split, with a hole blown in one pipe. */
export function drawWall(g, px, py, S, owner, { links = {}, cracked = false } = {}) {
  const k = kit(g, px, py, S), { rect, poly, line, X, Y } = k;
  const body = cracked ? '#4d443c' : '#363a44', hi = cracked ? '#6b5e50' : '#575d6c', lo = cracked ? '#2f2924' : '#23262d', ring = cracked ? '#5a4a3c' : '#444956', INKC = '#15161a';
  const T = .4, CY = .56, y0 = CY - T / 2, x0 = .5 - T / 2, F = .06;           // pipe thickness, centre line, flange size
  const { n, e, s, w } = links;
  const horiz = (xa, xb) => {                                                  // a horizontal pipe: body, highlight along the top, shade along the bottom
    rect(xa, y0, xb - xa, T, body); rect(xa, y0 + .04, xb - xa, .07, hi); rect(xa, y0 + T - .09, xb - xa, .09, lo);
  };
  const vert = (ya, yb) => { rect(x0, ya, T, yb - ya, body); rect(x0 + .04, ya, .07, yb - ya, hi); rect(x0 + T - .09, ya, .09, yb - ya, lo); };
  poly([[0, CY + T / 2], [1, CY + T / 2], [1.1, CY + T / 2 - .06], [1.1, CY + T / 2 + .02], [.1, CY + T / 2 + .08], [0, CY + T / 2 + .08]], 'rgba(0,0,0,.22)');   // shadow to the lower right
  if (n) vert(0, CY); if (s) vert(CY, 1);
  if (w) horiz(0, .5); if (e) horiz(.5, 1);
  // flanges at the tile edges where a pipe continues into the next tile
  if (w) rect(0, y0 - F / 2, F, T + F, ring); if (e) rect(1 - F, y0 - F / 2, F, T + F, ring);
  if (n) rect(x0 - F / 2, 0, T + F, F, ring);
  if (s) rect(x0 - F / 2, 1 - F, T + F, F, ring);
  const straightH = w && e && !n && !s, straightV = n && s && !w && !e;
  if (straightH) rect(.45, y0, .1, T, owner);                                  // a straight run: a plain pipe with a team-coloured band
  else if (straightV) rect(x0, CY - .05, T, .1, owner);
  else {
    // the hub: a round joint a little fatter than the pipes, with a team-coloured band
    g.fillStyle = body; g.beginPath(); g.arc(X(.5), Y(CY), (T / 2 + .04) * S, 0, 7); g.fill();
    g.fillStyle = hi; g.beginPath(); g.arc(X(.46), Y(CY - .05), .11 * S, 0, 7); g.fill();
    g.strokeStyle = owner; g.lineWidth = Math.max(2, .07 * S); g.beginPath(); g.arc(X(.5), Y(CY), (T / 2 - .02) * S, 0, 7); g.stroke();
    g.strokeStyle = INKC; g.lineWidth = Math.max(1, .02 * S); g.beginPath(); g.arc(X(.5), Y(CY), (T / 2 + .04) * S, 0, 7); g.stroke();
  }
  if (cracked) {
    line([[.43, y0 + .03], [.5, CY - .06], [.45, CY + .04], [.52, CY + .12], [.48, y0 + T]], INKC, .028);   // a crack across the hub
    const gap = e ? 'e' : w ? 'w' : n ? 'n' : s ? 's' : null;                                              // a hole blown in one pipe, with torn edges
    if (gap === 'e' || gap === 'w') { const hx = gap === 'e' ? .72 : .14; rect(hx, y0 + .02, .13, T - .04, INKC); poly([[hx, y0 + .02], [hx + .04, y0 - .02], [hx + .08, y0 + .03], [hx + .13, y0 - .01], [hx + .13, y0 + .04], [hx, y0 + .04]], body); }
    if (gap === 'n') { rect(x0 + .02, .12, T - .04, .12, INKC); }
    if (gap === 's') { rect(x0 + .02, .74, T - .04, .12, INKC); }
    for (const [a, b] of [[.62, .97], [.7, .94], [.3, .96]]) { g.fillStyle = '#8a5a34'; g.beginPath(); g.arc(X(a), Y(b), .028 * S, 0, 7); g.fill(); }   // rust flakes and rubble
    rect(.16, y0 + .12, .08, .05, '#8a5a34'); rect(.78, y0 + T - .16, .08, .05, '#8a5a34');                 // rust patches
  }
}

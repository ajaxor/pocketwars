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

/** One wall tile, drawn like the factories (front face, lighter roof, darker side, up-and-right depth) and filling its tile: a tall post in the
 *  middle and an arm to every linked neighbour, so a run of walls draws as one wall. Cracked walls are darker, split by cracks, with a
 *  chunk knocked out and rubble: the variant that can be destroyed. */
export function drawWall(g, px, py, S, owner, { links = {}, cracked = false } = {}) {
  const k = kit(g, px, py, S), { rect, poly, line } = k;
  const face = cracked ? '#a3998a' : '#b9b7ad', roof = shade(face, .28), side = shade(face, -.3), dark = '#4a4338';
  const DX = .9, DY = -.7, d = .12, dx = d * DX, dy = d * DY;
  const { n, e, s, w } = links;
  const Y0 = .5, YB = .88, H = YB - Y0;                                         // the arms' front faces run from Y0 to YB
  const PX0 = .27, PX1 = .73, PY0 = .4;                                        // the post is a little wider and taller
  poly([[0, YB], [1, YB], [1 + .12, YB - .07], [1 + .12, YB - .02], [.12, YB + .04], [0, YB + .04]], 'rgba(0,0,0,.2)');   // ground shadow to the lower right
  if (n) { rect(.36, 0, .28, PY0, roof); poly([[.64, 0], [.64, PY0], [.64 + dx, PY0 + dy], [.64 + dx, dy]], side); }   // arms running up the tile: seen from above
  if (s) { rect(.36, YB, .28, 1 - YB, face); poly([[.36, YB - .02], [.64, YB - .02], [.64 + dx, YB - .02 + dy], [.36 + dx, YB - .02 + dy]], roof); }
  const arm = (x0, x1) => {                                                    // a horizontal arm: roof, then front face
    poly([[x0, Y0], [x0 + dx, Y0 + dy], [x1 + dx, Y0 + dy], [x1, Y0]], roof);
    rect(x0, Y0, x1 - x0, H, face);
  };
  if (w) arm(0, PX0 + .02); if (e) arm(PX1 - .02, 1);
  if (!e) poly([[PX1, Y0], [PX1 + dx, Y0 + dy], [PX1 + dx, YB + dy], [PX1, YB]], side);
  if (!w && !e && !s && !n) poly([[PX0, Y0], [PX0 + dx, Y0 + dy], [PX1 + dx, Y0 + dy], [PX1, Y0]], roof);
  poly([[PX0, PY0], [PX0 + dx, PY0 + dy], [PX1 + dx, PY0 + dy], [PX1, PY0]], roof);       // the post: roof, side, front
  poly([[PX1, PY0], [PX1 + dx, PY0 + dy], [PX1 + dx, YB + dy], [PX1, YB]], side);
  rect(PX0, PY0, PX1 - PX0, YB - PY0, face);
  rect(PX0, PY0 + .1, PX1 - PX0, .08, owner);                                           // team-coloured band across the post
  if (cracked) {
    line([[.4, PY0 + .02], [.47, .56], [.43, .64], [.5, .74], [.46, YB]], dark, .025);   // a crack down the post
    if (w) line([[.14, Y0], [.2, .62], [.15, .72], [.21, YB]], dark, .022);
    if (e) { line([[.84, Y0], [.78, .64], [.85, .76], [.8, YB]], dark, .022); rect(.88, Y0 - .01, .1, .2, '#5e5a52'); }   // a chunk missing from the arm
    if (!e && w) rect(.12, Y0 - .01, .1, .2, '#5e5a52');
    for (const [a, b, r] of [[.62, .93, .03], [.7, .96, .022], [.28, .94, .026], [.34, .97, .02]]) { g.fillStyle = '#8d8678'; g.beginPath(); g.arc(k.X(a), k.Y(b), r * S, 0, 7); g.fill(); }   // rubble
  }
}

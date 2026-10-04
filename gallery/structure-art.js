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

/** One wall tile: a run of poured concrete blocks seen like the buildings (from the front-left and above, lit from the upper left): a pale
 *  concrete front, a darker right side, and a coping along the top in the owner's colour, so a line of walls carries the team colour at any
 *  size. The wall's footprint is a strip down the middle of the tile, and its height is drawn straight up with a slight lean to the right
 *  (the buildings' depth direction), so a horizontal run shows its front and a vertical run shows its top and right side. Where the line
 *  turns, ends or branches (anything but a straight run) a taller square post stands on the joint with a team-coloured cap. Linked arms
 *  reach the tile edge, so neighbouring tiles join with no seam. Cracked walls are the breakable variant: stained concrete, the coping
 *  broken off, cracks, a bite out of the top and rubble at the foot. */
export function drawWall(g, px, py, S, owner, { links = {}, cracked = false } = {}) {
  const { n, e, s, w } = links;
  const CY = .68, T = .2, H = .34, LEAN = -.15;                                   // footprint centre line, wall thickness, height, lean per unit of height
  const PT = .34, PH = .46;                                                      // the post: footprint and height
  const conc = cracked ? '#9c9584' : '#c9c5b8', side = shade(conc, -.32), course = shade(conc, -.12), joint = shade(conc, -.28);
  const cap = cracked ? shade(conc, .12) : shade(owner, .12), capSide = cracked ? side : shade(owner, -.3), capFront = cracked ? course : owner;
  const P = (x, y, z = 0) => [px + (x + z * LEAN) * S, py + (y - z) * S];      // ground point (x, y) raised by z, in pixels
  const fill = (pts, col) => { g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b))); g.closePath(); g.fillStyle = col; g.fill(); };
  // ground shadow under the whole tile's footprint, filled once so the arms do not double it up; a pure move down (horizontal arms) or right (vertical arms)
  // so the shadows of neighbouring tiles meet edge to edge
  g.beginPath();
  const sh = (x0, y0, x1, y1, dx, dy) => { const a = P(x0 + dx, y0 + dy), b = P(x1 + dx, y1 + dy); g.rect(a[0], a[1], b[0] - a[0], b[1] - a[1]); };
  const ya = CY - T / 2, yb = CY + T / 2, xa = .5 - T / 2, xb = .5 + T / 2;
  if (w) sh(0, ya, .5, yb, 0, .07); if (e) sh(.5, ya, 1, yb, 0, .07);
  if (n) sh(xa, 0, xb, CY, .08, 0); if (s) sh(xa, CY, xb, 1, .08, 0);
  const straight = (w && e && !n && !s) || (n && s && !w && !e);
  if (!straight) sh(.5 - PT / 2, CY - PT / 2, .5 + PT / 2, CY + PT / 2, .08, .06);
  g.fillStyle = 'rgba(0,0,0,.2)'; g.fill();
  // one block: a footprint (x0..x1, y0..y1) raised to height h, in palette `pal` (front, side, top, band). Right side, front, then the top;
  // a face that butts onto more wall is left out so the run looks continuous
  const WALL = { front: conc, side, top: cap, band: capFront, bandSide: capSide, course };
  const POST = cracked ? WALL : { front: owner, side: shade(owner, -.3), top: shade(owner, .25), band: shade(owner, -.18), bandSide: shade(owner, -.42), course: shade(owner, -.1) };
  const block = (x0, y0, x1, y1, h, { front = true, right = true, coping = .05, joints = [], pal = WALL } = {}) => {
    if (right) fill([P(x1, y1), P(x1, y0), P(x1, y0, h), P(x1, y1, h)], pal.side);
    if (front) {
      fill([P(x0, y1), P(x1, y1), P(x1, y1, h), P(x0, y1, h)], pal.front);
      fill([P(x0, y1, h * .4), P(x1, y1, h * .4), P(x1, y1, h * .47), P(x0, y1, h * .47)], pal.course);   // one darker course across the front
      for (const jx of joints) fill([P(jx - .008, y1), P(jx + .008, y1), P(jx + .008, y1, h - coping), P(jx - .008, y1, h - coping)], joint);
      fill([P(x0, y1, h - coping), P(x1, y1, h - coping), P(x1, y1, h), P(x0, y1, h)], pal.band);       // the coping's front edge
    }
    if (right && coping) fill([P(x1, y1, h - coping), P(x1, y0, h - coping), P(x1, y0, h), P(x1, y1, h)], pal.bandSide);
    fill([P(x0, y0, h), P(x1, y0, h), P(x1, y1, h), P(x0, y1, h)], pal.top);                            // the top
  };
  // back to front: the arm going north, the arms east and west, the post, then the arm coming south toward the viewer
  if (n && !straight) block(xa, 0, xb, CY - PT / 2 + .02, H, { front: false });
  if (w) block(0, ya, straight ? .5 : .5 - PT / 2 + .02, yb, H, { right: false, joints: [.25] });
  if (e) block(straight ? .5 : .5 + PT / 2 - .02, ya, 1, yb, H, { right: false, joints: [.75] });
  if (straight && w) { const a = P(.5, yb), b = P(.5, yb, H - .05); g.fillStyle = joint; g.fillRect(a[0] - .008 * S, b[1], .016 * S, a[1] - b[1]); }
  if (!straight) {
    const x0 = .5 - PT / 2, x1 = .5 + PT / 2, y0 = CY - PT / 2, y1 = CY + PT / 2;
    block(x0, y0, x1, y1, PH, { coping: .07, pal: POST });
    if (!cracked) fill([P(x0 + .1, y1, PH - .2), P(x1 - .1, y1, PH - .2), P(x1 - .1, y1, PH - .16), P(x0 + .1, y1, PH - .16)], '#2b2d33');   // a firing slit
  }
  if (s) block(xa, straight ? 0 : CY + PT / 2 - .02, xb, 1, H, { front: false });
  if (straight && n) block(xa, 0, xb, 1, H, { front: false });                                         // a vertical run is one long block
  if (cracked) {
    const ink = '#3a352d', rust = '#8a5a34';
    const crack = (pts) => { g.strokeStyle = ink; g.lineWidth = Math.max(1, .022 * S); g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y, z], i) => { const [a, b] = P(x, y, z); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke(); };
    const fy = straight && n ? null : (straight ? yb : CY + PT / 2);                                 // the face the damage is drawn on
    if (fy != null) {
      const hh = straight ? H : PH;
      crack([[.36, fy, hh], [.42, fy, hh * .6], [.38, fy, hh * .35], [.45, fy, 0]]);
      crack([[.62, fy, hh * .9], [.58, fy, hh * .55]]);
      fill([P(.44, fy, hh + .002), P(.6, fy, hh + .002), P(.54, fy, hh - .1), P(.5, fy, hh - .06)], side);   // a bite out of the top edge
      g.strokeStyle = rust; g.lineWidth = Math.max(1, .014 * S); g.beginPath(); { const [a, b] = P(.5, fy, hh - .02), [c, d] = P(.53, fy, hh + .05); g.moveTo(a, b); g.lineTo(c, d); } g.stroke();   // a bent rebar
    } else {
      crack([[xa + .04, .2, H], [xb - .06, .35, H], [xa + .08, .5, H], [xb - .04, .62, H]]);           // across the top of a vertical run
    }
    for (const [x, y, r] of [[.24, .93, .035], [.7, .95, .028], [.82, .9, .02], [.32, .97, .02]]) { const [a, b] = P(x, y); g.fillStyle = r > .03 ? conc : side; g.beginPath(); g.arc(a, b, r * S, 0, 7); g.fill(); }   // rubble
  }
}

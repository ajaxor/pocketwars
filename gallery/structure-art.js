// Experimental structures (NOT in the game): bases drawn like the game's buildings (src/render/buildings.js: flat-shaded, seen from
// the front-left and above, a soft shadow to the lower right). The linkable walls are in the game now: their drawing lives in src/render/walls.js
// and is re-exported here for the gallery.
//   BASES[id](g, px, py, S, owner)               draws a building into the square (px, py, S), in the owner's colour
//   drawWall(g, px, py, S, owner, { links, cracked, broken })   one wall tile; `links` = { n, e, s, w }: which neighbours are also walls
//   wallLinks(isWall, x, y)                      the links of cell (x, y), given a predicate for "is there a wall here"
// The rule (docs/unit-art-lessons.md): few shapes, one idea per building, no windows or small fittings.
import { kit } from '../src/render/buildings.js';
import { shade } from '../src/render/color.js';
export { drawWall, wallLinks } from '../src/render/walls.js';

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
  // Mech Factory: a tall hall with a big bay door and a robot standing in it.
  mech_factory(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    k.boxShadow(.1, .34, .62, .54, .12); k.box(.1, .34, .62, .54, .12, owner);
    k.rect(.22, .46, .3, .42, DARK);                                                     // the bay
    k.rect(.3, .54, .14, .1, STEEL); k.rect(.27, .64, .2, .16, STEEL);                   // the robot: head and body
    k.rect(.29, .8, .06, .08, STEEL); k.rect(.39, .8, .06, .08, STEEL);                  // its legs
    k.line([[.62, .34], [.62, .1], [.84, .1]], shade(owner, -.4), .04);                  // a crane arm
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
  // ---- production buildings for the "units are built in their own building" idea (gallery/production.json) -------------------------------------
  // Heavy Factory: a squat, wide hall under a thick roof with two smokestacks and a tread-wide bay door, with a plated tank face at the door.
  heavy_factory(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    k.boxShadow(.04, .5, .8, .38, .16); k.box(.04, .5, .8, .38, .16, owner);
    k.box(.02, .42, .84, .09, .18, '#8d93a0');                                           // a heavy roof slab
    k.rect(.14, .58, .36, .3, DARK);                                                     // the wide bay
    k.rect(.18, .72, .28, .1, STEEL); k.rect(.22, .64, .14, .08, STEEL);                 // a tank in the door: hull and turret
    k.rect(.36, .66, .14, .03, STEEL);
    k.rect(.62, .18, .1, .26, '#555a64'); k.rect(.76, .26, .09, .18, '#555a64');         // two stacks
    k.rect(.62, .18, .1, .03, shade(owner, .2)); k.rect(.76, .26, .09, .03, shade(owner, .2));
  },
  // Rocket Factory: a hall with a rack of rockets standing on end beside it, nose cones in the owner's colour.
  rocket_factory(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    k.boxShadow(.06, .56, .46, .32, .12); k.box(.06, .56, .46, .32, .12, owner);
    k.rect(.16, .68, .24, .2, DARK);                                                     // the door
    k.rect(.6, .84, .34, .06, '#6a6e78');                                                // the rack's base
    for (let i = 0; i < 3; i++) {                                                        // three rockets
      const x = .62 + i * .11, top = .3 + (i === 1 ? -.08 : 0);
      k.rect(x, top, .07, .54 - (top - .3) - .08 + .08, WHITE);
      k.poly([[x, top], [x + .035, top - .12], [x + .07, top]], owner);
      k.rect(x, .72, .07, .04, RED);
    }
  },
  // Aid Station: a low white hall with a red cross and a tent awning: medics and mechanics.
  aid_station(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    k.boxShadow(.1, .52, .6, .36, .12); k.box(.1, .52, .6, .36, .12, WHITE);
    k.rect(.1, .5, .6, .06, owner);                                                      // an eaves stripe
    k.rect(.34, .58, .12, .3, RED); k.rect(.25, .67, .3, .12, RED);                      // the cross
    k.poly([[.72, .88], [.72, .6], [.94, .6], [.94, .88]], shade(owner, -.1));           // a canvas awning
    k.poly([[.72, .6], [.83, .44], [.94, .6]], owner);
    k.rect(.78, .72, .1, .16, DARK);
  },
  // Heliport: a round pad with an H, a windsock and a low hut.
  heliport(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(k.X(.56), k.Y(.82), .36 * S, .13 * S, 0, 0, 7); g.fill();
    g.fillStyle = '#6a6e78'; g.beginPath(); g.ellipse(k.X(.5), k.Y(.76), .36 * S, .14 * S, 0, 0, 7); g.fill();     // the pad
    g.fillStyle = WHITE; g.beginPath(); g.ellipse(k.X(.5), k.Y(.76), .31 * S, .115 * S, 0, 0, 7); g.fill();
    g.fillStyle = owner; g.beginPath(); g.ellipse(k.X(.5), k.Y(.76), .27 * S, .098 * S, 0, 0, 7); g.fill();
    k.rect(.39, .7, .035, .12, WHITE); k.rect(.575, .7, .035, .12, WHITE); k.rect(.39, .745, .22, .03, WHITE);     // the H
    k.box(.04, .46, .2, .2, .08, shade(owner, -.2));                                     // a hut
    k.line([[.86, .72], [.86, .3]], '#4a3a26', .03); k.poly([[.86, .3], [.66, .34], [.86, .42]], '#ffb347');       // windsock
  },
  // Dry Dock (needs a sea backdrop): two tall gantry towers straddling a berth, a big hull sitting between them.
  dry_dock(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    k.boxShadow(.04, .84, .92, .06, .12); k.box(.04, .84, .92, .06, .12, '#6a6e78');       // the quay
    k.poly([[.14, .84], [.86, .84], [.8, .66], [.22, .66]], shade(owner, -.4));          // the hull
    k.rect(.3, .6, .22, .06, shade(owner, -.15)); k.rect(.36, .52, .1, .08, owner);
    k.rect(.06, .2, .09, .64, shade(owner, -.2)); k.rect(.85, .2, .09, .64, shade(owner, -.2));    // the gantry towers
    k.rect(.06, .2, .88, .07, shade(owner, -.35));                                       // the beam across
    k.line([[.5, .27], [.5, .46]], '#222', .015);
  },
};


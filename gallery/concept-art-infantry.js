// Experimental concept units, Training Ground group: specialist infantry. NOTHING here is in the game (see concept-art.js).
// Same conventions as src/render/unit-art.js: SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j }), centred on (0, 0), +x forward.
// The rule for this group (and the guideline in docs/unit-art-lessons.md): every specialist is the game's plain soldier (legs, torso,
// head, helmet, the same walk cycle) plus ONE thing that tells it apart: a bandanna, a launcher, a wrench, a case, a fur hat.
import { box, disc, oval, poly, stroke, mix, afloat, INK, STEEL, SKIN, UNDER_SHADE, legs, torso, head, dome } from '../src/render/parts.js';

const RED = '#d4442e', WHITE = '#f4f4ee', WOOD = '#7a4e2a', FUR = '#8a7a66';

/** Walk state: leg offset l, rifle swing sw (pixels) and bob bb (tile fractions). */
const gait = (s, { w, ph, run, moving, b }) => {
  const walk = run && moving ? 1 : 0, k = Math.sin(w * 8 + ph);
  return { l: k * s * .05 * walk, sw: k * s * .02 * walk, bb: b / s };
};
/** The soldier's body, up to and including the head. */
const body = (g, o, { pack = null } = {}) => {
  const { s, c, dk } = o, { l, sw, bb } = gait(s, o);
  legs(g, s, l, dk);
  if (pack) box(g, s, -.24, -.1 + bb, .09, .2, 3, pack);
  torso(g, s, bb, c);
  head(g, s, bb);
  return { s, c, dk, bb, sw: sw / s };
};
/** The soldier's helmet: a dome and a rim. */
const helmet = (g, s, bb, col, r = .11) => { dome(g, s, bb, r, col); g.fillStyle = col; g.fillRect(-s * (r + .02), (-.22 + bb) * s, s * (r + .02) * 2, s * .03); };
/** The soldier's rifle line (the game's: a thick dark stroke from the hip up and forward). */
const rifle = (g, s, bb, sw) => stroke(g, s, -.1, .04 + bb, .26, -.12 + bb + sw, Math.max(2, s * .05), INK);

// ---- Commando: a soldier with a red bandanna round the helmet, and an AK-47 ---------------------------------------------------------
const ak47 = (g, s, x, y, ang) => {
  g.save(); g.translate(x * s, y * s); g.rotate(ang);
  box(g, s, -.2, -.02, .13, .05, 1, WOOD);                                         // wooden stock
  box(g, s, -.08, -.03, .17, .05, 1, INK);                                         // receiver
  box(g, s, .09, -.025, .12, .04, 1, WOOD);                                        // wooden handguard
  box(g, s, .21, -.012, .15, .018, 0, INK);                                        // barrel
  poly(g, s, [[.0, .02], [.06, .02], [.09, .13], [.03, .14]], '#3a2c20');          // the curved magazine
  g.restore();
};
const commando = (g, o) => {
  const { s, dk, bb, sw } = body(g, o, {}), fl = o.run ? Math.sin(o.w * 9 + o.ph) * .03 : 0, tail = o.moving ? .04 : 0;
  helmet(g, s, bb, dk);
  box(g, s, -.11, -.228 + bb, .22, .036, 1, RED);                                  // the bandanna
  poly(g, s, [[-.1, -.225 + bb], [-.2, -.2 + fl + bb - tail], [-.27, -.17 + fl * 2 + bb - tail], [-.25, -.23 + fl + bb - tail], [-.17, -.25 + bb]], RED);   // its tails
  ak47(g, s, -.02, .02 + bb + sw * .3, -.36 + sw * .4);
};

// ---- RPG trooper: a soldier with a launcher across the shoulders, behind the head, and the rocket's warhead in the muzzle -----------------
const rpgTrooper = (g, o) => {
  const { s, c, dk } = o, { l, bb } = gait(s, o);
  legs(g, s, l, dk); torso(g, s, bb, c);
  g.save(); g.translate(0, (-.185 + bb) * s); g.rotate(-.12);                       // the tube, drawn BEFORE the head so the head is in front of it
  box(g, s, -.36, -.05, .72, .1, 3, '#5d6445');
  poly(g, s, [[-.4, -.07], [-.34, -.05], [-.34, .05], [-.4, .07]], '#3c4130');      // rear flare
  poly(g, s, [[.34, -.035], [.46, 0], [.34, .035]], RED);                           // the warhead
  g.restore();
  head(g, s, bb); helmet(g, s, bb, dk);
  stroke(g, s, .1, .08 + bb, .17, -.16 + bb, 3.2, SKIN);                            // a hand on the tube
};

// ---- Mechanic: a soldier holding a big wrench ----------------------------------------------------------------------------------------
const mechanic = (g, o) => {
  const { s, dk, bb } = body(g, o, {}), t = o.run ? Math.sin(o.w * 3 + o.ph) * .06 : 0;
  helmet(g, s, bb, dk);
  g.save(); g.translate(.14 * s, (.12 + bb) * s); g.rotate(.55 + t);                // the wrench, held up in front
  box(g, s, -.035, -.46, .07, .5, 3, STEEL);                                        // handle
  g.beginPath(); g.arc(0, -.52 * s, .075 * s, -Math.PI / 2 + .75, Math.PI * 1.5 - .75); g.lineWidth = .08 * s; g.strokeStyle = STEEL; g.lineCap = 'butt'; g.stroke();   // the open jaw, a C
  g.restore();
};

// ---- Medic: a soldier carrying a white case with one red cross --------------------------------------------------------------------------
const medic = (g, o) => {
  const { s, dk, bb } = body(g, o, {});
  helmet(g, s, bb, WHITE);
  box(g, s, .06, .02 + bb, .24, .17, 3, WHITE);                                      // the case
  box(g, s, .13, -.03 + bb, .1, .05, 1, mix(WHITE, '#000000', .35));                 // its handle
  box(g, s, .12, .085 + bb, .12, .04, 0, RED); box(g, s, .15, .055 + bb, .06, .1, 0, RED);   // the cross
  void dk;
};

// ---- Mortar team: a soldier behind a short fat tube on a baseplate; a shell rises out of it when it fires ---------------------------------
const mortarTeam = (g, o) => {
  const { s, c, dk, w, ph, run } = o, { l, bb } = gait(s, o);
  const cy = run ? Math.max(0, Math.sin(w * 1.1 + ph)) : 0;
  g.save(); g.translate(-.2 * s, 0); g.scale(.92, .92);                               // the loader stands behind the tube
  legs(g, s, l, dk); torso(g, s, bb, c); head(g, s, bb); helmet(g, s, bb, dk);
  g.restore();
  box(g, s, .06, .26, .36, .045, 2, '#3b3b3b');                                      // baseplate
  stroke(g, s, .3, .05, .4, .26, 3, '#3b3b3b');                                      // bipod leg
  g.save(); g.translate(.2 * s, .25 * s); g.rotate(-1.2);                            // the tube, nearly vertical
  box(g, s, -.05, -.06, .1, .12, 3, mix(c, dk, .4));                                 // breech
  box(g, s, .04, -.055, .34, .11, 2, '#4d535c');                                     // tube
  box(g, s, .36, -.06, .06, .12, 1, INK);                                            // muzzle
  g.restore();
  if (cy > .5) { const k = (cy - .5) * 2; oval(g, s, .31 - k * .02, -.1 - k * .12, .022, .045, '#d9b44a'); }   // the shell, leaving
};

// ---- Conscript: a soldier with a fur winter hat instead of a helmet ---------------------------------------------------------------------
const conscript = (g, o) => {
  const { s, bb, sw } = body(g, o, {});
  box(g, s, -.125, -.3 + bb, .25, .11, 3, FUR);                                      // the hat
  box(g, s, -.14, -.235 + bb, .28, .05, 2, mix(FUR, '#ffffff', .2));                 // its turned-up band
  box(g, s, -.14, -.22 + bb, .05, .13, 2, FUR); box(g, s, .09, -.22 + bb, .05, .13, 2, FUR);   // ear flaps
  disc(g, s, .01, -.27 + bb, .02, RED);                                              // the star
  rifle(g, s, bb, sw);
};

// ---- Spy: a dark coat with the collar up, a hat pulled low, dark glasses, and a pistol; a little see-through while it stands still ---------
const spy = (g, o) => {
  const { s, c, dk, w, run } = o, { l, bb } = gait(s, o);
  g.save(); g.globalAlpha = run && !o.moving ? .78 + .14 * Math.sin(w * 2) : .92;
  g.fillStyle = INK; g.fillRect(-s * .12, s * .14, s * .09, s * .15 + l); g.fillRect(s * .03, s * .14, s * .09, s * .15 - l);
  poly(g, s, [[-.16, -.12 + bb], [.16, -.12 + bb], [.2, .2], [-.2, .2]], '#2b2f3a');           // the long coat
  poly(g, s, [[-.16, -.12 + bb], [-.05, -.12 + bb], [-.02, -.04 + bb], [-.2, -.02 + bb]], '#3a3f4c');   // collar, up
  disc(g, s, 0, -.2 + bb, .085, SKIN);
  box(g, s, -.08, -.215 + bb, .17, .035, 1, INK);                                              // dark glasses
  oval(g, s, .01, -.25 + bb, .16, .03, '#23242c'); box(g, s, -.085, -.33 + bb, .17, .09, 3, '#23242c');   // the hat
  box(g, s, -.085, -.26 + bb, .17, .022, 0, c);                                                // team-coloured hat band
  stroke(g, s, .06, .04 + bb, .22, .0 + bb, 3, SKIN);                                          // the arm
  box(g, s, .2, -.03 + bb, .1, .045, 1, INK); box(g, s, .28, -.02 + bb, .1, .025, 0, '#4a4e58');   // pistol and its long suppressor
  g.restore();
};

// ---- Diver ----------------------------------------------------------------------------------------------------------------------------
// On land: a soldier in a dark wetsuit with an air tank and a mask pushed up on the forehead. Afloat (waterSprite diver_swim): a dark body with a
// mask, a tank and one fin.
const diver = (g, o) => {
  const { s, c, dk } = o, { l, bb } = gait(s, o);
  const suit = '#2a2e36';
  legs(g, s, l, suit);
  box(g, s, -.25, -.12 + bb, .1, .22, 4, '#c9ccd2'); box(g, s, -.25, -.04 + bb, .1, .04, 0, c);   // air tank on the back, with a team band
  torso(g, s, bb, suit);
  box(g, s, -.16, -.02 + bb, .32, .04, 1, c);                                         // team-coloured chest stripe
  head(g, s, bb);
  dome(g, s, bb, .095, suit);                                                         // the hood
  oval(g, s, .05, -.225 + bb, .06, .035, mix(c, '#ffffff', .25)); oval(g, s, .06, -.225 + bb, .04, .02, '#9fe0ff');   // the mask, pushed up
};
const diverSwim = (g, { s, c, dk, w, ph, run, moving, b }) => {
  const bb = b / s, kick = run ? Math.sin(w * (moving ? 8 : 3) + ph) : 0;
  afloat(g, s, w, run, -.38, .4, (light) => {
    const suit = light ? '#2a2e36' : mix('#2a2e36', c, .3), tank = light ? '#c9ccd2' : mix('#c9ccd2', dk, UNDER_SHADE);
    g.save(); g.translate(0, (bb - .08) * s);
    g.save(); g.translate(-.18 * s, .1 * s); g.rotate(kick * .2);                      // legs and a fin, kicking
    box(g, s, -.14, -.03, .16, .07, 3, suit);
    poly(g, s, [[-.14, -.03], [-.3, -.09], [-.32, .0], [-.3, .09], [-.14, .04]], light ? '#e8a020' : mix('#e8a020', dk, UNDER_SHADE));
    g.restore();
    box(g, s, -.2, .02, .4, .16, 7, suit);                                             // body
    box(g, s, -.17, -.09, .27, .14, 5, tank);                                          // air tank
    disc(g, s, .26, -.01, .115, suit);                                                 // head
    oval(g, s, .33, -.01, .065, .05, light ? '#9fe0ff' : mix('#9fe0ff', dk, .4));      // mask
    g.restore();
  }, -.02);
};

export const SPRITES = { commando, rpg_trooper: rpgTrooper, mechanic, medic, mortar_team: mortarTeam, conscript, spy, diver, diver_swim: diverSwim };

// ---- shadows ------------------------------------------------------------------------------------------------------------------------------
const ground = (rx, ry, y, dx = 0) => (g, { s }) => { g.fillStyle = 'rgba(0,0,0,.26)'; g.beginPath(); g.ellipse(dx * s, y * s, rx * s, ry * s, 0, 0, 7); g.fill(); };
const none = () => {};
export const SHADOWS = {
  commando: ground(.17, .04, .3), rpg_trooper: ground(.2, .04, .3), mechanic: ground(.2, .04, .3), medic: ground(.2, .04, .3),
  mortar_team: ground(.35, .045, .3, .02), conscript: ground(.17, .04, .3), spy: ground(.18, .04, .3), diver: ground(.19, .04, .3), diver_swim: none,
};

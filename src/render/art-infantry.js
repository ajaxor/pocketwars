// Sprites for the Training Ground's specialist infantry: commando, mechanic, medic, mortar team and spy are in the game (unit-art.js
// takes them by name); the rest are still concepts (gallery/concepts.json).
// Same conventions as src/render/unit-art.js: SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j }), centred on (0, 0), +x forward.
// The rule for this group (and the guideline in docs/unit-art-lessons.md): every specialist is the game's plain soldier (legs, torso,
// head, helmet, the same walk cycle) plus ONE thing that tells it apart: a bandanna, a launcher, a wrench, a case, a fur hat.
import { box, disc, oval, poly, stroke, mix, afloat, INK, STEEL, SKIN, UNDER_SHADE, legs, torso, head, dome } from './parts.js';

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
  box(g, s, .09, -.025, .12, .04, 1, INK);                                         // handguard, black like the barrel
  box(g, s, .09, -.012, .27, .018, 0, INK);                                        // barrel, all black
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
  box(g, s, .3, -.07, .05, .14, 1, '#3c4130'); poly(g, s, [[.35, -.09], [.47, -.045], [.52, 0], [.47, .045], [.35, .09]], RED);   // the rocket: a fat warhead bigger than the tube
  g.restore();
  head(g, s, bb); helmet(g, s, bb, dk);
};

// ---- Mechanic: a soldier holding a wrench across his chest like a rifle, bobbing it up and down --------------------------------------
const mechanic = (g, o) => {
  const { s, dk, bb, sw } = body(g, o, {}), t = o.run ? Math.sin(o.w * 5 + o.ph) : 0;
  helmet(g, s, bb, dk);
  g.save(); g.translate(-.1 * s, (.1 + bb + sw * .3 + t * .02) * s); g.rotate(-.6 + t * .1);   // from the hip up and out past the chest
  const side = mix(STEEL, '#000000', .4);
  const piece = (col, grow, dx, dy) => {                                           // the whole wrench in one colour: handle and the open jaw (a C)
    g.fillStyle = col; g.fillRect((-grow + dx) * s, (-.02 - grow + dy) * s, (.34 + grow * 2) * s, (.04 + grow * 2) * s);
    g.beginPath(); g.arc((.38 + dx) * s, dy * s, .05 * s, .5, Math.PI * 2 - .5); g.lineWidth = (.055 + grow * 2) * s; g.strokeStyle = col; g.lineCap = 'butt'; g.stroke();
  };
  piece(INK, .014, .014, .02);                                                     // outline round the side
  piece(side, 0, .014, .02);                                                       // the side face, offset down and right
  piece(INK, .014, 0, 0);                                                          // outline round the front
  piece(STEEL, 0, 0, 0);                                                           // the front
  g.restore();
};

// ---- Medic: a soldier with a white case slung on the back side and a pistol in front ---------------------------------------------------
const medic = (g, o) => {
  const { s, bb, sw } = body(g, o, {});
  helmet(g, s, bb, WHITE);
  box(g, s, -.29, .02 + bb, .22, .16, 3, WHITE);                                     // the case, behind
  box(g, s, -.22, -.025 + bb, .08, .045, 1, mix(WHITE, '#000000', .35));             // its handle
  box(g, s, -.215, .075 + bb, .1, .035, 0, RED); box(g, s, -.185, .045 + bb, .035, .095, 0, RED);   // the cross
  box(g, s, .1, -.03 + bb + sw * .3, .15, .045, 1, INK); box(g, s, .1, -.0 + bb + sw * .3, .045, .08, 1, INK);   // pistol: slide and grip
};

// ---- Mortar team: a soldier behind a short fat tube on a baseplate; a shell rises out of it when it fires ---------------------------------
const mortarTeam = (g, o) => {
  const { s, c, dk } = o, { l, bb } = gait(s, o);
  g.save(); g.translate(-.12 * s, 0); g.scale(.92, .92);                             // the loader stands right behind the tube
  legs(g, s, l, dk); torso(g, s, bb, c); head(g, s, bb); helmet(g, s, bb, dk);
  g.restore();
  g.save(); g.translate(-.06 * s, 0);
  box(g, s, .06, .26, .36, .045, 2, '#3b3b3b');                                      // baseplate
  stroke(g, s, .3, .05, .4, .26, 3, '#3b3b3b');                                      // bipod leg
  g.save(); g.translate(.2 * s, .25 * s); g.rotate(-1.2);                            // the tube, nearly vertical
  box(g, s, -.05, -.06, .1, .12, 3, mix(c, dk, .4));                                 // breech
  box(g, s, .04, -.055, .34, .11, 2, '#4d535c');                                     // tube
  box(g, s, .36, -.06, .06, .12, 1, INK);                                            // muzzle
  g.restore();
  g.restore();
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

// ---- Spy: a dark coat, a fedora pulled low, and a pistol ------------------------------------------------------------------------------
const spy = (g, o) => {
  const { s, c, dk } = o, { l, bb } = gait(s, o);
  g.fillStyle = dk; g.fillRect(-s * .12, s * .14, s * .09, s * .15 + l); g.fillRect(s * .03, s * .14, s * .09, s * .15 - l);
  poly(g, s, [[-.16, -.12 + bb], [.16, -.12 + bb], [.2, .2], [-.2, .2]], c);                   // the long coat, in the team colour
  disc(g, s, 0, -.2 + bb, .085, SKIN);
  oval(g, s, .01, -.25 + bb, .16, .03, dk); box(g, s, -.085, -.33 + bb, .17, .09, 3, dk);   // the fedora
  box(g, s, .12, -.04 + bb, .16, .045, 1, INK); box(g, s, .12, -.01 + bb, .045, .08, 1, INK);   // pistol: slide and grip
};

// ---- Diver ----------------------------------------------------------------------------------------------------------------------------
// On land: a soldier in a dark wetsuit with an air tank and a mask pushed up on the forehead. Afloat (waterSprite diver_swim): a dark body with a
// mask, a tank and one fin.
const diver = (g, o) => {
  const { s, c } = o, { l, bb } = gait(s, o);
  const suit = '#2a2e36';
  legs(g, s, l, c);                                                                   // team-coloured fins
  box(g, s, -.25, -.12 + bb, .1, .22, 4, c);                                          // air tank on the back, in the team colour
  torso(g, s, bb, suit);
  head(g, s, bb);
  dome(g, s, bb, .095, suit);                                                         // the hood
  oval(g, s, .05, -.225 + bb, .06, .035, mix(c, '#ffffff', .25)); oval(g, s, .06, -.225 + bb, .04, .02, '#9fe0ff');   // the mask, pushed up
  stroke(g, s, -.09, -.19 + bb, -.09, -.35 + bb, 3, INK); stroke(g, s, -.09, -.35 + bb, -.15, -.35 + bb, 3, INK); stroke(g, s, -.09, -.19 + bb, -.03, -.17 + bb, 3, INK);   // the snorkel: mouthpiece at the face, the tube up the side, its open end bent back
};
const diverSwim = (g, { s, c, dk, w, ph, run, moving, b }) => {
  const bb = b / s, kick = run ? Math.sin(w * (moving ? 8 : 3) + ph) : 0;
  afloat(g, s, w, run, -.34, .32, (light) => {
    const suit = light ? '#2a2e36' : mix('#2a2e36', c, .3), team = light ? c : mix(c, dk, UNDER_SHADE);
    g.save(); g.translate(0, (bb - .08) * s);
    g.save(); g.translate(-.15 * s, .1 * s); g.rotate(kick * .2);                      // legs and a team-coloured fin, kicking
    box(g, s, -.1, -.03, .13, .07, 3, suit);
    poly(g, s, [[-.1, -.03], [-.21, -.08], [-.22, .0], [-.21, .08], [-.1, .04]], team);
    g.restore();
    box(g, s, -.17, .02, .34, .16, 7, suit);                                           // body
    box(g, s, -.14, -.09, .22, .14, 5, team);                                          // air tank
    disc(g, s, .22, -.01, .095, suit);                                                 // head
    oval(g, s, .28, -.01, .055, .045, light ? '#9fe0ff' : mix('#9fe0ff', dk, .4));     // mask
    stroke(g, s, .2, -.09, .17, -.2, 3, INK); stroke(g, s, .17, -.2, .11, -.2, 3, INK); stroke(g, s, .2, -.09, .25, -.05, 3, INK);   // the snorkel: mouthpiece at the face, tube up, open end bent back
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

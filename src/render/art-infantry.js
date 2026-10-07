// Sprites for the Training Ground's specialist infantry: commando, mechanic, medic, mortar team, spy, flamethrower, royal guard, shock trooper and
// swordsman are in the game (unit-art.js takes them by name); the rest are still concepts (gallery/concepts.json).
// Same conventions as src/render/unit-art.js: SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j }), centred on (0, 0), +x forward.
// The rule for this group (and the guideline in docs/unit-art-lessons.md): every specialist is the game's plain soldier (legs, torso,
// head, helmet, the same walk cycle) plus ONE thing that tells it apart: a bandanna, a launcher, a wrench, a case, a fur hat.
import { box, disc, oval, poly, stroke, mix, afloat, skyClip, seaClip, INK, STEEL, SKIN, UNDER_SHADE, legs, torso, head, dome } from './parts.js';
import { shade } from './color.js';

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
  box(g, s, .09, -.019, .27, .032, 0, INK);                                       // barrel, all black, thick enough to read without an outline
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
  head(g, s, bb); helmet(g, s, bb, dk);
  g.save(); g.translate(-.14 * s, (.07 + bb) * s); g.rotate(-.5);                        // held diagonally in front of the body, like the AT infantry's bazooka
  box(g, s, -.03, -.045, .5, .09, 3, '#5d6445');
  poly(g, s, [[-.08, -.065], [-.02, -.045], [-.02, .045], [-.08, .065]], '#3c4130');      // rear flare
  box(g, s, .44, -.06, .045, .12, 1, '#3c4130'); poly(g, s, [[.485, -.075], [.58, -.04], [.63, 0], [.58, .04], [.485, .075]], c);   // the rocket's warhead in the muzzle, in the team colour
  g.restore();
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

// ---- Conscript: a bare-headed soldier in a patched, hand-me-down shirt, with a rifle ------------------------------------------------
const conscript = (g, o) => {
  const { s, c, dk, bb, sw } = body(g, o, {});
  box(g, s, -.11, -.05 + bb, .08, .07, 1, mix(c, dk, .22)); box(g, s, .035, .06 + bb, .09, .07, 1, mix(c, '#ffffff', .14));   // subtle patches on the shirt
  box(g, s, -.13, .1 + bb, .06, .05, 1, mix(c, dk, .12));
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
// On land: a soldier in a dark wetsuit with an air tank and a mask pushed up on the forehead. Afloat (waterSprite diver_swim): a dark body that swims entirely below the surface (a long tank, a harpoon gun, two fins) with only the snorkel sticking out.
/** A simple harpoon gun, all gray: a stock and barrel held at `ang` radians above horizontal from (x, y), `len` long, with a spear tip. */
const GRAY = '#8d939c';
const harpoon = (g, s, x, y, len, ang = .45) => {
  const dx = Math.cos(ang), dy = -Math.sin(ang), ex = x + dx * len, ey = y + dy * len;
  stroke(g, s, x - dx * .06, y - dy * .06, ex, ey, Math.max(2, s * .045), GRAY);
  poly(g, s, [[ex - dy * .035, ey + dx * .035], [ex + dx * .08, ey + dy * .08], [ex + dy * .035, ey - dx * .035]], GRAY);
};
const diver = (g, o) => {
  const { s, c } = o, { l, bb } = gait(s, o);
  const suit = '#2a2e36';
  legs(g, s, l, c);                                                                   // team-coloured fins
  box(g, s, -.25, -.12 + bb, .1, .22, 4, c);                                          // air tank on the back, in the team colour
  torso(g, s, bb, suit);
  head(g, s, bb);
  dome(g, s, bb, .095, suit);                                                         // the hood
  oval(g, s, .05, -.225 + bb, .06, .035, mix(c, '#ffffff', .25)); oval(g, s, .06, -.225 + bb, .04, .02, '#9fe0ff');   // the mask, pushed up
  stroke(g, s, -.09, -.19 + bb, -.09, -.35 + bb, 3, INK); stroke(g, s, -.09, -.19 + bb, -.03, -.17 + bb, 3, INK);
  harpoon(g, s, .0, .0 + bb, .3, -.5);   // the snorkel: mouthpiece at the face, a straight tube up the side
};
const diverSwim = (g, { s, c, dk, w, run, moving, ph, b }) => {
  const LN = -.18, k = 1.05;                                                             // the waterline sits just above the diver's head; he is centred in the tile
  const bb = 0, kick = run ? Math.sin(w * (moving ? 8 : 3) + ph) : 0;   // no bobbing: he glides steadily under the surface
  const diverBody = (light) => {                                                       // drawn above (light: the snorkel only) and below the waterline, bobbing together
    const suit = mix('#14171c', c, .1), team = mix(c, dk, UNDER_SHADE);
    g.save(); g.translate(0, bb * s); g.scale(k, k);
    if (!light) {
      for (const [dy, dir, shade] of [[.1, -1, .15], [.03, 1, 0]]) {                   // two legs, each with a team-coloured fin, kicking in turn
        g.save(); g.translate(-.15 * s, dy * s); g.rotate(kick * .2 * dir);
        box(g, s, -.1, -.03, .13, .07, 3, mix(team, '#000000', shade));   // legs in the team colour, as when standing
        poly(g, s, [[-.1, -.03], [-.21, -.08], [-.22, .0], [-.21, .08], [-.1, .04]], mix(team, '#000000', shade));
        g.restore();
      }
      box(g, s, -.17, -.01, .34, .16, 7, suit);                                        // body
      box(g, s, -.24, -.1, .38, .12, 6, team);                                         // air tank: long, along the back
      disc(g, s, .22, -.03, .095, mix(SKIN, dk, .12));                                 // the face, skin-coloured as when standing
      g.fillStyle = suit; g.beginPath(); g.arc(.22 * s, -.03 * s, .095 * s, Math.PI * .85, Math.PI * 1.95); g.fill();   // the hood over the top and back of the head
      oval(g, s, .275, -.04, .06, .038, mix(mix(c, '#ffffff', .25), dk, .12)); oval(g, s, .285, -.04, .04, .022, mix('#9fe0ff', dk, .25));   // the mask: team rim, glass
      harpoon(g, s, .1, .08, .2, -.3);                                                 // pointing a little downward
    }
    stroke(g, s, .2, -.11, .2, -.3, 3, INK); stroke(g, s, .2, -.11, .25, -.07, 3, INK);   // the snorkel: mouthpiece at the face and a straight tube up through the surface
    g.restore();
  };
  g.save(); skyClip(g, s, LN); diverBody(true); g.restore();
  g.save(); seaClip(g, s, LN); diverBody(false); g.restore();
  const hx = .2 * k, p = .8 + .2 * Math.sin(w * 4) * run;                              // only a faint disturbance round the tube, like a dived submarine's periscope
  oval(g, s, hx, LN, .07 * p, .02, 'rgba(255,255,255,.35)');
  oval(g, s, hx, LN, .035 * p, .009, 'rgba(255,255,255,.55)');
  poly(g, s, [[hx, LN - .004], [hx - .1 - .03 * p, LN + .008], [hx - .1 - .03 * p, LN - .008]], 'rgba(255,255,255,.25)');
};


// ---- Flamethrower, Royal Guard, Shock Trooper and Swordsman: the soldier plus ONE thing (fuel tanks, a bearskin and shield, a Tesla rifle, a katana) ----
const FLAME = '#ff9a2e', FLAME_HOT = '#ffe36b', ARC = '#9fe8ff', BLADE = '#8a8f98';   // BLADE is listed in outline.js's NO_OUTLINE: a light grey that gets no outline
/** Like `body`, but the pack is drawn by a callback (it needs the bob `bb`) before the torso, so it stands behind the body. */
const bodyPack = (g, o, pack) => {
  const { s, c, dk } = o, { l, sw, bb } = gait(s, o);
  legs(g, s, l, dk); pack(bb); torso(g, s, bb, c); head(g, s, bb);
  return { s, c, dk, bb, sw: sw / s };
};
const flame = (g, s, x, y, h, w, sway, col) => {   // a teardrop standing on its base at (x, y), h tall, its point leaning by `sway`
  g.fillStyle = col; g.beginPath();
  g.moveTo((x - w) * s, y * s);
  g.quadraticCurveTo((x - w * 1.15) * s, (y - h * .55) * s, (x + sway) * s, (y - h) * s);
  g.quadraticCurveTo((x + w * 1.15) * s, (y - h * .55) * s, (x + w) * s, y * s);
  g.quadraticCurveTo(x * s, (y + w * .9) * s, (x - w) * s, y * s);
  g.fill();
};
const flamethrower = (g, o) => {
  const { s, dk, bb, sw } = bodyPack(g, o, (bb) => {   // drawn before the torso, so the tanks stand behind the body, toward the left
    box(g, o.s, -.27, -.23 + bb, .13, .37, .065 * o.s, '#bcc0c7');                                          // a plain white tank, a little shaded (the far one)
    box(g, o.s, -.18, -.23 + bb, .13, .37, .065 * o.s, '#bcc0c7');                                          // and the near one
  });
  helmet(g, s, bb, dk);
  const y0 = -.01 + bb, y1 = -.07 + bb + sw;
  stroke(g, s, -.1, y0 + .04, .29, y1, Math.max(2.5, s * .05), INK);                                               // the flamer, long across the chest
  box(g, s, .28, y1 - .04, .045, .08, 1, '#555a64');                                                          // its nozzle
  const f = o.run ? .85 + .2 * Math.sin(o.w * 19 + o.ph) : .9, lean = o.run ? Math.sin(o.w * 13 + o.ph) * .015 : 0;
  const fx = .335, fy = y1 - .035;
  flame(g, s, fx, fy, .27 * f, .065, lean, FLAME);                                                            // the flame, upright at the tip
  flame(g, s, fx, fy, .15 * f, .033, lean * .6, FLAME_HOT);
};

// Royal Guard: a soldier in a tall black bearskin with a team-coloured band, a tall shield in a pale tint of the team colour, and a rifle
// (the soldier's single black line) carried over his shoulder.
const BEAR = '#2b2b2f';
const royalGuard = (g, o) => {
  const { s, c, bb, sw } = body(g, o);
  box(g, s, -.115, -.47 + bb, .23, .23, .06 * s, BEAR);                                                         // the bearskin, sitting on top of the head
  box(g, s, -.115, -.285 + bb, .23, .035, 1, c);                                                                // its band, in the team colour
  const sh = mix(c, '#dfe6ee', .55);
  box(g, s, .1, -.16 + bb, .11, .44, 4, shade(sh, -.25));                                                       // the shield's edge
  box(g, s, .14, -.18 + bb, .1, .44, 4, sh);                                                                    // and its plain face
  stroke(g, s, .08, .08 + bb, -.2, -.3 + bb + sw * .5, Math.max(2, s * .05), INK);                              // the rifle: up across the shoulder, barrel behind it
};

// Shock trooper: a soldier in a helmet with a hand-held Tesla rifle: a long dark gun with a stock, copper coil windings along the barrel and a
// glowing ball at the muzzle.
const COPPER = '#c58b3a';
const shockTrooper = (g, o) => {
  const { s, dk, bb, sw } = body(g, o);
  helmet(g, s, bb, dk);
  const glow = o.run ? .6 + .4 * Math.sin(o.w * 11 + o.ph) : .7;
  g.save(); g.translate(-.02 * s, (.02 + bb + sw * .3) * s); g.rotate(-.3 + sw * .4);                           // held across the body, muzzle up
  box(g, s, -.2, -.075, .22, .15, 3, '#0d0e10');                                                               // the big housing at the base, like a minigun's motor block
  box(g, s, -.2, -.075, .22, .04, 2, '#0d0e10');                                                               // its lighter top plate
  box(g, s, -.14, .06, .06, .1, 1, '#0d0e10');                                                                 // the grip under it
  box(g, s, .02, -.045, .3, .03, 1, '#0d0e10'); box(g, s, .02, .015, .3, .03, 1, '#0d0e10');                   // two short barrels side by side
  for (const x of [.08, .17, .26]) box(g, s, x, -.06, .03, .13, 1, COPPER);                                    // copper rings round them
  disc(g, s, .35, 0, .05 * glow + .03, 'rgba(159,232,255,.35)'); disc(g, s, .35, 0, .035, ARC);                // the glowing ball at the muzzle
  if (o.run) {                                                                                                 // a little arc that jumps about
    const j = ((Math.floor(o.w * 9 + o.ph) * 7) % 5 - 2) * .012;
    g.strokeStyle = ARC; g.lineWidth = Math.max(1.5, s * .014); g.lineJoin = 'round';
    g.beginPath(); g.moveTo(.35 * s, 0); g.lineTo(.39 * s, (-.05 + j) * s); g.lineTo(.37 * s, (-.065 + j) * s); g.lineTo(.42 * s, (-.11 + j) * s); g.stroke();
  }
  g.restore();
};

// Swordsman: a plain soldier in a helmet with a katana held up and forward: a dark grey blade, a black grip and a small guard.
const swordsman = (g, o) => {
  const { s, dk, bb, sw } = body(g, o);
  helmet(g, s, bb, dk);
  g.save(); g.translate(-.02 * s, (.04 + bb + sw * .5) * s); g.rotate(-.85 + sw * .5);
  box(g, s, -.1, -.02, .14, .04, 1, '#0d0e10');                                                                      // the grip
  box(g, s, .04, -.033, .022, .066, 1, '#0d0e10');                                                                  // the guard
  const bow = (x) => .03 * ((x - .065) / .43) ** 2, xs = [.065, .15, .24, .33, .42], top = xs.map((x) => [x, -.022 - bow(x)]);   // a slim blade bowed gently upward
  poly(g, s, [...top, [.5, -.022 - bow(.5) + .004], [.44, .022 - bow(.44)], ...xs.slice(0, 4).reverse().map((x) => [x, .022 - bow(x)])], BLADE);   // the tip sweeps up to a point
  g.restore();
};

export const SPRITES = { flamethrower, royal_guard: royalGuard, shock_trooper: shockTrooper, swordsman, commando, rpg_trooper: rpgTrooper, mechanic, medic, mortar_team: mortarTeam, conscript, spy, diver, diver_swim: diverSwim };

// ---- shadows ------------------------------------------------------------------------------------------------------------------------------
const ground = (rx, ry, y, dx = 0) => (g, { s }) => { g.fillStyle = 'rgba(0,0,0,.26)'; g.beginPath(); g.ellipse(dx * s, y * s, rx * s, ry * s, 0, 0, 7); g.fill(); };
const none = () => {};
export const SHADOWS = {
  flamethrower: ground(.22, .04, .3), royal_guard: ground(.2, .04, .3), shock_trooper: ground(.2, .04, .3), swordsman: ground(.2, .04, .3),
  commando: ground(.17, .04, .3), rpg_trooper: ground(.2, .04, .3), mechanic: ground(.2, .04, .3), medic: ground(.2, .04, .3),
  mortar_team: ground(.35, .045, .3, .02), conscript: ground(.17, .04, .3), spy: ground(.18, .04, .3), diver: ground(.19, .04, .3), diver_swim: none,
};

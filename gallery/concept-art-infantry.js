// Experimental concept units, Training Ground group: specialist infantry. NOTHING here is in the game (see concept-art.js).
// Same conventions as src/render/unit-art.js: SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j }), centred on (0, 0), +x forward.
// The trooper body and walk cycle idea is the game's own (legs swing while moving, bob b breathes); each unit gets a distinct
// silhouette from its headgear, pack and weapon.
import { box, disc, oval, poly, stroke, mix, afloat, GLASS, INK, STEEL, SKIN, OLIVE, UNDER_SHADE, legs, torso, head, dome } from '../src/render/parts.js';

const RED = '#d4442e', GREEN = '#46b86a', YELLOW = '#f2c230', WHITE = '#f4f4ee', BRASS = '#d9b44a', WOOD = '#6b4a2b';

/** Walk state: leg offset l, rifle swing sw (pixels) and bob bb (tile fractions). */
const gait = (s, { w, ph, run, moving, b }) => {
  const walk = run && moving ? 1 : 0, k = Math.sin(w * 8 + ph);
  return { walk, l: k * s * .05 * walk, sw: k * s * .02 * walk, bb: b / s };
};
/** A green plus floating up from a unit that is healing: the idle cue for the healers. */
const plus = (g, s, x, y, r, a, col = GREEN) => {
  g.save(); g.globalAlpha = a;
  const cr = (k, f) => { box(g, s, x - r * k, y - r * .3 * k * f, r * 2 * k, r * .6 * k * f, 1, f > 1 ? '#fff' : col); box(g, s, x - r * .3 * k * f, y - r * k, r * .6 * k * f, r * 2 * k, 1, f > 1 ? '#fff' : col); };
  cr(1.3, 1.6); cr(1, 1);
  g.restore();
};
const pulse = (w, ph, speed = 1.4) => { const f = (w * speed + ph) % 1; return f < 0 ? f + 1 : f; };

// ---- Commando: bandanna with streaming tails, face paint, bandolier, short SMG; crouches a little and glows green when it heals --------
const commando = (g, o) => {
  const { s, c, dk, w, ph, run, moving } = o, { l, sw, bb } = gait(s, o);
  const fl = run ? Math.sin(w * 9 + ph) * .03 : 0, tail = moving ? .04 : 0;
  legs(g, s, l, mix(dk, '#000000', .3));
  box(g, s, -.23, -.07 + bb, .1, .17, 3, mix(c, '#000000', .45));                             // small assault pack
  torso(g, s, bb, mix(c, dk, .35));
  poly(g, s, [[-.16, -.08 + bb], [-.08, -.12 + bb], [.0, -.12 + bb], [.16, .13 + bb], [.08, .15 + bb]], mix(dk, '#000000', .1));   // bandolier
  for (let i = 0; i < 3; i++) box(g, s, -.07 + i * .06, -.07 + i * .08 + bb, .035, .045, 1, BRASS);
  box(g, s, -.16, .04 + bb, .32, .035, 1, INK);                                                 // belt
  box(g, s, .06, .07 + bb, .13, .045, 1, STEEL);                                                // knife on the thigh
  head(g, s, bb);
  box(g, s, .0, -.19 + bb, .09, .022, 1, INK);                                                  // face paint stripe
  dome(g, s, bb, .095, '#2e3326');                                                              // hair/cap under the band
  box(g, s, -.1, -.255 + bb, .2, .05, 2, RED);                                                  // the bandanna
  poly(g, s, [[-.1, -.25 + bb], [-.19, -.22 + fl + bb - tail], [-.3, -.19 + fl * 2 + bb - tail], [-.28, -.25 + fl + bb - tail], [-.18, -.27 + bb]], RED);   // tails
  poly(g, s, [[-.1, -.24 + bb], [-.2, -.17 + fl + bb], [-.28, -.1 + fl * 2 + bb], [-.24, -.15 + bb]], mix(RED, '#000000', .2));
  stroke(g, s, -.08, .04 + bb, .22, -.03 + bb + sw / s, Math.max(2.6, s * .055), INK);        // SMG
  box(g, s, .12, -.07 + bb + sw / s, .17, .04, 1, INK); box(g, s, .06, -.01 + bb + sw / s, .04, .1, 1, '#3a3a44');
  if (run && !moving) { const f = pulse(w, ph, .5); plus(g, s, .02, -.38 - f * .08 + bb, .045, Math.sin(f * Math.PI) * .9); }   // self-heal
};

// ---- RPG trooper: helmet, a fat launcher on the shoulder with the single rocket's warhead poking out of the muzzle -----------------
const rpgTrooper = (g, o) => {
  const { s, c, dk, w, ph, run } = o, { l, sw, bb } = gait(s, o);
  legs(g, s, l, dk);
  box(g, s, -.24, -.1 + bb, .09, .2, 3, mix(dk, '#000000', .2));                               // pack
  torso(g, s, bb, c);
  box(g, s, -.16, .02 + bb, .32, .04, 1, dk);
  head(g, s, bb);
  dome(g, s, bb, .11, dk); g.fillStyle = dk; g.fillRect(-s * .13, (-.22 + bb) * s, s * .26, s * .03);
  const ty = -.17 + bb + sw / s, bob = run ? Math.sin(w * 3 + ph) * .004 : 0;
  g.save(); g.translate(0, (ty + bob) * s); g.rotate(-.06);
  box(g, s, -.34, -.052, .28, .104, 3, mix(OLIVE, '#000000', .1));                              // rear venturi flare
  poly(g, s, [[-.4, -.075], [-.32, -.05], [-.32, .05], [-.4, .075]], '#35382a');
  box(g, s, -.3, -.05, .62, .1, 3, OLIVE);                                                      // the tube
  box(g, s, -.04, -.062, .05, .124, 1, '#35382a'); box(g, s, .2, -.062, .05, .124, 1, '#35382a');   // bands
  box(g, s, .04, -.075, .08, .03, 1, INK);                                                      // sight
  box(g, s, .3, -.058, .03, .116, 1, INK);                                                      // muzzle ring
  oval(g, s, .33, 0, .008, .04, '#14130e');
  poly(g, s, [[.31, -.036], [.42, -.0], [.31, .036]], RED);                                     // the rocket's warhead, in the tube
  box(g, s, .3, -.036, .02, .072, 0, mix(RED, '#000000', .3));
  g.restore();
  stroke(g, s, .1, .04 + bb, .02, -.09 + bb, 3.5, SKIN);                                        // forward hand on the tube
  box(g, s, -.12, .05 + bb, .14, .09, 2, mix(dk, '#ffffff', .12));                              // hip pouch with spare fuse kit
};

// ---- Mechanic: yellow hard hat with a lamp, overalls with straps, a big wrench in hand and a red toolbox -------------------------------
const mechanic = (g, o) => {
  const { s, c, dk, w, ph, run, moving } = o, { l, bb } = gait(s, o);
  const sw = run ? Math.sin(w * 3 + ph) * .1 : 0;
  legs(g, s, l, mix(dk, '#d6a24a', .2));
  torso(g, s, bb, c);
  box(g, s, -.16, -.01 + bb, .32, .17, 3, mix(dk, '#ffffff', .12));                             // overalls bib and trousers' top
  box(g, s, -.1, -.12 + bb, .035, .12, 1, mix(dk, '#ffffff', .12)); box(g, s, .065, -.12 + bb, .035, .12, 1, mix(dk, '#ffffff', .12));   // straps
  box(g, s, -.05, .03 + bb, .1, .07, 1, mix(dk, '#000000', .2));                                // chest pocket
  box(g, s, -.045, -.0 + bb, .03, .09, 1, STEEL);                                               // screwdriver in the pocket
  head(g, s, bb);
  box(g, s, .0, -.18 + bb, .07, .02, 1, mix(SKIN, '#7a4a2a', .5));                              // a smear of grease
  dome(g, s, bb, .115, YELLOW); box(g, s, -.14, -.225 + bb, .28, .035, 1, YELLOW);
  box(g, s, .02, -.235 + bb, .15, .03, 1, mix(YELLOW, '#000000', .2));                          // brim
  box(g, s, -.01, -.3 + bb, .02, .07, 0, mix(YELLOW, '#000000', .2));                           // ridge
  disc(g, s, .1, -.255 + bb, .028, run && Math.sin(w * 4) > -.3 ? '#fff6c0' : '#aaa');          // headlamp
  g.save(); g.translate(.14 * s, (.04 + bb) * s); g.rotate(.7 + sw);                           // the wrench held up
  box(g, s, -.02, -.3, .04, .31, 1, STEEL);
  g.fillStyle = STEEL; g.beginPath(); g.arc(0, -.3 * s, .07 * s, 0, 7); g.fill();
  box(g, s, -.02, -.4, .04, .09, 0, '#5f8fc0'); g.fillStyle = '#5f8fc0'; g.fillRect(-.012 * s, -.395 * s, .024 * s, .06 * s);
  g.restore();
  box(g, s, -.31, .09 + bb, .17, .13, 2, RED); box(g, s, -.28, .06 + bb, .11, .035, 1, INK); box(g, s, -.31, .14 + bb, .17, .02, 0, mix(RED, '#000000', .3));   // toolbox behind
  void moving;
};

// ---- Medic: white helmet with a red cross, white armband, a satchel with a cross, and a plus that rises while it heals ----------------
const cross = (g, s, x, y, r, col = RED) => { box(g, s, x - r, y - r * .32, r * 2, r * .64, 0, col); box(g, s, x - r * .32, y - r, r * .64, r * 2, 0, col); };
const medic = (g, o) => {
  const { s, c, dk, w, ph, run } = o, { l, bb } = gait(s, o);
  legs(g, s, l, dk);
  box(g, s, -.25, -.06 + bb, .1, .2, 3, WHITE); cross(g, s, -.2, .04 + bb, .035);              // medical backpack
  torso(g, s, bb, c);
  box(g, s, -.16, .02 + bb, .32, .04, 1, dk);
  head(g, s, bb);
  dome(g, s, bb, .115, WHITE); g.fillStyle = WHITE; g.fillRect(-s * .13, (-.22 + bb) * s, s * .26, s * .03);
  cross(g, s, .0, -.265 + bb, .035);                                                            // cross on the helmet
  box(g, s, .08, -.04 + bb, .07, .1, 1, WHITE); cross(g, s, .115, .01 + bb, .028);              // armband on the near arm
  g.save(); g.translate(-.02 * s, (.06 + bb) * s); g.rotate(-.1);
  poly(g, s, [[-.1, 0], [.13, 0], [.12, .12], [-.08, .13]], mix(WHITE, '#8aa07a', .12));        // satchel
  poly(g, s, [[-.1, 0], [.13, 0], [.12, .045], [-.1, .04]], mix(WHITE, '#000000', .1));
  cross(g, s, .015, .075, .03);
  g.restore();
  stroke(g, s, -.1, -.1 + bb, .12, .11 + bb, 2.2, mix(WHITE, '#000000', .25));                  // satchel strap
  const f = pulse(w, ph, .7), a = run ? Math.sin(f * Math.PI) : .8;
  plus(g, s, .19, -.14 - f * .12 * (run ? 1 : 0) + bb, .055, a * .95);
  box(g, s, .15, .02 + bb, .1, .07, 2, WHITE); cross(g, s, .2, .055 + bb, .022);                // first-aid kit in the hand
};

// ---- Mortar team: a trooper with a shell in hand behind a mortar tube on its baseplate (the tube is the silhouette) -------------------
const mortarTeam = (g, o) => {
  const { s, c, dk, w, ph, run } = o, { l, bb } = gait(s, o);
  const cy = run ? Math.max(0, Math.sin(w * 1.1 + ph)) : 0;                                      // slow drop-and-recoil cycle
  g.save(); g.translate(-.17 * s, 0);                                                           // the loader stands behind the tube
  g.scale(.92, .92);
  legs(g, s, l, dk);
  box(g, s, -.24, -.1 + bb, .09, .2, 3, mix(dk, '#000000', .15));
  torso(g, s, bb, c);
  box(g, s, -.16, .02 + bb, .32, .04, 1, dk);
  head(g, s, bb);
  dome(g, s, bb, .11, dk); g.fillStyle = dk; g.fillRect(-s * .13, (-.22 + bb) * s, s * .26, s * .03);
  g.restore();
  // the shell, held up and forward in the loader's hand, nose up
  const sx = -.02, sy = -.1 + bb - cy * .03;
  box(g, s, sx - .02, sy - .06, .04, .13, 1, BRASS); poly(g, s, [[sx - .02, sy - .06], [sx, sy - .1], [sx + .02, sy - .06]], RED);
  stroke(g, s, -.12, -.02 + bb, sx - .01, sy + .04, 3.4, SKIN);
  // baseplate, bipod and tube
  box(g, s, .06, .27, .34, .035, 1, '#3b3b3b'); box(g, s, .1, .24, .26, .03, 1, STEEL);
  stroke(g, s, .27, .0, .4, .25, 3, '#3b3b3b');                                                  // bipod leg
  const k = cy * .015;
  g.save(); g.translate(.2 * s, .24 * s); g.rotate(-1.15);                                       // the tube: nearly vertical
  g.translate(-k * s, 0);
  box(g, s, -.04, -.05, .09, .1, 3, mix(c, dk, .5));                                             // breech cap
  box(g, s, .03, -.04, .42, .08, 2, mix(STEEL, '#000000', .25));                                 // the tube
  box(g, s, .2, -.05, .06, .1, 1, c);                                                            // team-coloured band
  box(g, s, .44, -.05, .05, .1, 1, INK);                                                         // muzzle
  g.restore();
  if (run && cy > .85) disc(g, s, .27, -.2, .03 * (cy - .8) * 5, 'rgba(255,255,255,.5)');        // a puff at the muzzle
};

// ---- Conscript: an oversized, dented helmet slipping over the eyes, ragged patched tunic, no boots, an old long rifle with bayonet ----
const conscript = (g, o) => {
  const { s, c, dk, w, ph, run, moving } = o, { l, sw, bb } = gait(s, o);
  g.fillStyle = SKIN; g.fillRect(-s * .14, s * .2, s * .1, s * .09 + l); g.fillRect(s * .04, s * .2, s * .1, s * .09 - l);      // bare shins
  g.fillStyle = mix(dk, '#5a4a30', .5); g.fillRect(-s * .14, s * .12, s * .1, s * .09); g.fillRect(s * .04, s * .12, s * .1, s * .09);   // ragged trousers
  box(g, s, -.15, -.12 + bb, .3, .28, 3, mix(c, '#8a8266', .45));                               // washed-out tunic
  poly(g, s, [[-.15, .13 + bb], [-.11, .19 + bb], [-.06, .14 + bb], [-.02, .2 + bb], [.03, .14 + bb], [.07, .19 + bb], [.11, .14 + bb], [.15, .18 + bb], [.15, .13 + bb]], mix(c, '#8a8266', .45));   // torn hem
  box(g, s, -.08, -.04 + bb, .09, .08, 1, mix(c, '#000000', .1)); box(g, s, -.05, -.02 + bb, .03, .0, 0, INK);   // patch
  stroke(g, s, -.1, -.1 + bb, -.1, .0 + bb, 1.5, mix(c, '#ffffff', .3));                        // a loose thread
  box(g, s, -.16, .1 + bb, .32, .04, 1, '#5a4a30');                                              // rope belt
  disc(g, s, 0, -.19 + bb, .085, SKIN);
  oval(g, s, 0, -.17 + bb, .02, .012, '#b8855e');
  const wob = run ? Math.sin(w * 2 + ph) * .01 : 0;                                              // the helmet slides about
  g.save(); g.translate(wob * s, 0);
  g.fillStyle = mix(dk, '#8a8a70', .25); g.beginPath(); g.arc(0, (-.2 + bb) * s, .145 * s, Math.PI, 0); g.fill();   // far too big
  g.fillRect(-.16 * s, (-.205 + bb) * s, .32 * s, .04 * s);                                     // rim covering the brow
  poly(g, s, [[-.05, -.33 + bb], [.0, -.31 + bb], [-.02, -.27 + bb], [-.07, -.29 + bb]], mix(dk, '#ffffff', .3));   // a dent catching light
  g.restore();
  box(g, s, -.15, -.16 + bb, .06, .02, 0, INK);                                                  // chinstrap hanging
  const ry = sw / s;                                                                             // old long rifle, wood stock, fixed bayonet
  stroke(g, s, -.2, .06 + bb, .34, -.1 + bb + ry, Math.max(2.4, s * .05), WOOD);
  stroke(g, s, .1, -.03 + bb + ry * .8, .34, -.1 + bb + ry, Math.max(1.6, s * .03), INK);
  stroke(g, s, .34, -.1 + bb + ry, .46, -.13 + bb + ry, 1.8, STEEL);                            // bayonet
  void moving;
};

// ---- Diver: swims horizontally, head, tank and shoulders above the waterline, the rest of the suit and the kicking fins below -----------
const diver = (g, { s, c, dk, w, ph, run, moving, b }) => {
  const bb = b / s, kick = run ? Math.sin(w * (moving ? 8 : 3) + ph) : 0;
  afloat(g, s, w, run, -.38, .4, (light) => {
    const suit = light ? '#2a2e36' : mix('#2a2e36', c, .3), skin = light ? SKIN : mix(SKIN, c, .35);
    const tank = light ? '#c9ccd2' : mix('#c9ccd2', dk, UNDER_SHADE), tc = light ? c : mix(c, dk, UNDER_SHADE);
    g.save(); g.translate(0, (bb - .08) * s);
    // legs and fins trailing back, kicking
    g.save(); g.translate(-.18 * s, .1 * s); g.rotate(kick * .22);
    box(g, s, -.14, -.03, .15, .07, 3, suit);
    poly(g, s, [[-.14, -.03], [-.3, -.09], [-.32, .0], [-.3, .09], [-.14, .04]], light ? '#e8a020' : mix('#e8a020', dk, UNDER_SHADE));   // fin
    g.restore();
    g.save(); g.translate(-.18 * s, .13 * s); g.rotate(-kick * .22);
    box(g, s, -.14, -.03, .15, .06, 3, mix(suit, '#000000', .2));
    g.restore();
    box(g, s, -.2, .02, .4, .16, 7, suit);                                                      // torso in a wetsuit
    box(g, s, -.12, .02, .28, .04, 2, tc);                                                      // team-coloured shoulder stripe
    box(g, s, -.17, -.09, .27, .15, 5, tank); box(g, s, -.17, -.04, .27, .035, 0, tc);          // air tank on the back
    box(g, s, -.04, -.12, .05, .04, 1, '#8a8e96');                                              // valve
    poly(g, s, [[.2, .05], [.3, .05], [.3, .16], [.2, .16]], suit);                              // arm reaching forward
    box(g, s, .18, .03, .18, .06, 3, suit);
    // head: hood, mask, regulator
    disc(g, s, .26, -.01, .115, suit);
    oval(g, s, .32, -.01, .07, .055, mix(c, '#ffffff', .2));                                       // mask frame in team colour
    oval(g, s, .335, -.01, .05, .037, light ? '#9fe0ff' : mix('#9fe0ff', dk, .4));
    box(g, s, .24, .0, .04, .05, 1, '#8a8e96');                                               // regulator
    // harpoon gun with a barbed bolt
    stroke(g, s, .3, .1, .46, .08, 3, '#4a4e58');
    poly(g, s, [[.44, .06], [.5, .08], [.44, .1]], STEEL);
    g.restore();
  }, -.02 - .0);
  if (run) for (let i = 0; i < 3; i++) {                                                         // exhaled bubbles rising from the regulator
    const f = (w * .9 + i / 3 + ph) % 1;
    oval(g, s, .28 + Math.sin(w * 5 + i * 2) * .02, .0 + bb - f * .3, .014 * (1 - f * .3), .014 * (1 - f * .3), `rgba(220,240,255,${(.75 * (1 - f)).toFixed(2)})`);
  }
};

export const SPRITES = { commando, rpg_trooper: rpgTrooper, mechanic, medic, mortar_team: mortarTeam, conscript, diver };

// ---- shadows ----------------------------------------------------------------------------------------------------------------
const ground = (rx, ry, y, dx = 0) => (g, { s }) => { g.fillStyle = 'rgba(0,0,0,.26)'; g.beginPath(); g.ellipse(dx * s, y * s, rx * s, ry * s, 0, 0, 7); g.fill(); };
const none = () => {};
export const SHADOWS = {
  commando: ground(.19, .04, .3), rpg_trooper: ground(.2, .04, .3), mechanic: ground(.22, .04, .3, -.04), medic: ground(.2, .04, .3),
  mortar_team: ground(.35, .045, .3, .02), conscript: ground(.17, .04, .3), diver: none,
};

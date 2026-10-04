// Motorcycle infantry sprite (a game unit). Same conventions as unit-art.js: SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j }) centred on
// (0, 0), +x forward, sizes are tile fractions; the ground is at about y = .29.
import { disc, poly, stroke, box, mix, wheel, INK, STEEL } from './parts.js';

// ---- Motorcycle infantry ----------------------------------------------------------------------------------------------------
// A racing bike: low, with a nose fairing and a tail hump, and the rider lying almost flat along the tank, helmet down by the handlebars.
const motorcycle = (g, { s, c, dk, w, ph, run, moving, b }) => {
  const bob = (run ? Math.sin(w * (moving ? 12 : 4) + ph) * (moving ? .008 : .004) : 0) + b / s;
  const wy = .19, bike = mix(c, dk, .4);
  wheel(g, s, -.24, wy, .1, w, run, 14); wheel(g, s, .24, wy, .1, w, run, 14);
  g.save(); g.translate(0, bob * s);
  stroke(g, s, .24, wy, .15, .02, 3.5, STEEL);                                                // front fork
  poly(g, s, [[-.3, .06], [-.22, -.01], [-.1, -.01], [-.08, .1], [-.24, .15]], bike);         // tail hump
  poly(g, s, [[-.12, .03], [.06, -.01], [.18, .01], [.27, .09], [.17, .15], [-.1, .15]], bike);   // body and nose fairing
  // the rider, all in the bike's team colour: crouched forward, one hand on the bar, the other holding a short gun
  stroke(g, s, -.14, .0, -.02, .09, 6, c); stroke(g, s, -.02, .09, -.06, .17, 5, c);          // thigh and shin
  stroke(g, s, -.13, -.01, .05, -.11, 12, c);                                                 // torso, leaning well forward
  stroke(g, s, .03, -.09, .16, -.03, 4.5, c);                                                 // arm to the bar
  stroke(g, s, .05, -.08, .15, -.07, 4.5, c);                                                 // the gun arm
  box(g, s, .13, -.09, .2, .035, 1, INK); box(g, s, .16, -.065, .04, .06, 1, INK);             // the gun: barrel and grip, held low
  // a full-face motorcycle helmet, one colour (the dark colour of the soldiers' helmets) apart from its black visor: a round dome on top that runs down
  // into a cylinder round the face, with one straight front edge shared by the visor and the chin bar below it, and a flat bottom. It is tilted down a
  // few degrees about the neck to follow the rider's forward lean.
  const hx = .095, hy = -.15, hr = .085, hb = -.07, hf = hx + hr + .01;
  g.save(); g.translate(.07 * s, hb * s); g.rotate(.2); g.translate(-.07 * s, -hb * s);
  const shell = () => {
    g.beginPath(); g.moveTo((hx - hr) * s, hb * s); g.lineTo((hx - hr) * s, hy * s); g.arc(hx * s, hy * s, hr * s, Math.PI, Math.PI * 2);
    g.lineTo(hf * s, hy * s); g.lineTo(hf * s, (hb - .015) * s); g.quadraticCurveTo(hf * s, hb * s, (hf - .015) * s, hb * s); g.closePath();
  };
  shell(); g.fillStyle = dk; g.fill();
  g.save(); shell(); g.clip();
  g.fillStyle = INK; g.fillRect((hx + .005) * s, (hy - .045) * s, (hf - hx) * s, .06 * s);                                     // the visor window, out to the shell's front edge
  g.restore();
  g.restore();
  g.restore();
  g.restore();
};

export const SPRITES = { motorcycle };
export const SHADOWS = { motorcycle: (g, { s }) => { g.fillStyle = 'rgba(0,0,0,.26)'; g.beginPath(); g.ellipse(0, .295 * s, .3 * s, .04 * s, 0, 0, 7); g.fill(); } };

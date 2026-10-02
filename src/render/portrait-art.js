// Leader portraits (src/render/portrait-art.js): a parametric bust (one drawing routine, driven by each leader's traits) pushed through a handful of art STYLES,
// so a direction can be judged on the same faces. A leader is a plain object of traits (see data/campaign.json); `assim` draws the
// leader as assimilated by the Chorus (visor, grey uniform, flat expression). Browser-only (it uses canvas and getImageData).
//
//   drawPortrait(g, leader, { px, style, expr, blink, talk, bg })   paints a px x px portrait at (0, 0) of g
//   STYLES, EXPRESSIONS, setFactions(list)   (leaders themselves are data: data/campaign.json)
// Portraits are cached per (leader, style, expression, blink, mouth, size), so animating a blink or a talking mouth is cheap.

import { EYE_STYLES } from './eye-styles.js';
import { CHIN_STYLES, MOUTH_STYLES, NOSE_STYLES } from './face-styles.js';

export const EXPRESSIONS = ['neutral', 'smile', 'angry', 'shock', 'worried'];

export const STYLES = [
  { id: 'flat', name: 'Flat bust', note: 'Plain fills and a soft cheek shadow: the same look as the unit art, so it never clashes with the map. Cheapest to produce and to animate.' },
  { id: 'ink', name: 'Ink and cel', note: 'Thick dark outlines with hard cel shadows on a loud backdrop. Reads at any size and has the most personality; the line weight needs care at phone sizes.' },
  { id: 'pixel', name: 'Pixel', note: 'Drawn at 56 px and scaled up with a limited palette and a one-pixel outline. Very retro and forgiving, but fine detail such as glasses turns to mush.' },
  { id: 'duotone', name: 'Duotone', note: 'Three-tone wash in the faction colour. Instantly ties each leader to their army and hides any inconsistency between faces.' },
  { id: 'halftone', name: 'Halftone pop', note: 'Printed-comic dots over a flat colour. Strong identity, but dots shimmer when scaled, so it wants fixed sizes.' },
  { id: 'medallion', name: 'Medallion', note: 'The flat bust in a round badge with a star ring. The most compact: it fits a unit-info card or a turn banner.' },
  { id: 'poster', name: 'Propaganda poster', note: 'Sunburst, white sticker edge and a name banner. Made for the big moments: power cut-ins, versus screens, briefings.' },
];

const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return '#' + [0, 1, 2].map((i) => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0')).join(''); };
const INK = '#161a26';
const NIGHT = '#0a0f1c';   // portrait backdrops are tinted towards this

const canvasOf = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// ---- the parametric bust, drawn in a 100 x 100 space ----------------------------------------------------------------------------
function bust(g, L, { c, dk }, { expr = 'neutral', blink = false, talk = 0, outline = false, shade = true, px = 100, assim = false }) {
  if (assim) {                                                                                         // taken over: washed-out, flat, never blinking
    L = { ...L, skin: mix(L.skin, '#aab6bf', .5), hair: mix(L.hair, '#59636d', .45), eye: '#7ef0ff', medals: 0, glasses: false, aviators: false, freckles: false, eyepatch: false };
    expr = 'neutral'; blink = false; talk = 0;
  }
  const lw = outline ? Math.max(1.1, 220 / px * 1.1 + 0.6) : 0;
  const paint = (path, fill, ink = true) => {
    g.beginPath(); path(g); g.fillStyle = fill; g.fill();
    if (outline && ink) { g.lineWidth = lw; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke(); }
  };
  const line = (x1, y1, x2, y2, w, col, cap = 'round') => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineWidth = w; g.strokeStyle = col; g.lineCap = cap; g.stroke(); };
  const ell = (x, y, rx, ry) => (p) => p.ellipse(x, y, rx, ry, 0, 0, 7);
  const poly = (pts) => (p) => { pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); };
  const skinShade = mix(L.skin, '#5a2a1a', .22), hairLight = mix(L.hair, '#ffffff', .22);
  g.save(); g.lineJoin = 'round';

  // back hair
  if (L.hairStyle === 'ponytail') paint(ell(74, 52, 6.5, 14), L.hair);
  if (L.hairStyle === 'bun') paint(ell(50, 17, 9, 8.5), L.hair);
  if (L.hairStyle === 'long') { paint(ell(29.5, 54, 6.5, 17), L.hair); paint(ell(70.5, 54, 6.5, 17), L.hair); }
  if (L.hairStyle === 'regal') {                                                                       // a queen's mane: a long, glossy fall behind both shoulders
    paint((p) => { p.moveTo(30, 40); p.bezierCurveTo(11, 50, 14, 86, 20, 101); p.lineTo(80, 101); p.bezierCurveTo(86, 86, 89, 50, 70, 40); p.closePath(); }, L.hair);
    for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(50 + sx * 25, 48); g.quadraticCurveTo(50 + sx * 31, 62, 50 + sx * 27.5, 78); g.lineWidth = 1.1; g.strokeStyle = mix(L.hair, '#8a7a50', .35); g.lineCap = 'round'; g.stroke(); }
  }
  if (L.hairStyle === 'shaggy') {                                                                      // a sun-bleached mop sticking out in tufts around the ears
    for (const sx of [-1, 1]) paint(poly([[50 + sx * 21, 36], [50 + sx * 26.5, 40], [50 + sx * 24, 43.5], [50 + sx * 27.5, 48], [50 + sx * 24.5, 51], [50 + sx * 26.5, 55], [50 + sx * 21, 54]]), L.hair);
  }
  if (L.hairStyle === 'wild') {                                                                        // a mad-scientist cloud of hair
    paint(ell(50, 25, 27, 20), L.hair);
    for (const [x, y, r] of [[26, 38, 8], [74, 38, 8], [30, 20, 8], [70, 20, 8], [40, 8, 7], [60, 8, 7], [50, 5, 6], [21, 28, 6], [79, 28, 6]]) paint(ell(x, y, r, r * 0.9), L.hair);
  }

  // body
  const bw = L.wide || 1, X = (x) => 50 + (x - 50) * bw;
  const trench = !!L.trench, uniform = !L.coat && !trench, TR = '#b59a66';
  const bodyCol = L.coat ? '#eef0f5' : trench ? TR : c;
  paint((p) => { p.moveTo(X(6), 101); p.bezierCurveTo(X(6), 82, X(24), 74, 50, 72); p.bezierCurveTo(X(76), 74, X(94), 82, X(94), 101); p.closePath(); }, bodyCol);
  paint(poly([[43, 71], [50, 88], [57, 71]]), L.coat ? c : '#e9e9ef');
  if (trench) paint(poly([[48.6, 74], [51.4, 74], [52.4, 92], [50, 95], [47.6, 92]]), '#2a2f3c', false);   // a dark tie                                  // shirt (or the colour under a lab coat)
  paint(poly([[X(33), 74], [43, 71], [50, 88], [38, 90]]), L.coat ? '#dfe3ec' : trench ? '#cdb887' : mix(c, dk, .45));      // collar flaps
  paint(poly([[X(67), 74], [57, 71], [50, 88], [62, 90]]), L.coat ? '#dfe3ec' : trench ? '#cdb887' : mix(c, dk, .45));
  if (trench) { paint((p) => p.rect(6, 94.5, 88, 4.5), '#7d6640', false); paint((p) => p.roundRect(45, 93.8, 10, 6, 1), '#c9a74a'); }   // belt and buckle
  if (uniform) {
    for (const sx of [-1, 1]) paint((p) => p.roundRect(sx > 0 ? X(70) : X(14), 77, 17 * bw, 6.5, 3), dk);   // epaulets
    for (const sx of [-1, 1]) line(sx > 0 ? X(72) : X(16), 80.2, sx > 0 ? X(85) : X(29), 80.2, 1.4, '#e8c050');
    for (let i = 0; i < L.medals; i++) paint(ell(60 + (i % 3) * 4.6, 90 + Math.floor(i / 3) * 4.6, 1.8, 1.8), i % 2 ? '#d94b3a' : '#e8c050', false);
  } else line(X(10), 90, X(10), 101, 0.001, bodyCol);
  if (assim) for (const dy of [0, 5]) paint(poly([[44, 87 + dy], [50, 91 + dy], [56, 87 + dy], [56, 89.6 + dy], [50, 93.6 + dy], [44, 89.6 + dy]]), '#7ef0ff', false);   // the Chorus chevrons

  // neck: plain skin with a soft shadow cast by the chin
  const CS = CHIN_STYLES[L.chinStyle] || CHIN_STYLES.plain;
  const chinY = Math.max(66, ...(CS.parts || []).map(([kind, ...a]) => (kind === 'ell' ? a[1] + a[3] : Math.max(...a.map((q) => q[1]))))) + (L.jaw === 'long' ? 3 : 0);
  paint((p) => p.roundRect(43, 58, 14, 17, 3), L.skin, false);
  { const gr = g.createLinearGradient(0, chinY - 3, 0, chinY + 8); gr.addColorStop(0, 'rgba(70,30,15,.42)'); gr.addColorStop(1, 'rgba(70,30,15,0)');
    g.save(); g.beginPath(); g.roundRect(43, 58, 14, 17, 3); g.clip(); g.fillStyle = gr; g.fillRect(40, 58, 20, 20); g.restore(); }
  if (!outline) for (const x of [43, 57]) line(x, 62, x, 74, 1.1, mix(L.skin, '#1c0f0c', .7), 'butt');   // the neck's edges, thin like the face outline
  if (L.tallCollar) {
    const cc = trench ? '#a48b58' : mix(c, dk, .55);
    paint(poly([[36, 76], [38, 57], [46, 62], [46, 77]]), cc);
    paint(poly([[64, 76], [62, 57], [54, 62], [54, 77]]), cc);
    if (!trench) { line(38, 59, 46, 63, 1, '#e8c050'); line(62, 59, 54, 63, 1, '#e8c050'); }
  }

  // ears and head: a thin dark rim round the whole silhouette, drawn first under every fill so the pieces join without seams
  const head = { oval: (p) => p.ellipse(50, 44, 19, 22, 0, 0, 7), long: (p) => p.ellipse(50, 45, 17.5, 24.5, 0, 0, 7), round: (p) => p.ellipse(50, 45, 21, 21, 0, 0, 7), square: (p) => p.roundRect(31.5, 22, 37, 45, [11, 11, 16, 16]) }[L.jaw];
  const chinShapes = (CS.parts || []).map(([kind, ...a]) => (kind === 'ell' ? ell(...a) : poly(a)));
  const ears = [ell(30.8, 47, 3.4, 5), ell(69.2, 47, 3.4, 5)];
  if (!outline) {
    g.strokeStyle = mix(L.skin, '#1c0f0c', .7); g.lineWidth = 2.1; g.lineJoin = 'round';
    for (const s of [...ears, ...chinShapes, head]) { g.beginPath(); s(g); g.stroke(); }
  }
  for (const s of ears) paint(s, L.skin);
  for (const s of chinShapes) paint(s, L.skin);                                                       // the chin, under the face
  paint(head, L.skin);
  const face = (fn) => { g.save(); g.beginPath(); head(g); for (const s of chinShapes) s(g); g.clip(); fn(); g.restore(); };   // head and chin together
  if (shade) {                                                                                         // soft shadow down the far side of the face, and a gentle fade towards the jaw
    face(() => {
      g.fillStyle = 'rgba(70,30,15,.16)'; g.beginPath(); g.ellipse(70, 50, 14, 30, 0, 0, 7); g.fill();
      const gr = g.createLinearGradient(0, 55, 0, 69); gr.addColorStop(0, 'rgba(70,30,15,0)'); gr.addColorStop(1, 'rgba(70,30,15,.15)');
      g.fillStyle = gr; g.fillRect(25, 55, 50, 30);
    });
  }
  if (L.stubble) face(() => { g.fillStyle = 'rgba(70,70,80,.24)'; g.beginPath(); g.ellipse(50, 67, 21, 14, 0, 0, 7); g.fill(); });

  // expression
  const E = { neutral: { open: 1, brow: 0, mouth: 'flat' }, smile: { open: .8, brow: -.5, mouth: 'smile' }, angry: { open: .8, brow: 3.6, mouth: 'shout' }, shock: { open: 1.25, brow: -3.4, mouth: 'o' }, worried: { open: 1, brow: -3.2, mouth: 'wave' } }[expr] || { open: 1, brow: 0, mouth: 'flat' };
  const eyeOpen = blink ? .12 : E.open;
  const ES = EYE_STYLES[L.eyeStyle] || EYE_STYLES.plain;
  const eyes = [[50 - ES.gap, 45, -1], [50 + ES.gap, 45, 1]];
  const lidTone = mix(L.skin, '#5a2a1a', .3);
  for (const [ex, ey, side] of eyes) {
    if (L.eyepatch && side < 0) continue;
    const sc = side > 0 ? ES.size2 || 1 : 1;
    const w = ES.w * sc, hh = (ES.h * eyeOpen + .3) * sc;
    const inner = [ex - side * w, ey + ES.tilt * .4], outer = [ex + side * w, ey - ES.tilt * .6];
    const topEdge = (p) => { p.moveTo(inner[0], inner[1]); p.quadraticCurveTo(ex, ey - 2 * hh * ES.top, outer[0], outer[1]); };
    const lens = (p) => { topEdge(p); p.quadraticCurveTo(ex, ey + 2 * hh * ES.bot, inner[0], inner[1]); p.closePath(); };
    if (ES.shadow) { g.save(); g.globalAlpha = .55; g.fillStyle = ES.shadow; g.beginPath(); g.ellipse(ex + side * .6, ey - hh * .9 - .6, w + 1.4, 2.8 + hh * .35, -side * ES.tilt * .05, 0, 7); g.fill(); g.restore(); }
    if (ES.bags && !blink) { g.beginPath(); g.ellipse(ex, ey + hh * ES.bot + 1.2, w * .8, 1.5, 0, .12 * Math.PI, .88 * Math.PI); g.lineWidth = ES.bags * .6; g.strokeStyle = mix(L.skin, '#5a2a1a', .34); g.lineCap = 'round'; g.stroke(); }
    paint(lens, ES.glow ? mix(L.eye, '#ffffff', .15) : '#ffffff');
    if (eyeOpen > .3) {
      g.save(); g.beginPath(); lens(g); g.clip();
      const ix = ex + ES.look * side * .45 + (ES.look && side > 0 ? 0 : 0) * 0 + (ES.look > 1 ? ES.look * .7 : 0);   // a sideways glance moves both irises the same way
      if (ES.glow) { const gr = g.createRadialGradient(ex, ey, .5, ex, ey, w); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.45, L.eye); gr.addColorStop(1, mix(L.eye, '#0b3a48', .5)); g.fillStyle = gr; g.fillRect(ex - w, ey - hh * 2, w * 2, hh * 4); }
      else {
        paint(ell(ix, ey, ES.ir, ES.irh), L.eye, false);
        if (ES.ring) { g.lineWidth = .9; g.strokeStyle = 'rgba(10,12,20,.75)'; g.beginPath(); g.ellipse(ix, ey, ES.ir - .3, ES.irh - .3, 0, 0, 7); g.stroke(); }
        paint(ell(ix, ey, ES.pr, ES.pr * 1.15), '#10121a', false);
        if (ES.shine) { g.fillStyle = '#fff'; g.beginPath(); g.arc(ix + 1.2, ey - 1.1, .7, 0, 7); g.fill(); }
        if (ES.shine > 1) { g.beginPath(); g.arc(ix - 1.1, ey + 1.2, .4, 0, 7); g.fill(); }
      }
      if (ES.lid) { const ly = ey - hh + 2 * hh * ES.lid; g.fillStyle = lidTone; g.fillRect(ex - w - 1, ey - hh * 2 - 1, w * 2 + 2, ly - (ey - hh * 2 - 1)); g.fillStyle = 'rgba(30,15,10,.55)'; g.fillRect(ex - w - 1, ly - .2, w * 2 + 2, .9); }
      g.restore();
    }
    if (ES.liner) { g.beginPath(); topEdge(g); g.lineWidth = ES.liner * (outline ? 1.1 : .8); g.strokeStyle = ES.shadow ? mix(ES.shadow, '#000000', .6) : '#2a1c1c'; g.lineCap = 'round'; g.stroke(); }
    if (ES.lashes && !blink) { line(outer[0], outer[1], outer[0] + side * 2.4, outer[1] - 1.8, 1.1, '#2a1c1c'); line(outer[0] - side * .9, outer[1] - .5, outer[0] + side * 1.2, outer[1] - 2.8, .9, '#2a1c1c'); }
  }
  for (const [ex, , side] of eyes) {                                                                  // brows: the inner end rises or falls with the mood
    if (L.eyepatch && side < 0) { continue; }
    const inner = 37.5 + E.brow * .8, outer = 37.5 - Math.abs(E.brow) * .35 - (E.brow > 0 ? E.brow * .1 : 0);
    line(ex + side * 6.2, outer, ex - side * 5.2, inner, L.brow + (outline ? .6 : 0), L.hair);
  }
  if (L.eyepatch) {
    line(31, 40, 69, 36, 1.3, '#17181d');
    paint(ell(42, 45.5, 6.6, 5.6), '#17181d');
    line(38, 42.8, 46, 48.2, .7, '#3a3d4a');
  }
  if (L.freckles) for (const sx of [-1, 1]) for (const [dx, dy] of [[7, 5.5], [10.5, 7], [5, 8], [9, 9.5], [12.5, 5.5]]) { g.fillStyle = mix(L.skin, '#a0522d', .5); g.beginPath(); g.arc(50 + sx * dx, 46 + dy, .8, 0, 7); g.fill(); }
  {                                                                                                    // nose: bridge, tip and nostrils
    const N = NOSE_STYLES[L.noseStyle] || NOSE_STYLES.plain, ty = 46 + N.len, tx = 50 - N.lean * .3;
    if (N.red) { g.fillStyle = `rgba(214,96,96,${N.red})`; g.beginPath(); g.ellipse(tx + .4, ty + .2, N.tip * 1.15, N.tip * .9, 0, 0, 7); g.fill(); }
    g.beginPath(); g.moveTo(50 - .6, 45.5);
    if (N.bump) g.quadraticCurveTo(50 - N.lean - N.bump * .6, 47 + N.len * .35, 50 - N.lean * .6, ty - 1.6); else g.lineTo(50 - N.lean, ty - 1.4);
    g.lineWidth = N.bridge + (outline ? .3 : 0); g.strokeStyle = skinShade; g.lineCap = 'round'; g.stroke();
    if (N.hook) { g.beginPath(); g.moveTo(tx - N.w * .6, ty - .6); g.quadraticCurveTo(tx, ty + N.hook + 1.2, tx + N.w * .6, ty - .2); g.lineWidth = N.bridge; g.stroke(); }
    g.beginPath(); g.moveTo(tx - N.w, ty - N.up * .5 - .2); g.quadraticCurveTo(tx, ty + 1.6 - N.up * .9, tx + N.w, ty - N.up * .5 - .2);
    g.lineWidth = N.bridge; g.strokeStyle = skinShade; g.stroke();
    if (N.flare > .5) for (const sx of [-1, 1]) { g.fillStyle = 'rgba(70,28,24,.62)'; g.beginPath(); g.ellipse(tx + sx * N.w * .62, ty + .5 - N.up * .35, .8 * N.flare, .55 * N.flare, 0, 0, 7); g.fill(); }
  }
  if (L.scar) { const sx = 58.6, sy = 50.5; line(sx, sy, sx + 2.2, sy + 9.5, 1.5, '#b5605f'); for (const f of [.3, .65]) line(sx + 2.2 * f - 1.5, sy + 9.5 * f - .1, sx + 2.2 * f + 1.5, sy + 9.5 * f + .4, 1, '#b5605f'); }   // down the right cheek, clear of the eyes

  // mouth
  const MS = MOUTH_STYLES[L.mouthStyle] || MOUTH_STYLES.plain;
  const my = (L.stache ? 59.6 : 57) + MS.dy, open = Math.max(talk, 0);
  const mouthFill = '#6a2230', lineTone = mix(L.skin, '#401018', .6), lipTone = mix(L.skin, '#a8434f', MS.red + .12);
  g.save(); g.translate(50, 0); g.transform(MS.w, MS.tilt / 5, 0, 1, 0, 0); g.translate(-50, 0);          // the style's width, and a corner that sits higher
  if (talk > 0 && (E.mouth === 'flat' || E.mouth === 'smile' || E.mouth === 'wave')) { paint(ell(50, my + .5, 4.2 + (E.mouth === 'smile' ? 1 : 0), .8 + 3 * open), mouthFill); }
  else if (E.mouth === 'flat') {
    if (MS.lips) {
      paint((p) => { p.moveTo(44.5, my + MS.curl * .8); p.quadraticCurveTo(47.5, my - MS.lips * 1.3, 50, my - MS.lips * .7); p.quadraticCurveTo(52.5, my - MS.lips * 1.3, 55.5, my + MS.curl * .8); p.quadraticCurveTo(50, my + .4, 44.5, my + MS.curl * .8); p.closePath(); }, lipTone, false);
      paint((p) => { p.moveTo(45, my + MS.curl * .8); p.quadraticCurveTo(50, my + MS.lips * 2.8 + .4, 55, my + MS.curl * .8); p.quadraticCurveTo(50, my + .5, 45, my + MS.curl * .8); p.closePath(); }, mix(lipTone, '#ffffff', .12), false);
    }
    g.beginPath(); g.moveTo(44.6, my + MS.curl); g.quadraticCurveTo(50, my - MS.curl * .25 + .1, 55.4, my + MS.curl); g.lineWidth = 1.3; g.strokeStyle = lineTone; g.lineCap = 'round'; g.stroke();
  }
  else if (E.mouth === 'smile') {
    paint((p) => { p.moveTo(43.5, my - 1); p.quadraticCurveTo(50, my + 8, 56.5, my - 1); p.quadraticCurveTo(50, my + 1.2, 43.5, my - 1); }, '#ffffff');
    if (MS.lips) { g.lineWidth = MS.lips * .7; g.strokeStyle = lipTone; g.stroke(); }
  }
  else if (E.mouth === 'shout') paint(ell(50, my + 1, 5.4, 3.6 + 2 * open), mouthFill);
  else if (E.mouth === 'o') paint(ell(50, my + 2, 3.2, 4.2 + 2 * open), mouthFill);
  else { g.beginPath(); g.moveTo(44, my + 1); g.bezierCurveTo(47, my - 1.5, 48, my + 2.5, 50, my + .5); g.bezierCurveTo(52, my - 1.5, 53, my + 2.5, 56, my + 1); g.lineWidth = 1.4; g.strokeStyle = lineTone; g.stroke(); }
  g.restore();
  if (CS.crease) { g.beginPath(); g.moveTo(45.5, my + 4.6); g.quadraticCurveTo(50, my + 6.4, 54.5, my + 4.6); g.lineWidth = .9; g.strokeStyle = skinShade; g.lineCap = 'round'; g.stroke(); }
  if (CS.dimple) { g.lineWidth = CS.dimple === 'cleft' ? 1.2 : .8; g.strokeStyle = skinShade; g.beginPath(); g.moveTo(50, my + (CS.dimple === 'cleft' ? 6 : 6.4)); g.lineTo(50, my + (CS.dimple === 'cleft' ? 10.2 : 7.6)); g.stroke(); }
  if (CS.fold) { g.beginPath(); g.moveTo(39, 68.4); g.quadraticCurveTo(50, 73.2, 61, 68.4); g.lineWidth = .9; g.strokeStyle = skinShade; g.stroke(); }
  if (L.stache) paint((p) => { p.moveTo(50, 55.2); p.bezierCurveTo(44, 50.5, 34, 53, 34.5, 60.5); p.bezierCurveTo(40, 56.5, 45, 57, 50, 57.4); p.bezierCurveTo(55, 57, 60, 56.5, 65.5, 60.5); p.bezierCurveTo(66, 53, 56, 50.5, 50, 55.2); p.closePath(); }, L.hair);

  // hair, hats, glasses
  if (L.hairStyle === 'ponytail') paint((p) => { p.moveTo(29.5, 44); p.bezierCurveTo(28, 22, 72, 22, 70.5, 44); p.bezierCurveTo(68, 33, 56, 30, 50, 29.5); p.bezierCurveTo(44, 30, 32, 33, 29.5, 44); p.closePath(); }, L.hair);
  if (L.hairStyle === 'short') paint((p) => { p.moveTo(31.5, 40); p.bezierCurveTo(29, 14, 71, 14, 68.5, 40); p.lineTo(66, 32); p.bezierCurveTo(55, 25, 45, 25, 34, 32); p.closePath(); }, L.hair);
  if (L.hairStyle === 'bun') paint((p) => { p.moveTo(30, 44); p.bezierCurveTo(28, 14, 72, 14, 70, 44); p.bezierCurveTo(68, 33, 58, 28, 50, 28); p.bezierCurveTo(42, 28, 32, 33, 30, 44); p.closePath(); }, L.hair);
  if (L.hairStyle === 'regal') {                                                                       // centre-parted, swept back over the ears into ringlets
    for (const sx of [-1, 1]) {
      paint((p) => { p.moveTo(50, 26); p.bezierCurveTo(50 + sx * 10, 25.5, 50 + sx * 19, 31, 50 + sx * 20.5, 50); p.bezierCurveTo(50 + sx * 18.5, 53, 50 + sx * 15.5, 52, 50 + sx * 15.5, 49); p.bezierCurveTo(50 + sx * 15.5, 40, 50 + sx * 9, 33, 50, 31.5); p.closePath(); }, L.hair);
      for (const [y, r] of [[55, 3], [61, 2.8], [67, 2.5]]) paint(ell(50 + sx * 20.5 + (y - 55) * sx * -.15, y, r, r), L.hair);
    }
    if (shade) for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(50 + sx * 2, 27.5); g.quadraticCurveTo(50 + sx * 15, 28, 50 + sx * 18.5, 42); g.lineWidth = 1; g.strokeStyle = hairLight; g.lineCap = 'round'; g.stroke(); }
  }
  if (L.hairStyle === 'shaggy') {                                                                      // a messy fringe swept across the brow, with long sideburns
    paint(poly([[31, 52], [30, 36], [34, 24], [43, 19], [57, 19], [66, 24], [70, 36], [69, 52], [66.5, 44], [66, 40], [61, 36], [57, 40], [53, 35], [48, 41], [44, 35], [39, 39], [35, 38], [33.5, 44]]), L.hair);
    if (shade) { g.beginPath(); g.moveTo(40, 24); g.quadraticCurveTo(50, 22, 60, 25); g.lineWidth = 1.2; g.strokeStyle = hairLight; g.lineCap = 'round'; g.stroke(); }
  }
  if (L.hairStyle === 'wild') {                                                                        // the fringe, sticking up
    paint(poly([[31, 38], [30, 26], [36, 31], [38, 19], [43, 28], [47, 16], [51, 27], [56, 17], [59, 28], [64, 21], [64, 31], [70, 27], [69, 38], [66, 32], [58, 28], [42, 28], [34, 32]]), L.hair);
  }
  if (L.hairStyle === 'topknot') {                                                                     // an old warrior: hair at the sides, a tied knot on a bare crown
    paint(ell(31.6, 42, 3.4, 9.5), L.hair); paint(ell(68.4, 42, 3.4, 9.5), L.hair);
    paint(poly([[32, 33], [37, 28], [50, 25.5], [63, 28], [68, 33], [64, 30.5], [50, 28.5], [36, 30.5]]), L.hair);
    paint(ell(50, 17.5, 5.2, 6.4), L.hair); line(45.4, 24, 54.6, 24, 1.6, '#c03a30');
  }
  if (L.hairStyle === 'bald' && shade) { g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.ellipse(44, 29, 7, 3.4, -.4, 0, 7); g.fill(); }
  if (L.hat === 'cap') {
    paint((p) => { p.moveTo(29.5, 35); p.bezierCurveTo(28, 9, 72, 9, 70.5, 35); p.quadraticCurveTo(50, 31, 29.5, 35); p.closePath(); }, c);
    paint((p) => { p.moveTo(28.5, 34.5); p.quadraticCurveTo(50, 28.5, 71.5, 34.5); p.quadraticCurveTo(50, 44, 28.5, 34.5); p.closePath(); }, dk);   // the brim, seen from the front
    paint(poly([[50.0, 16.1], [51.6, 20.3], [56.1, 20.5], [52.6, 23.3], [53.8, 27.7], [50.0, 25.2], [46.2, 27.7], [47.4, 23.3], [43.9, 20.5], [48.4, 20.3]]), '#f6d35a', false);                                  // one star, centred on the cap
  }
  if (L.hat === 'cowboy') {
    const hc = '#c79552', hd = '#8a5a2a';
    paint((p) => { p.moveTo(10, 29); p.quadraticCurveTo(28, 43, 50, 41); p.quadraticCurveTo(72, 43, 90, 29); p.quadraticCurveTo(72, 33, 50, 31.5); p.quadraticCurveTo(28, 33, 10, 29); p.closePath(); }, hc);   // the wide, curled brim
    paint((p) => { p.moveTo(32, 36); p.lineTo(34, 15); p.quadraticCurveTo(42, 10, 50, 15); p.quadraticCurveTo(58, 10, 66, 15); p.lineTo(68, 36); p.quadraticCurveTo(50, 42, 32, 36); p.closePath(); }, hc);   // the dented crown
    paint((p) => { p.moveTo(32.3, 30.5); p.quadraticCurveTo(50, 36.5, 67.7, 30.5); p.lineTo(68, 35); p.quadraticCurveTo(50, 41, 32, 35); p.closePath(); }, hd);   // hat band
    paint(ell(50, 34.4, 2.6, 2.2), '#e8c050', false);
    if (shade) { g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(41, 21, 5, 3, -.4, 0, 7); g.fill(); }
  }
  if (L.hat === 'ushanka') {
    const f1 = '#8c7b66', f2 = '#a9987f';
    paint((p) => p.roundRect(24.5, 32, 10, 27, 5), f1); paint((p) => p.roundRect(65.5, 32, 10, 27, 5), f1);   // ear flaps
    paint((p) => { p.moveTo(27, 37); p.bezierCurveTo(24, 6, 76, 6, 73, 37); p.quadraticCurveTo(50, 31, 27, 37); p.closePath(); }, f1);
    paint((p) => p.roundRect(26, 29.5, 48, 10, 5), f2);
    paint(poly([[50, 14], [51.8, 18.4], [56.5, 18.6], [52.8, 21.4], [54.2, 26], [50, 23.2], [45.8, 26], [47.2, 21.4], [43.5, 18.6], [48.2, 18.4]]), '#cf2430', false);   // red star badge
    if (shade) { g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.ellipse(41, 18, 8, 3.4, -.4, 0, 7); g.fill(); }
  }
  if (L.hat === 'crown') {
    paint(poly([[34, 33], [33, 15], [41, 23], [50, 10], [59, 23], [67, 15], [66, 33]]), '#e8c050');
    paint((p) => p.rect(34, 28.5, 32, 4.5), '#c99a2a', false);
    for (const [x, y, col] of [[33, 14.5, '#d94b3a'], [50, 9.5, '#4a8fe0'], [67, 14.5, '#d94b3a']]) paint(ell(x, y, 2.1, 2.1), col, false);
    for (const x of [41, 50, 59]) paint(ell(x, 30.8, 1.3, 1.3), '#f4f6fa', false);
  }
  if (L.hat === 'helmet') {
    const hc = mix(c, '#4b5238', .55);
    paint((p) => { p.moveTo(28, 40); p.bezierCurveTo(24, 7, 76, 7, 72, 40); p.quadraticCurveTo(50, 33, 28, 40); p.closePath(); }, hc);
    paint(poly([[50.0, 17.3], [51.5, 21.4], [55.9, 21.6], [52.5, 24.3], [53.6, 28.5], [50.0, 26.1], [46.4, 28.5], [47.5, 24.3], [44.1, 21.6], [48.5, 21.4]]), '#d6d6d6', false);                                       // one star, centred on the helmet
  }
  if (L.hairStyle === 'long') paint((p) => { p.moveTo(30, 46); p.bezierCurveTo(28, 20, 72, 20, 70, 46); p.bezierCurveTo(68, 34, 58, 31, 50, 31); p.bezierCurveTo(42, 31, 32, 34, 30, 46); p.closePath(); }, L.hair);
  if (L.hat === 'captain') {
    paint((p) => { p.moveTo(29, 36); p.bezierCurveTo(27, 10, 73, 10, 71, 36); p.quadraticCurveTo(50, 31, 29, 36); p.closePath(); }, '#f4f6fa');
    paint((p) => { p.moveTo(28.5, 34); p.quadraticCurveTo(50, 29, 71.5, 34); p.lineTo(71.5, 37); p.quadraticCurveTo(50, 32, 28.5, 37); p.closePath(); }, dk);   // band
    paint((p) => { p.moveTo(26.5, 36.5); p.quadraticCurveTo(50, 30.5, 73.5, 36.5); p.quadraticCurveTo(50, 46, 26.5, 36.5); p.closePath(); }, '#1c2a44');   // peak
    paint(ell(50, 22, 4.2, 4.2), '#e8c050'); paint(ell(50, 22, 1.8, 1.8), '#f4f6fa', false);                                  // gold badge
    if (shade) { g.fillStyle = 'rgba(80,100,140,.14)'; g.beginPath(); g.ellipse(60, 22, 8, 10, 0, 0, 7); g.fill(); }
  }
  if (L.hat === 'headset') {
    g.beginPath(); g.arc(50, 41, 21.5, Math.PI * 1.08, Math.PI * 1.92); g.lineWidth = 2.6; g.strokeStyle = '#3a3d4a'; g.stroke();
    paint((p) => p.roundRect(66.2, 41, 6.2, 11, 2.5), '#3a3d4a'); paint((p) => p.roundRect(27.6, 41, 6.2, 11, 2.5), '#3a3d4a');
    g.beginPath(); g.moveTo(69, 52); g.quadraticCurveTo(68, 62, 58, 62.5); g.lineWidth = 1.3; g.strokeStyle = '#3a3d4a'; g.stroke(); paint(ell(57, 62.5, 2.2, 1.7), '#3a3d4a');
  }
  if (L.aviators) {                                                                                    // gold-rimmed, dark teardrop lenses
    for (const [ex, ey, side] of eyes) {
      paint((p) => { p.moveTo(ex - side * 7.2, ey - 4.6); p.quadraticCurveTo(ex + side * 1, ey - 6.4, ex + side * 6.4, ey - 3); p.quadraticCurveTo(ex + side * 7.6, ey + 6.4, ex, ey + 6.6); p.quadraticCurveTo(ex - side * 8.4, ey + 5.6, ex - side * 7.2, ey - 4.6); p.closePath(); }, '#2e2619');
      g.lineWidth = 1.2; g.strokeStyle = '#e0b84a'; g.stroke();
      if (shade) { g.fillStyle = 'rgba(190,225,255,.55)'; g.beginPath(); g.ellipse(ex - side * 2.8, ey - 2.4, 2.6, 1.1, -.5 * side, 0, 7); g.fill(); }
    }
    line(48.6, 42.6, 51.4, 42.6, 1.1, '#e0b84a'); line(35.2, 42, 31, 41.4, 1.1, '#e0b84a'); line(64.8, 42, 69, 41.4, 1.1, '#e0b84a');
  }
  if (L.glasses) {
    g.lineWidth = 1.4; g.strokeStyle = '#2a2018';
    for (const [ex, ey] of eyes) { g.beginPath(); g.arc(ex, ey, 6.4, 0, 7); g.stroke(); g.fillStyle = 'rgba(190,225,245,.22)'; g.fill(); }
    line(48.4, 45, 51.6, 45, 1.3, '#2a2018'); line(35.6, 44.5, 31, 43.5, 1.1, '#2a2018'); line(64.4, 44.5, 69, 43.5, 1.1, '#2a2018');
  }
  if (assim) {                                                                                         // the Chorus visor over the eyes, and a circuit line on the cheek
    paint((p) => p.roundRect(32, 40.2, 36, 9.6, 4.8), '#0b1218');
    g.fillStyle = 'rgba(126,240,255,.2)'; g.beginPath(); g.roundRect(33.5, 41.8, 33, 6.4, 3.2); g.fill();
    line(35.5, 45, 64.5, 45, 1.9, '#7ef0ff');
    line(67, 54, 62, 59, 1, 'rgba(126,240,255,.85)'); line(62, 59, 62, 66, 1, 'rgba(126,240,255,.85)');
  }
  g.restore();
}

// ---- style pipeline -------------------------------------------------------------------------------------------------------------
const cache = new Map();
const factionColors = {};
export const setFactions = (list) => list.forEach((f) => { factionColors[f.id] = f; });
const colorsOf = (L, assim = false) => (assim ? factionColors.chorus : factionColors[L.faction]) || { color: assim ? '#4fd3e6' : '#e8712c', dark: assim ? '#1f3b46' : '#9a3f0e' };

function renderBust(L, { px, expr, blink, talk, outline, shade = true, assim = false }) {
  const f = colorsOf(L, assim), cv = canvasOf(px), g = cv.getContext('2d');
  g.scale(px / 100, px / 100);
  bust(g, L, { c: assim ? '#6b7a88' : f.color, dk: assim ? '#323c46' : f.dark }, { expr, blink, talk, outline, shade, px, assim });
  return cv;
}

const lum = (r, gg, b) => (.299 * r + .587 * gg + .114 * b) / 255;

function styled(L, style, px, expr, blink, talk, assim = false) {
  const f = colorsOf(L, assim), c = f.color, dk = f.dark, out = canvasOf(px), g = out.getContext('2d');
  const S = (v) => v * px / 100;

  if (style === 'flat') {
    g.fillStyle = mix(c, NIGHT, .86); g.fillRect(0, 0, px, px);                                         // a dark backdrop, so every skin and hair colour stands out
    g.fillStyle = mix(c, NIGHT, .5); g.beginPath(); g.arc(px / 2, S(58), S(40), 0, 7); g.fill();
    g.lineWidth = S(1.6); g.strokeStyle = mix(c, '#ffffff', .22); g.stroke();
    g.drawImage(renderBust(L, { px, expr, blink, talk, outline: false, assim }), 0, 0);
  } else if (style === 'ink') {
    g.fillStyle = mix(c, NIGHT, .82); g.fillRect(0, 0, px, px);
    g.strokeStyle = mix(c, NIGHT, .55); g.lineWidth = S(3);
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; g.beginPath(); g.moveTo(px / 2 + Math.cos(a) * S(30), S(46) + Math.sin(a) * S(30)); g.lineTo(px / 2 + Math.cos(a) * S(90), S(46) + Math.sin(a) * S(90)); g.stroke(); }
    g.lineWidth = S(2.4); g.strokeStyle = INK; g.strokeRect(S(1.2), S(1.2), px - S(2.4), px - S(2.4));
    g.drawImage(renderBust(L, { px, expr, blink, talk, outline: true, assim }), 0, 0);
  } else if (style === 'pixel') {
    const N = 56, small = canvasOf(N), sg = small.getContext('2d');
    sg.drawImage(renderBust(L, { px: N, expr, blink, talk, outline: false, shade: false, assim }), 0, 0);
    const img = sg.getImageData(0, 0, N, N), d = img.data, solid = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) {                                                                  // posterise, then drop soft edges
      const a = d[i * 4 + 3] > 110; solid[i] = a ? 1 : 0;
      for (let k = 0; k < 3; k++) d[i * 4 + k] = Math.round(d[i * 4 + k] / 255 * 5) / 5 * 255;
      d[i * 4 + 3] = a ? 255 : 0;
    }
    const ink = hex(INK);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {                                         // a one-pixel outline round the figure
      const i = y * N + x; if (solid[i]) continue;
      if ((x > 0 && solid[i - 1]) || (x < N - 1 && solid[i + 1]) || (y > 0 && solid[i - N]) || (y < N - 1 && solid[i + N])) { d[i * 4] = ink[0]; d[i * 4 + 1] = ink[1]; d[i * 4 + 2] = ink[2]; d[i * 4 + 3] = 255; }
    }
    sg.putImageData(img, 0, 0);
    g.fillStyle = mix(c, NIGHT, .8); g.fillRect(0, 0, px, px);
    g.fillStyle = mix(c, NIGHT, .7);
    for (let y = 0; y < N; y += 2) for (let x = (y / 2) % 2 ? 1 : 0; x < N; x += 2) g.fillRect(Math.floor(x * px / N), Math.floor(y * px / N), Math.ceil(px / N), Math.ceil(px / N));   // checker dither
    g.imageSmoothingEnabled = false; g.drawImage(small, 0, 0, px, px);
  } else if (style === 'duotone') {
    const src = renderBust(L, { px, expr, blink, talk, outline: false, assim }), sg = src.getContext('2d');
    const img = sg.getImageData(0, 0, px, px), d = img.data, lo = hex('#0d1220'), mid = hex(c), hi = hex('#fff1cf');
    for (let i = 0; i < px * px; i++) {
      const l = Math.min(1, lum(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) * 1.12), t = l < .5 ? l * 2 : (l - .5) * 2, A = l < .5 ? lo : mid, B = l < .5 ? mid : hi;
      for (let k = 0; k < 3; k++) d[i * 4 + k] = A[k] + (B[k] - A[k]) * t;
    }
    sg.putImageData(img, 0, 0);
    g.fillStyle = mix(dk, '#000000', .3); g.fillRect(0, 0, px, px);
    g.fillStyle = dk; g.beginPath(); g.arc(px / 2, S(56), S(42), 0, 7); g.fill();
    g.drawImage(src, 0, 0);
  } else if (style === 'halftone') {
    g.fillStyle = mix(c, NIGHT, .88); g.fillRect(0, 0, px, px);
    const src = renderBust(L, { px, expr, blink, talk, outline: false, assim }), sg = src.getContext('2d');
    const d = sg.getImageData(0, 0, px, px).data;
    g.fillStyle = mix(c, NIGHT, .55);
    g.beginPath(); g.arc(px / 2, S(56), S(42), 0, 7); g.fill();
    const step = Math.max(3, px / 34);
    for (let y = step / 2; y < px; y += step) for (let x = step / 2; x < px; x += step) {
      const i = (Math.floor(y) * px + Math.floor(x)) * 4, a = d[i + 3] / 255;
      if (a < .5) continue;
      const l = lum(d[i], d[i + 1], d[i + 2]), r = step * .74 * Math.pow(1 - l, .85);
      if (r > .4) { g.fillStyle = dk; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    }
    g.drawImage(src, 0, 0);
    g.lineWidth = S(2.4); g.strokeStyle = INK; g.strokeRect(S(1.2), S(1.2), px - S(2.4), px - S(2.4));
  } else if (style === 'medallion') {
    g.clearRect(0, 0, px, px);
    const cx = px / 2, cy = px / 2, R = px * .47;
    g.fillStyle = dk; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
    g.fillStyle = '#e8c050'; g.beginPath(); g.arc(cx, cy, R * .93, 0, 7); g.fill();
    g.fillStyle = mix(c, NIGHT, .82); g.beginPath(); g.arc(cx, cy, R * .86, 0, 7); g.fill();
    g.save(); g.beginPath(); g.arc(cx, cy, R * .86, 0, 7); g.clip();
    g.fillStyle = mix(c, NIGHT, .5); g.beginPath(); g.arc(cx, cy + R * .3, R * .62, 0, 7); g.fill();
    g.drawImage(renderBust(L, { px, expr, blink, talk, outline: false, assim }), 0, S(2));
    g.restore();
    g.fillStyle = '#f6d35a';
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 - Math.PI / 2; g.beginPath(); g.arc(cx + Math.cos(a) * R * .965, cy + Math.sin(a) * R * .965, px * .012, 0, 7); g.fill(); }
  } else if (style === 'poster') {
    g.fillStyle = dk; g.fillRect(0, 0, px, px);
    g.fillStyle = c;
    for (let i = 0; i < 16; i += 2) { const a0 = (i / 16) * Math.PI * 2, a1 = ((i + 1) / 16) * Math.PI * 2; g.beginPath(); g.moveTo(px / 2, S(48)); g.arc(px / 2, S(48), px * 1.2, a0, a1); g.closePath(); g.fill(); }
    const fig = renderBust(L, { px, expr, blink, talk, outline: true, assim }), sil = canvasOf(px), sg = sil.getContext('2d');
    sg.drawImage(fig, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#ffffff'; sg.fillRect(0, 0, px, px);   // white silhouette for the sticker edge
    const w = Math.max(2, S(2.6));
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; g.drawImage(sil, Math.cos(a) * w, Math.sin(a) * w); }
    g.drawImage(fig, 0, 0);
    g.fillStyle = INK; g.fillRect(0, S(84), px, S(16));
    g.fillStyle = '#f6d35a'; g.font = `800 ${S(8.6)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(L.name.split(' ').slice(-1)[0].toUpperCase(), px / 2, S(92.4));
  }
  return out;
}

/** Paint one portrait at (0, 0), `px` device pixels square. `talk` is 0 (mouth closed) .. 1; it is rounded to three mouth shapes. */
export function drawPortrait(g, leader, { px, style = 'flat', expr = 'neutral', blink = false, talk = 0, assim = false }) {
  const t = talk <= 0 ? 0 : talk < .5 ? .5 : 1;
  const key = `${leader.id}|${assim?'A':'n'}|${style}|${expr}|${blink ? 1 : 0}|${t}|${px}`;
  let cv = cache.get(key);
  if (!cv) { cv = styled(leader, style, px, expr, blink, t, assim); cache.set(key, cv); if (cache.size > 900) cache.delete(cache.keys().next().value); }
  g.drawImage(cv, 0, 0);
}

/** A bust with no background (for half-body cut-outs and layouts that supply their own backdrop). */
export function drawCutout(g, leader, { px, expr = 'neutral', blink = false, talk = 0, outline = true, assim = false }) {
  const t = talk <= 0 ? 0 : talk < .5 ? .5 : 1;
  const key = `cut|${leader.id}|${assim?'A':'n'}|${expr}|${blink ? 1 : 0}|${t}|${px}|${outline ? 1 : 0}`;
  let cv = cache.get(key);
  if (!cv) { cv = renderBust(leader, { px, expr, blink, talk: t, outline, assim }); cache.set(key, cv); }
  g.drawImage(cv, 0, 0);
}

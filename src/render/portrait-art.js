// Leader portraits (src/render/portrait-art.js): a parametric bust (one drawing routine, driven by each leader's traits) pushed through a handful of art STYLES,
// so a direction can be judged on the same faces. A leader is a plain object of traits (see data/campaign.json); `assim` draws the
// leader as assimilated by the Chorus (visor, grey uniform, flat expression). Browser-only (it uses canvas and getImageData).
//
//   drawPortrait(g, leader, { px, style, expr, blink, talk, bg })   paints a px x px portrait at (0, 0) of g
//   STYLES, EXPRESSIONS, setFactions(list)   (leaders themselves are data: data/campaign.json)
// Portraits are cached per (leader, style, expression, blink, mouth, size), so animating a blink or a talking mouth is cheap.

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

const canvasOf = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// ---- the parametric bust, drawn in a 100 x 100 space ----------------------------------------------------------------------------
function bust(g, L, { c, dk }, { expr = 'neutral', blink = false, talk = 0, outline = false, shade = true, px = 100, assim = false }) {
  if (assim) {                                                                                         // taken over: washed-out, flat, never blinking
    L = { ...L, skin: mix(L.skin, '#aab6bf', .5), hair: mix(L.hair, '#59636d', .45), eye: '#7ef0ff', medals: 0, glasses: false, eyepatch: false };
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

  // body
  const bw = L.wide || 1, X = (x) => 50 + (x - 50) * bw;
  const bodyCol = L.coat ? '#eef0f5' : c;
  paint((p) => { p.moveTo(X(6), 101); p.bezierCurveTo(X(6), 82, X(24), 74, 50, 72); p.bezierCurveTo(X(76), 74, X(94), 82, X(94), 101); p.closePath(); }, bodyCol);
  paint(poly([[43, 71], [50, 88], [57, 71]]), L.coat ? c : '#e9e9ef');                                  // shirt (or the colour under a lab coat)
  paint(poly([[X(33), 74], [43, 71], [50, 88], [38, 90]]), L.coat ? '#dfe3ec' : mix(c, dk, .45));      // collar flaps
  paint(poly([[X(67), 74], [57, 71], [50, 88], [62, 90]]), L.coat ? '#dfe3ec' : mix(c, dk, .45));
  if (!L.coat) {
    for (const sx of [-1, 1]) paint((p) => p.roundRect(sx > 0 ? X(70) : X(14), 77, 17 * bw, 6.5, 3), dk);   // epaulets
    for (const sx of [-1, 1]) line(sx > 0 ? X(72) : X(16), 80.2, sx > 0 ? X(85) : X(29), 80.2, 1.4, '#e8c050');
    for (let i = 0; i < L.medals; i++) paint(ell(60 + (i % 3) * 4.6, 90 + Math.floor(i / 3) * 4.6, 1.8, 1.8), i % 2 ? '#d94b3a' : '#e8c050', false);
  } else line(X(10), 90, X(10), 101, 0.001, bodyCol);
  if (assim) for (const dy of [0, 5]) paint(poly([[44, 87 + dy], [50, 91 + dy], [56, 87 + dy], [56, 89.6 + dy], [50, 93.6 + dy], [44, 89.6 + dy]]), '#7ef0ff', false);   // the Chorus chevrons

  // neck
  paint((p) => p.roundRect(43, 58, 14, 17, 3), L.skin, false);
  paint(poly([[43, 63], [57, 63], [57, 70], [50, 74], [43, 70]]), skinShade, false);
  if (L.tallCollar) {
    paint(poly([[36, 76], [38, 57], [46, 62], [46, 77]]), mix(c, dk, .55));
    paint(poly([[64, 76], [62, 57], [54, 62], [54, 77]]), mix(c, dk, .55));
    line(38, 59, 46, 63, 1, '#e8c050'); line(62, 59, 54, 63, 1, '#e8c050');
  }

  // ears and head
  paint(ell(30.8, 47, 3.4, 5), L.skin); paint(ell(69.2, 47, 3.4, 5), L.skin);
  const head = { oval: (p) => p.ellipse(50, 44, 19, 22, 0, 0, 7), long: (p) => p.ellipse(50, 45, 17.5, 24.5, 0, 0, 7), round: (p) => p.ellipse(50, 45, 21, 21, 0, 0, 7), square: (p) => p.roundRect(31.5, 22, 37, 45, [11, 11, 16, 16]) }[L.jaw];
  paint(head, L.skin);
  if (shade) {                                                                                         // soft shadow down the far side of the face and under the hair
    g.save(); g.beginPath(); head(g); g.clip();
    g.fillStyle = 'rgba(70,30,15,.16)'; g.beginPath(); g.ellipse(70, 50, 14, 30, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(70,30,15,.12)'; g.fillRect(30, 62, 40, 10);
    g.restore();
  }
  if (L.stubble) { g.save(); g.beginPath(); head(g); g.clip(); g.fillStyle = 'rgba(70,70,80,.26)'; g.beginPath(); g.ellipse(50, 66, 21, 13, 0, 0, 7); g.fill(); g.restore(); }

  // expression
  const E = { neutral: { open: 1, brow: 0, mouth: 'flat' }, smile: { open: .8, brow: -.5, mouth: 'smile' }, angry: { open: .8, brow: 3.6, mouth: 'shout' }, shock: { open: 1.25, brow: -3.4, mouth: 'o' }, worried: { open: 1, brow: -3.2, mouth: 'wave' } }[expr] || { open: 1, brow: 0, mouth: 'flat' };
  const eyeOpen = blink ? .12 : E.open;
  const eyes = [[42, 45, -1], [58, 45, 1]];
  for (const [ex, ey, side] of eyes) {
    if (L.eyepatch && side < 0) continue;
    paint(ell(ex, ey, 4.4, 3.5 * eyeOpen + .3), '#ffffff');
    if (eyeOpen > .3) { g.save(); g.beginPath(); g.ellipse(ex, ey, 4.4, 3.5 * eyeOpen + .3, 0, 0, 7); g.clip(); paint(ell(ex + .4 * side, ey, 2.6, 2.9), L.eye, false); paint(ell(ex + .4 * side, ey, 1.2, 1.4), '#10121a', false); g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + 1.2, ey - 1.1, .7, 0, 7); g.fill(); g.restore(); }
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
  line(50, 46, 48.4, 52.6, 1.1, skinShade); line(48.4, 52.6, 50.6, 53.1, 1.1, skinShade);          // nose
  if (L.scar) { line(34.5, 35, 45, 55, 1.5, '#b5605f'); for (const t of [.3, .55, .8]) line(34.5 + 10.5 * t - 1.6, 35 + 20 * t + .2, 34.5 + 10.5 * t + 1.6, 35 + 20 * t - .2, 1, '#b5605f'); }

  // mouth
  const my = L.stache ? 59.6 : 57, open = Math.max(talk, 0);
  const mouthFill = '#6a2230';
  if (talk > 0 && (E.mouth === 'flat' || E.mouth === 'smile' || E.mouth === 'wave')) { paint(ell(50, my + .5, 4.2 + (E.mouth === 'smile' ? 1 : 0), .8 + 3 * open), mouthFill); }
  else if (E.mouth === 'flat') line(45, my, 55, my, 1.4, mix(L.skin, '#401018', .6));
  else if (E.mouth === 'smile') { paint((p) => { p.moveTo(43.5, my - 1); p.quadraticCurveTo(50, my + 8, 56.5, my - 1); p.quadraticCurveTo(50, my + 1.2, 43.5, my - 1); }, '#ffffff'); }
  else if (E.mouth === 'shout') paint(ell(50, my + 1, 5.4, 3.6 + 2 * open), mouthFill);
  else if (E.mouth === 'o') paint(ell(50, my + 2, 3.2, 4.2 + 2 * open), mouthFill);
  else { g.beginPath(); g.moveTo(44, my + 1); g.bezierCurveTo(47, my - 1.5, 48, my + 2.5, 50, my + .5); g.bezierCurveTo(52, my - 1.5, 53, my + 2.5, 56, my + 1); g.lineWidth = 1.4; g.strokeStyle = mix(L.skin, '#401018', .6); g.stroke(); }
  if (L.stache) paint((p) => { p.moveTo(50, 55.2); p.bezierCurveTo(44, 50.5, 34, 53, 34.5, 60.5); p.bezierCurveTo(40, 56.5, 45, 57, 50, 57.4); p.bezierCurveTo(55, 57, 60, 56.5, 65.5, 60.5); p.bezierCurveTo(66, 53, 56, 50.5, 50, 55.2); p.closePath(); }, L.hair);

  // hair, hats, glasses
  if (L.hairStyle === 'ponytail') paint((p) => { p.moveTo(29.5, 44); p.bezierCurveTo(28, 22, 72, 22, 70.5, 44); p.bezierCurveTo(68, 33, 56, 30, 50, 29.5); p.bezierCurveTo(44, 30, 32, 33, 29.5, 44); p.closePath(); }, L.hair);
  if (L.hairStyle === 'short') paint((p) => { p.moveTo(31.5, 40); p.bezierCurveTo(29, 14, 71, 14, 68.5, 40); p.lineTo(66, 32); p.bezierCurveTo(55, 25, 45, 25, 34, 32); p.closePath(); }, L.hair);
  if (L.hairStyle === 'bun') paint((p) => { p.moveTo(30, 44); p.bezierCurveTo(28, 14, 72, 14, 70, 44); p.bezierCurveTo(68, 33, 58, 28, 50, 28); p.bezierCurveTo(42, 28, 32, 33, 30, 44); p.closePath(); }, L.hair);
  if (L.hairStyle === 'bald' && shade) { g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.ellipse(44, 29, 7, 3.4, -.4, 0, 7); g.fill(); }
  if (L.hat === 'cap') {
    paint((p) => { p.moveTo(29.5, 35); p.bezierCurveTo(28, 9, 72, 9, 70.5, 35); p.quadraticCurveTo(50, 31, 29.5, 35); p.closePath(); }, c);
    paint((p) => { p.moveTo(28.5, 34.5); p.quadraticCurveTo(50, 28.5, 71.5, 34.5); p.quadraticCurveTo(50, 44, 28.5, 34.5); p.closePath(); }, dk);   // the brim, seen from the front
    paint(poly([[50, 14], [51.8, 18.4], [56.5, 18.6], [52.8, 21.4], [54.2, 26], [50, 23.2], [45.8, 26], [47.2, 21.4], [43.5, 18.6], [48.2, 18.4]]), '#f6d35a', false);
    paint(ell(40, 21, 4.4, 4.4), '#bfe4f0'); paint(ell(60, 21, 4.4, 4.4), '#bfe4f0');                    // goggles pushed up on the cap
    line(35.6, 21, 64.4, 21, 1, '#5a4a3a', 'butt');
  }
  if (L.hat === 'helmet') {
    const hc = mix(c, '#4b5238', .55);
    paint((p) => { p.moveTo(28, 40); p.bezierCurveTo(24, 7, 76, 7, 72, 40); p.quadraticCurveTo(50, 33, 28, 40); p.closePath(); }, hc);
    paint((p) => { p.moveTo(27, 39); p.quadraticCurveTo(50, 31.5, 73, 39); p.lineTo(72.5, 42.5); p.quadraticCurveTo(50, 35.5, 27.5, 42.5); p.closePath(); }, dk);   // helmet band
    paint(poly([[50, 14.5], [52, 19.5], [57, 19.8], [53, 23], [54.6, 28], [50, 25], [45.4, 28], [47, 23], [43, 19.8], [48, 19.5]]), '#d6d6d6', false);
    line(31.5, 41, 33.5, 60, 1.4, mix(hc, '#000', .3)); line(68.5, 41, 66.5, 60, 1.4, mix(hc, '#000', .3));   // chin strap
    if (shade) { g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.ellipse(41, 21, 9, 4, -.5, 0, 7); g.fill(); }
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
    g.fillStyle = mix(c, '#ffffff', .62); g.fillRect(0, 0, px, px);
    g.fillStyle = mix(c, '#ffffff', .4); g.beginPath(); g.arc(px / 2, S(58), S(40), 0, 7); g.fill();
    g.drawImage(renderBust(L, { px, expr, blink, talk, outline: false, assim }), 0, 0);
  } else if (style === 'ink') {
    g.fillStyle = mix(c, '#ffffff', .15); g.fillRect(0, 0, px, px);
    g.strokeStyle = mix(c, '#ffffff', .4); g.lineWidth = S(3);
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
    g.fillStyle = mix(c, dk, .3); g.fillRect(0, 0, px, px);
    g.fillStyle = mix(c, dk, .15);
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
    g.fillStyle = '#f4ead2'; g.fillRect(0, 0, px, px);
    const src = renderBust(L, { px, expr, blink, talk, outline: false, assim }), sg = src.getContext('2d');
    const d = sg.getImageData(0, 0, px, px).data;
    g.fillStyle = mix(c, '#ffffff', .35);
    g.beginPath(); g.arc(px / 2, S(56), S(42), 0, 7); g.fill();
    const step = Math.max(3, px / 34);
    for (let y = step / 2; y < px; y += step) for (let x = step / 2; x < px; x += step) {
      const i = (Math.floor(y) * px + Math.floor(x)) * 4, a = d[i + 3] / 255;
      if (a < .5) continue;
      const l = lum(d[i], d[i + 1], d[i + 2]), r = step * .74 * Math.pow(1 - l, .85);
      if (r > .4) { g.fillStyle = dk; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    }
    g.save(); g.globalAlpha = .55; g.globalCompositeOperation = 'multiply'; g.drawImage(src, 0, 0); g.restore();
    g.lineWidth = S(2.4); g.strokeStyle = INK; g.strokeRect(S(1.2), S(1.2), px - S(2.4), px - S(2.4));
  } else if (style === 'medallion') {
    g.clearRect(0, 0, px, px);
    const cx = px / 2, cy = px / 2, R = px * .47;
    g.fillStyle = dk; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
    g.fillStyle = '#e8c050'; g.beginPath(); g.arc(cx, cy, R * .93, 0, 7); g.fill();
    g.fillStyle = mix(c, '#ffffff', .4); g.beginPath(); g.arc(cx, cy, R * .86, 0, 7); g.fill();
    g.save(); g.beginPath(); g.arc(cx, cy, R * .86, 0, 7); g.clip();
    g.fillStyle = mix(c, '#ffffff', .2); g.beginPath(); g.arc(cx, cy + R * .3, R * .62, 0, 7); g.fill();
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

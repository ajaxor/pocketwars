// What an attack looks like, matched to the weapon: tracers for rifles and machine guns, a muzzle flash and a shell for cannons, lobbed
// shells for artillery, smoke-trailed rockets and guided missiles, a stream of fire, a bolt of lightning, a slash, a harpoon on its line,
// a torpedo with a bubbly wake, a depth charge that sinks, bombs that fall. Pure drawing: no DOM, no game state.
//
//   attackSpec(name)           { name, d, hit, impact?, lunge? }: how long the animation runs, when the blow lands (ms from the start),
//                              how the impact looks, and whether the attacker lunges. Unknown names fall back to a plain bullet.
//   drawAttack(g, f, p, S, now)   draws one running animation `f` (from Effects.strike) at progress p (0..1) on a tile size S
//   drawImpact(g, f, p, S)     the burst where a blow lands (style: blast | spark | fire | zap | splash | flak)
//
// A weapon picks its look with `fx` in data/weapons.json; a unit's `render.attackFx` is the fallback for a weapon that names none.
// The old names (shot, arc, drop) still work as aliases.

export const ALIASES = { shot: 'bullet', arc: 'shell', drop: 'bombs' };

const SPECS = {
  bullet:       { d: 220, hit: 200, impact: 'spark' },
  burst:        { d: 580, hit: 540, impact: 'spark' },
  sniper:       { d: 360, hit: 300, impact: 'spark' },
  cannon:       { d: 330, hit: 300, impact: 'blast' },
  heavy_cannon: { d: 390, hit: 350, impact: 'blast' },
  flak:         { d: 500, hit: 430, impact: 'flak' },
  shell:        { d: 620, hit: 580, impact: 'blast' },
  mortar:       { d: 700, hit: 660, impact: 'blast' },
  naval_shell:  { d: 640, hit: 600, impact: 'blast' },
  rocket:       { d: 480, hit: 450, impact: 'blast' },
  salvo:        { d: 800, hit: 760, impact: 'blast' },
  pods:         { d: 600, hit: 560, impact: 'blast' },
  missile:      { d: 780, hit: 740, impact: 'blast' },
  sam:          { d: 820, hit: 780, impact: 'blast' },
  cruise:       { d: 940, hit: 900, impact: 'blast' },
  flame:        { d: 600, hit: 420, impact: 'fire' },
  electric:     { d: 480, hit: 170, impact: 'zap' },
  slash:        { d: 340, hit: 150, impact: 'spark', lunge: true },
  wrench:       { d: 380, hit: 190, impact: 'spark', lunge: true },
  harpoon:      { d: 440, hit: 400, impact: 'spark' },
  torpedo:      { d: 660, hit: 640, impact: 'splash' },
  depth:        { d: 860, hit: 820, impact: 'splash' },
  bombs:        { d: 600, hit: 580, impact: 'blast' },
  light_bombs:  { d: 540, hit: 520, impact: 'blast' },
  lunge:        { d: 360, hit: 180, impact: 'blast', lunge: true },
};

/** Every attack look a weapon (or unit) may name. */
export const ATTACK_FX_NAMES = [...Object.keys(SPECS), ...Object.keys(ALIASES)];

export function attackSpec(name) {
  const key = ALIASES[name] || name;
  const spec = SPECS[key] || SPECS.bullet;
  return { name: SPECS[key] ? key : 'bullet', ...spec };
}

// ---- helpers ------------------------------------------------------------------------------------------------------------------------
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => x * x;                                  // accelerating
const rnd = (n) => { const s = Math.sin(n * 12.9898 + 4.1414) * 43758.5453; return s - Math.floor(s); };   // 0..1, the same for the same n
const lerp = (a, b, q) => a + (b - a) * q;

/** The geometry of one attack in pixels: start, end, direction, unit vectors along and across. */
function geo(f, S) {
  const x0 = f.x0 * S, y0 = f.y0 * S, x1 = f.x1 * S, y1 = f.y1 * S;
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
  return { x0, y0, x1, y1, len, ux: dx / len, uy: dy / len, nx: -dy / len, ny: dx / len, a: Math.atan2(dy, dx) };
}

function flash(g, x, y, a, size, p, color = '#fff3b0') {
  if (p >= 1) return;
  g.save(); g.translate(x, y); g.rotate(a); g.globalAlpha = 1 - p;
  g.fillStyle = color;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(size * .9, -size * .35); g.lineTo(size * 1.5, 0); g.lineTo(size * .9, size * .35); g.closePath(); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(size * .15, 0, size * .28, 0, 7); g.fill();
  g.restore();
}

function puff(g, x, y, r, alpha, color = '#cfd2d6') {
  if (alpha <= 0) return;
  g.save(); g.globalAlpha = alpha; g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.restore();
}

/** A dotted trail of smoke behind a moving point: `at(q)` gives the point at progress q; the trail covers `span` of the progress. */
function smokeTrail(g, at, p, span, S, { n = 9, r = .045, color = '#d7dadf', grow = 1.6 } = {}) {
  for (let i = 1; i <= n; i++) {
    const q = p - (i / n) * span;
    if (q < 0) break;
    const [x, y] = at(q);
    const age = i / n;
    puff(g, x, y, S * r * (1 + age * grow), (1 - age) * .75, color);
  }
}

function body(g, x, y, a, len, wid, color, tip = '#e04a3a') {
  g.save(); g.translate(x, y); g.rotate(a);
  g.fillStyle = color; g.beginPath(); g.moveTo(len * .55, 0); g.lineTo(len * .1, -wid); g.lineTo(-len * .5, -wid); g.lineTo(-len * .5, wid); g.lineTo(len * .1, wid); g.closePath(); g.fill();
  g.fillStyle = tip; g.beginPath(); g.moveTo(len * .55, 0); g.lineTo(len * .25, -wid * .9); g.lineTo(len * .25, wid * .9); g.closePath(); g.fill();
  g.fillStyle = '#8a8f99'; g.beginPath(); g.moveTo(-len * .5, -wid); g.lineTo(-len * .72, -wid * 2); g.lineTo(-len * .3, -wid); g.fill(); g.beginPath(); g.moveTo(-len * .5, wid); g.lineTo(-len * .72, wid * 2); g.lineTo(-len * .3, wid); g.fill();
  g.restore();
}

function exhaust(g, x, y, a, size, now) {
  g.save(); g.translate(x, y); g.rotate(a);
  const f = .7 + .3 * Math.sin(now / 30);
  g.fillStyle = '#ff8a2e'; g.beginPath(); g.moveTo(0, -size * .35); g.lineTo(-size * 2.2 * f, 0); g.lineTo(0, size * .35); g.fill();
  g.fillStyle = '#fff3b0'; g.beginPath(); g.moveTo(0, -size * .18); g.lineTo(-size * 1.2 * f, 0); g.lineTo(0, size * .18); g.fill();
  g.restore();
}

// ---- the looks ----------------------------------------------------------------------------------------------------------------------
function tracer(g, q, G, S, { len = .2, w = 2.2, color = '#ffe45c' } = {}) {
  const x = lerp(G.x0, G.x1, q), y = lerp(G.y0, G.y1, q), l = S * len;
  g.save(); g.lineCap = 'round';
  g.strokeStyle = 'rgba(255,200,60,.55)'; g.lineWidth = w * 2.4; g.beginPath(); g.moveTo(x - G.ux * l, y - G.uy * l); g.lineTo(x, y); g.stroke();
  g.strokeStyle = color; g.lineWidth = w; g.beginPath(); g.moveTo(x - G.ux * l, y - G.uy * l); g.lineTo(x, y); g.stroke();
  g.strokeStyle = '#fff'; g.lineWidth = w * .5; g.beginPath(); g.moveTo(x - G.ux * l * .4, y - G.uy * l * .4); g.lineTo(x, y); g.stroke();
  g.restore();
}

function shot(g, f, p, S, G, { r = .06, glow = '#ffcf4a', big = false } = {}) {
  const q = clamp01(p / .85);
  const x = lerp(G.x0, G.x1, q), y = lerp(G.y0, G.y1, q);
  flash(g, G.x0 + G.ux * S * .25, G.y0 + G.uy * S * .25, G.a, S * (big ? .5 : .32), clamp01(p / .25));
  if (p < .55) puff(g, G.x0 + G.ux * S * .3, G.y0 + G.uy * S * .3 - S * .05 * p * 4, S * (big ? .14 : .09) * (1 + p * 3), (1 - p / .55) * .5);
  if (q >= 1) return;
  g.fillStyle = glow; g.globalAlpha = .55; g.beginPath(); g.arc(x, y, S * r * 1.9, 0, 7); g.fill(); g.globalAlpha = 1;
  g.fillStyle = '#2b2f36'; g.beginPath(); g.arc(x, y, S * r, 0, 7); g.fill();
}

/** A lobbed projectile with a shadow on the ground: height `h` in tiles. */
function lob(g, f, p, S, G, { h = 1.1, r = .07, color = '#2b2f36', heavy = false, now = 0 } = {}) {
  const q = clamp01(p / .93);
  flash(g, G.x0 + G.ux * S * .2, G.y0 + G.uy * S * .2 - S * .1, G.a - .5, S * (heavy ? .55 : .35), clamp01(p / .2));
  if (p < .6) puff(g, G.x0, G.y0 - S * .2, S * (heavy ? .16 : .1) * (1 + p * 3), (1 - p / .6) * .55);
  if (q >= 1) return;
  const gx = lerp(G.x0, G.x1, q), gy = lerp(G.y0, G.y1, q), lift = Math.sin(Math.PI * q) * S * h;
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(gx, gy + S * .1, S * r * 1.2, S * r * .5, 0, 0, 7); g.fill();
  smokeTrail(g, (u) => [lerp(G.x0, G.x1, u), lerp(G.y0, G.y1, u) - Math.sin(Math.PI * u) * S * h], q, .22, S, { n: 6, r: .03, grow: 1 });
  g.fillStyle = color; g.beginPath(); g.arc(gx, gy - lift, S * r, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(gx - S * r * .3, gy - lift - S * r * .3, S * r * .35, 0, 7); g.fill();
}

function rocketAt(g, G, q, S, now, { arcH = 0, off = 0, size = .22, lag = 0 } = {}) {
  if (q <= 0 || q >= 1) return null;
  const e = ease(q) * .6 + q * .4;
  const at = (u) => { const w = ease(u) * .6 + u * .4; return [lerp(G.x0, G.x1, w) + G.nx * off * S * Math.sin(Math.PI * w), lerp(G.y0, G.y1, w) + G.ny * off * S * Math.sin(Math.PI * w) - Math.sin(Math.PI * w) * arcH * S]; };
  const [x, y] = at(q);
  const [xb, yb] = at(Math.max(0, q - .02));
  const a = Math.atan2(y - yb, x - xb);
  smokeTrail(g, at, q, .35, S, { n: 10, r: .035 });
  exhaust(g, x - Math.cos(a) * S * size * .4, y - Math.sin(a) * S * size * .4, a, S * .06, now);
  body(g, x, y, a, S * size, S * .028, '#d9dde3');
  return e;
}

function guided(g, G, q, S, now, ctrl, { size = .3, wid = .034 } = {}) {
  if (q <= 0 || q >= 1) return;
  const at = (u) => { const m = 1 - u; return [m * m * G.x0 + 2 * m * u * ctrl[0] + u * u * G.x1, m * m * G.y0 + 2 * m * u * ctrl[1] + u * u * G.y1]; };
  const [x, y] = at(q), [xb, yb] = at(Math.max(0, q - .02));
  const a = Math.atan2(y - yb, x - xb);
  smokeTrail(g, at, q, .45, S, { n: 14, r: .04, grow: 2 });
  exhaust(g, x - Math.cos(a) * S * size * .4, y - Math.sin(a) * S * size * .4, a, S * .07, now);
  body(g, x, y, a, S * size, S * wid, '#f2f4f7');
}

const DRAW = {
  bullet(g, f, p, S) { const G = geo(f, S); flash(g, G.x0 + G.ux * S * .22, G.y0 + G.uy * S * .22, G.a, S * .22, clamp01(p / .3)); const q = clamp01((p - .1) / .8); if (q > 0 && q < 1) tracer(g, q, G, S, { len: .16, w: 2 }); },

  burst(g, f, p, S, now) {   // a machine gun: a string of tracers and a flickering muzzle flash
    const G = geo(f, S);
    for (let i = 0; i < 7; i++) {
      const q = (p - i * .1) / .22;
      if (q > 0 && q < 1) tracer(g, clamp01(q), G, S, { len: .14, w: 1.8 });
    }
    if (p < .75) flash(g, G.x0 + G.ux * S * .22 + G.nx * rnd(Math.floor(now / 45)) * S * .03, G.y0 + G.uy * S * .22, G.a + (rnd(Math.floor(now / 45) + 3) - .5) * .5, S * (.16 + .1 * rnd(Math.floor(now / 45) + 7)), (Math.floor(now / 45) % 2) * .35);
  },

  sniper(g, f, p, S) {   // a glint in the scope, then one thin bright line
    const G = geo(f, S);
    if (p < .4) { const k = Math.sin(Math.PI * clamp01(p / .4)); g.save(); g.translate(G.x0 + G.ux * S * .15, G.y0 + G.uy * S * .15 - S * .1); g.strokeStyle = 'rgba(255,255,255,' + k + ')'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-S * .1 * k, 0); g.lineTo(S * .1 * k, 0); g.moveTo(0, -S * .1 * k); g.lineTo(0, S * .1 * k); g.stroke(); g.restore(); }
    if (p > .4 && p < .95) { const k = 1 - (p - .4) / .55; g.save(); g.lineCap = 'round'; g.globalAlpha = k; g.strokeStyle = '#bfe3ff'; g.lineWidth = 4; g.beginPath(); g.moveTo(G.x0, G.y0); g.lineTo(G.x1, G.y1); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(G.x0, G.y0); g.lineTo(G.x1, G.y1); g.stroke(); g.restore(); flash(g, G.x0 + G.ux * S * .2, G.y0 + G.uy * S * .2, G.a, S * .2, 1 - k); }
  },

  cannon(g, f, p, S) { shot(g, f, p, S, geo(f, S), { r: .07, glow: '#ffb347' }); },
  heavy_cannon(g, f, p, S) { shot(g, f, p, S, geo(f, S), { r: .095, glow: '#ff9a2e', big: true }); },

  flak(g, f, p, S, now) {   // tracers streak up, then black puffs with a red heart burst around the target
    const G = geo(f, S);
    for (let i = 0; i < 3; i++) { const q = (p - i * .06) / .3; if (q > 0 && q < 1) tracer(g, clamp01(q), G, S, { len: .12, w: 1.6, color: '#ffd9a0' }); }
    for (let i = 0; i < 5; i++) {
      const s = (p - .3 - i * .07) / .45;
      if (s <= 0 || s >= 1) continue;
      const x = G.x1 + (rnd(i * 3 + 1) - .5) * S * .8, y = G.y1 + (rnd(i * 3 + 2) - .6) * S * .7;
      puff(g, x, y, S * (.1 + .12 * s), (1 - s) * .85, '#2c2f36');
      puff(g, x, y, S * .06 * (1 - s), 1 - s, '#ff6a3d');
    }
    if (p < .25) flash(g, G.x0 + G.ux * S * .2, G.y0 + G.uy * S * .2, G.a, S * .2, p / .25);
  },

  shell(g, f, p, S, now) { lob(g, f, p, S, geo(f, S), { h: 1.1, r: .07, now }); },
  mortar(g, f, p, S, now) { lob(g, f, p, S, geo(f, S), { h: 1.6, r: .055, color: '#3a3d33', now }); },
  naval_shell(g, f, p, S, now) { lob(g, f, p, S, geo(f, S), { h: .7, r: .085, heavy: true, now }); },

  rocket(g, f, p, S, now) { const G = geo(f, S); flash(g, G.x0 + G.ux * S * .2, G.y0 + G.uy * S * .2, G.a, S * .3, clamp01(p / .25), '#ffd7a0'); puff(g, G.x0 - G.ux * S * .15, G.y0 - G.uy * S * .15, S * .12 * (1 + p * 2), (1 - clamp01(p / .5)) * .6); rocketAt(g, G, p / .94, S, now, { size: .2 }); },

  salvo(g, f, p, S, now) {   // several rockets, one after the other, fanning out as they arc over
    const G = geo(f, S);
    for (let i = 0; i < 4; i++) rocketAt(g, G, (p - i * .09) / .6, S, now, { arcH: .55, off: (i - 1.5) * .09, size: .17 });
    if (p < .4) flash(g, G.x0 + G.ux * S * .2, G.y0 + G.uy * S * .2 - S * .08, G.a - .4, S * .32, (p / .4) * .7, '#ffd7a0');
  },

  pods(g, f, p, S, now) {    // a helicopter's rocket pods: three quick rockets, almost flat
    const G = geo(f, S);
    for (let i = 0; i < 3; i++) rocketAt(g, G, (p - i * .1) / .7, S, now, { off: (i - 1) * .06, size: .15 });
    if (p < .35) flash(g, G.x0 + G.ux * S * .2, G.y0 + G.uy * S * .2, G.a, S * .22, p / .35, '#ffd7a0');
  },

  missile(g, f, p, S, now) {   // launched upward, then curving down onto the target
    const G = geo(f, S);
    flash(g, G.x0, G.y0 - S * .1, -Math.PI / 2, S * .35, clamp01(p / .2), '#ffd7a0');
    guided(g, G, p / .95, S, now, [lerp(G.x0, G.x1, .35) + G.nx * S * .15, Math.min(G.y0, G.y1) - S * .75]);
  },

  sam(g, f, p, S, now) {      // straight up, then over onto an aircraft
    const G = geo(f, S);
    flash(g, G.x0, G.y0 - S * .1, -Math.PI / 2, S * .45, clamp01(p / .2), '#ffd7a0');
    puff(g, G.x0, G.y0, S * .18 * (1 + p * 2), (1 - clamp01(p / .6)) * .6);
    guided(g, G, p / .95, S, now, [G.x0 + G.ux * S * .15, Math.min(G.y0, G.y1) - S * 1.25], { size: .34, wid: .038 });
  },

  cruise(g, f, p, S, now) {   // a big missile rising to a high arc, long smoke
    const G = geo(f, S);
    flash(g, G.x0, G.y0 - S * .1, -Math.PI / 2, S * .45, clamp01(p / .2), '#ffd7a0');
    guided(g, G, p / .96, S, now, [lerp(G.x0, G.x1, .3), Math.min(G.y0, G.y1) - S * 1.5], { size: .4, wid: .04 });
  },

  flame(g, f, p, S, now) {   // a stream of fire: bright at the nozzle, spreading and dying out towards the target
    const G = geo(f, S);
    const reach = clamp01(p / .55), fade = clamp01((p - .6) / .4);
    for (let i = 0; i < 34; i++) {
      const t = i / 33;
      if (t > reach) break;
      const wob = (rnd(i * 7 + Math.floor(now / 60)) - .5) * (.05 + .22 * t) * S;
      const x = G.x0 + G.ux * G.len * t * 1.0 + G.nx * wob, y = G.y0 + G.uy * G.len * t * 1.0 + G.ny * wob - S * .03 * t;
      const r = S * (.05 + .13 * t) * (1 - fade);
      const hue = t < .3 ? '#fff3b0' : t < .6 ? '#ffb02e' : '#e8501e';
      g.save(); g.globalAlpha = (1 - fade) * (.9 - .35 * t); g.fillStyle = hue; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.restore();
    }
    if (p < .75) { g.save(); g.globalAlpha = .55 * (1 - p); g.fillStyle = '#ffd37a'; g.beginPath(); g.arc(G.x0 + G.ux * S * .2, G.y0 + G.uy * S * .2, S * .1, 0, 7); g.fill(); g.restore(); }
  },

  electric(g, f, p, S, now) {   // a crackling bolt from the rifle, redrawn every few frames so it jitters
    const G = geo(f, S);
    const fade = p < .2 ? 1 : 1 - (p - .2) / .8;
    const frame = Math.floor(now / 55);
    const bolt = (seed, width, color, spread) => {
      g.beginPath(); g.moveTo(G.x0 + G.ux * S * .2, G.y0 + G.uy * S * .2);
      const n = 8;
      for (let i = 1; i < n; i++) {
        const t = i / n, j = (rnd(seed + i * 13 + frame * 31) - .5) * spread * S * Math.sin(Math.PI * t) * 2.2;
        g.lineTo(lerp(G.x0, G.x1, t) + G.nx * j, lerp(G.y0, G.y1, t) + G.ny * j);
      }
      g.lineTo(G.x1, G.y1); g.lineWidth = width; g.strokeStyle = color; g.stroke();
    };
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.globalAlpha = Math.max(0, fade);
    bolt(1, 7, 'rgba(90,170,255,.35)', .3); bolt(1, 3.2, '#7fd4ff', .3); bolt(1, 1.4, '#ffffff', .3);
    if (p < .8) { g.globalAlpha *= .8; bolt(50, 2, '#b8e8ff', .45); }
    g.restore();
    g.save(); g.globalAlpha = Math.max(0, fade); g.fillStyle = '#bfe8ff'; g.beginPath(); g.arc(G.x0 + G.ux * S * .2, G.y0 + G.uy * S * .2, S * (.07 + .04 * rnd(frame)), 0, 7); g.fill(); g.restore();
  },

  slash(g, f, p, S) {   // a bright crescent sweeping across the target
    const G = geo(f, S);
    const q = clamp01((p - .15) / .5), fade = clamp01((p - .5) / .5);
    if (q <= 0) return;
    g.save(); g.translate(G.x1, G.y1); g.rotate(G.a); g.lineCap = 'round';
    const R = S * .42, a0 = -1.1, a1 = a0 + 2.2 * q;
    for (const [w, c, al] of [[S * .1, '#ffffff', .35], [S * .05, '#ffffff', 1], [S * .02, '#9fd0ff', 1]]) {
      g.globalAlpha = al * (1 - fade); g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.arc(-R * .55, 0, R, a0 + .4 * q, a1); g.stroke();
    }
    g.restore();
  },

  wrench(g, f, p, S) {   // a spinning wrench thrown into the swing, and a ring where it lands
    const G = geo(f, S);
    const q = clamp01((p - .1) / .45);
    if (q > 0 && q < 1) {
      g.save(); g.translate(lerp(G.x0, G.x1, q), lerp(G.y0, G.y1, q) - Math.sin(Math.PI * q) * S * .18); g.rotate(q * 9);
      g.strokeStyle = '#c9ccd2'; g.lineWidth = S * .05; g.lineCap = 'round'; g.beginPath(); g.moveTo(-S * .1, 0); g.lineTo(S * .1, 0); g.stroke();
      g.beginPath(); g.arc(S * .12, 0, S * .045, .5, 5.8); g.stroke(); g.restore();
    }
    if (p > .45) { const k = clamp01((p - .45) / .4); g.save(); g.globalAlpha = 1 - k; g.strokeStyle = '#ffe45c'; g.lineWidth = 3; g.beginPath(); g.arc(G.x1, G.y1, S * (.1 + .25 * k), 0, 7); g.stroke(); g.restore(); }
  },

  harpoon(g, f, p, S) {   // a spear on a line back to the diver
    const G = geo(f, S);
    const q = clamp01(p / .85), x = lerp(G.x0, G.x1, q), y = lerp(G.y0, G.y1, q);
    g.save(); g.lineCap = 'round';
    g.strokeStyle = 'rgba(230,235,240,.8)'; g.lineWidth = 1.4; g.setLineDash([S * .05, S * .03]); g.beginPath(); g.moveTo(G.x0, G.y0); g.lineTo(x, y); g.stroke(); g.setLineDash([]);
    if (q < 1 || p < .95) { g.translate(x, y); g.rotate(G.a); g.strokeStyle = '#9aa1ab'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-S * .2, 0); g.lineTo(S * .06, 0); g.stroke(); g.fillStyle = '#e8ecf1'; g.beginPath(); g.moveTo(S * .14, 0); g.lineTo(S * .04, -S * .045); g.lineTo(S * .04, S * .045); g.fill(); }
    g.restore();
    if (p < .3) puff(g, G.x0, G.y0, S * .12 * (1 + p * 3), (1 - p / .3) * .5, '#dff3ff');
  },

  torpedo(g, f, p, S) {   // a dark torpedo with a trail of bubbles
    const G = geo(f, S);
    const q = clamp01(p), x = lerp(G.x0, G.x1, q), y = lerp(G.y0, G.y1, q);
    for (let i = 1; i <= 12; i++) {
      const u = q - i * .03; if (u < 0) break;
      puff(g, lerp(G.x0, G.x1, u) + (rnd(i) - .5) * S * .05, lerp(G.y0, G.y1, u) + (rnd(i + 9) - .5) * S * .05, S * (.02 + .012 * (i % 3)), (1 - i / 13) * .9, '#eaf7ff');
    }
    g.save(); g.translate(x, y); g.rotate(G.a); g.fillStyle = '#1d222b'; g.beginPath(); g.ellipse(0, 0, S * .09, S * .03, 0, 0, 7); g.fill();
    g.fillStyle = '#e04a3a'; g.beginPath(); g.arc(S * .07, 0, S * .014, 0, 7); g.fill(); g.restore();
  },

  depth(g, f, p, S) {   // rolled off the stern, sinks with ripples, goes off below
    const G = geo(f, S);
    const q = clamp01(p / .35);
    if (p < .35) { const x = lerp(G.x0, G.x1, q), y = lerp(G.y0, G.y1, q) - Math.sin(Math.PI * q) * S * .35; g.fillStyle = '#4b505a'; g.beginPath(); g.ellipse(x, y, S * .06, S * .08, 0, 0, 7); g.fill(); g.fillStyle = '#e0a43a'; g.fillRect(x - S * .05, y - S * .03, S * .1, S * .025); }
    else {
      const k = clamp01((p - .35) / .6);
      g.save(); g.globalAlpha = (1 - k) * .9; g.strokeStyle = '#e8f6ff'; g.lineWidth = S * .04;
      g.beginPath(); g.ellipse(G.x1, G.y1 + S * .1, S * (.1 + .35 * k), S * (.05 + .15 * k), 0, 0, 7); g.stroke(); g.restore();
      if (k < .5) { g.fillStyle = 'rgba(40,60,80,' + (.7 - k) + ')'; g.beginPath(); g.ellipse(G.x1, G.y1 + S * .12, S * .06 * (1 - k), S * .08 * (1 - k), 0, 0, 7); g.fill(); }
    }
  },

  bombs(g, f, p, S) { fall(g, f, p, S, 3); },
  light_bombs(g, f, p, S) { fall(g, f, p, S, 1); },
  lunge() {},
};

/** Bombs falling onto the target from above, with a growing shadow each. */
function fall(g, f, p, S, n) {
  for (let i = 0; i < n; i++) {
    const q = clamp01((p - i * .1) / (1 - (n - 1) * .1));
    if (q <= 0 || q >= 1) continue;
    const ox = (i - (n - 1) / 2) * S * .2, x = f.x1 * S + ox, y = f.y1 * S - (1 - q * q) * S * 1.2 - (n > 1 ? 0 : 0);
    g.fillStyle = 'rgba(0,0,0,' + (.1 + .25 * q) + ')'; g.beginPath(); g.ellipse(x, f.y1 * S + S * .1, S * (.06 + .12 * q), S * (.03 + .06 * q), 0, 0, 7); g.fill();
    g.save(); g.translate(x, y); g.fillStyle = '#2b2f36'; g.beginPath(); g.ellipse(0, 0, S * .06, S * .11, 0, 0, 7); g.fill();
    g.fillStyle = '#8a8f99'; g.fillRect(-S * .05, -S * .17, S * .1, S * .05); g.fillStyle = '#ffe45c'; g.fillRect(-S * .02, -S * .13, S * .04, S * .03); g.restore();
  }
}

/** Draw one running animation (`f.fx` names it) at progress p. */
export function drawAttack(g, f, p, S, now) {
  const fn = DRAW[f.fx] || DRAW.bullet;
  g.save(); fn(g, f, p, S, now); g.restore();
}

/** The burst where a blow lands. `f.style` picks the look; a kill (`f.big`) is always a full blast. */
export function drawImpact(g, f, p, S) {
  const style = f.big ? 'blast' : (f.style || 'blast');
  g.save(); g.translate(f.x * S, f.y * S); g.globalAlpha = 1 - p;
  if (style === 'spark') {
    const r = S * .3 * (.3 + .7 * p);
    g.fillStyle = '#fff6c8'; g.beginPath(); g.arc(0, 0, r * .45, 0, 7); g.fill();
    g.strokeStyle = '#ffd24a'; g.lineWidth = 2; g.lineCap = 'round';
    for (let i = 0; i < 7; i++) { const a = i * 0.9 + rnd(i) * .6; g.beginPath(); g.moveTo(Math.cos(a) * r * .5, Math.sin(a) * r * .5); g.lineTo(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3); g.stroke(); }
  } else if (style === 'fire') {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2, rise = p * S * .3, r = S * (.16 - .08 * p) * (.7 + .5 * rnd(i));
      g.fillStyle = i % 2 ? '#ff8a2e' : '#ffd23f'; g.beginPath(); g.arc(Math.cos(a) * S * .16, Math.sin(a) * S * .1 - rise, r, 0, 7); g.fill();
    }
    g.fillStyle = '#e8501e'; g.beginPath(); g.arc(0, -p * S * .15, S * .14 * (1 - p * .5), 0, 7); g.fill();
  } else if (style === 'zap') {
    const r = S * .42 * (.4 + .6 * p);
    g.strokeStyle = '#bfe8ff'; g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round';
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 + p * .8; g.beginPath(); g.moveTo(0, 0);
      g.lineTo(Math.cos(a + .25) * r * .5, Math.sin(a + .25) * r * .5); g.lineTo(Math.cos(a - .2) * r * .75, Math.sin(a - .2) * r * .75); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); g.stroke();
    }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, S * .1 * (1 - p), 0, 7); g.fill();
  } else if (style === 'splash') {
    g.strokeStyle = '#eaf7ff'; g.lineWidth = S * .04;
    for (let i = 0; i < 2; i++) { const k = clamp01(p * 1.3 - i * .2); g.beginPath(); g.ellipse(0, S * .1, S * (.1 + .42 * k), S * (.05 + .17 * k), 0, 0, 7); g.stroke(); }
    g.fillStyle = '#eaf7ff';
    for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * .35, d = S * .4 * Math.sin(Math.PI * Math.min(1, p * 1.2)); g.beginPath(); g.arc(Math.cos(a) * d * .6, S * .1 + Math.sin(a) * d, S * .035, 0, 7); g.fill(); }
  } else if (style === 'flak') {
    g.fillStyle = '#2c2f36'; g.beginPath(); g.arc(0, 0, S * .2 * (.4 + .6 * p), 0, 7); g.fill();
    g.fillStyle = '#ff6a3d'; g.beginPath(); g.arc(0, 0, S * .1 * (1 - p), 0, 7); g.fill();
  } else {
    const r = S * (f.big ? .75 : .45) * (.25 + .75 * p);
    g.fillStyle = f.c || '#ff9a2e'; g.beginPath(); g.arc(0, 0, r * .7, 0, 7); g.fill();
    g.strokeStyle = '#fff3b0'; g.lineWidth = 3;
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + p; g.beginPath(); g.moveTo(Math.cos(a) * r * .6, Math.sin(a) * r * .6); g.lineTo(Math.cos(a) * r * 1.25, Math.sin(a) * r * 1.25); g.stroke(); }
  }
  g.restore();
}

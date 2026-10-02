// Drawing for the campaign: the continent (five nations as polygons in a 100 x 120 space), and every scene of the intro cutscene.
// Everything is drawn in device pixels from a scene description (src/campaign/cutscene.js), so a frame is a pure function of
// the time: nothing here keeps state besides the portrait cache in portrait-art.js.
//
//   drawContinent(g, w, h, o)    the land: o = { nations, colors(id), assim{id:0..1}, t, scale, cx, cy, selected, capitals }
//   renderFrame(g, w, h, st, ctx)  one frame of the intro. st = stateAt(...) ; ctx = { campaign, tl, colors, expr/blink handled here }
//
// The fit (where the continent sits and how big it is) comes from `mapFit`, which the world-map screen shares so taps can be
// hit-tested against the same polygons.

import { drawCutout } from './portrait-art.js';
import { assimilation } from '../campaign/cutscene.js';

export const MAP_W = 100, MAP_H = 120;
const CYAN = '#7ef0ff';
const FONT = 'Fredoka, system-ui, sans-serif';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (v) => { v = clamp01(v); return v * v * (3 - 2 * v); };
const hex = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, k) => { const x = hex(a), y = hex(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',')})`; };

/** Where the continent goes in a w x h area: { s (px per map unit), ox, oy }. `pad` is the margin as a fraction. */
export function mapFit(w, h, { pad = 0.06, top = 0, bottom = 0 } = {}) {
  const aw = w * (1 - pad * 2), ah = h - top - bottom - h * pad * 2;
  const s = Math.min(aw / MAP_W, ah / MAP_H);
  return { s, ox: (w - MAP_W * s) / 2, oy: top + h * pad + (ah - MAP_H * s) / 2 };
}

/** Point-in-polygon in map units (for taps on the world map). */
export function inPolygon(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export const nationAt = (nations, pt) => nations.find((n) => inPolygon(pt, n.outline)) || null;

function path(g, poly, fit) {
  g.beginPath();
  poly.forEach(([x, y], i) => { const px = fit.ox + x * fit.s, py = fit.oy + y * fit.s; if (i) g.lineTo(px, py); else g.moveTo(px, py); });
  g.closePath();
}

export function drawSea(g, w, h, t = 0, tint = 0) {
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, mix('#0a1226', '#04141a', tint)); sky.addColorStop(1, mix('#1b2d52', '#0a2a33', tint));
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {          // stars: fixed positions from a tiny hash, gently twinkling
    const x = ((i * 9301 + 49297) % 233280) / 233280 * w, y = ((i * 7919 + 1237) % 104729) / 104729 * h * 0.8;
    g.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(t * 1.3 + i)); g.fillStyle = '#cfe6ff';
    g.fillRect(x, y, w / 300 + (i % 3 === 0 ? 1 : 0), w / 300 + (i % 3 === 0 ? 1 : 0));
  }
  g.globalAlpha = 1;
}

export function drawContinent(g, w, h, { nations, colors, assim = {}, t = 0, fit, selected = null, free = null, dim = 0 }) {
  fit = fit || mapFit(w, h);
  const U = fit.s;
  // the coast first, so the five lands read as one continent with a shore
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(120,190,255,.25)'; g.lineWidth = U * 3.2;
  for (const n of nations) { path(g, n.outline, fit); g.stroke(); }
  g.strokeStyle = '#0b1830'; g.lineWidth = U * 1.6;
  for (const n of nations) { path(g, n.outline, fit); g.stroke(); }
  for (const n of nations) {
    const a = ease(assim[n.id] || 0), c = colors(n.faction);
    path(g, n.outline, fit);
    g.fillStyle = mix(c.color, '#46606a', a * 0.85); g.fill();
    if (a > 0) {
      g.save(); path(g, n.outline, fit); g.clip();
      const cx = fit.ox + n.capital[0] * U, cy = fit.oy + n.capital[1] * U;
      if (a < 1) {                                  // the wave front spreading from the capital
        const r = a * 70 * U;
        const grd = g.createRadialGradient(cx, cy, r * 0.6, cx, cy, r);
        grd.addColorStop(0, 'rgba(126,240,255,.0)'); grd.addColorStop(0.85, 'rgba(126,240,255,.35)'); grd.addColorStop(1, 'rgba(126,240,255,.9)');
        g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
      }
      g.strokeStyle = `rgba(126,240,255,${0.18 + 0.1 * Math.sin(t * 3 + n.capital[0])})`; g.lineWidth = Math.max(1, U * 0.25);
      for (let y = fit.oy; y < fit.oy + MAP_H * U; y += U * 2.6) { g.beginPath(); g.moveTo(fit.ox, y); g.lineTo(fit.ox + MAP_W * U, y); g.stroke(); }
      g.restore();
    }
    path(g, n.outline, fit);
    g.strokeStyle = a > 0.5 ? mix('#2a5560', CYAN, 0.4 + 0.2 * Math.sin(t * 2)) : mix(c.dark, '#000000', 0.15); g.lineWidth = Math.max(1.5, U * 0.7); g.stroke();
    if (selected === n.id) { path(g, n.outline, fit); g.strokeStyle = '#fff'; g.lineWidth = Math.max(2, U * 1.1); g.setLineDash([U * 2, U * 1.2]); g.lineDashOffset = -t * U * 4; g.stroke(); g.setLineDash([]); }
    if (free && free(n)) { path(g, n.outline, fit); g.fillStyle = 'rgba(255,255,255,.08)'; g.fill(); }
  }
  // capitals
  for (const n of nations) {
    const a = ease(assim[n.id] || 0), x = fit.ox + n.capital[0] * U, y = fit.oy + n.capital[1] * U, r = U * (n.home ? 3.2 : 2.5);
    g.save(); g.translate(x, y);
    if (a > 0.6) { g.fillStyle = '#0b1218'; g.fillRect(-r, -r * 0.6, r * 2, r * 1.2); g.fillStyle = CYAN; g.fillRect(-r * 0.8, -r * 0.14, r * 1.6, r * 0.28); }
    else { g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.fillStyle = colors(n.faction).dark; g.beginPath(); g.arc(0, 0, r * 0.6, 0, 7); g.fill(); if (n.home) { g.fillStyle = '#ffe45c'; g.beginPath(); g.arc(0, 0, r * 0.28, 0, 7); g.fill(); } }
    g.restore();
  }
  if (dim) { g.fillStyle = `rgba(4,8,18,${dim})`; g.fillRect(0, 0, w, h); }
}

// ---- text ---------------------------------------------------------------------------------------------------------------------------
function wrap(g, text, maxW) {
  const lines = []; let line = '';
  for (const word of text.split(' ')) {
    const t = line ? line + ' ' + word : word;
    if (g.measureText(t).width > maxW && line) { lines.push(line); line = word; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

function caption(g, w, h, text, alpha, U) {
  g.save(); g.globalAlpha = alpha;
  g.font = `600 ${Math.round(20 * U)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const lines = wrap(g, text, w * 0.84), lh = 27 * U, y0 = h - h * 0.13 - (lines.length - 1) * lh / 2;
  lines.forEach((l, i) => { g.lineWidth = 5 * U; g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(l, w / 2, y0 + i * lh); g.fillStyle = '#fff'; g.fillText(l, w / 2, y0 + i * lh); });
  g.restore();
}

function textBox(g, w, h, U, { name, color, text, shown, side, typing, t }) {
  const bw = w * 0.92, bh = 112 * U, x = (w - bw) / 2, y = h - bh - h * 0.07 - 14 * U;   // above the letterbox bar
  g.save();
  g.fillStyle = 'rgba(10,16,34,.92)'; g.strokeStyle = color; g.lineWidth = 3 * U;
  g.beginPath(); g.roundRect(x, y, bw, bh, 12 * U); g.fill(); g.stroke();
  g.font = `700 ${Math.round(15 * U)}px ${FONT}`; const tw = g.measureText(name).width + 28 * U, tx = side === 'right' ? x + bw - tw - 14 * U : x + 14 * U;
  g.fillStyle = color; g.beginPath(); g.roundRect(tx, y - 15 * U, tw, 28 * U, 8 * U); g.fill();
  g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(name, tx + 14 * U, y - 1 * U);
  g.font = `500 ${Math.round(18 * U)}px ${FONT}`; g.textBaseline = 'top';
  // wrap the whole line first so words do not jump as letters appear, then reveal letter by letter
  const full = wrap(g, text, bw - 32 * U); let left = shown;
  full.forEach((l, i) => { const part = l.slice(0, Math.max(0, left)); left -= l.length + 1; g.fillStyle = '#fff'; g.fillText(part, x + 16 * U, y + 22 * U + i * 25 * U); });
  if (!typing && Math.floor(t * 2.2) % 2 === 0) { g.fillStyle = color; g.beginPath(); g.moveTo(x + bw - 30 * U, y + bh - 22 * U); g.lineTo(x + bw - 16 * U, y + bh - 22 * U); g.lineTo(x + bw - 23 * U, y + bh - 11 * U); g.fill(); }
  g.restore();
}

// ---- scenes -------------------------------------------------------------------------------------------------------------------------
function impactPoint(nations) {
  const c = nations.find((n) => n.id === 'centre') || nations[0];
  return c.capital;
}

function arrival(g, w, h, st, fit, nations) {
  const p = st.p, [ix, iy] = impactPoint(nations), U = fit.s;
  const X = fit.ox + ix * U, Y = fit.oy + iy * U;
  const hit = 0.62;
  if (p < hit) {                                                  // a bright streak falling from the top-right
    const k = ease(p / hit), sx = X + w * 0.5, sy = -h * 0.1, x = sx + (X - sx) * k, y = sy + (Y - sy) * k;
    const bx = x + (sx - x) * 0.3, by = y + (sy - y) * 0.3, tail = g.createLinearGradient(bx, by, x, y);
    tail.addColorStop(0, 'rgba(126,240,255,0)'); tail.addColorStop(1, 'rgba(255,255,255,.95)');
    g.strokeStyle = tail; g.lineWidth = U * 2.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(bx, by); g.lineTo(x, y); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, U * 2.2, 0, 7); g.fill();
  } else {
    const q = (p - hit) / (1 - hit);
    g.fillStyle = `rgba(255,255,255,${Math.max(0, 0.85 - q * 2.2)})`; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3; i++) {                                 // shock rings
      const r = Math.max(0, q - i * 0.18) * 90 * U; if (r <= 0) continue;
      g.strokeStyle = `rgba(126,240,255,${Math.max(0, 0.9 - r / (90 * U)) })`; g.lineWidth = U * 1.6; g.beginPath(); g.arc(X, Y, r, 0, 7); g.stroke();
    }
    const glow = g.createRadialGradient(X, Y, 0, X, Y, U * 22); glow.addColorStop(0, 'rgba(126,240,255,.8)'); glow.addColorStop(1, 'rgba(126,240,255,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(X, Y, U * 22, 0, 7); g.fill();
  }
}

function talk(g, w, h, st, ctx, U, t) {
  const sc = st.scene, { campaign } = ctx, L = (id) => id && campaign.leaderById[id];
  const sz = Math.round(Math.min(w * 0.7, h * 0.46)), baseY = h - h * 0.07 - 126 * U - sz * 1.08;
  const speaker = st.line.who, blink = (t % 4.3) < 0.13;
  const fade = ease(Math.min(st.local / 0.6, 1));
  for (const side of ['left', 'right']) {
    const L1 = L(sc[side]); if (!L1) continue;
    const talking = speaker === L1.id && st.typing, on = speaker === L1.id;
    const expr = on ? st.line.expr || 'neutral' : 'neutral';
    const x = side === 'left' ? -sz * 0.04 : w - sz * 0.96, y = baseY + (1 - fade) * 24 * U + (on ? 0 : 8 * U);
    g.save(); g.globalAlpha = fade * (on ? 1 : 0.55);
    g.translate(x, y);
    if (side === 'right') { g.translate(sz, 0); g.scale(-1, 1); }
    // faction-coloured glow behind the speaker
    const col = L1.faction === 'chorus' ? campaign.chorus.color : ctx.colors(L1.faction).color;
    const glow = g.createRadialGradient(sz / 2, sz * 0.5, 0, sz / 2, sz * 0.5, sz * 0.6); glow.addColorStop(0, col + '88'); glow.addColorStop(1, col + '00');
    g.fillStyle = glow; g.fillRect(-sz * .2, -sz * .2, sz * 1.4, sz * 1.4);
    drawCutout(g, L1, { px: sz, expr, blink, talk: talking ? (Math.floor(t * 8) % 2 ? 1 : 0.5) : 0, outline: false });
    g.restore();
  }
  const who = L(speaker), col = who.faction === 'chorus' ? campaign.chorus.color : ctx.colors(who.faction).color;
  textBox(g, w, h, U, { name: who.name, color: col, text: st.line.text, shown: st.shown, typing: st.typing, side: sc.right === speaker ? 'right' : 'left', t });
}

/** One frame of the intro. `ctx` = { campaign, tl, colors(factionId) -> {color, dark} }. */
export function renderFrame(g, w, h, st, ctx, t) {
  const { campaign, tl } = ctx, nations = campaign.nations, sc = st.scene, U = Math.max(0.6, Math.min(w / 390, h / 700));
  const assim = assimilation(tl, st.index, st.local, nations);
  const taken = Object.values(assim).reduce((a, b) => a + b, 0) / Math.max(1, nations.length - 1);
  drawSea(g, w, h, t, taken);
  const zoom = 1 + 0.05 * st.p, fit0 = mapFit(w, h, { pad: 0.08, bottom: sc.kind === 'talk' ? h * 0.22 : h * 0.14 });
  const fit = { s: fit0.s * zoom, ox: fit0.ox - (MAP_W * fit0.s * (zoom - 1)) / 2, oy: fit0.oy - (MAP_H * fit0.s * (zoom - 1)) / 2 };
  const dim = sc.kind === 'talk' ? 0.55 : sc.kind === 'title' ? 0.35 : sc.kind === 'arrival' ? 0.45 : 0;
  drawContinent(g, w, h, { nations, colors: ctx.colors, assim, t, fit, dim });
  if (sc.kind === 'arrival') arrival(g, w, h, st, fit, nations);
  if (sc.kind === 'talk') talk(g, w, h, st, ctx, U, t);
  if (sc.kind === 'fall') {                                       // a pop-up as each nation goes
    for (const id of sc.order || []) {
      const n = nations.find((q) => q.id === id), k = st.local - (0.4 + (sc.order.indexOf(id)) * (sc.duration / (sc.order.length + 1)) * 0.95 + (sc.duration / (sc.order.length + 1)) * 0.9);
      if (k > 0 && k < 1.6) {
        g.save(); g.globalAlpha = Math.min(1, k * 4) * Math.min(1, (1.6 - k) * 3); g.font = `700 ${Math.round(14 * U)}px ${FONT}`; g.textAlign = 'center';
        const x = fit.ox + n.capital[0] * fit.s, y = fit.oy + n.capital[1] * fit.s - fit.s * (5 + k * 2);
        g.lineWidth = 4 * U; g.strokeStyle = '#04141a'; g.strokeText(`${n.name.toUpperCase()} ASSIMILATED`, x, y); g.fillStyle = CYAN; g.fillText(`${n.name.toUpperCase()} ASSIMILATED`, x, y); g.restore();
      }
    }
  }
  if (sc.caption) caption(g, w, h, sc.caption, Math.min(ease(st.local / 0.8), ease((sc.duration - st.local) / 0.6)), U);
  if (sc.kind === 'title') {
    const a = ease(st.local / 1.2);
    g.save(); g.globalAlpha = a; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 ${Math.round(16 * U)}px ${FONT}`; g.fillStyle = CYAN; g.fillText('P O C K E T   W A R S', w / 2, h * 0.38);
    g.font = `700 ${Math.round(40 * U)}px ${FONT}`; const lines = wrap(g, sc.text.toUpperCase(), w * 0.86);
    lines.forEach((l, i) => { const y = h * 0.46 + i * 46 * U; g.lineWidth = 8 * U; g.strokeStyle = '#04141a'; g.strokeText(l, w / 2, y); g.fillStyle = '#fff'; g.fillText(l, w / 2, y); });
    g.restore();
  }
  // cinematic bars and a fade in at the start / out at the end
  const bar = h * 0.07; g.fillStyle = '#000'; g.fillRect(0, 0, w, bar); g.fillRect(0, h - bar, w, bar);
  const fadeIn = 1 - ease(st.time / 1.2), fadeOut = ease((st.time - (tl.total - 1.0)) / 1.0);
  const f = Math.max(fadeIn, fadeOut); if (f > 0) { g.fillStyle = `rgba(0,0,0,${f})`; g.fillRect(0, 0, w, h); }
}

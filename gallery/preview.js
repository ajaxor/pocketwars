// Live gallery. Runs the real sprite code on canvas with the game's animation states:
//   idle   - the unit is ready: idle animation running          (what you see on your turn)
//   moving - the unit is sliding across the map: animation at double speed
//   done   - the unit has acted: static pose, washed with dark grey
// This file draws a tile (paintTile) and boots the page: index.html is hand-written, the tabs are views (units-view.js, characters-view.js).
import { SPRITES, SHADOWS } from '../src/render/unit-art.js';
import { drawFrameAlpha, DISABLED_TINT } from '../src/render/unit-frame.js';
import { loadRegistry, fetchReader } from '../src/data/loader.js';
import { setFactions } from '../src/render/portrait-art.js';
import { buildCatalog, GROUPS } from './catalog.js';
import { createUnitsView } from './units-view.js';
import { createCharactersView } from './characters-view.js';
import { drawOutlined, OUTLINE_THIN } from '../src/render/outline.js';
import { SPRITES as CONCEPT_SPRITES, SHADOWS as CONCEPT_SHADOWS } from './concept-art.js';   // experimental units, not in the game

const MOD = { SPRITES, SHADOWS };
const CONCEPT_MOD = { SPRITES: CONCEPT_SPRITES, SHADOWS: CONCEPT_SHADOWS };
export const STATES = { idle: { run: 1, speed: 1, alpha: 1 }, moving: { run: 1, speed: 2, alpha: 1 }, done: { run: 0, speed: 1, alpha: 1, tint: DISABLED_TINT } };

/** Paint one tile (backdrop + unit) into a 2D context that is already scaled to CSS pixels. Pure drawing: no DOM. */
export const OUTLINES = { off: 0, thin: OUTLINE_THIN, medium: .024, thick: .038 };   // radius as a fraction of the tile
export const OUTLINE_COLORS = { navy: '#161a26', black: '#000000', faction: null };            // null: the faction's dark colour

export function paintTile(g, { unit, faction, size, t, state, phase, bg, outline = 'off', outlineColor = 'navy', make }) {
  const st = STATES[state] || STATES.idle;
  g.clearRect(0, 0, size, size);
  g.fillStyle = bg; g.fillRect(0, 0, size, size);
  g.save(); g.translate(size / 2, size / 2);
  const mod = unit.concept ? CONCEPT_MOD : MOD;
  const o = { s: size, c: faction.color, dk: faction.dark, alt: unit.altitude || 0, w: t * st.speed, ph: phase, run: st.run, moving: state === 'moving', make };
  const k = OUTLINES[outline] || 0;
  if (k) drawOutlined(g, mod, unit.sprite, o, { r: Math.max(1, size * k), color: OUTLINE_COLORS[outlineColor] || faction.dark, tint: st.tint || null, make });
  else drawFrameAlpha(g, mod, unit.sprite, o, st.alpha, st.tint || null);
  g.restore();
}

// ---- page ----------------------------------------------------------------------------------------------------
const TABS = [...GROUPS.map((g) => ({ ...g, kind: 'units' })), { id: 'characters', label: 'Characters', kind: 'characters' }];

async function boot() {
  const $ = (sel) => document.querySelector(sel);
  const json = async (rel) => (await fetch(new URL(rel, import.meta.url))).json();
  const registry = await loadRegistry(fetchReader(new URL('../data/', import.meta.url)));
  const [concepts, status, campaign, planned] = await Promise.all([json('concepts.json'), json('status.json'), json('../data/campaign.json'), json('planned-units.json').catch(() => ({}))]);
  setFactions([...Object.values(registry.factions), { id: 'chorus', ...campaign.chorus }]);
  const catalog = buildCatalog({ registry, concepts, planned, status });
  const factions = Object.values(registry.factions).map((f) => ({ id: f.id, name: f.name, color: f.color, dark: f.dark }));
  const terrain = Object.fromEntries(['plain', 'road', 'sea'].map((id) => [id, registry.terrain[id].render.base]));

  const state = { mode: 'idle', size: 96, bg: 'plain', outline: 'thin', outlineColor: 'faction', paused: matchMedia('(prefers-reduced-motion: reduce)').matches };
  let clock = 0, last = performance.now();
  const tiles = [];   // { canvas, g, unit, faction, phase, visible }: everything animated on the page; only the ones on screen are redrawn
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => entries.forEach((e) => { const t = tiles.find((x) => x.canvas === e.target); if (t) t.visible = e.isIntersecting; })) : null;
  const ctx = {
    state, registry, catalog, status, factions, concepts, campaign,
    addTile(canvas, unit, faction, phase) { const t = { canvas, g: canvas.getContext('2d'), unit, faction, phase, visible: true }; tiles.push(t); io?.observe(canvas); return t; },
    sizeTile(t) { const dpr = window.devicePixelRatio || 1, S = state.size; t.canvas.width = Math.round(S * dpr); t.canvas.height = Math.round(S * dpr); t.canvas.style.width = t.canvas.style.height = S + 'px'; t.g.setTransform(dpr, 0, 0, dpr, 0, 0); },
    /** A small static icon of a game unit in a team's colours (the kits in the Characters tab). */
    icon(unitId, faction, px = 56) {
      const def = registry.unit(unitId), cv = document.createElement('canvas'), dpr = window.devicePixelRatio || 1;
      cv.width = cv.height = Math.round(px * dpr); cv.style.width = cv.style.height = px + 'px'; cv.className = 'icon';
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintTile(g, { unit: { sprite: def.render.sprite, altitude: def.render.altitude || 0, concept: false }, faction, size: px, t: .4, state: 'idle', phase: 0, bg: terrain[def.moveClass === 'naval' ? 'sea' : 'plain'], outline: 'thin', outlineColor: 'faction' });
      cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', def.name);
      return cv;
    },
    paint(t) { paintTile(t.g, { unit: t.unit, faction: t.faction, size: state.size, t: clock, state: state.mode, phase: t.phase, bg: terrain[t.unit.water && state.bg === 'plain' ? 'sea' : state.bg], outline: state.outline, outlineColor: state.outlineColor }); },
  };
  const units = createUnitsView(ctx, $('#view-units'));
  const characters = await createCharactersView(ctx, $('#view-chars'));

  // tabs: the hash picks one (#vehicle, #characters), so a link opens on it
  const bar = $('#tabs');
  for (const t of TABS) {
    const b = document.createElement('button'); b.role = 'tab'; b.dataset.tab = t.id;
    const n = t.kind === 'units' ? catalog.filter((u) => u.group === t.id).length : null;
    b.append(t.label); if (n !== null) { const c = document.createElement('span'); c.className = 'count'; c.textContent = n; b.append(c); }
    b.addEventListener('click', () => { location.hash = t.id; });
    bar.append(b);
  }
  const show = () => {
    const id = TABS.some((t) => t.id === location.hash.slice(1)) ? location.hash.slice(1) : TABS[0].id, tab = TABS.find((t) => t.id === id);
    bar.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
    const isUnits = tab.kind === 'units';
    $('#view-units').hidden = !isUnits; $('#view-chars').hidden = isUnits; $('#unit-controls').hidden = !isUnits;
    if (isUnits) units.show(id); else characters.show();
    window.scrollTo(0, 0);
  };
  addEventListener('hashchange', show);

  function resize() {
    document.documentElement.style.setProperty('--s', state.size + 'px');
    for (const t of tiles.filter((x) => x.sized !== false)) ctx.sizeTile(t);
    draw();
  }
  function draw() { for (const t of tiles) if (t.visible && t.sized !== false) ctx.paint(t); }
  function frame(now) {
    if (!state.paused) clock += (now - last) / 1000;
    last = now; draw(); characters.frame(now); requestAnimationFrame(frame);
  }
  ctx.sizeAll = resize;

  const group = (sel, key) => document.querySelectorAll(`${sel} button`).forEach((b) => b.addEventListener('click', () => {
    state[key] = b.dataset.v; document.querySelectorAll(`${sel} button`).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); draw();
  }));
  group('#mode', 'mode'); group('#bg', 'bg'); group('#outline', 'outline'); group('#outlineColor', 'outlineColor');
  $('#size').addEventListener('input', (e) => { state.size = Number(e.target.value); $('#sizeOut').textContent = state.size + ' px'; resize(); });
  const pauseBtn = $('#pause');
  const syncPause = () => { pauseBtn.textContent = state.paused ? 'Play' : 'Pause'; pauseBtn.setAttribute('aria-pressed', String(state.paused)); };
  pauseBtn.addEventListener('click', () => { state.paused = !state.paused; syncPause(); });
  syncPause(); show(); resize(); requestAnimationFrame(frame);
}

if (typeof document !== 'undefined') await boot();

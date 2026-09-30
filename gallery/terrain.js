// Live terrain-style gallery. Each card runs the game's own Renderer on the classic map with one terrain theme, so what you
// compare here is exactly what ships. "Use in game" remembers the choice in localStorage (src/main.js reads it).
import { fetchReader, loadMap, loadMapIndex, loadRegistry } from '../src/data/loader.js';
import { Game } from '../src/engine/game.js';
import { Effects } from '../src/render/effects.js';
import { MoveAnimator } from '../src/render/animator.js';
import { Renderer } from '../src/render/renderer.js';
import { DEFAULT_TERRAIN_THEME, TERRAIN_THEMES, TERRAIN_THEME_KEY, terrainThemeById } from '../src/render/terrain-themes.js';

const EMPTY_VIEW = { selectedId: null, dest: null, reach: null, attackTiles: null, targets: [], showTargets: false, pendingTargetId: null };

const store = {
  get() { try { return localStorage.getItem(TERRAIN_THEME_KEY); } catch { return null; } },
  set(id) { try { localStorage.setItem(TERRAIN_THEME_KEY, id); return true; } catch { return false; } },
};

async function boot() {
  const readJson = fetchReader(new URL('../data/', import.meta.url));
  const registry = await loadRegistry(readJson);
  const index = await loadMapIndex(readJson);
  const map = await loadMap(readJson, registry, index.default);
  const $ = (sel) => document.querySelector(sel);
  const state = { size: 34, paused: matchMedia('(prefers-reduced-motion: reduce)').matches };
  let current = terrainThemeById(store.get()).id;
  let clock = 0, last = performance.now();

  const cards = TERRAIN_THEMES.map((style) => {
    const game = new Game(registry, map);
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `The classic map drawn with the ${style.name} terrain`);
    let renderer = null;
    const effects = new Effects(registry, (owner) => renderer.colorsOf(owner));
    renderer = new Renderer(canvas, game, effects, new MoveAnimator(), { terrainTheme: style.id });

    const el = document.createElement('div'); el.className = 'card';
    const head = document.createElement('div'); head.className = 'head';
    const name = document.createElement('span'); name.className = 'name'; name.textContent = style.name;
    const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = style.id === DEFAULT_TERRAIN_THEME ? 'default' : '';
    head.append(name, tag);
    const note = document.createElement('div'); note.className = 'note'; note.textContent = style.note;
    const use = document.createElement('button'); use.className = 'use'; use.type = 'button';
    use.addEventListener('click', () => {
      if (store.set(style.id)) current = style.id; else use.textContent = 'Could not save (storage is blocked)';
      sync();
    });
    el.append(head, note, canvas, use);
    return { style, el, canvas, renderer, use, visible: true };
  });
  $('#grid').append(...cards.map((c) => c.el));

  function sync() {
    for (const c of cards) {
      const on = c.style.id === current;
      c.el.classList.toggle('on', on);
      c.use.setAttribute('aria-pressed', String(on));
      c.use.textContent = on ? 'Used in the game' : 'Use in game';
    }
  }

  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => entries.forEach((e) => { cards.find((c) => c.canvas === e.target).visible = e.isIntersecting; })) : null;
  if (io) cards.forEach((c) => io.observe(c.canvas));

  function resize() {
    const dpr = window.devicePixelRatio || 1, S = state.size;
    document.documentElement.style.setProperty('--w', map.width * S + 'px');
    for (const { canvas, renderer } of cards) {
      renderer.S = S;
      canvas.width = Math.round(map.width * S * dpr); canvas.height = Math.round(map.height * S * dpr);
      canvas.style.width = map.width * S + 'px'; canvas.style.height = map.height * S + 'px';
      renderer.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    draw();
  }
  const draw = () => { for (const c of cards) if (c.visible) c.renderer.draw(EMPTY_VIEW, clock * 1000); };
  function frame(now) {
    if (!state.paused) clock += (now - last) / 1000;
    last = now; draw(); requestAnimationFrame(frame);
  }

  $('#size').addEventListener('input', (e) => { state.size = Number(e.target.value); $('#sizeOut').textContent = state.size + ' px'; resize(); });
  const pauseBtn = $('#pause');
  const syncPause = () => { pauseBtn.textContent = state.paused ? 'Play' : 'Pause'; pauseBtn.setAttribute('aria-pressed', String(state.paused)); };
  pauseBtn.addEventListener('click', () => { state.paused = !state.paused; syncPause(); });
  sync(); syncPause(); resize(); requestAnimationFrame(frame);
}

if (typeof document !== 'undefined') await boot();

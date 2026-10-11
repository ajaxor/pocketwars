// The Sound effects tab: every generated clip with a play button, grouped by what it is for (attack, impact, movement, death, UI),
// a fade-in / fade-out / stop-early demo for movement clips, and the mapping from units, weapon looks and events to clips.
// The clips are plain mp3 files in gallery/sfx/, listed with their prompts and the mapping in gallery/sfx.json.

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

/** Total number of clips in the data (shown as the tab's count). */
export const clipCount = (data) => data.groups.reduce((n, g) => n + g.clips.length, 0);

export function createSfxView(ctx, root, data) {
  const players = new Map();   // clip id -> { audio, button }
  const state = { volume: 0.8, loop: false };

  root.append(el('p', 'intro', `${data.model}. ${data.note}`));

  // one set of controls for the whole tab
  const bar = el('div', 'controls sfx-controls');
  const volLabel = el('label', 'ctl', 'Volume ');
  const vol = el('input'); vol.type = 'range'; vol.min = '0'; vol.max = '1'; vol.step = '0.05'; vol.value = String(state.volume); vol.setAttribute('aria-label', 'Volume');
  volLabel.append(vol);
  const loopLabel = el('label', 'ctl');
  const loop = el('input'); loop.type = 'checkbox'; loopLabel.append(loop, ' Loop (hear the seam)');
  const stopAll = el('button', 'btn', 'Stop all'); stopAll.type = 'button';
  bar.append(volLabel, loopLabel, stopAll);
  root.append(bar);

  for (const group of data.groups) {
    const section = el('section', 'sfx-group');
    section.append(el('h3', 'section', `${group.label} · ${group.unit}`));
    const grid = el('div', 'grid');
    for (const clip of group.clips) {
      const card = el('article', 'card unit st-draft');
      const top = el('div', 'top'); top.append(el('div', 'name', clip.id), el('span', 'tag', `${clip.seconds.toFixed(1)} s`));
      const button = el('button', 'btn sfx-play', 'Play'); button.type = 'button'; button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', `Play ${clip.id}`);
      const label = [clip.for, clip.chosen ? 'chosen' : null].filter(Boolean).join(' · ');
      card.append(top);
      if (label) card.append(el('div', 'meta', label));
      card.append(button);
      button.addEventListener('click', () => play(clip.id));
      if (group.id === 'move') {   // hear a move: fade in, run for a moment, then cut early the way the game does when the move ends
        const demo = el('button', 'btn sfx-play', 'Move + stop'); demo.type = 'button'; demo.setAttribute('aria-label', `Play ${clip.id} as a short move`);
        demo.addEventListener('click', () => playMove(clip.id));
        card.append(demo);
      }
      card.append(el('p', 'mech', clip.prompt));
      players.set(clip.id, { clip, audio: null, button });
      grid.append(card);
    }
    section.append(grid);
    root.append(section);
  }

  function audioFor(p) {
    if (!p.audio) {
      p.audio = new Audio(new URL(p.clip.file, import.meta.url));
      p.audio.preload = 'auto';
      p.audio.addEventListener('ended', () => mark(p, false));
      p.audio.addEventListener('pause', () => mark(p, false));
    }
    return p.audio;
  }
  function mark(p, on) { p.button.setAttribute('aria-pressed', String(on)); p.button.textContent = on ? 'Playing' : 'Play'; }

  function play(id) {
    const p = players.get(id), a = audioFor(p);
    a.volume = state.volume; a.loop = state.loop; a.currentTime = 0;
    a.play().then(() => mark(p, true)).catch(() => mark(p, false));   // a refused play (no gesture, no codec) just leaves the button idle
  }
  function stop() { clearInterval(fadeTimer); for (const p of players.values()) if (p.audio) { p.audio.pause(); p.audio.currentTime = 0; } }

  // The movement design from sfx.json: no loop, fade in at the start, fade out and stop when the move ends (here after ~0.9 s).
  let fadeTimer = null;
  function playMove(id) {
    stop();
    const p = players.get(id), a = audioFor(p), cfg = data.movePlayback || { fadeInMs: 150, fadeOutMs: 250 };
    a.loop = false; a.currentTime = 0; a.volume = 0;
    a.play().then(() => mark(p, true)).catch(() => mark(p, false));
    const start = performance.now(), moveMs = 900;
    fadeTimer = setInterval(() => {
      const t = performance.now() - start;
      const up = Math.min(1, t / cfg.fadeInMs), down = t < moveMs ? 1 : Math.max(0, 1 - (t - moveMs) / cfg.fadeOutMs);
      a.volume = state.volume * up * down;
      if (down === 0) { clearInterval(fadeTimer); a.pause(); a.currentTime = 0; }
    }, 20);
  }

  // which clip plays for what: unit -> movement and death, weapon look -> attack, impact style, event
  if (data.map) {
    const section = el('section', 'sfx-group');
    section.append(el('h3', 'section', 'Mapping'));
    section.append(el('p', 'intro', 'Which clip plays for what. Tap a row to hear it. Weapons name their look in data/weapons.json (fx); the impact style comes from the attack effect; movement and death are picked per unit.'));
    const titles = { attack: 'Weapon look → attack', impact: 'Impact style → impact', move: 'Unit → movement', death: 'Unit → death', ui: 'Interface', events: 'Battle events' };
    for (const [key, table] of Object.entries(data.map)) {
      const details = el('details', 'sfx-map');
      details.append(el('summary', null, `${titles[key] || key} (${Object.keys(table).length})`));
      const list = el('div', 'controls');
      for (const [name, id] of Object.entries(table)) {
        const b = el('button', 'btn', `${name} → ${id}`); b.type = 'button';
        b.addEventListener('click', () => play(id));
        list.append(b);
      }
      details.append(list);
      section.append(details);
    }
    root.append(section);
  }

  vol.addEventListener('input', () => { state.volume = Number(vol.value); for (const p of players.values()) if (p.audio) p.audio.volume = state.volume; });
  loop.addEventListener('change', () => { state.loop = loop.checked; for (const p of players.values()) if (p.audio) p.audio.loop = state.loop; });
  stopAll.addEventListener('click', stop);

  return { show() {}, stop, resize() {}, frame() {} };
}

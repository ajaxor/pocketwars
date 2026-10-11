// The Sound effects tab: every generated clip with a play button, grouped by what it is for (attack, movement, death).
// The clips are plain mp3 files in gallery/sfx/, listed with their prompts in gallery/sfx.json.

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
      card.append(top, button, el('p', 'mech', clip.prompt));
      button.addEventListener('click', () => play(clip.id));
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
  function stop() { for (const p of players.values()) if (p.audio) { p.audio.pause(); p.audio.currentTime = 0; } }

  vol.addEventListener('input', () => { state.volume = Number(vol.value); for (const p of players.values()) if (p.audio) p.audio.volume = state.volume; });
  loop.addEventListener('change', () => { state.loop = loop.checked; for (const p of players.values()) if (p.audio) p.audio.loop = state.loop; });
  stopAll.addEventListener('click', stop);

  return { show() {}, stop, resize() {}, frame() {} };
}

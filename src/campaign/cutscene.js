// The intro cutscene as a pure timeline: given the scene list and a time in seconds, say which scene is on screen, how far
// through it we are, which line is being spoken and how many letters of it show, and how far each nation has been assimilated.
// Nothing here draws or touches the DOM, so it is unit-tested; src/render/campaign-art.js draws what this describes.

const CPS = 24;            // typewriter speed, letters per second
const TAIL = 0.6;          // a finished line stays on screen this long before the next one

export function buildTimeline(scenes) {
  let t = 0;
  const starts = scenes.map((s) => { const at = t; t += s.duration; return at; });
  return { scenes, starts, total: t };
}

/** The state of the cutscene at time `t` (clamped to [0, total]). */
export function stateAt(tl, t) {
  const time = Math.min(Math.max(t, 0), tl.total);
  let i = tl.scenes.length - 1;
  while (i > 0 && time < tl.starts[i]) i--;
  const scene = tl.scenes[i], local = Math.min(time - tl.starts[i], scene.duration);
  return { time, index: i, scene, local, p: local / scene.duration, done: time >= tl.total, ...(scene.kind === 'talk' ? speech(scene, local) : {}) };
}

/** Which line of a talk scene is showing at `local` seconds, and how many letters of it. Line time is shared out by length. */
export function speech(scene, local) {
  const lens = scene.lines.map((l) => l.text.length / CPS + TAIL + 0.9);
  const sum = lens.reduce((a, b) => a + b, 0), k = scene.duration / sum;   // stretch the lines to fill the scene
  let at = 0;
  for (let i = 0; i < lens.length; i++) {
    const span = lens[i] * k;
    if (local < at + span || i === lens.length - 1) {
      const into = Math.max(0, local - at), line = scene.lines[i];
      const shown = Math.min(line.text.length, Math.floor(into * CPS * Math.max(1, k * .8)));
      return { lineIndex: i, line, shown, typing: shown < line.text.length, lineStart: at, lineEnd: at + span };
    }
    at += span;
  }
}

/** Seconds from the start of the whole cutscene at which the line after the current one begins, or null on the last line. */
export function nextLineTime(tl, t) {
  const s = stateAt(tl, t);
  if (s.scene.kind === 'talk' && s.lineIndex < s.scene.lines.length - 1) return tl.starts[s.index] + s.lineEnd;
  return null;
}

/** How assimilated each nation is (0 = free, 1 = taken): all free before the 'fall' scene, sweeping through `order` during it,
 * and taken for good afterwards. Nations not in the order (the home nation) never fall. */
export function assimilation(tl, index, local, nations) {
  const out = {};
  for (const n of nations) out[n.id] = 0;
  const fallAt = tl.scenes.findIndex((s) => s.kind === 'fall');
  if (fallAt < 0 || index < fallAt) return out;
  const fall = tl.scenes[fallAt], order = fall.order || [];
  for (const [k, id] of order.entries()) {
    if (index > fallAt) { out[id] = 1; continue; }
    const slot = fall.duration / (order.length + 1), start = 0.4 + k * slot * 0.95;
    out[id] = Math.min(1, Math.max(0, (local - start) / (slot * 0.9)));
  }
  return out;
}

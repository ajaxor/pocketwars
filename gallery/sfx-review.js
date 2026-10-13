// Sound review shared by every gallery page: Approve / Reject for a clip, wherever the clip turns up.
//   createReviewStore(data, storage)   the decisions (pure, no DOM; unit-tested)
//   createSfxKit(data, baseUrl)        the store plus the widgets: kit.row(clipId, label), kit.group(title, [[clipId, label]]), kit.bar()
//   clipsFor.*                         which clips belong to a unit / weapon look / building / event, from the mapping in sfx.json
// Approved status is saved in sfx.json (committed). A pending decision lives in this browser (localStorage) until it is exported to chat,
// where Claude applies it (approve, or redo the rejected ones) and the saved status takes over. All pages share one key, so a decision made
// on the Units tab shows on the Sound effects tab and on the other pages.

export const REVIEW_KEY = 'pocketwars-sfx-review';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

function browserStorage() { try { return globalThis.localStorage ?? null; } catch { return null; } }

/** @param {{groups:{clips:{id:string,status?:string}[]}[]}} data  sfx.json   @param {{getItem:Function,setItem:Function}|null} storage */
export function createReviewStore(data, storage = browserStorage()) {
  const saved = new Map(data.groups.flatMap((g) => g.clips).map((c) => [c.id, c.status || 'new']));
  let decisions = {};
  try { decisions = JSON.parse(storage?.getItem(REVIEW_KEY)) || {}; } catch { decisions = {}; }
  const listeners = new Set();
  const prune = () => { for (const id of Object.keys(decisions)) if (!saved.has(id) || decisions[id].v === saved.get(id)) delete decisions[id]; };   // a decision the file already holds, or for a clip that is gone
  const commit = () => { prune(); try { storage?.setItem(REVIEW_KEY, JSON.stringify(decisions)); } catch { /* private window: decisions last until the tab closes */ } for (const f of listeners) f(); };
  prune();
  return {
    has: (id) => saved.has(id),
    statusOf: (id) => decisions[id]?.v || saved.get(id) || 'new',
    isPending: (id) => Boolean(decisions[id]),
    noteOf: (id) => decisions[id]?.note || '',
    /** Choose approved / rejected for a clip; choosing the current status again undoes the decision. */
    decide(id, v, note = '') {
      if (!saved.has(id)) return;
      const was = decisions[id]?.v;
      if (was === v || (!was && saved.get(id) === v)) delete decisions[id]; else decisions[id] = { v, note: note.trim() };
      commit();
    },
    setNote(id, note) { if (decisions[id]) { decisions[id].note = note.trim(); commit(); } },
    clear() { decisions = {}; commit(); },
    pendingCount: () => Object.keys(decisions).length,
    counts() { const c = { new: 0, approved: 0, rejected: 0 }; for (const id of saved.keys()) c[this.statusOf(id)]++; return c; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    exportText() {
      const pick = (v) => Object.entries(decisions).filter(([, d]) => d.v === v);
      const ok = pick('approved'), no = pick('rejected');
      return ['Sound review', '', `Approved (${ok.length}): ${ok.map(([id]) => id).join(', ') || 'none'}`, '',
        `Rejected, please redo (${no.length}):`, ...(no.length ? no.map(([id, d]) => `- ${id}${d.note ? ': ' + d.note : ''}`) : ['none'])].join('\n');
    },
  };
}

/** The clips that belong to a thing, from sfx.json's `map`. Pure: returns [[clipId, label]], skipping anything unmapped and repeats. */
export const clipsFor = {
  /** A unit: how it moves and how it dies, plus the attack sound of each weapon look it has (`fxs`). */
  unit(map, unitId, fxs = []) {
    return uniq([[map.move[unitId], 'moves'], [map.death[unitId], 'dies'], ...fxs.map((fx) => [map.attack[fx], `fires (${fx})`])]);
  },
  /** A weapon look: the attack sound, and the impact sound of the style the effect lands with (`impactStyle`). */
  attack(map, fx, impactStyle) { return uniq([[map.attack[fx], 'attack'], [impactStyle ? map.impact[impactStyle] : null, 'impact']]); },
  /** Battle events by key (see map.events), labelled with the key. */
  events(map, keys) { return uniq(keys.map((k) => [map.events[k], k])); },
  ui(map, keys) { return uniq(keys.map((k) => [map.ui[k], k])); },
};
function uniq(pairs) { const seen = new Set(); return pairs.filter(([id]) => id && !seen.has(id) && seen.add(id)); }

/** The widgets, all wired to one store and one player (starting a clip stops the one playing). */
export function createSfxKit(data, baseUrl = import.meta.url, storage) {
  const store = createReviewStore(data, storage);
  const clips = new Map(data.groups.flatMap((g) => g.clips).map((c) => [c.id, c]));
  const audios = new Map();
  let playing = null;
  const volume = 0.8;
  const stopAll = () => { for (const a of audios.values()) { a.pause(); a.currentTime = 0; } playing = null; };
  function play(id) {
    const clip = clips.get(id); if (!clip || typeof Audio === 'undefined') return;
    stopAll();
    if (!audios.has(id)) { const a = new Audio(new URL(clip.file, baseUrl)); a.preload = 'none'; audios.set(id, a); }
    const a = audios.get(id); a.volume = volume; a.currentTime = 0; playing = id;
    a.play().catch(() => { /* no gesture or no codec: the button just stays idle */ });
  }
  const refreshers = new Set();
  store.subscribe(() => refreshers.forEach((f) => f()));

  /** One clip: Play, Approve, Reject (and a note box once rejected). */
  function row(id, label) {
    const clip = clips.get(id);
    const box = el('div', 'sfx-row');
    const head = el('div', 'sfx-row-head');
    const name = el('span', 'sfx-row-name', label ? `${label} · ${id}` : id); name.title = clip?.prompt || '';
    const badge = el('span', 'tag');
    head.append(name, badge);
    const buttons = el('div', 'sfx-review');
    const playBtn = el('button', 'btn sfx-play', 'Play'); playBtn.type = 'button'; playBtn.setAttribute('aria-label', `Play ${id}`);
    const ok = el('button', 'btn sfx-ok', 'Approve'); ok.type = 'button'; ok.setAttribute('aria-label', `Approve ${id}`);
    const no = el('button', 'btn sfx-no', 'Reject'); no.type = 'button'; no.setAttribute('aria-label', `Reject ${id}`);
    const note = el('input', 'sfx-note'); note.type = 'text'; note.placeholder = 'Why? (optional)'; note.setAttribute('aria-label', `Note for ${id}`);
    playBtn.addEventListener('click', () => play(id));
    ok.addEventListener('click', () => store.decide(id, 'approved', note.value));
    no.addEventListener('click', () => store.decide(id, 'rejected', note.value));
    note.addEventListener('change', () => store.setNote(id, note.value));
    buttons.append(playBtn, ok, no);
    box.append(head, buttons, note);
    const refresh = () => {
      const st = store.statusOf(id);
      box.dataset.status = st; box.classList.toggle('sfx-pending', store.isPending(id));
      badge.textContent = st === 'new' ? 'new' : st + (store.isPending(id) ? ' •' : '');
      ok.setAttribute('aria-pressed', String(st === 'approved')); no.setAttribute('aria-pressed', String(st === 'rejected'));
      if (store.isPending(id)) note.value = store.noteOf(id);
      note.hidden = st !== 'rejected';
    };
    refreshers.add(refresh); refresh();
    return box;
  }

  /** A collapsible "Sound" block with a row per clip; returns null when there is nothing to hear. */
  function group(pairs, title = 'Sound') {
    if (!pairs.length) return null;
    const d = el('details', 'sfx-block');
    const sum = el('summary', null, title); const dot = el('span', 'tag'); sum.append(' ', dot);
    d.append(sum);
    for (const [id, label] of pairs) d.append(row(id, label));
    const refresh = () => {
      const n = pairs.filter(([id]) => store.statusOf(id) === 'new').length;
      dot.textContent = n ? `${n} to review` : 'all reviewed'; dot.classList.toggle('sfx-done', !n);
    };
    refreshers.add(refresh); refresh();
    return d;
  }

  /** The pending decisions with Export (copies the text for chat) and Clear. */
  function bar() {
    const wrap = el('div', 'sfx-bar');
    const line = el('div', 'controls sfx-controls');
    const summary = el('span', 'tag sfx-summary');
    const exportBtn = el('button', 'btn', 'Export decisions'); exportBtn.type = 'button';
    const clearBtn = el('button', 'btn', 'Clear decisions'); clearBtn.type = 'button';
    line.append(summary, exportBtn, clearBtn);
    const box = el('textarea', 'sfx-export'); box.readOnly = true; box.hidden = true; box.rows = 8; box.setAttribute('aria-label', 'Exported decisions');
    wrap.append(line, box);
    const refresh = () => {
      const c = store.counts(), n = store.pendingCount();
      summary.textContent = `Sound review: ${c.approved} approved · ${c.rejected} rejected · ${c.new} to review`;
      exportBtn.hidden = n === 0; clearBtn.hidden = n === 0;   // nothing to export yet: keep the sticky header short
      exportBtn.textContent = n ? `Export decisions (${n})` : 'Export decisions';
      if (!n) box.hidden = true;
    };
    exportBtn.addEventListener('click', async () => {
      const text = store.exportText();
      box.value = text; box.hidden = false;   // always shown too, so it can be copied by hand if the clipboard is blocked
      try { await navigator.clipboard.writeText(text); exportBtn.textContent = 'Copied!'; } catch { box.select(); exportBtn.textContent = 'Select and copy below'; }
      setTimeout(refresh, 1800);
    });
    clearBtn.addEventListener('click', () => store.clear());
    refreshers.add(refresh); refresh();
    return wrap;
  }

  return { store, map: data.map, clips, row, group, bar, play, stop: stopAll, isPlaying: () => playing };
}

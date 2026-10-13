// Review shared by every gallery page: Approve / Reject for a sound clip or for any asset (unit art, building, attack effect, leader, tileset...),
// wherever it turns up. The file keeps its old name; it started as the sound review.
//   createReviewStore(data, storage)   the decisions (pure, no DOM; unit-tested)
//   createSfxKit(data, baseUrl)        the store plus the widgets: kit.row(clipId, label), kit.group(pairs, title), kit.review(key, label), kit.bar()
//   clipsFor.*                         which clips belong to a unit / weapon look / building / event, from the mapping in sfx.json
// Keys: a sound clip is its plain id ("tank-move-2"); any other asset is "<kind>:<id>" ("unit:tank", "building:agency", "attack:tank.tank_cannon",
// "leader:harlan", "tileset:desert", "style:ink", "layout:versus"). Approved sounds are saved in sfx.json and approved assets in reviews.json (both committed).
// A pending decision lives in this browser (localStorage) until it is exported to chat, where Claude applies it and the saved status takes over.
// ONE export collects the decisions of every tab and page: they all share one localStorage key (and update each other live across browser tabs).

export const REVIEW_KEY = 'pocketwars-sfx-review';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

function browserStorage() { try { return globalThis.localStorage ?? null; } catch { return null; } }

/** @param {{groups:{clips:{id:string,status?:string}[]}[]}} data  sfx.json   @param {{getItem:Function,setItem:Function}|null} storage */
export const KIND_LABELS = { sound: 'Sounds', unit: 'Unit and structure art', building: 'Production buildings', attack: 'Attack effects', leader: 'Leaders', tileset: 'Terrain tilesets', style: 'Portrait styles', layout: 'Dialogue layouts' };
export const kindOf = (key) => (key.includes(':') ? key.slice(0, key.indexOf(':')) : 'sound');
const nameOf = (key) => (key.includes(':') ? key.slice(key.indexOf(':') + 1) : key);

export function createReviewStore(data, storage = browserStorage()) {
  const saved = new Map(data.groups.flatMap((g) => g.clips).map((c) => [c.id, c.status || 'new']));
  const approvedAssets = new Set(data.approvedAssets || []);
  const savedOf = (id) => (saved.has(id) ? saved.get(id) : approvedAssets.has(id) ? 'approved' : 'new');
  const known = (id) => saved.has(id) || (id.includes(':') && KIND_LABELS[kindOf(id)] !== undefined);
  const load = () => { try { return JSON.parse(storage?.getItem(REVIEW_KEY)) || {}; } catch { return {}; } };
  let decisions = load();
  const listeners = new Set();
  const prune = () => { for (const id of Object.keys(decisions)) if (!known(id) || decisions[id].v === savedOf(id)) delete decisions[id]; };   // a decision the file already holds, or for something that is gone
  const commit = () => { prune(); try { storage?.setItem(REVIEW_KEY, JSON.stringify(decisions)); } catch { /* private window: decisions last until the tab closes */ } for (const f of listeners) f(); };
  prune();
  // another browser tab or page changed the decisions: take them over
  try { globalThis.addEventListener?.('storage', (e) => { if (e.key === REVIEW_KEY) { decisions = load(); prune(); for (const f of listeners) f(); } }); } catch { /* no window */ }
  return {
    has: known,
    statusOf: (id) => decisions[id]?.v || savedOf(id),
    isPending: (id) => Boolean(decisions[id]),
    noteOf: (id) => decisions[id]?.note || '',
    /** Choose approved / rejected for a clip; choosing the current status again undoes the decision. */
    decide(id, v, note = '') {
      if (!known(id)) return;
      const was = decisions[id]?.v;
      if (was === v || (!was && savedOf(id) === v)) delete decisions[id]; else decisions[id] = { v, note: note.trim() };
      commit();
    },
    setNote(id, note) { if (decisions[id]) { decisions[id].note = note.trim(); commit(); } },
    clear() { decisions = {}; commit(); },
    pendingCount: () => Object.keys(decisions).length,
    counts() { const c = { new: 0, approved: 0, rejected: 0 }; for (const id of saved.keys()) c[this.statusOf(id)]++; return c; },   // the sound clips: the only things with a known total
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /** Every pending decision of every kind, in one block of text for chat. */
    exportText() {
      const kinds = Object.keys(KIND_LABELS).filter((k) => Object.keys(decisions).some((id) => kindOf(id) === k));
      const out = ['Asset review'];
      for (const k of kinds) {
        const mine = Object.entries(decisions).filter(([id]) => kindOf(id) === k);
        const ok = mine.filter(([, d]) => d.v === 'approved'), no = mine.filter(([, d]) => d.v === 'rejected');
        out.push('', KIND_LABELS[k], `Approved (${ok.length}): ${ok.map(([id]) => nameOf(id)).join(', ') || 'none'}`,
          `Rejected, please redo (${no.length}):`, ...(no.length ? no.map(([id, d]) => `- ${nameOf(id)}${d.note ? ': ' + d.note : ''}`) : ['none']));
      }
      if (!kinds.length) out.push('', 'No decisions yet.');
      return out.join('\n');
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
/** Fetch sfx.json and reviews.json (next to this file) and build the kit: what every page does at start-up. */
export async function loadKit(base = import.meta.url) {
  const get = async (f) => { try { const r = await fetch(new URL(f, base)); return r.ok ? r.json() : null; } catch { return null; } };
  const [sfx, reviews] = await Promise.all([get('sfx.json'), get('reviews.json')]);
  return createSfxKit({ ...sfx, approvedAssets: reviews?.approved || [] }, base);
}

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
  function row(id, label, { playable = true } = {}) {
    const clip = clips.get(id);
    const box = el('div', 'sfx-row');
    const head = el('div', 'sfx-row-head');
    const name = el('span', 'sfx-row-name', playable ? (label ? `${label} · ${id}` : id) : label); name.title = clip?.prompt || '';
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
    if (playable) buttons.append(playBtn);
    buttons.append(ok, no);
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

  /** Approve / Reject for any asset (no Play button): `key` is "<kind>:<id>", `label` says what is being judged, e.g. "Art". */
  const review = (key, label = 'Review') => { const r = row(key, label, { playable: false }); r.classList.add('asset-review'); return r; };

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
      summary.textContent = `Review (all tabs): ${n} pending · sounds ${c.approved} approved, ${c.rejected} rejected, ${c.new} to review`;
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

  return { store, map: data.map, clips, row, review, group, bar, play, stop: stopAll, isPlaying: () => playing };
}

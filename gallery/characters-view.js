// The Characters tab: every leader with their bio, their kit (what they build and what they start with, as unit icons) and a dialogue
// tester that plays their speech lines the way the game does (the Talker never repeats a line soon), typed out with the mouth moving.
import { drawPortrait } from '../src/render/portrait-art.js';
import { SITUATIONS, Talker, MIN_LINES } from '../src/campaign/speech.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const CPS = 34;                 // typing speed in the tester, letters per second
const HOLD = 1500;              // how long a finished line stays before the next one in "play all"
const pretty = (id) => id.replace(/_/g, ' ');
// the face a leader pulls for a situation while the line is being said
const EXPR = { greeting: 'smile', praise: 'smile', joined: 'smile', victory: 'smile', first_blood: 'smile', killing_spree: 'smile', dominant: 'smile', first_turn: 'smile',
  attack: 'angry', taunt: 'angry', building_lost: 'angry', unit_lost: 'worried', first_loss: 'worried', heavy_losses: 'worried', defeat: 'worried', outnumbered: 'worried',
  danger: 'shock', hq_threat: 'shock', tech: 'shock' };

export async function createCharactersView(ctx, root) {
  const { registry, campaign } = ctx;
  const leaders = campaign.leaders;
  const factionOf = (L) => (L.faction === 'chorus' ? { id: 'chorus', name: 'The Chorus', ...campaign.chorus } : registry.factions[L.faction]);

  const speech = {};
  await Promise.all(leaders.map(async (L) => { try { speech[L.id] = await (await fetch(new URL(`../data/speech/${L.id}.json`, import.meta.url))).json(); } catch { speech[L.id] = null; } }));
  const talker = new Talker(speech);

  const intro = el('p', 'intro', 'Every leader as the game has them: portrait, kit and voice. Kits are what they can build at each production building and the units they start a battle with (a set at the HQ and one around each production building they own). Pick a situation and have them say it, or play them all.');
  const list = el('div', 'chars');
  root.append(intro, list);

  const cards = [];
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => { const c = cards.find((x) => x.el === e.target); if (c) c.visible = e.isIntersecting; })) : null;

  for (const L of leaders) {
    const f = factionOf(L), sp = speech[L.id];
    const card = el('article', 'char'); card.style.setProperty('--team', f?.color || '#888');
    const c = { L, el: card, visible: true, last: '', typing: null, queue: [], off: Math.random() * 4000 };

    // portrait + who
    const px = 150, dpr = Math.min(2, window.devicePixelRatio || 1);
    const cv = el('canvas', 'portrait'); cv.width = cv.height = Math.round(px * dpr); cv.style.width = cv.style.height = px + 'px';
    c.cv = cv; c.g = cv.getContext('2d'); c.px = Math.round(px * dpr);
    const who = el('div', 'who');
    who.append(el('h2', '', L.name), el('div', 'sub', `${L.tag} · ${f?.name || L.faction}`), el('p', 'bio', L.bio || ''));
    if (L.flaw) who.append(el('p', 'flaw', `Flaw: ${L.flaw}`));
    if (sp) who.append(el('p', 'voice', `Voice: ${sp.voice}`));
    const head = el('div', 'head'); head.append(cv, who);
    card.append(head);

    // kit
    let kit = null;
    try { kit = registry.loadoutFor(L.id); } catch { /* the Envoy has no kit */ }
    if (kit) {
      const custom = Object.keys(registry.loadouts.leaders[L.id] || {}).length > 0;
      const sec = el('section', 'kit');
      sec.append(el('h3', '', custom ? 'Kit' : 'Kit (the standard one)'));
      const unitChip = (id, n) => {
        const d = registry.unit(id), box = el('div', 'kunit'); box.title = `${d.name}: ${d.cost.toLocaleString('en-US')}`;
        box.append(ctx.icon(id, f)); box.append(el('span', 'kname', d.name));
        if (n > 1) box.append(el('span', 'kn', `×${n}`));
        return box;
      };
      const rowOf = (label, items) => { const r = el('div', 'krow'); r.append(el('div', 'klabel', label)); const u = el('div', 'kunits'); items.forEach((i) => u.append(i)); r.append(u); return r; };
      const builds = el('div', 'kgroup'); builds.append(el('h4', '', 'Builds'));
      for (const [bid, ids] of Object.entries(kit.build)) builds.append(rowOf(registry.terrain[bid]?.name || bid, ids.map((id) => unitChip(id, 1))));
      const starts = el('div', 'kgroup'); starts.append(el('h4', '', 'Starts with'));
      for (const [src, set] of Object.entries(kit.start)) {
        const counts = new Map(); for (const s of set) counts.set(s.unit, (counts.get(s.unit) || 0) + 1);
        starts.append(rowOf(src === 'hq' ? 'HQ' : `Each ${registry.terrain[src]?.name || src}`, [...counts].map(([id, n]) => unitChip(id, n))));
      }
      sec.append(builds, starts); card.append(sec);
    }

    // dialogue tester
    if (sp) {
      const sec = el('section', 'talk');
      sec.append(el('h3', '', 'Dialogue'));
      const bar = el('div', 'tbar');
      const sel = el('select'); sel.setAttribute('aria-label', `${L.name}: situation`);
      for (const [id, desc] of Object.entries(SITUATIONS)) { const o = el('option', '', `${pretty(id)} (${(sp.lines[id] || []).length})`); o.value = id; o.title = desc; sel.append(o); }
      const say = el('button', 'btn', 'Say a line'), all = el('button', 'btn', 'Play all'), rnd = el('button', 'btn', 'Surprise me');
      for (const b of [say, all, rnd]) b.type = 'button';
      const desc = el('span', 'tdesc', SITUATIONS[sel.value]);
      bar.append(sel, say, all, rnd);
      const bubble = el('div', 'bubble', 'Pick a situation and press Say a line.'); bubble.dataset.empty = '1';
      const info = el('div', 'tinfo');
      sec.append(bar, desc, bubble, info);
      const lines = el('details', 'lines'); lines.append(el('summary', '', `Every line (${Object.values(sp.lines).reduce((a, l) => a + l.length, 0)})`));
      for (const [sit, ls] of Object.entries(sp.lines)) { const g = el('div', 'lgroup'); g.append(el('h4', '', `${pretty(sit)} · ${ls.length}${ls.length < MIN_LINES ? ' (too few!)' : ''}`)); const ul = el('ul'); ls.forEach((l) => ul.append(el('li', '', l))); g.append(ul); lines.append(g); }
      sec.append(lines); card.append(sec);

      const speak = (sit, text, n, of) => { c.typing = { sit, text, start: performance.now(), done: false }; bubble.dataset.empty = ''; info.textContent = `${pretty(sit)}${of ? ` · line ${n} of ${of}` : ''}`; };
      sel.addEventListener('change', () => { desc.textContent = SITUATIONS[sel.value]; c.queue = []; });
      say.addEventListener('click', () => { c.queue = []; speak(sel.value, talker.say(L.id, sel.value)); });
      all.addEventListener('click', () => { const ls = sp.lines[sel.value] || []; c.queue = ls.map((t, i) => [sel.value, t, i + 1, ls.length]); const first = c.queue.shift(); if (first) speak(...first); });
      rnd.addEventListener('click', () => { c.queue = []; const ids = Object.keys(SITUATIONS); const sit = ids[Math.floor(Math.random() * ids.length)]; sel.value = sit; desc.textContent = SITUATIONS[sit]; speak(sit, talker.say(L.id, sit)); });
      c.bubble = bubble;
    }

    cards.push(c); list.append(card); io?.observe(card);
  }

  function frame(now) {
    if (root.hidden) return;
    for (const c of cards) {
      if (!c.visible) continue;
      let talk = 0;
      const t = c.typing;
      if (t) {
        const shown = Math.min(t.text.length, Math.floor(((now - t.start) / 1000) * CPS));
        if (shown !== t.shown) { t.shown = shown; c.bubble.textContent = t.text.slice(0, shown); }
        if (shown < t.text.length) talk = Math.floor(now / 110) % 2 ? 1 : .45;
        else if (!t.done) { t.done = true; t.end = now; }
        else if (c.queue.length && now - t.end > HOLD) { const next = c.queue.shift(); t.done = null; c.typing = { sit: next[0], text: next[1], start: now, done: false }; c.bubble.dataset.empty = ''; c.el.querySelector('.tinfo').textContent = `${pretty(next[0])} · line ${next[2]} of ${next[3]}`; }
      }
      const blink = ((now + c.off) % 4300) < 130, expr = (t && EXPR[t.sit]) || 'neutral';
      const key = `${blink}|${talk}|${expr}`;
      if (key === c.last) continue;
      c.last = key;
      c.g.clearRect(0, 0, c.px, c.px);
      drawPortrait(c.g, c.L, { px: c.px, style: 'flat', expr, blink, talk });
    }
  }
  return { show() { cards.forEach((c) => { c.last = ''; }); }, frame };
}

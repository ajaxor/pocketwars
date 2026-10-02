// Leader portrait gallery: builds the style grid, the expression sheet and eight dialogue mock-ups, and animates the portraits
// (blinking, and a flapping mouth while a mock-up is "typing"). Art lives in portrait-art.js; layouts are CSS in portraits.html.
import { STYLES, EXPRESSIONS, drawPortrait, drawCutout, setFactions } from '../src/render/portrait-art.js';

const DATA = await (await fetch(new URL('data.json', import.meta.url))).json();
const CAMPAIGN = await (await fetch(new URL('../data/campaign.json', import.meta.url))).json();
setFactions([...DATA.factions, { id: 'chorus', ...CAMPAIGN.chorus }]);
const LEADERS = CAMPAIGN.leaders.filter((l) => l.id !== 'envoy');   // the five faction leaders

const fac = (L) => DATA.factions.find((f) => f.id === L.faction);
const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dpr = Math.min(2, window.devicePixelRatio || 1);
const state = { expr: 'neutral', size: 150, dlg: 'auto', sheetStyle: 'ink' };

// ---- live portraits -------------------------------------------------------------------------------------------------------------
const live = [];   // { cv, L, style, expr, who, scene, cut, last, off }
/** Put a portrait on a canvas. `o`: { style, expr, scene, who, cut, cssPx } (a cut-out has no backdrop; `scene` supplies talking). */
function portrait(L, o) {
  const cv = document.createElement('canvas'), px = Math.round(o.cssPx * dpr);
  cv.width = cv.height = px; cv.style.width = cv.style.height = o.cssPx + 'px';
  const p = { cv, g: cv.getContext('2d'), L, px, style: o.style || 'flat', expr: o.expr || 'neutral', who: o.who ?? 0, scene: o.scene || null, cut: !!o.cut, last: '', off: Math.random() * 4000, fixedStyle: !!o.fixedStyle, follow: !!o.follow };
  live.push(p); return p;
}
function frame(now) {
  for (const p of live) {
    if (!p.cv.isConnected) continue;
    const blink = ((now + p.off) % 4300) < 130;
    const sc = p.scene, talking = sc && sc.typing && sc.speaking === p.who;
    const talk = talking ? (Math.floor(now / 120) % 2 ? 1 : .5) : 0;
    const expr = (sc && sc.expr && sc.expr[p.who]) || (p.follow ? state.expr : p.expr);
    const style = sc && state.dlg !== 'auto' && !p.cut && !p.fixedStyle ? state.dlg : p.style;
    const key = `${p.assim ? 'A' : 'n'}|${style}|${expr}|${blink}|${talk}|${p.px}`;
    if (key === p.last) continue;
    p.last = key;
    p.g.clearRect(0, 0, p.px, p.px);
    if (p.cut) drawCutout(p.g, p.L, { px: p.px, expr, blink, talk, outline: false, assim: !!p.assim });
    else drawPortrait(p.g, p.L, { px: p.px, style, expr, blink, talk, assim: !!p.assim });
  }
  requestAnimationFrame(frame);
}

// ---- controls -------------------------------------------------------------------------------------------------------------------
function seg(host, items, current, onPick) {
  host.replaceChildren();
  for (const [v, label] of items) {
    const b = el('button', '', label); b.dataset.v = v; b.setAttribute('aria-pressed', String(v === current));
    b.addEventListener('click', () => { host.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); onPick(v); });
    host.append(b);
  }
}
seg($('#expr'), EXPRESSIONS.map((e) => [e, e]), state.expr, (v) => { state.expr = v; live.forEach((p) => { p.last = ''; }); });
seg($('#dlg'), [['auto', 'As designed'], ...STYLES.filter((s) => s.id !== 'poster' && s.id !== 'medallion').map((s) => [s.id, s.name])], state.dlg, (v) => { state.dlg = v; live.forEach((p) => { p.last = ''; }); });
$('#size').addEventListener('input', (e) => {
  state.size = Number(e.target.value); $('#sizeOut').textContent = state.size + ' px';
  document.documentElement.style.setProperty('--s', state.size + 'px');
  for (const p of live.filter((x) => x.sizeBound)) { p.px = Math.round(state.size * dpr); p.cv.width = p.cv.height = p.px; p.last = ''; }
});

// ---- section 1: the styles ------------------------------------------------------------------------------------------------------
for (const st of STYLES) {
  const row = el('div', 'style-row'); row.append(el('h3', '', st.name), el('p', '', st.note));
  const faces = el('div', 'faces');
  for (const L of LEADERS) {
    const f = el('div', 'face'), p = portrait(L, { style: st.id, cssPx: 150, follow: true });
    p.sizeBound = true; p.cv.style.width = p.cv.style.height = ''; p.cv.style.borderRadius = '6px';
    p.px = Math.round(state.size * dpr); p.cv.width = p.cv.height = p.px;
    f.append(p.cv, el('div', 'cap', `<b>${L.name}</b><br>${L.tag}`)); faces.append(f);
  }
  row.append(faces); $('#styles').append(row);
}

// ---- section 2: expression sheet ------------------------------------------------------------------------------------------------
function buildSheet() {
  for (let i = live.length - 1; i >= 0; i--) if (live[i].sheet) live.splice(i, 1);
  const t = el('table'), head = el('tr'); head.append(el('th'));
  EXPRESSIONS.forEach((e) => head.append(el('th', '', e))); t.append(head);
  for (const L of LEADERS) {
    const tr = el('tr'); tr.append(el('th', '', L.name.split(' ').slice(-1)[0]));
    for (const e of EXPRESSIONS) { const td = el('td'), p = portrait(L, { style: state.sheetStyle, expr: e, cssPx: 96, fixedStyle: true }); p.sheet = true; td.append(p.cv); tr.append(td); }
    t.append(tr);
  }
  $('#sheet').replaceChildren(t);
}
seg($('#sheetStyle'), STYLES.map((s) => [s.id, s.name]), state.sheetStyle, (v) => { state.sheetStyle = v; buildSheet(); });
buildSheet();

// ---- section 2b: assimilated -----------------------------------------------------------------------------------------------------
{
  const row = el('div', 'faces');
  for (const L of CAMPAIGN.leaders) {
    for (const assim of L.id === 'envoy' ? [false] : [false, true]) {
      const f = el('div', 'face'), p = portrait(L, { style: 'flat', cssPx: 130, follow: true });
      p.assim = assim; p.sizeBound = true; p.cv.style.width = p.cv.style.height = ''; p.cv.style.borderRadius = '6px';
      p.px = Math.round(state.size * dpr); p.cv.width = p.cv.height = p.px;
      f.append(p.cv, el('div', 'cap', `<b>${L.name}</b><br>${assim ? 'Assimilated' : L.id === 'envoy' ? L.tag : 'Free'}`)); row.append(f);
    }
  }
  $('#assim').append(row);
}

// ---- section 3: dialogue mock-ups -----------------------------------------------------------------------------------------------
const A = LEADERS[0], B = LEADERS[1];
const BANTER = [
  { who: 0, text: 'Reinforcements are rolling in! Let\'s take that bridge before dusk!', expr: ['smile', 'neutral'] },
  { who: 1, text: 'Predictable. Your flank was mine three turns ago.', expr: ['shock', 'neutral'] },
  { who: 0, text: 'Then you won\'t mind if I hit it again!', expr: ['angry', 'neutral'] },
  { who: 1, text: 'Please. Try.', expr: ['angry', 'smile'] },
];
const stage = (cls, extra = '') => { const s = el('div', 'stage ' + cls, extra); s.insertAdjacentHTML('afterbegin', '<div class="hud"><span>Day 4</span><i>12,000</i></div>'); return s; };

/** A running exchange. `apply(line, scene)` updates the layout for the new speaker; the text is typed into `target`. */
async function play(scene, target, lines, apply) {
  while (scene.alive) {
    for (const ln of lines) {
      while (scene.hidden) await sleep(300);
      scene.speaking = ln.who; scene.expr = ln.expr; scene.typing = true; apply(ln);
      target.textContent = '';
      for (let i = 1; i <= ln.text.length; i++) { target.textContent = ln.text.slice(0, i); await sleep(26); }
      scene.typing = false; await sleep(1700);
    }
  }
}
function mock(title, note, pro, con, build) {
  const m = el('div', 'mock'); m.append(el('h3', '', title), el('p', '', `${note}<br><span class="pro">+ ${pro}</span><br><span class="con">– ${con}</span>`));
  const scene = { alive: true, hidden: false, typing: false, speaking: 0, expr: null };
  const st = build(scene);
  m.append(st); $('#mocks').append(m);
  new IntersectionObserver((es) => { scene.hidden = !es[0].isIntersecting; }).observe(m);
  return scene;
}
const place = (host, p, who) => { p.who = who; host.append(p.cv); return p; };

// 1 classic box
mock('1 · Classic box', 'A framed portrait and a text box along the bottom, with a name tab and a "more" arrow. The familiar, safest layout.', 'Familiar, readable, easy to build; works for any portrait style.', 'Covers the bottom third of the map, and the portrait is small.', (scene) => {
  const s = stage('classic-stage'), box = el('div', 'classic', '<div class="nm"></div><div class="pt"></div><div class="tx caret"></div><div class="nx">▼</div>');
  s.append(box);
  const pts = [A, B].map((L, i) => portrait(L, { style: 'ink', cssPx: 84, scene, who: i }));
  const slot = box.querySelector('.pt'); const swap = (i) => { slot.replaceChildren(pts[i].cv); };
  swap(0);
  play(scene, box.querySelector('.tx'), BANTER, (ln) => { const L = [A, B][ln.who]; box.style.setProperty('--fc', fac(L).color); box.querySelector('.nm').textContent = L.name; swap(ln.who); });
  return s;
});

// 2 visual novel
mock('2 · Visual novel', 'Big half-length cut-outs stand at the edges and the speaker is lit while the listener dims; a slim box floats between them.', 'Most expressive: faces are large and the conversation feels staged.', 'Needs the most art (every leader, several poses) and hides a lot of the map.', (scene) => {
  const s = stage('vn');
  const pa = portrait(A, { cut: true, cssPx: 230, scene, who: 0 }), pb = portrait(B, { cut: true, cssPx: 230, scene, who: 1 });
  pa.cv.className = 'cut a'; pb.cv.className = 'cut b'; pa.cv.style.position = pb.cv.style.position = 'absolute';
  const box = el('div', 'vn-box box', '<div class="nm"></div><div class="tx caret"></div>'); box.className = 'box';
  s.append(pa.cv, pb.cv, box);
  play(scene, box.querySelector('.tx'), BANTER, (ln) => {
    const L = [A, B][ln.who]; box.style.setProperty('--fc', fac(L).color);
    const nm = box.querySelector('.nm'); nm.textContent = L.name; nm.style.left = ln.who === 0 ? '14px' : 'auto'; nm.style.right = ln.who === 0 ? 'auto' : '14px';
    pa.cv.dataset.on = ln.who === 0 ? 1 : 0; pb.cv.dataset.on = ln.who === 1 ? 1 : 0;
  });
  return s;
});

// 3 bubbles on the map
mock('3 · Map bubbles', 'A speech bubble attached to the unit or HQ that is talking, with a small medallion. Nothing leaves the map.', 'Least intrusive: you can keep playing, and it points at who is speaking.', 'Little room for text, and a bubble can cover nearby units.', (scene) => {
  const s = stage('bub');
  const hqA = el('div', 'tile hq', 'HQ'), hqB = el('div', 'tile hq', 'HQ');
  hqA.style.cssText = 'left:44px;top:170px'; hqB.style.cssText = 'right:44px;top:170px';
  hqA.style.setProperty('--fc', fac(A).color); hqB.style.setProperty('--fc', fac(B).color);
  const ba = el('div', 'bubble', '<div class="pt"></div><div class="tx caret"></div>'), bb = el('div', 'bubble', '<div class="pt"></div><div class="tx caret"></div>');
  ba.style.cssText = 'left:14px;top:96px;--tail:34px'; bb.style.cssText = 'right:14px;top:96px;--tail:158px';
  place(ba.querySelector('.pt'), portrait(A, { style: 'medallion', cssPx: 38, scene, who: 0, fixedStyle: true }), 0);
  place(bb.querySelector('.pt'), portrait(B, { style: 'medallion', cssPx: 38, scene, who: 1, fixedStyle: true }), 1);
  s.append(hqA, hqB, ba, bb);
  const tx = { 0: ba.querySelector('.tx'), 1: bb.querySelector('.tx') };
  // type into whichever bubble is speaking
  const proxy = { set textContent(v) { tx[scene.speaking].textContent = v; } };
  play(scene, proxy, BANTER, (ln) => { ba.dataset.on = ln.who === 0 ? 1 : 0; bb.dataset.on = ln.who === 1 ? 1 : 0; tx[ln.who].textContent = ''; });
  return s;
});

// 4 radio
mock('4 · Radio transmission', 'A green phosphor monitor with scan-lines and a rolling glitch bar, for calls from off-map allies and enemies.', 'Strong flavour, and the duotone look hides weak portrait art.', 'Harder to read for long text, and the look is only right for remote conversations.', (scene) => {
  const s = stage('crt-stage');
  const c = el('div', 'crt', '<div class="top"><span>CH 07 · ENCRYPTED</span><b>● INCOMING</b></div><div class="scr"></div><div class="info"></div><div class="tx caret"></div>');
  const pts = [A, B].map((L, i) => portrait(L, { style: 'flat', cssPx: 120, scene, who: i, fixedStyle: true }));
  s.append(c);
  const slot = c.querySelector('.scr'); slot.append(pts[0].cv);
  play(scene, c.querySelector('.tx'), BANTER, (ln) => {
    const L = [A, B][ln.who]; slot.replaceChildren(pts[ln.who].cv);
    c.querySelector('.info').innerHTML = `<b>${L.name.toUpperCase()}</b><br>${L.tag.toUpperCase()}<br>SIGNAL ${ln.who ? '62' : '88'}%`;
  });
  return s;
});

// 5 dossier
mock('5 · Briefing dossier', 'A paper file with a clipped halftone photo, a stamp and a typed note. For mission briefings and introducing a new leader.', 'A great way to introduce a mission: objectives, a name and a face in one card.', 'Not for back-and-forth talk, and too busy to show in the middle of a battle.', (scene) => {
  const s = stage('dossier');
  const sheet = el('div', 'paper', '<h4></h4><div class="f"></div><div class="pt"></div><div class="tx caret"></div><div class="ob">☐ Hold the bridge &nbsp; ☐ Keep the HQ safe</div>');
  const pts = [A, B].map((L, i) => portrait(L, { style: 'halftone', cssPx: 84, scene, who: i, fixedStyle: true }));
  s.append(sheet, el('div', 'clip'), el('div', 'stamp', 'CLASSIFIED'));
  sheet.querySelector('.pt').append(pts[0].cv);
  play(scene, sheet.querySelector('.tx'), BANTER, (ln) => {
    const L = [A, B][ln.who]; sheet.querySelector('.pt').replaceChildren(pts[ln.who].cv);
    sheet.querySelector('h4').textContent = L.name;
    sheet.querySelector('.f').innerHTML = `<b>Army:</b> ${fac(L).name}<br><b>Known for:</b> ${L.tag}<br><b>Threat:</b> ${ln.who ? 'Severe' : 'Moderate'}`;
  });
  return s;
});

// 6 versus
mock('6 · Versus screen', 'Two leaders slide in on a diagonal split in their army colours, with a one-liner under each. For the start of a battle or a duel.', 'Instant drama and it tells you the matchup at a glance.', 'A pure intro: no dialogue to speak of, and it costs a second or two every time.', (scene) => {
  const s = stage('vs');
  s.style.setProperty('--fa', fac(A).dark); s.style.setProperty('--fb', fac(B).dark);
  const L = el('div', 'L'), R = el('div', 'R'); s.append(L, R);
  const pa = portrait(A, { style: 'poster', cssPx: 160, scene, who: 0, fixedStyle: true }), pb = portrait(B, { style: 'poster', cssPx: 160, scene, who: 1, fixedStyle: true });
  const wa = el('div', 'pa'), wb = el('div', 'pb'); wa.append(pa.cv); wb.append(pb.cv);
  const ca = el('div', 'ca', `<b>${A.name}</b>${A.line}`), cb = el('div', 'cb', `<b>${B.name}</b>${B.line}`);
  s.append(wa, wb, el('div', 'big', 'VS'), ca, cb);
  scene.typing = false; return s;
});

// 7 toasts
mock('7 · Battle chatter chips', 'A narrow chip slides in at the top with a small portrait and one line: a taunt, a warning, a report. Never blocks play.', 'Cheap to show often, and gives characters presence during play.', 'One line only, and easy to miss without sound.', (scene) => {
  const s = stage('toasts');
  const lines = [[A, 'We captured the factory!'], [B, 'You will regret that.'], [A, 'Bring it on!']];
  lines.forEach(([L, t], i) => {
    const chip = el('div', 't', `<div></div><div><b>${L.name.toUpperCase()}</b>${t}</div>`); chip.style.setProperty('--fc', fac(L).color);
    chip.firstChild.append(portrait(L, { style: 'medallion', cssPx: 38, expr: i === 1 ? 'angry' : 'smile', fixedStyle: true }).cv);
    s.append(chip);
  });
  return s;
});

// 8 power cut-in
mock('8 · Power cut-in', 'A diagonal banner sweeps across the screen with the leader bursting in, speed lines and a shout, when a special power fires.', 'The big moment: nothing else says "something just changed" like it.', 'Needs a skip option, and it hides the board while it plays.', (scene) => {
  const s = stage('power');
  s.style.setProperty('--fc', fac(A).color);
  const cut = portrait(A, { cut: true, cssPx: 220, scene, who: 0, expr: 'angry' }); cut.cv.className = 'cut'; cut.cv.style.position = 'absolute';
  s.append(el('div', 'band'), el('div', 'lines'), cut.cv, el('div', 'shout', 'FULL<br>THROTTLE!'), el('div', 'sub', 'All units move again · +1 range'));
  return s;
});

requestAnimationFrame(frame);

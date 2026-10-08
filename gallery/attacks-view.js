// The Attacks tab: every armed unit shooting its weapon at a target, on a loop, using the game's own effects code (src/render/effects.js).
import { Effects } from '../src/render/effects.js';
import { attackList } from './attack-stage.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const GAP = 900;   // ms of rest between two plays

export function createAttacksView(ctx, root) {
  const { registry, factions } = ctx;
  const [mine, theirs] = factions;
  const { armed, unarmed } = attackList(registry);
  const colorsOf = (owner) => (owner === 0 ? mine : theirs);
  const stages = [];   // { canvas, g, effects, spec, label, started, visible }

  root.append(el('p', 'intro', `Every armed unit firing each of its weapons at a target, looping. This is the game's real effect code (src/render/attack-fx.js); a weapon picks its look with "fx" in data/weapons.json. ${unarmed.length} unarmed units (${unarmed.map((u) => u.name).join(', ')}) have no attack.`));
  const grid = el('div', 'grid');
  root.append(grid);

  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => entries.forEach((e) => { const s = stages.find((x) => x.canvas === e.target); if (s) s.visible = e.isIntersecting; })) : null;
  for (const u of armed) {
    const card = el('article', 'card unit st-draft wide');
    const top = el('div', 'top'); top.append(el('div', 'name', u.name), el('span', 'tag', u.category));
    card.append(top);
    for (const spec of u.stages) {
      const w = registry.weapon(spec.weapon);
      const row = el('div', 'attack-row');
      row.append(el('div', 'meta', `${w.name} · ${w.fx} · range ${w.range[0] === w.range[1] ? w.range[0] : w.range[0] + '–' + w.range[1]}`));
      const canvas = el('canvas'); canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${u.name}: ${w.name}`);
      row.append(canvas);
      card.append(row);
      const stage = { canvas, g: canvas.getContext('2d'), effects: new Effects(registry, colorsOf), spec, started: -1e9, visible: true, play: 0 };
      stages.push(stage); io?.observe(canvas);
      canvas.addEventListener('click', () => { stage.started = -1e9; });   // tap to replay now
    }
    grid.append(card);
  }

  const tileCss = () => ctx.state.size;
  function size(s) {
    const S = tileCss(), dpr = window.devicePixelRatio || 1, n = s.spec.distance + 1;
    s.canvas.width = Math.round(S * n * dpr); s.canvas.height = Math.round(S * dpr);
    s.canvas.style.width = S * n + 'px'; s.canvas.style.height = S + 'px';
    s.g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function paint(s, now) {
    const S = tileCss(), { spec, effects, g } = s;
    const n = spec.distance + 1;
    if (now - s.started > 2600 + GAP) {    // start the next play
      effects.clear();
      s.started = now;
      const a = { id: 1, type: spec.attacker, owner: 0, x: 0, y: 0, hp: 10 };
      const d = { id: 2, type: spec.target, owner: 1, x: spec.distance, y: 0, hp: 6 };
      effects.strike({ attacker: a, defender: d, weapon: spec.weapon, damage: 4, destroyed: false }, now);
      s.a = a; s.d = d;
    }
    const sprites = { a: registry.unit(spec.attacker).render, d: registry.unit(spec.target).render };
    const common = { faction: null, size: S, t: ctx.clock(), state: 'idle', outline: ctx.state.outline, outlineColor: ctx.state.outlineColor, blackLines: ctx.state.blackLines };
    g.clearRect(0, 0, S * n, S);
    for (let i = 0; i < n; i++) {   // the ground first
      const water = i === 0 ? spec.attackerWater : i === n - 1 ? spec.targetWater : spec.attackerWater && spec.targetWater;
      g.save(); g.translate(i * S, 0);
      ctx.paintTile(g, { ...common, unit: {}, faction: mine, phase: 0, bg: ctx.terrain[water ? 'sea' : 'plain'], empty: true });
      g.restore();
    }
    // the units on it: the attacker lunges forward and the target shakes when hit (the effects know when)
    const [lx, ly] = effects.unitOffset(1, now, S), [hx, hy] = effects.unitOffset(2, now, S);
    for (const [i, ox, oy, u, f, water] of [[0, lx, ly, sprites.a, mine, spec.attackerWater], [n - 1, hx, hy, sprites.d, theirs, spec.targetWater]]) {
      g.save(); g.translate(i * S + ox, oy);
      ctx.paintTile(g, { ...common, unit: { sprite: u.sprite, altitude: u.altitude || 0, concept: false, water }, faction: f, phase: i, bg: null });
      g.restore();
    }
    effects.draw(g, now, S, () => {});
  }

  return {
    show() { stages.forEach(size); },
    frame(now) { for (const s of stages) if (s.visible && !root.hidden) paint(s, now); },
    resize() { stages.forEach(size); },
  };
}

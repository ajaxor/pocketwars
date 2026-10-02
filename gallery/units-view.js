// The unit tabs: a pipeline summary with stage filters, and a card per unit (two team colours, status badge, stats, description).
import { stageCounts } from './catalog.js';
import { createWallLab } from './wall-lab.js';

export const SECTIONS = ['Game buildings', 'Defences', 'Walls', 'Labs and bases'];   // the order of the Structures tab's sections

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

export function createUnitsView(ctx, root) {
  const { catalog, status, factions, state } = ctx;
  const stageRank = Object.fromEntries(status.stages.map((s, i) => [s.id, i]));
  const stageInfo = Object.fromEntries(status.stages.map((s) => [s.id, s]));
  let group = null, filter = null;   // the tab, and the stage chosen in the pipeline bar (null = all)

  const pipeline = el('div', 'pipeline');
  const grid = el('div', 'grid');
  root.append(pipeline, grid);
  const wallLab = createWallLab(ctx, root); wallLab.hidden = true;
  const sectionRank = (u) => (u.section ? Math.max(0, SECTIONS.indexOf(u.section)) : -1);
  const headings = new Map(SECTIONS.map((name) => [name, el('h3', 'section', name)]));

  // one card per unit, built once and shown or hidden by tab and stage
  const cards = catalog.map((u, order) => {
    const unit = { sprite: u.sprite, altitude: u.altitude, concept: u.art === 'concept', water: u.water, kind: u.kind, cracked: u.cracked, links: u.kind === 'wall' ? (u.cracked ? { e: true, w: true } : { e: true, w: true, s: true }) : null };
    const card = el('article', `card unit st-${u.stage}`);
    const top = el('div', 'top'); top.append(el('div', 'name', u.name));
    const badge = el('span', `badge st-${u.stage}`, stageInfo[u.stage].label); badge.title = stageInfo[u.stage].note; top.append(badge);
    const meta = [u.role, u.cost != null ? u.cost.toLocaleString('en-US') : null, u.kind === 'unit' && u.move ? `move ${u.move}` : null, u.range].filter(Boolean).join(' · ');
    const row = el('div', 'row');
    factions.slice(0, 2).forEach((faction, fx) => {
      const canvas = el('canvas'); canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${u.name}, ${faction.name}`);
      row.append(canvas); ctx.addTile(canvas, unit, faction, order * 1.3 + fx * .7);
    });
    if (u.waterSprite) {                                                                        // a unit that looks different afloat: a third tile on water
      const canvas = el('canvas'); canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${u.name} on water`);
      row.append(canvas); ctx.addTile(canvas, { ...unit, sprite: u.waterSprite, water: true }, factions[0], order * 1.3 + 1.4);
    }
    card.append(top, el('div', 'meta', meta), row);
    if (u.weapons?.length) card.append(el('p', 'mech', u.weapons.map((w) => `${w.name} ${w.range[0] === w.range[1] ? w.range[0] : w.range[0] + '–' + w.range[1]}`).join(' · ')));
    if (u.tags?.length) { const t = el('div', 'tags'); u.tags.forEach((k) => t.append(el('span', 'tag', k))); card.append(t); }
    if (u.mechanic) card.append(el('p', 'mech', u.mechanic));
    if (u.facility) card.append(el('div', 'ov', `${u.facility}${u.overlaps ? ` · overlaps: ${u.overlaps}` : ''}`));
    return { u, card, order };
  });
  cards.sort((a, b) => sectionRank(a.u) - sectionRank(b.u) || stageRank[b.u.stage] - stageRank[a.u.stage] || a.order - b.order);   // by section, then furthest along first
  let lastSection = null;
  for (const c of cards) {
    if (c.u.section && c.u.section !== lastSection) { lastSection = c.u.section; const h = headings.get(c.u.section); if (h) grid.append(h); }
    grid.append(c.card);
  }

  function render() {
    const mine = catalog.filter((u) => u.group === group);
    const counts = stageCounts(mine, status);
    pipeline.replaceChildren();
    const bar = el('div', 'bar');
    for (const s of counts) if (s.n) { const seg = el('span', `seg st-${s.id}`); seg.style.flexGrow = s.n; seg.title = `${s.label}: ${s.n}`; bar.append(seg); }
    const chips = el('div', 'chips');
    const chip = (id, label, n, note) => {
      const b = el('button', `chip${id ? ` st-${id}` : ''}`, `${label} ${n}`); b.type = 'button'; b.title = note || '';
      b.setAttribute('aria-pressed', String(filter === id)); b.addEventListener('click', () => { filter = filter === id ? null : id; render(); }); chips.append(b);
    };
    chip(null, 'All', mine.length, 'every unit in this tab');
    for (const s of counts) chip(s.id, s.label, s.n, s.note);
    pipeline.append(bar, chips, el('p', 'legend', status.stages.map((s) => `${s.label}: ${s.note}`).join('  ·  ')));
    let shown = 0;
    for (const { u, card } of cards) {
      const on = u.group === group && (!filter || u.stage === filter);
      card.hidden = !on; if (on) shown++;
    }
    for (const [name, h] of headings) h.hidden = group !== 'structure' || !cards.some((c) => c.u.section === name && !c.card.hidden);
    wallLab.hidden = group !== 'structure';
    grid.dataset.empty = shown ? '' : 'Nothing at this stage yet.';
    ctx.sizeAll?.();
  }

  return { show(id) { if (id !== group) filter = null; group = id; render(); } };
}

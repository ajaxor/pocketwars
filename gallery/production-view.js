// The Production tab: which building produces which unit. gallery/production.json assigns every unit in the game to a building; the buildings are
// the game's own production buildings and labs, plus a few concept buildings drawn in the gallery.
// The pure checks (productionProblems) are unit-tested; the view only lays the data out.

import { clipsFor } from './sfx-review.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

/** Things wrong with production.json, as sentences (empty = fine). `unitIds` are the game's units; `art` = { game: Set, concept: Set } of drawable building ids. */
export function productionProblems(data, unitIds, art) {
  const p = [], seen = new Map(), ids = new Set();
  for (const b of data.buildings) {
    if (ids.has(b.id)) p.push(`building "${b.id}" appears twice`);
    ids.add(b.id);
    if (!art[b.art]?.has(b.id)) p.push(`building "${b.id}" has no ${b.art} drawing`);
    if (!b.units?.length) p.push(`building "${b.id}" produces nothing`);
    for (const u of b.units || []) {
      if (!unitIds.includes(u)) p.push(`"${u}" (in ${b.id}) is not a unit`);
      if (seen.has(u)) p.push(`"${u}" is in both ${seen.get(u)} and ${b.id}`);
      seen.set(u, b.id);
    }
  }
  for (const l of data.laid?.units || []) { if (seen.has(l.unit)) p.push(`"${l.unit}" is both built and laid`); seen.set(l.unit, 'laid'); }
  for (const l of data.shelved?.units || []) { if (seen.has(l.unit)) p.push(`"${l.unit}" is both built and shelved`); seen.set(l.unit, 'shelved'); }
  for (const u of unitIds) if (!seen.has(u)) p.push(`unit "${u}" is not assigned to a building`);
  return p;
}

/** Number of unit-producing buildings (the tab's count). */
export const buildingCount = (data) => data.buildings.length;

export function createProductionView(ctx, root, data) {
  const { registry, factions } = ctx;
  const origins = { existing: 'In the game', 'existing concept': 'Concept (drawn)', new: 'New idea' };
  let filter = null;

  root.append(el('p', 'intro', data.note.split('. ')[0] + '. Each card is a building and the units it would make. Buildings marked "New idea" were invented for this page; the others already exist in the game or the gallery.'));
  const chips = el('div', 'chips');
  const grid = el('div', 'grid prod-grid');
  root.append(chips, grid);

  const cards = data.buildings.map((b, order) => {
    const card = el('article', 'card unit st-' + (b.origin === 'new' ? 'idea' : b.origin === 'existing' ? 'ready' : 'draft') + ' wide');
    const top = el('div', 'top'); top.append(el('div', 'name', b.name), el('span', 'tag', origins[b.origin] || b.origin));
    const row = el('div', 'row');
    factions.slice(0, 2).forEach((faction, fx) => {
      const canvas = el('canvas'); canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${b.name}, ${faction.name}`);
      row.append(canvas); ctx.addTile(canvas, { sprite: b.id, kind: 'building', concept: b.art === 'concept', water: b.water }, faction, order * 1.1 + fx * .7);
    });
    const units = el('div', 'kunits prod-units');
    for (const id of b.units) {
      const d = registry.unit(id), box = el('div', 'kunit'); box.title = `${d.name}: ${d.cost.toLocaleString('en-US')}`;
      box.append(ctx.icon(id, factions[0], 56), el('span', 'kname', d.name), el('span', 'kcost', d.cost.toLocaleString('en-US')));
      units.append(box);
    }
    card.append(top, row, el('p', 'mech', b.blurb), units);
    if (ctx.sfx) card.append(ctx.sfx.review(`building:${b.id}`, 'Building and its units'));
    const sound = ctx.sfx?.group(clipsFor.events(ctx.sfx.map, ['build']), 'Sound');   // the build jingle every building shares
    if (sound) card.append(sound);
    return { b, card };
  });
  for (const c of cards) grid.append(c.card);
  for (const group of [data.laid, data.shelved]) if (group?.units?.length) {
    const card = el('article', 'card unit st-draft wide');
    card.append(el('div', 'top'));
    card.firstChild.append(el('div', 'name', group === data.laid ? 'Not bought' : 'Shelved'), el('span', 'tag', group === data.laid ? 'laid by a unit' : 'not built'));
    const units = el('div', 'kunits prod-units');
    for (const l of data.laid.units) {
      const d = registry.unit(l.unit), box = el('div', 'kunit');
      box.append(ctx.icon(l.unit, factions[0], 56), el('span', 'kname', d.name), el('span', 'kcost', l.by ? `laid by ${registry.unit(l.by).name}` : 'shelved'));
      units.append(box);
    }
    card.append(el('p', 'mech', group.note), units);
    grid.append(card);
  }

  function render() {
    chips.replaceChildren();
    const chip = (id, label, n) => {
      const b = el('button', 'chip', `${label} ${n}`); b.type = 'button'; b.setAttribute('aria-pressed', String(filter === id));
      b.addEventListener('click', () => { filter = filter === id ? null : id; render(); }); chips.append(b);
    };
    chip(null, 'All', cards.length);
    for (const [id, label] of Object.entries(origins)) chip(id, label, cards.filter((c) => c.b.origin === id).length);
    for (const c of cards) c.card.hidden = Boolean(filter) && c.b.origin !== filter;
    ctx.sizeAll?.();
  }
  return { show() { render(); } };
}

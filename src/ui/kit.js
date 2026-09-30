// The UI kit: the few building blocks every window, menu and screen is made of, so they all look and behave alike.
// It only makes DOM nodes (through the document it is given, so tests can pass a fake one); the look is style.css:
//
//   .win        a window: a dark panel with a chunky outline, an optional title tab and a coloured accent
//   .btn        a button; variants --primary (orange), --danger (red), --ghost (outline only); sizes --sm, --lg
//   .chip       a small stat pill, e.g. "MOV 6"
//   .stars      defense stars, .meter  a fill bar (hit points)
//
// Colours and sizes are CSS variables on :root (style.css), never literals in these functions.

export function h(doc, tag, cls, text) {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** Turn a class on or off. */
export function toggle(el, cls, on) { el.classList[on ? 'add' : 'remove'](cls); }

/** Set a CSS custom property (used for the per-window accent colour). */
export function setVar(el, name, value) { el.style.setProperty(name, value); }

/**
 * A button. opts: label, variant ('primary' | 'danger' | 'ghost'), size ('sm' | 'lg'), onClick, disabled, title (tooltip).
 * Children (an icon canvas, say) can be passed in `kids` and go before the label.
 */
export function button(doc, { label, variant, size, onClick, disabled = false, kids = [], cls = '' } = {}) {
  const b = h(doc, 'button', ['btn', variant && `btn--${variant}`, size && `btn--${size}`, cls].filter(Boolean).join(' '));
  b.setAttribute('type', 'button');
  if (kids.length) b.append(...kids);
  if (label != null) b.append(h(doc, 'span', 'btn-label', label));
  b.disabled = disabled;
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

/**
 * A window: { root, head, title, body }. `accent` colours the title tab and the edge (a faction colour, say); `tag` is an
 * optional small label at the right of the title. Without a `title` the window is a headerless card: just the body, with the
 * accent as a stripe down its left edge (the info boxes and the order buttons).
 */
export function windowBox(doc, { title, tag, accent, cls = '' } = {}) {
  const card = !title;
  const root = h(doc, 'section', `win ${card ? 'win--card ' : ''}${cls}`.trim());
  const body = h(doc, 'div', 'win-body');
  let head = null, titleEl = null;
  if (!card) {
    head = h(doc, 'header', 'win-head');
    titleEl = h(doc, 'span', 'win-title', title);
    head.append(titleEl);
    if (tag) head.append(h(doc, 'span', 'win-tag', tag));
    root.append(head);
  }
  root.append(body);
  if (accent) setVar(root, '--accent', accent);
  return { root, head, title: titleEl, body };
}

/** A label/value pill: chip(doc, 'MOV', 6). */
export function chip(doc, label, value, cls = '') {
  const c = h(doc, 'span', `chip ${cls}`.trim());
  c.append(h(doc, 'span', 'chip-k', label));
  if (value != null) c.append(h(doc, 'span', 'chip-v', String(value)));
  return c;
}

/** A row of defense stars: `n` lit out of `max` (at least n; a half star is not a thing here, so n is rounded up). */
export function stars(doc, n, max = 4) {
  const box = h(doc, 'span', 'stars');
  box.setAttribute('aria-label', `${n} of ${Math.max(max, Math.ceil(n))} stars`);
  const total = Math.max(max, Math.ceil(n));
  for (let i = 0; i < total; i++) box.append(h(doc, 'i', i < Math.ceil(n) ? 'star on' : 'star'));
  return box;
}

/** A fill bar; `frac` 0..1. Returns { root, fill } so the caller can update it. */
export function meter(doc, frac, cls = '') {
  const root = h(doc, 'span', `meter ${cls}`.trim());
  const fill = h(doc, 'span', 'meter-fill');
  root.append(fill);
  setMeter({ root, fill }, frac);
  return { root, fill };
}
export function setMeter(m, frac) {
  const f = Math.max(0, Math.min(1, frac));
  m.fill.style.width = `${Math.round(f * 100)}%`;
  toggle(m.root, 'is-low', f <= .3);
  toggle(m.root, 'is-mid', f > .3 && f <= .6);
}

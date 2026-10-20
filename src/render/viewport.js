// The real size of the area the game fills.
//
// `innerWidth` / `innerHeight` are not reliable for that: in an app opened from the iPhone home screen (standalone, with the
// translucent status bar) `innerHeight` can leave out the home-indicator strip at the bottom, while the page itself (position:fixed;
// inset:0) still fills the whole screen, so a canvas sized from `innerHeight` stops short and shows the background below it.
// An invisible fixed element covering the window is sized by the same CSS as the game's layers (including --fill-h in style.css,
// which is the full screen height in an installed app), so its box is what the game should fill.
// Without a DOM (tests, headless use) it falls back to `innerWidth` / `innerHeight`.

const probes = new WeakMap();

function probeOf(doc) {
  let p = probes.get(doc);
  if (p && p.isConnected !== false) return p;
  if (!doc.body?.appendChild || !doc.createElement) return null;
  p = doc.createElement('div');
  p.setAttribute?.('aria-hidden', 'true');
  p.style.cssText = 'position:fixed;inset:0;height:var(--fill-h,100%);visibility:hidden;pointer-events:none;z-index:-1';
  doc.body.appendChild(p);
  probes.set(doc, p);
  return p;
}

/** @returns {{w:number, h:number}} the window's size in CSS pixels */
export function viewportSize(win = globalThis) {
  const r = win.document ? probeOf(win.document)?.getBoundingClientRect?.() : null;
  if (r && r.width > 0 && r.height > 0) return { w: r.width, h: r.height };
  return { w: win.innerWidth || 0, h: win.innerHeight || 0 };
}

/**
 * Calls `onChange` whenever the area may have changed size: the window resizing, a rotation, the app coming back from the
 * background (iOS sometimes reports a stale size until then) and the probe itself changing size.
 * @returns {() => void} stops watching
 */
export function watchViewport(onChange, win = globalThis) {
  const events = ['resize', 'orientationchange', 'pageshow'];
  for (const e of events) win.addEventListener?.(e, onChange);
  const probe = win.document ? probeOf(win.document) : null;
  const observer = probe && win.ResizeObserver ? new win.ResizeObserver(() => onChange()) : null;
  observer?.observe(probe);
  return () => { for (const e of events) win.removeEventListener?.(e, onChange); observer?.disconnect(); };
}

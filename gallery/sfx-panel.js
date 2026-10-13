// The sound review for the standalone gallery pages (terrain.html, portraits.html): a collapsible panel with the clips that fit the page, the same
// Approve / Reject rows as the main gallery, and the Export bar. Decisions are shared with every other page through localStorage.
import { loadKit, clipsFor } from './sfx-review.js';

/** Which clips each standalone page reviews: [[kind, keys]]; kind is 'events' or 'ui' (see clipsFor). */
export const PAGE_CLIPS = {
  terrain: { title: 'Sounds on the map', events: ['capture', 'capture-completed', 'rebuild', 'build', 'income', 'turnStart-repaired', 'turnStart-refuelled'] },
  portraits: { title: 'Sounds around dialogue', events: ['turn-yours', 'turn-enemy', 'gameOver-win', 'gameOver-lose', 'eliminated'], ui: ['tap', 'confirm', 'cancel', 'menu-open', 'menu-close'] },
};

/** Build the panel for `page` ('terrain' | 'portraits') and append it to `host`; resolves to the kit, so the page can add review rows of its own. */
export async function mountSfxPanel(host, page) {
  const spec = PAGE_CLIPS[page];
  if (!spec || !host) return null;
  const kit = await loadKit();
  const data = { map: kit.map };
  const pairs = [...clipsFor.events(data.map, spec.events || []), ...clipsFor.ui(data.map, spec.ui || [])];
  const wrap = document.createElement('section'); wrap.className = 'sfx-panel';
  const block = kit.group(pairs, spec.title);
  if (block) { block.open = false; wrap.append(block); }
  wrap.append(kit.bar());
  host.append(wrap);
  return kit;
}

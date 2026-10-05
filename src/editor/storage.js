// Maps made in the editor, kept in the browser (localStorage). Nothing here is shared between devices: to put a map in the game for everyone,
// download its file and add it to data/maps/ (docs/map-format.md).
//
//   savedMaps(store)            { <id>: raw map file object } of every map saved with "Save to My maps"
//   saveMap(raw, store)         keep (or replace) a map under its id
//   deleteMap(id, store)
//   loadDraft(store) / saveDraft(raw, store)   the map being edited, kept after every change so leaving the editor loses nothing
//   customMaps(registry, store) the saved maps that are playable, parsed, ready for the skirmish page (ids prefixed `my-` so they never clash
//                               with the game's own maps)
//
// Every function takes the Storage to use (default: window.localStorage) and never throws: a browser that refuses storage (a private window)
// just has no saved maps.

import { parseMap } from '../data/map-format.js';

const MAPS = 'pocketwars.editor.maps';
const DRAFT = 'pocketwars.editor.draft';

const defaultStore = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
const read = (store, key, fallback) => { try { const v = store?.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const write = (store, key, value) => { try { store?.setItem(key, JSON.stringify(value)); return !!store; } catch { return false; } };

export const savedMaps = (store = defaultStore()) => { const m = read(store, MAPS, {}); return m && typeof m === 'object' ? m : {}; };
export function saveMap(raw, store = defaultStore()) { const all = savedMaps(store); all[raw.id] = raw; return write(store, MAPS, all); }
export function deleteMap(id, store = defaultStore()) { const all = savedMaps(store); delete all[id]; return write(store, MAPS, all); }
export const loadDraft = (store = defaultStore()) => read(store, DRAFT, null);
export const saveDraft = (raw, store = defaultStore()) => write(store, DRAFT, raw);

/** The saved maps that parse, as GameMaps for the skirmish page: id `my-<id>`, name marked as yours. Broken ones are skipped. */
export function customMaps(registry, store = defaultStore()) {
  const out = [];
  for (const raw of Object.values(savedMaps(store))) {
    try {
      const m = parseMap(raw, registry);
      out.push(Object.freeze({ ...m, id: `my-${m.id}`, name: `${m.name} (my map)` }));
    } catch { /* not playable yet: it stays in the editor's list */ }
  }
  return out;
}

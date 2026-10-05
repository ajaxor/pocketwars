// The map editor's model: one map being edited, as plain mutable data, with undo and redo. No DOM: the editor screen (editor-screen.js) draws
// it and turns taps into the operations below, and the tests drive it directly.
//
//   const m = EditorModel.blank(registry, { width: 20, height: 14 })   or   EditorModel.fromRaw(raw, registry)   (a *.map.json object)
//   m.begin()                           start one undoable step (a stroke, a fill, a resize...); every edit after it is undone together
//   m.paintTerrain(x, y, id, owner)     terrain (owner only matters on a property); units that cannot stand on the new terrain are removed
//   m.paintGround(x, y, id)             the ground under the terrain (grass, dirt)
//   m.placeUnit(x, y, type, owner)      -> null, or why not ('cannot-stand', 'needs-owner', 'not-neutral')
//   m.removeUnit(x, y)
//   m.fill(x, y, paint)                 flood-fills the region of equal tiles round (x, y) with `paint` ({ kind: 'terrain'|'ground', id, owner })
//   m.resize(w, h, anchor)              anchor { x: 0 | .5 | 1, y: ... }: which side stays put; new tiles are plain
//   m.setPlayer(i, patch) / addPlayer() / removePlayer(i)
//   m.undo() / m.redo()                 -> true when something changed
//   m.toRaw()                           the map file object (serializeMap of asGameMap)
//   m.problems()                        everything parseMap would reject, plus the editor's own warnings (a player without an HQ)
//   symmetryPoints(m, x, y, mode)       the tiles a symmetric edit touches: [{ x, y, copy }] (copy 0 is the tile itself)
//   ownerInCopy(owner, copy, copies, n) whose a mirrored copy of something is

import { parseMap, serializeMap, MapError } from '../data/map-format.js';

export const MAX_SIZE = 64;
export const MIN_SIZE = 4;
export const MAX_PLAYERS = 4;
const HISTORY = 120;

const grid = (w, h, v) => Array.from({ length: h }, () => Array.from({ length: w }, () => v));
const clone = (o) => JSON.parse(JSON.stringify(o));
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'my_map';

export class EditorModel {
  constructor(registry, data) {
    this.registry = registry;
    Object.assign(this, data);   // id, name, description, width, height, terrain, owners, ground, units, players, legend
    this.past = [];
    this.future = [];
    this.version = 0;            // bumped on every change (the screen redraws and autosaves on it)
  }

  /** A new map: plain grass, two players (a human and the computer) with an HQ each on opposite sides. */
  static blank(registry, { width = 20, height = 14, name = 'New map', players = 2 } = {}) {
    const factions = registry.factionIds.slice(0, players);
    const m = new EditorModel(registry, {
      id: slug(name), name, description: '', width, height, legend: {},
      terrain: grid(width, height, 'plain'), owners: grid(width, height, null), ground: grid(width, height, registry.defaultGround),
      units: [], players: factions.map((faction, i) => ({ faction, controller: i === 0 ? 'human' : 'ai', funds: 5000 })),
    });
    const y = Math.floor(height / 2);
    m.terrain[y][1] = 'hq'; m.owners[y][1] = 0;
    m.terrain[height - 1 - y][width - 2] = 'hq'; m.owners[height - 1 - y][width - 2] = 1;
    return m;
  }

  /**
   * A map file object, read leniently: whatever parseMap would complain about (a unit on the wrong terrain, a missing HQ) is kept so it can be
   * fixed here. Throws only when there is no usable grid at all.
   */
  static fromRaw(raw, registry) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.tiles) || !raw.tiles.length) throw new Error('Not a map file: it has no tiles.');
    const legend = raw.legend && typeof raw.legend === 'object' ? raw.legend : {};
    const rows = raw.tiles.map((r) => [...String(r)]);
    const width = Math.min(MAX_SIZE, Math.max(...rows.map((r) => r.length))), height = Math.min(MAX_SIZE, rows.length);
    const players = (Array.isArray(raw.players) ? raw.players : []).slice(0, MAX_PLAYERS).map((p, i) => ({
      faction: registry.factions[p?.faction] ? p.faction : registry.factionIds[i], controller: p?.controller === 'ai' ? 'ai' : 'human',
      funds: Number.isInteger(p?.funds) && p.funds >= 0 ? p.funds : 5000,
    }));
    while (players.length < 2) players.push({ faction: registry.factionIds.find((f) => !players.some((p) => p.faction === f)), controller: 'ai', funds: 5000 });
    const terrain = grid(width, height, 'plain'), owners = grid(width, height, null), ground = grid(width, height, registry.defaultGround);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const e = legend[rows[y][x]];
        if (!e || !registry.terrain[e.terrain]) continue;
        terrain[y][x] = e.terrain;
        if (registry.terrain[e.terrain].attributes.property && Number.isInteger(e.owner) && e.owner < players.length) owners[y][x] = e.owner;
      }
    }
    if (Array.isArray(raw.ground) && raw.groundLegend) {
      raw.ground.forEach((row, y) => [...String(row)].forEach((ch, x) => { const id = raw.groundLegend[ch]; if (y < height && x < width && registry.ground?.[id]) ground[y][x] = id; }));
    }
    const units = (Array.isArray(raw.units) ? raw.units : [])
      .filter((u) => u && registry.units[u.type] && Number.isInteger(u.x) && Number.isInteger(u.y) && u.x >= 0 && u.y >= 0 && u.x < width && u.y < height)
      .filter((u) => u.owner === null || (Number.isInteger(u.owner) && u.owner < players.length))
      .map((u) => ({ type: u.type, owner: u.owner, x: u.x, y: u.y, ...(Number.isInteger(u.hp) && { hp: u.hp }) }));
    const seen = new Set();
    return new EditorModel(registry, {
      id: typeof raw.id === 'string' && /^[a-z0-9_-]+$/.test(raw.id) ? raw.id : slug(raw.name), name: typeof raw.name === 'string' && raw.name ? raw.name : 'Untitled',
      description: typeof raw.description === 'string' ? raw.description : '', width, height, legend: clone(legend),
      terrain, owners, ground, players, units: units.filter((u) => { const k = `${u.x},${u.y}`; if (seen.has(k)) return false; seen.add(k); return true; }),
    });
  }

  // ---- reading ---------------------------------------------------------------------------------------------------------------------------
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.width && y < this.height; }
  unitAt(x, y) { return this.units.find((u) => u.x === x && u.y === y) ?? null; }
  terrainDef(x, y) { return this.registry.terrainDef(this.terrain[y][x]); }
  /** Can a unit of `type` stand on (x, y)? */
  canStand(type, x, y) { return this.terrainDef(x, y).moveCost[this.registry.unit(type).moveClass] != null; }

  /** The map as a GameMap-shaped object (what the renderer, createState and serializeMap read). Shares the arrays: do not keep it across edits. */
  asGameMap() {
    const { id, name, description, width, height, terrain, ground, owners, players, units, legend } = this;
    return { id, name, description, width, height, terrain, ground, owners, players, units, legend };
  }

  /** The map file object. Legend glyphs of an imported map are kept where they still fit. */
  toRaw() {
    const raw = serializeMap(this.asGameMap(), { defaultGround: this.registry.defaultGround ?? undefined });
    for (const u of raw.units) if (u.hp === undefined) delete u.hp;
    return raw;
  }

  /** Every reason the map cannot be played yet (empty: it can), as sentences. */
  problems() {
    const out = [];
    try { parseMap(this.toRaw(), this.registry); } catch (e) { if (e instanceof MapError) out.push(...e.problems); else out.push(String(e.message || e)); }
    this.players.forEach((_, p) => {
      const hqs = this.terrain.flat().filter((t, k) => this.registry.terrain[t].attributes.victoryOnCapture && this.owners[Math.floor(k / this.width)][k % this.width] === p).length;
      if (!hqs) out.push(`Player ${p + 1} has no HQ`);
    });
    return out;
  }

  // ---- history ---------------------------------------------------------------------------------------------------------------------------
  #snapshot() {
    const { id, name, description, width, height, terrain, owners, ground, units, players, legend } = this;
    return JSON.stringify({ id, name, description, width, height, terrain, owners, ground, units, players, legend });
  }
  #restore(json) { Object.assign(this, JSON.parse(json)); this.#changed(); }
  #changed() { this.version++; }

  /** Start an undoable step: everything changed until the next begin() is undone as one. */
  begin() {
    const snap = this.#snapshot();
    if (this.past[this.past.length - 1] === snap) return;
    this.past.push(snap);
    if (this.past.length > HISTORY) this.past.shift();
    this.future = [];
  }
  /** Drop the step begun last if nothing changed in it (a tap that painted the same terrain). */
  settle() { if (this.past[this.past.length - 1] === this.#snapshot()) this.past.pop(); }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  undo() { if (!this.past.length) return false; this.future.push(this.#snapshot()); this.#restore(this.past.pop()); return true; }
  redo() { if (!this.future.length) return false; this.past.push(this.#snapshot()); this.#restore(this.future.pop()); return true; }

  // ---- edits -----------------------------------------------------------------------------------------------------------------------------
  /**
   * Paint terrain. A property keeps `owner` (null: neutral); anything else has none. Units that cannot stand on it go, and so does a unit on a
   * breakable wall (the cracked wall the game puts there needs the tile). Returns the units removed.
   */
  paintTerrain(x, y, id, owner = null) {
    if (!this.inBounds(x, y)) return [];
    const def = this.registry.terrainDef(id);
    const o = def.attributes.property && owner !== null && owner < this.players.length ? owner : null;
    if (this.terrain[y][x] === id && this.owners[y][x] === o) return [];
    this.terrain[y][x] = id;
    this.owners[y][x] = o;
    const u = this.unitAt(x, y);
    const gone = u && (!this.canStand(u.type, x, y) || def.attributes.wall?.structure) ? [u] : [];
    if (gone.length) this.units = this.units.filter((v) => v !== u);
    this.#changed();
    return gone;
  }

  paintGround(x, y, id) {
    if (!this.inBounds(x, y) || this.ground[y][x] === id) return;
    this.ground[y][x] = id;
    this.#changed();
  }

  /** Put a unit down (replacing whatever unit is there). null, or why not: 'cannot-stand', 'needs-owner' (only structures can be neutral), 'no-such-player'. */
  placeUnit(x, y, type, owner) {
    if (!this.inBounds(x, y)) return 'out-of-bounds';
    const def = this.registry.unit(type);
    if (!this.canStand(type, x, y)) return 'cannot-stand';
    if (owner === null && !def.attributes.structure) return 'needs-owner';
    if (owner !== null && !(owner >= 0 && owner < this.players.length)) return 'no-such-player';
    const here = this.unitAt(x, y);
    if (here && here.type === type && here.owner === owner) return null;
    this.units = this.units.filter((u) => u !== here);
    this.units.push({ type, owner, x, y });
    this.#changed();
    return null;
  }

  removeUnit(x, y) {
    const u = this.unitAt(x, y);
    if (!u) return false;
    this.units = this.units.filter((v) => v !== u);
    this.#changed();
    return true;
  }

  /** The tiles of the region round (x, y) whose terrain and owner (or ground, for a ground fill) are the same, 4-connected. */
  region(x, y, kind = 'terrain') {
    if (!this.inBounds(x, y)) return [];
    const key = (a, b) => (kind === 'ground' ? this.ground[b][a] : `${this.terrain[b][a]}|${this.owners[b][a]}`);
    const want = key(x, y), seen = new Set([y * this.width + x]), out = [], stack = [[x, y]];
    while (stack.length) {
      const [a, b] = stack.pop();
      out.push([a, b]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = a + dx, ny = b + dy, k = ny * this.width + nx;
        if (!this.inBounds(nx, ny) || seen.has(k) || key(nx, ny) !== want) continue;
        seen.add(k); stack.push([nx, ny]);
      }
    }
    return out;
  }

  /** Flood fill from (x, y) with `paint` = { kind: 'terrain' | 'ground', id, owner? }. Returns the units removed. */
  fill(x, y, paint) {
    const gone = [];
    for (const [a, b] of this.region(x, y, paint.kind)) {
      if (paint.kind === 'ground') this.paintGround(a, b, paint.id);
      else gone.push(...this.paintTerrain(a, b, paint.id, paint.owner ?? null));
    }
    return gone;
  }

  /** New size; `anchor` says which edge stays put on each axis (0 left/top, .5 centre, 1 right/bottom). New tiles are plain. */
  resize(width, height, anchor = { x: 0, y: 0 }) {
    width = Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.round(width)));
    height = Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.round(height)));
    if (width === this.width && height === this.height) return;
    const dx = Math.round((width - this.width) * anchor.x), dy = Math.round((height - this.height) * anchor.y);
    const move = (src, fill) => Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => {
      const sx = x - dx, sy = y - dy;
      return sx >= 0 && sy >= 0 && sx < this.width && sy < this.height ? src[sy][sx] : fill;
    }));
    this.terrain = move(this.terrain, 'plain');
    this.owners = move(this.owners, null);
    this.ground = move(this.ground, this.registry.defaultGround);
    this.units = this.units.map((u) => ({ ...u, x: u.x + dx, y: u.y + dy })).filter((u) => u.x >= 0 && u.y >= 0 && u.x < width && u.y < height);
    this.width = width;
    this.height = height;
    this.#changed();
  }

  /** Change a player's faction, controller or funds. Giving a player a faction someone else has swaps them. */
  setPlayer(i, patch) {
    const p = this.players[i];
    if (!p) return;
    if (patch.faction && patch.faction !== p.faction) {
      const other = this.players.find((q) => q !== p && q.faction === patch.faction);
      if (other) other.faction = p.faction;
    }
    Object.assign(p, patch);
    this.#changed();
  }

  addPlayer() {
    if (this.players.length >= MAX_PLAYERS) return false;
    const faction = this.registry.factionIds.find((f) => !this.players.some((p) => p.faction === f));
    this.players.push({ faction, controller: 'ai', funds: this.players[0]?.funds ?? 5000 });
    this.#changed();
    return true;
  }

  /** Remove player i (two must stay): their units go, their properties turn neutral, later players move down one. */
  removePlayer(i) {
    if (this.players.length <= 2 || !this.players[i]) return false;
    const shift = (o) => (o === null ? null : o === i ? null : o > i ? o - 1 : o);
    this.players.splice(i, 1);
    this.units = this.units.filter((u) => u.owner !== i).map((u) => ({ ...u, owner: shift(u.owner) }));
    this.owners = this.owners.map((row) => row.map(shift));
    this.#changed();
    return true;
  }

  setInfo({ name, id, description }) {
    if (name !== undefined) this.name = String(name).slice(0, 60);
    if (id !== undefined) this.id = slug(id);
    if (description !== undefined) this.description = String(description).slice(0, 400);
    this.#changed();
  }
}

/** The symmetry modes the editor offers: how many copies each makes. */
export const SYMMETRY = {
  none: { label: 'Off', copies: 1 },
  mirror_x: { label: 'Left | right', copies: 2 },
  mirror_y: { label: 'Top / bottom', copies: 2 },
  rotate: { label: 'Rotate 180', copies: 2 },
  quad: { label: 'Four ways', copies: 4 },
};

/** The tiles a symmetric edit at (x, y) touches, each once: [{ x, y, copy }]; copy 0 is (x, y) itself. */
export function symmetryPoints(m, x, y, mode = 'none') {
  const W = m.width - 1, H = m.height - 1;
  const all = {
    none: [[x, y]],
    mirror_x: [[x, y], [W - x, y]],
    mirror_y: [[x, y], [x, H - y]],
    rotate: [[x, y], [W - x, H - y]],
    quad: [[x, y], [W - x, y], [x, H - y], [W - x, H - y]],
  }[mode] ?? [[x, y]];
  const seen = new Set(), out = [];
  all.forEach(([a, b], copy) => { const k = `${a},${b}`; if (!seen.has(k)) { seen.add(k); out.push({ x: a, y: b, copy }); } });
  return out;
}

/** Who owns the mirrored copy `copy` (of `copies`) of something owned by `owner` on a map with `n` players: the other side's player. Neutral stays neutral. */
export function ownerInCopy(owner, copy, copies, n) {
  if (owner === null || owner === undefined || copy === 0) return owner ?? null;
  const step = Math.max(1, Math.floor(n / copies));
  return (owner + copy * step) % n;
}

/** Problems that are only the editor's business: none of them stops saving, but a map with any cannot be played. */
export const isPlayable = (m) => m.problems().length === 0;

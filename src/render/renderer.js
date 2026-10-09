// Draws the board. The renderer only READS the game and a `view` object describing the current selection
// (owned by the input controller); it never changes game state.
//
// view = {
//   selectedId: number|null       unit currently selected
//   dest: {x,y}|null              tentative destination of the selected unit (move preview)
//   reach: ReachMap|null          tiles to highlight as reachable
//   attackTiles: Set<number>|null tile indexes outlined as the attack range
//   targets: Unit[]               enemies that can be attacked right now (mode 'act')
//   showTargets: boolean
//   pendingTargetId: number|null  enemy awaiting attack confirmation
//   cursor: {x,y}|null            tile the player last tapped (outlined while nothing is selected)
//   sonar: Set<number>|null       tiles covered by the selected unit's sonar (drawn as a small sonar mark on each empty deep-water tile)
//   layTiles: {x,y}[]|null        tiles a mine layer may drop its mine on (a pulsing outline)
// }
//
// The canvas covers the whole window. A Camera (camera.js) decides which part of the map is on screen: a small map is centred
// whole, a big one scrolls. Everything below draws in map pixels, so the frame starts by clearing the window and moving the
// origin to the map's top-left corner (which may be off-screen), and only the tiles that are on screen are painted.

import { ammoLevel } from '../engine/ammo.js';
import { fuelLevel } from '../engine/fuel.js';
import { canAttackFrom } from '../engine/combat.js';
import { Camera } from './camera.js';
import { canSee, isExposed, isHidden } from '../engine/detection.js';
import { isMine } from '../engine/mines.js';
import { facingAlong, skinAt, terrainAt, terrainIdAt, tileIndex, unitById } from '../engine/queries.js';
import { drawTerrainLayer, faceRect } from './terrain-layer.js';
import { drawWalls } from './walls.js';
import { isFogged, rememberedStructures, tileExplored, tileVisible } from '../engine/fog.js';
import { attributeConfig } from '../engine/attributes.js';
import { font } from './font.js';
import { BUBBLE_COUNTER, BUBBLE_HIT, drawBubble } from './bubble.js';
import { drawUnit } from './unit-sprites.js';

/**
 * A tile-sized box (x0, y0)-(x1, y1) added to `path`, clockwise from the top-left, with each corner (top-left, top-right, bottom-right,
 * bottom-left) either square (null), rounded ({ r }) or notched ({ m }: an m x m square cut out of it).
 */
function tilePath(path, x0, y0, x1, y1, [tl, tr, br, bl]) {
  path.moveTo(x0, y0 + (tl?.r ?? tl?.m ?? 0));
  if (tl?.r) path.arcTo(x0, y0, x0 + tl.r, y0, tl.r); else if (tl?.m) { path.lineTo(x0 + tl.m, y0 + tl.m); path.lineTo(x0 + tl.m, y0); } else path.lineTo(x0, y0);
  if (tr?.r) { path.lineTo(x1 - tr.r, y0); path.arcTo(x1, y0, x1, y0 + tr.r, tr.r); } else if (tr?.m) { path.lineTo(x1 - tr.m, y0); path.lineTo(x1 - tr.m, y0 + tr.m); path.lineTo(x1, y0 + tr.m); } else path.lineTo(x1, y0);
  if (br?.r) { path.lineTo(x1, y1 - br.r); path.arcTo(x1, y1, x1 - br.r, y1, br.r); } else if (br?.m) { path.lineTo(x1, y1 - br.m); path.lineTo(x1 - br.m, y1 - br.m); path.lineTo(x1 - br.m, y1); } else path.lineTo(x1, y1);
  if (bl?.r) { path.lineTo(x0 + bl.r, y1); path.arcTo(x0, y1, x0, y1 - bl.r, bl.r); } else if (bl?.m) { path.lineTo(x0 + bl.m, y1); path.lineTo(x0 + bl.m, y1 - bl.m); path.lineTo(x0, y1 - bl.m); } else path.lineTo(x0, y1);
  path.closePath();
}

/** Fog of war look (drawFog): how long a change of sight takes to fade (ms), and the grey rim between black and ground in plain sight (tiles). */
const FOG_FADE = 380;
const FOG_RIM = .2;

export class Renderer {
  constructor(canvas, game, effects, animator) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.game = game;
    this.effects = effects;
    this.animator = animator;
    this.arrivals = null;   // an Arrivals (arrivals.js): units still sliding in from off screen are drawn on their way there
    this.camera = new Camera(game.map.width, game.map.height);
    this.dpr = 1;
    // The player whose eyes the board is drawn with: units hidden from them (a submerged enemy nobody has spotted) are not drawn
    // and not outlined. null shows everything (tests, the sprite gallery). The session sets it each frame.
    this.viewer = null;
    // Per unit: how far dived (0..1, eased so a dive is seen) and how visible it is (0..1, eased so a unit that turns hidden fades away).
    this.motion = new Map();
    this.motionViewer = null;
    this.motionAt = null;
    // until fit() learns the real window, the map is laid out whole at 40 px a tile (headless use and tests)
    this.camera.setViewport(game.map.width * 40, game.map.height * 40, 0);
  }

  get S() { return this.camera.S; }
  get tileSize() { return this.camera.S; }

  /** The window size, the map's window-pixel origin and the device pixel ratio. */
  get layout() {
    const { ox, oy } = this.camera.origin();
    return { W: this.camera.W, H: this.camera.H, ox, oy, d: this.dpr };
  }

  /** [x, y, w, h, radius] of tile (x, y), for outlines and highlights that follow the rounded tiles. */
  face(x, y, margin = 0) { return faceRect(x, y, this.S, margin); }

  colorsOf(owner) {
    const { registry, map } = this.game;
    return owner === null ? { color: registry.rules.neutralColor, dark: registry.rules.neutralColor } : registry.faction(map.players[owner].faction);
  }

  /** The colours a unit is drawn in: its owner's, or the dark grey of a neutral structure (rules.neutralUnitColors). */
  unitColorsOf(owner) {
    return owner == null ? this.game.registry.rules.neutralUnitColors ?? { color: '#3e4045', dark: '#1b1c1f' } : this.colorsOf(owner);
  }

  /**
   * What the wall layer draws on (x, y): null, 'wall', 'cracked' (a breakable section whose structure still stands) or 'broken' (its rubble).
   * Terrain with the `wall` attribute is a wall; one that names a structure is cracked while a unit of that type stands on it.
   */
  wallAt(x, y) {
    const { game } = this;
    const cfg = attributeConfig(game.registry.terrainDef(terrainIdAt(game, x, y)), 'wall');
    if (!cfg) return null;
    if (cfg === true) return 'wall';
    if (this.viewer !== null && isFogged(game, this.viewer) && !tileVisible(game, this.viewer, x, y)) {   // out of sight: as last seen
      return rememberedStructures(game, this.viewer).some((m) => m.x === x && m.y === y && m.type === cfg.structure) ? 'cracked' : 'broken';
    }
    return game.state.units.some((u) => u.x === x && u.y === y && u.type === cfg.structure) ? 'cracked' : 'broken';
  }

  /**
   * Enemy structures out of the viewer's sight, drawn as the viewer last saw them (fog.js rememberedStructures): still (no animation), with
   * the HP they had, whether or not they are still there.
   */
  drawRemembered() {
    const { g, S, game, viewer } = this;
    if (viewer === null || !isFogged(game, viewer)) return;
    for (const m of rememberedStructures(game, viewer)) {
      const def = game.registry.unit(m.type);
      if (def.render.inWall) continue;   // a cracked wall is part of the wall layer (wallAt)
      drawUnit(g, { type: m.type, x: m.x, y: m.y, hp: m.hp }, {
        def, colors: this.unitColorsOf(m.owner), px: m.x * S, py: m.y * S, size: S, now: 0, animate: true, moving: false, alpha: 1, showHp: true, face: 1,
      });
    }
  }

  /**
   * Make the canvas cover the window and tell the camera how much of it the map may use: everything below `top` px (the status
   * bar). A map that fits at a comfortable tile size is shown whole and centred; a bigger one scrolls (see camera.js).
   */
  fit({ top = 0 } = {}) {
    const W = innerWidth, H = innerHeight;
    const d = globalThis.devicePixelRatio || 1;
    this.dpr = d;
    this.camera.setViewport(W, H, top);
    this.cv.width = Math.round(W * d);
    this.cv.height = Math.round(H * d);
    this.cv.style.width = W + 'px';
    this.cv.style.height = H + 'px';
  }

  /** Drag the map by (dx, dy) window pixels. */
  pan(dx, dy) { this.camera.panBy(dx, dy); }
  /** Zoom by `factor` around a window point (pinch, wheel). */
  zoom(factor, x, y) { this.camera.zoomBy(factor, x, y); }
  /** Put a tile in the middle of the window now. */
  centerOn(x, y) { this.camera.centerOn(x, y); }
  /** Bring tiles ([[x, y], ...]) on screen by easing the camera, if they are not already. */
  reveal(points) { this.camera.reveal(points); }
  /** Advance the camera's easing; call once a frame with the frame time in ms. */
  updateCamera(ms) { this.camera.step(ms); }

  /** The tiles the window shows, as {left, top, right, bottom} in (fractional) tile coordinates; outside the map the numbers go off the map. */
  viewBounds() {
    const { W, H, ox, oy } = this.layout, S = this.S;
    return { left: -ox / S, top: -oy / S, right: (W - ox) / S, bottom: (H - oy) / S };
  }

  /** Tile (x, y)'s rectangle in window pixels: where the windows look to decide which edge to sit on. */
  tileRect(x, y) {
    const { ox, oy } = this.layout;
    return { left: ox + x * this.S, top: oy + y * this.S, size: this.S };
  }

  /** The map tile a window point falls in (outside the map the numbers are out of range). */
  tileAt(clientX, clientY) {
    const r = this.cv.getBoundingClientRect();
    const { ox, oy } = this.layout;
    return { x: Math.floor((clientX - r.left - ox) / this.S), y: Math.floor((clientY - r.top - oy) / this.S) };
  }

  /**
   * Ease each unit's dive depth and visibility toward where the game says they are. A dived unit the viewer can no longer see first
   * finishes sinking and then fades out; a unit that becomes visible fades in. The first frame a unit is seen it simply starts there.
   * Returns the (dive, alpha) of `u` for this frame.
   */
  motionOf(u, now) {
    if (this.motionViewer !== this.viewer) { this.motion.clear(); this.motionViewer = this.viewer; }
    const dt = this.motionAt === null ? 0 : Math.max(0, Math.min(100, now - this.motionAt)) / 1000;
    const goalDive = u.submerged ? 1 : 0, goalAlpha = this.isShown(u) ? 1 : 0;
    let m = this.motion.get(u.id);
    if (!m) { m = { dive: goalDive, alpha: goalAlpha, at: now }; this.motion.set(u.id, m); return m; }
    if (m.at === now) return m;      // already eased this frame
    m.at = now;
    m.dive += Math.sign(goalDive - m.dive) * Math.min(Math.abs(goalDive - m.dive), dt / .7);
    if (goalAlpha === 1) m.alpha = Math.min(1, m.alpha + dt / .35);
    else if (m.dive >= 1 || !u.submerged) m.alpha = Math.max(0, m.alpha - dt / .6);   // let a dive play out before fading
    return m;
  }

  /** Is `u` drawn for the current viewer? */
  isShown(u) { return this.viewer === null || canSee(this.game, this.viewer, u); }

  logicalPos(u, view) {
    return view.dest && u.id === view.selectedId ? view.dest : u;
  }

  /** Which way a unit is drawn facing: along the preview path while its move is only previewed, along its slide while it moves, else as the game has it. */
  facingOf(u, view, now) {
    const current = u.facing ?? 1;
    if (this.arrivals?.has(u.id)) return this.arrivals.facingOf(u.id, now) ?? current;
    if (this.animator.current && this.animator.current.unitId === u.id) return this.animator.facingOf(u.id, now) ?? current;   // mid-slide: turns step by step
    if (view.dest && u.id === view.selectedId && view.reach && view.reach.pathTo) return facingAlong(view.reach.pathTo(view.dest.x, view.dest.y) || [], current);   // previewed, the slide done
    return current;
  }

  drawUnitAt(g, u, view, now, { dying = false, alpha = 1, dive = u.submerged ? 1 : 0 } = {}) {
    const { S, game, animator, effects } = this;
    if (game.registry.unit(u.type).render.inWall) return;   // a cracked wall is part of the wall layer (wallAt), not a sprite
    const lp = dying ? u : this.logicalPos(u, view);
    const arriving = !dying && !!this.arrivals?.has(u.id);
    const moving = arriving || (animator.current !== null && animator.current.unitId === u.id);
    const base = (arriving && this.arrivals.positionOf(u.id, now, S)) || animator.positionOf(u.id, now, S) || [lp.x * S, lp.y * S];
    const [dx, dy] = effects.unitOffset(u.id, now, S);
    const acted = u.done && u.owner === game.state.turn && !isMine(game, u);   // a mine is always `done`, but it is not spent
    const cx = Math.floor((base[0] + S / 2) / S), cy = Math.floor((base[1] + S / 2) / S);   // the tile under the unit's centre, even mid-slide
    const onWater = !dying && !!game.registry.terrainDef(terrainIdAt(game, Math.min(game.map.width - 1, Math.max(0, cx)), Math.min(game.map.height - 1, Math.max(0, cy))))?.render.water;
    if (arriving) { g.save(); g.beginPath(); g.rect(0, 0, game.map.width * S, game.map.height * S); g.clip(); }   // a unit driving in from off the map is cut off at the map's edge
    drawUnit(g, { type: u.type, x: lp.x, y: lp.y, hp: dying ? u.hp : effects.displayHp(u, now) }, {
      face: game.registry.unit(u.type).render.facing === false ? 1 : this.facingOf(u, view, now), submerged: dive, hidden: !dying && isHidden(game, u), exposed: !dying && isHidden(game, u) && isExposed(game, u, this.viewer),
      def: game.registry.unit(u.type), colors: this.unitColorsOf(u.owner), px: base[0] + dx, py: base[1] + dy,
      size: S, now, animate: dying || !acted || moving, moving, alpha, showHp: true, onWater: onWater || (dying && !!game.registry.terrainDef(terrainIdAt(game, u.x, u.y)).render.water),
      ammo: dying ? null : ammoLevel(game, u),
      fuel: dying ? null : fuelLevel(game, u),   // drawUnit only draws it for 'low' and 'empty'
    });
    if (arriving) g.restore();
  }

  /**
   * Tiles whose building is drawn faintly: a property whose owner has a unit standing on it (neutral and enemy properties
   * keep their full colour). A unit that is still sliding does not count until it arrives; a previewed move counts at once.
   */
  dimmedTiles(view) {
    const { game, animator } = this;
    const { map, state } = game;
    const out = new Set();
    for (const u of state.units) {
      if (animator.current !== null && animator.current.unitId === u.id) continue;
      if (this.arrivals?.has(u.id)) continue;
      const { x, y } = this.logicalPos(u, view);
      if (u.owner !== null && state.owners[y][x] === u.owner && game.registry.terrainDef(terrainIdAt(game, x, y)).attributes.property) out.add(tileIndex(map, x, y));
    }
    return out;
  }

  /**
   * Fog of war for the viewer (fog.js), over the terrain and the units: tiles never seen are black, tiles seen before but out of sight now are
   * greyed out (their colour drained, then darkened). Nothing is drawn when the viewer is not in fog. `seen` is the camera's tile range.
   *
   * Each kind of fog is one solid shape with rounded corners, like the merged terrain tiles: an outer corner of the fog is rounded, an inner
   * corner (where sight pokes into the fog) gets a fillet, and the map's own border stays square. Where black meets ground in plain sight, the
   * black stops FOG_RIM short, so a thin band of grey fog always lies between them.
   *
   * Changes are animated: when sight changes, tiles that come into sight fade out of the fog and tiles that leave it fade in, over FOG_FADE ms
   * (fogFrame keeps the sets before and after the change).
   */
  drawFog(seen, now = 0) {
    const { g, game, viewer } = this;
    if (viewer === null || !isFogged(game, viewer)) { this.fogAnim = null; return; }
    const f = this.fogFrame(now);
    if (f.from !== f.to && now - f.t0 >= FOG_FADE) f.from = f.to;   // the fade is over: from now on it is just the new fog
    const t = f.from === f.to ? 1 : Math.min(1, (now - f.t0) / FOG_FADE);
    const ease = t * t * (3 - 2 * t);
    // the steady fog (no fade running) is the same picture every frame until the sight, the camera range or the tile size changes
    const steady = f.from === f.to;
    const key = `${seen.x0},${seen.y0},${seen.x1},${seen.y1},${this.S}`;
    if (!this.fogPaths || this.fogPaths.frame !== f || this.fogPaths.key !== key) this.fogPaths = { frame: f, key, byLayer: new Map() };
    const draw = (sets, paint, layer) => {
      const { from, to } = sets;
      const both = (k) => from[k] && to[k], into = (k) => !from[k] && to[k], out = (k) => from[k] && !to[k];
      const any = (k) => from[k] || to[k];
      let main = steady ? this.fogPaths.byLayer.get(layer) : null;
      if (!main) { main = this.fogShape(seen, both, any, sets.rim); if (steady) this.fogPaths.byLayer.set(layer, main); }
      paint(main, 1);
      if (ease < 1) {
        paint(this.fogShape(seen, into, any, sets.rim, both), ease);
        paint(this.fogShape(seen, out, any, sets.rim, both), 1 - ease);
      }
    };
    g.save();
    draw({ from: f.from.grey, to: f.to.grey }, (path, a) => {
      g.globalAlpha = a;
      g.globalCompositeOperation = 'saturation'; g.fillStyle = '#808080'; g.fill(path);   // a grey source drains the colour out of what is under it
      g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(14,18,28,.45)'; g.fill(path);
    }, 'grey');
    // the black stops short of ground in plain sight (in sight before and after: grey in neither)
    const open = (k) => !f.from.grey[k] && !f.to.grey[k];
    draw({ from: f.from.black, to: f.to.black, rim: open }, (path, a) => { g.globalAlpha = a; g.fillStyle = '#07090d'; g.fill(path); }, 'black');
    g.restore();
  }

  /**
   * The fog sets to draw this frame: { from, to, t0 }, each set { grey, black } (one 0/1 per tile: out of sight / never seen). They are
   * recomputed when the game changes; when they differ from the last ones, a fade from those to the new ones starts at `now`.
   */
  fogFrame(now) {
    const { game, viewer } = this;
    const a = this.fogAnim;
    if (a && a.revision === game.revision && a.viewer === viewer && a.mapW === game.map.width) return a;
    const { width: W, height: H } = game.map;
    const grey = new Uint8Array(W * H), black = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = y * W + x; grey[k] = tileVisible(game, viewer, x, y) ? 0 : 1; black[k] = tileExplored(game, viewer, x, y) ? 0 : 1; }
    const to = { grey, black };
    const same = a && a.viewer === viewer && a.mapW === W && a.to.grey.every((v, k) => v === grey[k]) && a.to.black.every((v, k) => v === black[k]);
    // a change during a fade starts the next one from where the old one was heading
    this.fogAnim = same ? { ...a, revision: game.revision } : { revision: game.revision, viewer, mapW: W, from: a && a.viewer === viewer && a.mapW === W ? a.to : to, to, t0: now };
    return this.fogAnim;
  }

  /**
   * One fog shape, as a Path2D: the tiles in `seen` (and a tile round it) for which `member(k)` holds. Corners are rounded and filleted by
   * `context(k)` (the whole fog the shape belongs to), so pieces of one fog drawn separately still join square. `rim(k)`, when given, marks
   * tiles the shape stops FOG_RIM short of. A fillet goes to this shape unless both its tiles pass `elsewhere(k)` (another piece draws it).
   */
  fogShape(seen, member, context, rim = null, elsewhere = null) {
    const { S, game } = this;
    const { width: W, height: H } = game.map;
    const r = this.face(0, 0)[4], m = rim ? S * FOG_RIM : 0;
    const k = (x, y) => y * W + x;
    const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    const ctx = (x, y) => (inMap(x, y) ? !!context(k(x, y)) : true);              // off the map counts as fog: the border stays square
    const gap = (x, y) => !!(rim && inMap(x, y) && rim(k(x, y)));                 // a neighbour in plain sight: leave a grey rim
    const path = new Path2D();
    const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];                          // roundRect's order: top-left, top-right, bottom-right, bottom-left
    for (let y = Math.max(0, seen.y0 - 1); y <= Math.min(H - 1, seen.y1 + 1); y++) {
      for (let x = Math.max(0, seen.x0 - 1); x <= Math.min(W - 1, seen.x1 + 1); x++) {
        if (member(k(x, y))) {
          const l = gap(x - 1, y) ? m : 0, t = gap(x, y - 1) ? m : 0, rr = gap(x + 1, y) ? m : 0, b = gap(x, y + 1) ? m : 0;
          // each corner: rounded (an outer corner of the fog), notched (ground in plain sight just across the corner: the rim goes round it), or square
          const corner = CORNERS.map(([dx, dy]) => {
            if (!ctx(x + dx, y) && !ctx(x, y + dy)) return { r };
            if (m && gap(x + dx, y + dy) && !gap(x + dx, y) && !gap(x, y + dy)) return { m };
            return null;
          });
          tilePath(path, x * S + l, y * S + t, x * S + S - rr, y * S + S - b, corner);
          continue;
        }
        if (ctx(x, y)) continue;
        // a tile outside this fog whose two neighbours at a corner are fog: fill that corner in, all but a quarter circle (an inner fillet)
        for (const [dx, dy] of CORNERS) {
          // a real inner corner only: both neighbours AND the tile across the corner are fog (two fog tiles that only touch at a corner, a
          // checkerboard step, keep their own rounded corners and get no fillet)
          if (!inMap(x + dx, y) || !inMap(x, y + dy) || !ctx(x + dx, y) || !ctx(x, y + dy) || !ctx(x + dx, y + dy)) continue;
          if (elsewhere && elsewhere(k(x + dx, y)) && elsewhere(k(x, y + dy))) continue;
          if (!elsewhere && !(member(k(x + dx, y)) || member(k(x, y + dy)))) continue;
          if (elsewhere && !(member(k(x + dx, y)) || member(k(x, y + dy)))) continue;
          const sh = gap(x, y) ? m : 0;                                             // the black's corner is pushed back by the rim
          const qx = (x + (dx > 0 ? 1 : 0)) * S + dx * sh, qy = (y + (dy > 0 ? 1 : 0)) * S + dy * sh;
          const cx = qx - dx * r, cy = qy - dy * r;
          const a0 = Math.atan2(dy, 0), a1 = Math.atan2(0, dx);
          let d = a1 - a0; while (d <= -Math.PI) d += 2 * Math.PI; while (d > Math.PI) d -= 2 * Math.PI;
          path.moveTo(qx, qy); path.lineTo(cx, qy); path.arc(cx, cy, r, a0, a1, d < 0); path.closePath();
        }
      }
    }
    return path;
  }

  drawArrow(now) {
    const arrow = this.animator.arrow;
    if (!arrow || arrow.length < 2) return;
    const g = this.g;
    const s = this.S;
    const n = arrow.length;
    const C = arrow.map(([x, y]) => [(x + .5) * s, (y + .5) * s]);
    const [dx, dy] = C[n - 1];
    const [qx, qy] = C[n - 2];
    const a = Math.atan2(dy - qy, dx - qx);
    const hl = s * .3;
    const tx = qx + Math.cos(a) * s * .38;
    const ty = qy + Math.sin(a) * s * .38;
    const bx = tx - Math.cos(a) * hl * .7;
    const by = ty - Math.sin(a) * hl * .7;
    const P = C.slice(0, n - 1);
    const line = (w, col, dash) => {
      g.strokeStyle = col; g.lineWidth = w; g.setLineDash(dash ? [s * .2, s * .12] : []); g.lineDashOffset = dash ? -now / 40 : 0; g.beginPath();
      P.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.lineTo(bx, by); g.stroke();
    };
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; line(s * .2, 'rgba(0,0,0,.6)'); line(s * .11, '#ffe45c', 1); g.setLineDash([]);
    g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx - Math.cos(a - .55) * hl, ty - Math.sin(a - .55) * hl); g.lineTo(tx - Math.cos(a + .55) * hl, ty - Math.sin(a + .55) * hl); g.closePath();
    g.lineWidth = s * .08; g.strokeStyle = 'rgba(0,0,0,.6)'; g.stroke(); g.fillStyle = '#ffe45c'; g.fill(); g.restore();
  }


  draw(view, now) {
    const { g, S, game } = this;
    const { map, state } = game;
    const sel = view.selectedId !== null ? unitById(game, view.selectedId) : null;
    const anim = this.animator.active;
    const { W, H, ox, oy, d } = this.layout;
    const seen = this.camera.visible(1);
    g.setTransform(d, 0, 0, d, 0, 0);
    g.clearRect(0, 0, W, H);
    g.setTransform(d, 0, 0, d, ox * d, oy * d);

    const terrainAt = (x, y) => skinAt(game, x, y);
    const dimmed = this.dimmedTiles(view);
    drawTerrainLayer(g, {
      width: map.width, height: map.height, S, now, terrainAt,
      ownerColorAt: (x, y) => (terrainAt(x, y).attributes.property ? this.colorsOf(state.owners[y][x]).color : null),
      dimmedAt: (x, y) => dimmed.has(tileIndex(map, x, y)),
      groundAt: (x, y) => game.registry.groundDef(map.ground?.[y]?.[x]),
      view: seen,
    });
    drawWalls(g, { width: map.width, height: map.height, S, wallAt: (x, y) => this.wallAt(x, y), view: seen });
    if (view.reach) {
      g.fillStyle = 'rgba(255,255,255,.38)'; g.beginPath();
      const tiles = [...view.reach.tiles()];
      const has = new Set(tiles.map(({ x, y }) => y * map.width + x));
      const at = (x, y) => x >= 0 && y >= 0 && x < map.width && y < map.height && has.has(y * map.width + x);
      const r = this.face(0, 0)[4];
      for (const { x, y } of tiles) {
        // only the outer corners of the merged shape are rounded (order: top-left, top-right, bottom-right, bottom-left)
        const round = (a, b) => (!a && !b ? r : 0);
        const n = at(x, y - 1), e = at(x + 1, y), s = at(x, y + 1), w = at(x - 1, y);
        g.roundRect(x * S, y * S, S, S, [round(n, w), round(n, e), round(s, e), round(s, w)]);
      }
      g.fill();
    }
    if (view.sonar && view.sonar.size) {   // the selected unit's sonar: a small sonar mark on every empty water tile (deep sea or shoals) it listens to
      g.save(); g.lineCap = 'round';
      const pulse = .55 + .25 * Math.sin(now / 350);
      for (const k of view.sonar) {
        const x = k % map.width, y = Math.floor(k / map.width);
        if (!terrainAt(x, y)?.render?.water || this.game.state.units.some((u) => u.x === x && u.y === y && this.isShown(u))) continue;
        const cx = x * S + S / 2, cy = y * S + S / 2, u = S * .1;
        g.strokeStyle = `rgba(150,235,255,${pulse})`; g.fillStyle = g.strokeStyle; g.lineWidth = Math.max(1.5, S * .035);
        g.beginPath(); g.arc(cx, cy + u * .6, u * .55, 0, 7); g.fill();               // the source dot, with two sound arcs above it
        g.beginPath(); g.arc(cx, cy + u * .6, u * 1.7, Math.PI * 1.2, Math.PI * 1.8); g.stroke();
        g.beginPath(); g.arc(cx, cy + u * .6, u * 2.9, Math.PI * 1.2, Math.PI * 1.8); g.stroke();
      }
      g.restore();
    }
    if (view.layTiles && view.layTiles.length) {
      g.save(); g.strokeStyle = `rgba(255,228,92,${.6 + .4 * Math.sin(now / 200)})`; g.fillStyle = 'rgba(255,228,92,.18)'; g.lineWidth = 3;
      for (const t of view.layTiles) { g.beginPath(); g.roundRect(...this.face(t.x, t.y, 2)); g.fill(); g.stroke(); }
      g.restore();
    }
    if (view.showTargets) {
      g.strokeStyle = '#ff3b3b'; g.lineWidth = 5;
      view.targets.filter((e) => this.isShown(e)).forEach((e) => { g.beginPath(); g.roundRect(...this.face(e.x, e.y, 2.5)); g.stroke(); });
    }
    this.drawRemembered();
    for (const u of state.units) {
      const m = this.motionOf(u, now);
      if (m.alpha > .01) this.drawUnitAt(g, u, view, now, { alpha: m.alpha, dive: m.dive });
    }
    this.motionAt = now;
    if (this.motion.size > state.units.length + 8) for (const id of [...this.motion.keys()]) if (!unitById(game, id)) this.motion.delete(id);
    this.drawFog(seen, now);
    this.drawArrow(now);

    const atk = view.attackTiles;
    if (atk) {
      g.save(); g.strokeStyle = '#ff3b3b'; g.lineWidth = 3; g.lineCap = 'square'; g.beginPath();
      for (const k of atk) {
        const x = k % map.width;
        const y = Math.floor(k / map.width);
        const l = x * S + 1.5;
        const t = y * S + 1.5;
        const r = l + S - 3;
        const b = t + S - 3;
        if (!atk.has(tileIndex(map, x, y - 1)) || y === 0) { g.moveTo(l, t); g.lineTo(r, t); }
        if (!atk.has(tileIndex(map, x, y + 1)) || y === map.height - 1) { g.moveTo(l, b); g.lineTo(r, b); }
        if (!atk.has(tileIndex(map, x - 1, y)) || x === 0) { g.moveTo(l, t); g.lineTo(l, b); }
        if (!atk.has(tileIndex(map, x + 1, y)) || x === map.width - 1) { g.moveTo(r, t); g.lineTo(r, b); }
      }
      g.stroke(); g.restore();
    }
    if (atk && sel) {
      g.strokeStyle = `rgba(255,70,70,${.55 + .45 * Math.sin(now / 150)})`; g.lineWidth = 3;
      state.units.forEach((e) => {
        if (e.owner !== sel.owner && this.isShown(e) && atk.has(tileIndex(map, e.x, e.y)) && canAttackFrom(game, sel, e, this.logicalPos(sel, view).x, this.logicalPos(sel, view).y)) { g.beginPath(); g.roundRect(...this.face(e.x, e.y, 2)); g.stroke(); }
      });
    }
    const pending = view.pendingTargetId !== null && sel ? unitById(game, view.pendingTargetId) : null;
    if (pending) {
      const ex = (pending.x + .5) * S;
      const ey = (pending.y + .5) * S;
      const r = S * (.4 + .04 * Math.sin(now / 110));
      g.strokeStyle = '#ff3b3b'; g.lineWidth = 3; g.beginPath(); g.arc(ex, ey, r, 0, 7); g.stroke();
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        const c = Math.cos(a);
        const n = Math.sin(a);
        g.beginPath(); g.moveTo(ex + c * (r - S * .1), ey + n * (r - S * .1)); g.lineTo(ex + c * (r + S * .12), ey + n * (r + S * .12)); g.stroke();
      }
      const f = view.forecast;
      if (f) {   // speech bubbles on the HP digits: the damage the target takes, and the counterattack the attacker takes
        drawBubble(g, pending.x * S, pending.y * S, S, f.destroyed ? 'KO' : '-' + f.damage, BUBBLE_HIT);
        if (f.counter) drawBubble(g, f.at.x * S, f.at.y * S, S, '-' + f.counter, BUBBLE_COUNTER);
      }
    }
    if (view.cursor && !sel) {
      g.strokeStyle = '#fff'; g.lineWidth = 3; g.globalAlpha = .7 + .3 * Math.sin(now / 220);
      g.beginPath(); g.roundRect(...this.face(view.cursor.x, view.cursor.y, 1)); g.stroke(); g.globalAlpha = 1;
    }
    if (sel && !anim) {
      const p = this.logicalPos(sel, view);
      g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.roundRect(...this.face(p.x, p.y, 1)); g.stroke();
    }
    this.effects.draw(g, now, S, (unit, alpha) => this.drawUnitAt(g, unit, view, now, { dying: true, alpha }));
  }
}

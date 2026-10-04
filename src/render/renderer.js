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
import { canAttackFrom } from '../engine/combat.js';
import { Camera } from './camera.js';
import { canSee, isExposed, isHidden } from '../engine/detection.js';
import { isMine } from '../engine/mines.js';
import { hasAttribute } from '../engine/attributes.js';
import { facingAlong, terrainAt, tileIndex, unitById } from '../engine/queries.js';
import { drawTerrainLayer, faceRect } from './terrain-layer.js';
import { font } from './font.js';
import { BUBBLE_COUNTER, BUBBLE_HIT, drawBubble } from './bubble.js';
import { drawUnit } from './unit-sprites.js';

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
    const lp = dying ? u : this.logicalPos(u, view);
    const arriving = !dying && !!this.arrivals?.has(u.id);
    const moving = arriving || (animator.current !== null && animator.current.unitId === u.id);
    const base = (arriving && this.arrivals.positionOf(u.id, now, S)) || animator.positionOf(u.id, now, S) || [lp.x * S, lp.y * S];
    const [dx, dy] = effects.unitOffset(u.id, now, S);
    const acted = u.done && u.owner === game.state.turn && !isMine(game, u);   // a mine is always `done`, but it is not spent
    const cx = Math.floor((base[0] + S / 2) / S), cy = Math.floor((base[1] + S / 2) / S);   // the tile under the unit's centre, even mid-slide
    const onWater = !dying && !!game.registry.terrainDef(game.map.terrain[Math.min(game.map.height - 1, Math.max(0, cy))]?.[Math.min(game.map.width - 1, Math.max(0, cx))])?.render.water;
    if (arriving) { g.save(); g.beginPath(); g.rect(0, 0, game.map.width * S, game.map.height * S); g.clip(); }   // a unit driving in from off the map is cut off at the map's edge
    drawUnit(g, { type: u.type, x: lp.x, y: lp.y, hp: dying ? u.hp : effects.displayHp(u, now) }, {
      face: game.registry.unit(u.type).render.facing === false ? 1 : this.facingOf(u, view, now), submerged: dive, hidden: !dying && isHidden(game, u), exposed: !dying && isHidden(game, u) && isExposed(game, u, this.viewer),
      def: game.registry.unit(u.type), colors: this.colorsOf(u.owner), px: base[0] + dx, py: base[1] + dy,
      size: S, now, animate: dying || !acted || moving, moving, alpha, showHp: true, onWater: onWater || (dying && !!game.registry.terrainDef(game.map.terrain[u.y][u.x]).render.water),
      ammo: dying ? null : ammoLevel(game, u),   // drawUnit only draws it for 'low' and 'empty'
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
      if (u.owner !== null && state.owners[y][x] === u.owner && game.registry.terrainDef(map.terrain[y][x]).attributes.property) out.add(tileIndex(map, x, y));
    }
    return out;
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

    const terrainAt = (x, y) => game.registry.terrainDef(map.terrain[y][x]);
    const dimmed = this.dimmedTiles(view);
    drawTerrainLayer(g, {
      width: map.width, height: map.height, S, now, terrainAt,
      ownerColorAt: (x, y) => (terrainAt(x, y).attributes.property ? this.colorsOf(state.owners[y][x]).color : null),
      dimmedAt: (x, y) => dimmed.has(tileIndex(map, x, y)),
      groundAt: (x, y) => game.registry.groundDef(map.ground?.[y]?.[x]),
      view: seen,
    });
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
    if (view.sonar && view.sonar.size) {   // the selected unit's sonar: a small sonar mark on every empty stretch of deep water it listens to
      g.save(); g.lineCap = 'round';
      const pulse = .55 + .25 * Math.sin(now / 350);
      for (const k of view.sonar) {
        const x = k % map.width, y = Math.floor(k / map.width);
        if (!hasAttribute(terrainAt(this.game, x, y), 'submergible') || this.game.state.units.some((u) => u.x === x && u.y === y && this.isShown(u))) continue;
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
    for (const u of state.units) {
      const m = this.motionOf(u, now);
      if (m.alpha > .01) this.drawUnitAt(g, u, view, now, { alpha: m.alpha, dive: m.dive });
    }
    this.motionAt = now;
    if (this.motion.size > state.units.length + 8) for (const id of [...this.motion.keys()]) if (!unitById(game, id)) this.motion.delete(id);
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

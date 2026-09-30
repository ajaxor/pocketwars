// The camera: which part of the map is on screen. Pure arithmetic, no DOM and no canvas, so it is tested directly.
//
// The canvas covers the whole window. The camera keeps a tile size `S` (whole pixels, so tiles stay crisp) and `cx, cy`, the
// point of the map (in tiles, fractions allowed) that sits at the centre of the playfield: the window below the status bar.
//
//   - A map that fits at a comfortable size is shown whole and centred, exactly as before.
//   - A bigger map is shown at a comfortable minimum tile size (MIN_TILE) and scrolls: drag to pan, pinch or wheel to zoom.
//   - Zoom goes from "the whole map fits" (never below ZOOM_OUT_FLOOR px) up to ZOOM_IN_CEIL px per tile.
//   - Along an axis where the map is smaller than the window it stays centred; otherwise its edges stop at the window's edges.

/** Smallest tile size used by default. A map that would need smaller tiles to fit whole scrolls instead. */
export const MIN_TILE = 36;
/** Smallest tile size zooming out can reach when the whole map still does not fit. */
export const ZOOM_OUT_FLOOR = 16;
/** Largest tile size zooming in can reach (a map that already fits bigger than this keeps its own size). */
export const ZOOM_IN_CEIL = 96;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class Camera {
  /** @param {number} mapW map width in tiles  @param {number} mapH map height in tiles */
  constructor(mapW, mapH) {
    this.mapW = mapW;
    this.mapH = mapH;
    this.W = 0;            // window size in px
    this.H = 0;
    this.top = 0;          // px covered by the status bar at the top of the window
    this.S = MIN_TILE;
    this.cx = mapW / 2;
    this.cy = mapH / 2;
    this.zoomed = false;   // true once the player has zoomed: a resize then keeps their zoom instead of re-fitting
    this.glide = null;     // { cx, cy }: where the camera is easing to (see glideTo), or null
  }

  /** Height of the playfield: the window below the status bar. */
  get availH() { return Math.max(1, this.H - this.top); }
  /** The biggest whole-pixel tile size at which the whole map fits. */
  get fitSize() { return Math.max(1, Math.floor(Math.min(this.W / this.mapW, this.availH / this.mapH))); }
  /** The tile size a map starts at: whole-map-fits, but never smaller than MIN_TILE. */
  get defaultSize() { return Math.max(this.fitSize, MIN_TILE); }
  get minSize() { return Math.min(this.defaultSize, Math.max(ZOOM_OUT_FLOOR, this.fitSize)); }
  get maxSize() { return Math.max(ZOOM_IN_CEIL, this.defaultSize); }
  /** True when the map is bigger than the window at the current zoom on either axis (so there is something to scroll to). */
  get scrolls() { return this.mapW * this.S > this.W || this.mapH * this.S > this.availH; }

  /** The window changed size (or this is the first time it is known). `top` is the status bar's height. */
  setViewport(W, H, top = 0) {
    this.W = W; this.H = H; this.top = top;
    this.S = this.zoomed ? clamp(this.S, this.minSize, this.maxSize) : this.defaultSize;
    this.#clamp();
  }

  /** Keep the camera on the map: centred along an axis the map does not fill, edge to edge along one it overfills. */
  #clamp() {
    const halfW = this.W / this.S / 2, halfH = this.availH / this.S / 2;
    this.cx = this.mapW <= halfW * 2 ? this.mapW / 2 : clamp(this.cx, halfW, this.mapW - halfW);
    this.cy = this.mapH <= halfH * 2 ? this.mapH / 2 : clamp(this.cy, halfH, this.mapH - halfH);
  }

  /** Window pixel of the map's top-left corner (whole pixels, so tile edges do not shimmer). */
  origin() {
    return { ox: Math.floor(this.W / 2 - this.cx * this.S), oy: Math.floor(this.top + this.availH / 2 - this.cy * this.S) };
  }

  /** The map tile under a window pixel (out of range when it is off the map). */
  tileAt(px, py) {
    const { ox, oy } = this.origin();
    return { x: Math.floor((px - ox) / this.S), y: Math.floor((py - oy) / this.S) };
  }

  /** Tiles that are at least partly on screen, as inclusive ranges widened by `margin` tiles and cut to the map. */
  visible(margin = 0) {
    const { ox, oy } = this.origin();
    return {
      x0: Math.max(0, Math.floor(-ox / this.S) - margin), y0: Math.max(0, Math.floor((this.top - oy) / this.S) - margin),
      x1: Math.min(this.mapW - 1, Math.floor((this.W - ox) / this.S) + margin), y1: Math.min(this.mapH - 1, Math.floor((this.H - oy) / this.S) + margin),
    };
  }

  /** Drag the map by (dx, dy) window pixels. Stops any easing in progress. */
  panBy(dx, dy) {
    this.glide = null;
    this.cx -= dx / this.S;
    this.cy -= dy / this.S;
    this.#clamp();
  }

  /** Change the tile size to `size` (clamped) keeping the map point under window pixel (ax, ay) where it is. */
  zoomTo(size, ax = this.W / 2, ay = this.top + this.availH / 2) {
    const s = clamp(Math.round(size), this.minSize, this.maxSize);
    this.glide = null;
    if (s === this.S) return;
    const { ox, oy } = this.origin();
    const wx = (ax - ox) / this.S, wy = (ay - oy) / this.S;     // the map point under the anchor, in tiles
    this.S = s;
    this.cx = wx - (ax - this.W / 2) / s;
    this.cy = wy - (ay - (this.top + this.availH / 2)) / s;
    this.zoomed = true;
    this.#clamp();
  }

  /** Multiply the tile size by `factor` around a window pixel (pinch and wheel). */
  zoomBy(factor, ax, ay) {
    // tiny pinches would round away; a factor that changes nothing still moves one step so zooming never sticks
    const target = this.S * factor;
    const next = Math.round(target) === this.S ? this.S + Math.sign(factor - 1) : target;
    this.zoomTo(next, ax, ay);
  }

  /** Put tile (x, y) at the centre of the window at once. */
  centerOn(x, y) {
    this.glide = null;
    this.cx = x + .5;
    this.cy = y + .5;
    this.#clamp();
  }

  /** Ease toward centring tile (x, y): call step(ms) every frame. */
  glideTo(x, y) { this.glide = { cx: x + .5, cy: y + .5 }; }

  /**
   * Make sure every point ([x, y] tiles) is on screen, leaving `margin` tiles of slack at the edges. Nothing moves when they
   * already are. When they all fit the camera eases to their middle; when they cannot, it follows the last one.
   */
  reveal(points, margin = 1) {
    if (!points.length) return;
    const halfW = this.W / this.S / 2, halfH = this.availH / this.S / 2;
    const cx = this.glide ? this.glide.cx : this.cx, cy = this.glide ? this.glide.cy : this.cy;
    const inside = ([x, y]) => x + .5 >= cx - halfW + margin && x + .5 <= cx + halfW - margin && y + .5 >= cy - halfH + margin && y + .5 <= cy + halfH - margin;
    if (points.every(inside)) return;
    const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
    const fits = Math.max(...xs) - Math.min(...xs) + 1 + 2 * margin <= halfW * 2 && Math.max(...ys) - Math.min(...ys) + 1 + 2 * margin <= halfH * 2;
    if (fits) this.glideTo((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2);
    else { const [x, y] = points[points.length - 1]; this.glideTo(x, y); }
  }

  /** Advance the easing by `ms` milliseconds. Returns true while the camera is still moving. */
  step(ms) {
    const g = this.glide;
    if (!g) return false;
    const k = 1 - Math.exp(-ms / 110);
    const halfW = this.W / this.S / 2, halfH = this.availH / this.S / 2;
    const tx = this.mapW <= halfW * 2 ? this.mapW / 2 : clamp(g.cx, halfW, this.mapW - halfW);
    const ty = this.mapH <= halfH * 2 ? this.mapH / 2 : clamp(g.cy, halfH, this.mapH - halfH);
    this.cx += (tx - this.cx) * k;
    this.cy += (ty - this.cy) * k;
    if (Math.abs(tx - this.cx) < .01 && Math.abs(ty - this.cy) < .01) { this.cx = tx; this.cy = ty; this.glide = null; return false; }
    return true;
  }
}

// Turns raw pointer and wheel events on the map into four plain intents, so the session only has to say what each one does:
//
//   onTap(x, y)            a touch or click that did not move: a tap on the map
//   onPan(dx, dy)          one finger (or the mouse) dragging: move the map by that many pixels
//   onZoom(factor, x, y)   two fingers pinching, or a ctrl/cmd + wheel: scale by `factor` around a point
//   onPan(dx, dy)          also fires for a plain wheel or trackpad scroll and for two fingers moving together
//
// A press only becomes a drag once it has moved DRAG_PX pixels, so a slightly shaky tap is still a tap. Once two fingers have
// been down, lifting them never counts as a tap. Coordinates are client (window) pixels; the class keeps no DOM references.

export const DRAG_PX = 8;

export class Gestures {
  /** @param {{onTap:Function, onPan:Function, onZoom:Function, dragPx?:number}} handlers */
  constructor({ onTap, onPan, onZoom, dragPx = DRAG_PX }) {
    Object.assign(this, { onTap, onPan, onZoom, dragPx });
    this.pointers = new Map();   // pointerId -> { x, y, sx, sy }
    this.dragging = false;       // the single pointer has moved far enough to count as a drag
    this.multi = false;          // two fingers have been down since the last time none were
    this.pinch = null;           // { d, cx, cy }: the last distance between the fingers and their middle
  }

  down(e) {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
    if (this.pointers.size === 1) { this.dragging = false; this.multi = false; }
    if (this.pointers.size >= 2) { this.multi = true; this.pinch = this.#measure(); }
  }

  move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (this.pointers.size >= 2) {
      const now = this.#measure(), was = this.pinch;
      this.pinch = now;
      if (was && was.d > 0 && now.d > 0 && now.d !== was.d) this.onZoom(now.d / was.d, now.cx, now.cy);
      if (was && (now.cx !== was.cx || now.cy !== was.cy)) this.onPan(now.cx - was.cx, now.cy - was.cy);
      return;
    }
    if (!this.dragging) {
      if (Math.hypot(p.x - p.sx, p.y - p.sy) < this.dragPx) return;
      this.dragging = true;
      this.onPan(p.x - p.sx, p.y - p.sy);   // catch up with everything moved before it counted as a drag
      return;
    }
    if (dx || dy) this.onPan(dx, dy);
  }

  up(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 1) this.pinch = null;   // back to one finger: it continues as a drag from where it is
    if (this.pointers.size === 0) {
      const tap = !this.dragging && !this.multi;
      this.dragging = false; this.multi = false; this.pinch = null;
      if (tap) this.onTap(e.clientX, e.clientY);
    }
    if (this.pointers.size === 1) this.dragging = true;
  }

  cancel(e) {
    this.pointers.delete(e.pointerId);
    if (!this.pointers.size) { this.dragging = false; this.multi = false; this.pinch = null; }
  }

  /** Mouse wheel and trackpad. ctrl/cmd (and trackpad pinch, which browsers report as ctrl + wheel) zooms; otherwise it scrolls. */
  wheel(e) {
    if (e.ctrlKey || e.metaKey) this.onZoom(Math.exp(-e.deltaY * .01), e.clientX, e.clientY);
    else this.onPan(-e.deltaX, -e.deltaY);
  }

  #measure() {
    const [a, b] = [...this.pointers.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }
}

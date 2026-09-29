// All DOM access for the in-game HUD lives here: status text, message line, action buttons and the
// animated unit icons on the build menu. Nothing else in the game touches `document`.

import { drawUnit } from '../render/unit-sprites.js';

const ICON = 44;

export class Hud {
  /** @param {Document} doc */
  constructor(doc) {
    this.doc = doc;
    this.el = {
      day: doc.getElementById('t'), funds: doc.getElementById('f'), msg: doc.getElementById('msg'),
      btns: doc.getElementById('btns'), undo: doc.getElementById('undo'), end: doc.getElementById('end'),
    };
    this.icons = [];
    this.shown = {};
  }

  message(text) { this.el.msg.textContent = text; }

  /** Update a text/disabled field only when it changed (this runs every frame). */
  #set(node, prop, value) {
    const key = node.id + prop;
    if (this.shown[key] !== value) { this.shown[key] = value; node[prop] = value; }
  }

  status(dayText, fundsText) { this.#set(this.el.day, 'textContent', dayText); this.#set(this.el.funds, 'textContent', fundsText); }
  setUndoDisabled(v) { this.#set(this.el.undo, 'disabled', v); }
  setEndDisabled(v) { this.#set(this.el.end, 'disabled', v); }
  onUndo(fn) { this.el.undo.onclick = fn; }
  onEnd(fn) { this.el.end.onclick = fn; }

  /**
   * Replace the action buttons. Each item: { label, onClick, icon?: { type, colors, def }, dim? }
   * An icon adds a live-animated unit picture (used by the build menu).
   */
  buttons(items) {
    const box = this.el.btns;
    const r = devicePixelRatio || 1;
    box.innerHTML = '';
    for (const it of items) {
      const b = this.doc.createElement('button');
      b.onclick = it.onClick;
      if (it.icon) {
        b.className = 'u';
        const c = this.doc.createElement('canvas');
        c.width = c.height = ICON * r;
        c.style.cssText = `width:${ICON}px;height:${ICON}px`;
        b.append(c, it.label);
        this.icons.push({ canvas: c, ...it.icon });
        if (it.dim) b.style.opacity = .45;
      } else b.textContent = it.label;
      box.appendChild(b);
    }
  }

  /** Redraw the animated icons of any visible build-menu buttons. */
  drawIcons(now) {
    const d = devicePixelRatio || 1;
    this.icons = this.icons.filter((i) => i.canvas.isConnected);
    for (const i of this.icons) {
      const g = i.canvas.getContext('2d');
      g.setTransform(d, 0, 0, d, 0, 0);
      g.clearRect(0, 0, ICON, ICON);
      drawUnit(g, { type: i.def.id, x: 0, y: 0, hp: 10 }, { def: i.def, colors: i.colors, px: 0, py: 0, size: ICON, now, animate: true, moving: false, showHp: false });
    }
  }
}

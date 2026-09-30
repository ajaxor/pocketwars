// A tiny fake DOM, enough for the title screen and launcher: elements with children, attributes, classes and listeners.
export class FakeEl {
  constructor(tag, doc) {
    this.tag = tag; this.doc = doc; this.children = []; this.attrs = {}; this.style = {}; this.listeners = {};
    this.className = ''; this.textContent = ''; this.innerHTML = ''; this.hidden = false; this.disabled = false; this.parent = null;
    const classes = new Set();
    this.classList = { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) };
  }
  append(...kids) { for (const k of kids) { k.parent = this; this.children.push(k); } }
  appendChild(k) { this.append(k); return k; }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
    this.parent = null;
    if (this.id && this.doc.byId[this.id] === this) delete this.doc.byId[this.id];
  }
  setAttribute(k, v) { this.attrs[k] = v; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  click() { for (const fn of this.listeners.click || []) fn(); }
  /** Every descendant (depth first) matching a predicate. */
  find(pred) { const out = []; const walk = (e) => { for (const c of e.children) { if (pred(c)) out.push(c); walk(c); } }; walk(this); return out; }
}

export class FakeDoc {
  constructor() {
    this.body = new FakeEl('body', this); this.head = new FakeEl('head', this); this.hidden = false; this.listeners = {}; this.byId = {};
  }
  createElement(tag) { return new FakeEl(tag, this); }
  getElementById(id) { return this.byId[id] || null; }
  /** Register an element under an id, as if it were in the page's HTML. */
  withId(id, el = this.createElement('div')) { this.byId[id] = el; el.id = id; this.body.append(el); return el; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  async fire(type) { for (const fn of this.listeners[type] || []) await fn(); }
}

// A tiny fake DOM, enough for the title screen and launcher: elements with children, attributes, classes and listeners.
export class FakeEl {
  constructor(tag, doc) {
    this.tag = tag; this.doc = doc; this.children = []; this.attrs = {}; this.listeners = {};
    this.className = ''; this.textContent = ''; this.innerHTML = ''; this.hidden = false; this.disabled = false; this.parent = null;
    this.style = { setProperty(k, v) { this[k] = v; } };
    const list = () => this.className.split(/\s+/).filter(Boolean);
    const put = (l) => { this.className = l.join(' '); };
    this.classList = {
      add: (c) => { if (!list().includes(c)) put([...list(), c]); },
      remove: (c) => put(list().filter((x) => x !== c)),
      contains: (c) => list().includes(c),
    };
  }
  get isConnected() { let e = this; while (e.parent) e = e.parent; return e === this.doc.body; }
  replaceChildren(...kids) { for (const k of this.children) k.parent = null; this.children = []; this.append(...kids); }
  offsetHeight = 0;
  append(...kids) { for (const k of kids) { k.parent = this; this.children.push(k); } }
  appendChild(k) { this.append(k); return k; }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
    this.parent = null;
    if (this.id && this.doc.byId[this.id] === this) delete this.doc.byId[this.id];
  }
  setAttribute(k, v) { this.attrs[k] = v; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  click() { if (this.onclick) this.onclick(); for (const fn of this.listeners.click || []) fn(); }
  getContext() { return null; }
  /** Every descendant (depth first) matching a predicate. */
  find(pred) { const out = []; const walk = (e) => { for (const c of e.children) { if (pred(c)) out.push(c); walk(c); } }; walk(this); return out; }
}

export class FakeDoc {
  constructor() {
    this.body = new FakeEl('body', this); this.head = new FakeEl('head', this); this.hidden = false; this.listeners = {}; this.byId = {};
  }
  createElement(tag) { return new FakeEl(tag, this); }
  getElementById(id) { return this.byId[id] || null; }
  get fonts() { return undefined; }
  /** Register an element under an id, as if it were in the page's HTML. */
  withId(id, el = this.createElement('div')) { this.byId[id] = el; el.id = id; this.body.append(el); return el; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  async fire(type) { for (const fn of this.listeners[type] || []) await fn(); }
}

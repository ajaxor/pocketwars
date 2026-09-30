// The title screen: a full-screen overlay with the logo, a progress bar, the Start button and links to the galleries.
// This is only the view: it builds its DOM and exposes the states below. The launcher (src/launcher.js) decides when each
// state happens. Its styles are the `.title*` rules in style.css; the buttons are the shared `.btn` kit.
//
//   setProgress(pct, text)   progress bar and status line
//   setVersion(text)         small build label at the bottom
//   setReady()               the game has loaded: Start is enabled
//   setFailed(message)       loading failed: the button becomes Retry
//   showUpdate(onClick)      show the "new version available" button
//   remove()                 take the overlay away (the game is underneath)
//   onStart                  called when the main button is pressed; set by the launcher

const ART = `<svg viewBox="0 0 320 120" aria-hidden="true">
<rect x="0" y="100" width="320" height="6" rx="3" fill="#86b95c"/>
<g><rect x="14" y="86" width="104" height="18" rx="9" fill="#2b2b2b"/><rect x="22" y="66" width="88" height="26" rx="6" fill="#e8712c"/><rect x="44" y="46" width="44" height="24" rx="6" fill="#9a3f0e"/><rect x="84" y="53" width="50" height="7" fill="#222"/></g>
<g><rect x="202" y="86" width="104" height="18" rx="9" fill="#2b2b2b"/><rect x="210" y="66" width="88" height="26" rx="6" fill="#3c74d6"/><rect x="232" y="46" width="44" height="24" rx="6" fill="#1e3f80"/><rect x="186" y="53" width="50" height="7" fill="#222"/></g>
<circle cx="160" cy="58" r="5" fill="#ffe45c"/><path d="M150 58h-10M170 58h10M160 48v-10M160 68v10" stroke="#ffe45c" stroke-width="3" stroke-linecap="round"/>
</svg>`;

export class TitleScreen {
  /**
   * @param {Document} doc
   * @param {{links?: {label:string, href:string}[]}} [opts]  extra buttons under Start (the galleries)
   */
  constructor(doc, { links = [] } = {}) {
    const h = (tag, cls, text) => {
      const e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    };
    this.ready = false;
    this.onStart = () => {};
    this.onUpdate = () => {};

    const art = h('div', 'title-art'); art.innerHTML = ART;
    const progress = h('div', 'title-prog');
    this.fill = h('div', 'title-fill'); progress.append(this.fill);
    this.status = h('div', 'title-status', 'Starting...');
    this.go = h('button', 'btn btn--primary btn--lg title-go', 'Loading'); this.go.disabled = true;
    this.go.addEventListener('click', () => this.onStart());
    this.links = h('nav', 'title-links');
    for (const { label, href } of links) { const a = h('a', 'btn btn--ghost', label); a.setAttribute('href', href); this.links.append(a); }
    this.upd = h('button', 'btn btn--sm title-upd', 'New version available - tap to update'); this.upd.hidden = true;
    this.upd.addEventListener('click', () => this.onUpdate());
    this.ver = h('div', 'title-ver');

    const loading = h('div', 'title-loading');   // the progress bar and its status line travel together
    loading.append(progress, this.status);

    const body = h('div', 'title-body');
    body.append(art, h('h1', '', 'Pocket Wars'), h('div', 'sub', 'Build your army, capture properties, and take the enemy HQ.'),
      loading, this.go, this.links, this.upd);
    this.root = h('div', 'title');
    this.root.append(body, this.ver);
    doc.body.append(this.root);
  }

  setProgress(pct, text) { this.fill.style.width = pct + '%'; this.status.textContent = text; }
  setVersion(text) { this.ver.textContent = text; }
  setReady() { this.ready = true; this.go.disabled = false; this.go.textContent = 'Start'; this.setProgress(100, 'Ready'); }
  setFailed(message) { this.ready = false; this.go.disabled = false; this.go.textContent = 'Retry'; this.setProgress(0, 'Could not load the game: ' + message); }
  showUpdate(onClick) { this.onUpdate = onClick; this.upd.hidden = false; }
  remove() { this.root.remove(); }
}

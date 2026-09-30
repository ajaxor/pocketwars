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

// The scene: a dusk battlefield with two tanks squaring off, built here as inline SVG so it shows before anything else has
// loaded. The motion (drifting clouds, a plane, muzzle flashes, idling tanks) is CSS in style.css and stops for people who
// ask their system for reduced motion.
const tank = (x, dir, hull, turret, cls) => `<g class="t-unit ${cls}" transform="translate(${x} 162) scale(${dir} 1)">
<rect x="-44" y="-14" width="88" height="14" rx="7" fill="#2b2b2b"/><rect x="-38" y="-33" width="76" height="22" rx="6" fill="${hull}"/>
<rect x="-16" y="-50" width="38" height="21" rx="6" fill="${turret}"/><rect x="20" y="-43" width="44" height="7" fill="#222"/>
<g class="t-flash"><circle cx="70" cy="-40" r="9" fill="#ffe45c"/><path d="M60-40h-8M80-40h8M70-50v-8M70-30v8" stroke="#fff7b0" stroke-width="3" stroke-linecap="round"/></g></g>`;
const grunt = (x, dir, body, cls) => `<g class="t-unit ${cls}" transform="translate(${x} 162) scale(${dir} 1)">
<rect x="-5" y="-17" width="10" height="13" rx="3" fill="${body}"/><circle cx="0" cy="-22" r="5" fill="#f3d4a8"/><path d="M-5-26h10v-3a5 5 0 0 0-10 0z" fill="#3b4a2a"/>
<rect x="3" y="-14" width="14" height="3" fill="#222"/><rect x="-4" y="-5" width="3" height="5" fill="#2b2b2b"/><rect x="1" y="-5" width="3" height="5" fill="#2b2b2b"/></g>`;
const city = (x, body, roof) => `<g transform="translate(${x} 132)"><rect x="0" y="6" width="16" height="24" fill="${body}"/><rect x="18" y="-6" width="14" height="36" fill="${body}"/><rect x="-2" y="3" width="20" height="4" fill="${roof}"/>
<rect x="21" y="0" width="3" height="3" fill="#ffe45c"/><rect x="26" y="8" width="3" height="3" fill="#ffe45c"/><rect x="4" y="14" width="3" height="3" fill="#ffe45c"/></g>`;
const cloud = (x, y, cls) => `<g class="t-cloud ${cls}" transform="translate(${x} ${y})"><ellipse cx="0" cy="0" rx="26" ry="8"/><ellipse cx="14" cy="-6" rx="16" ry="8"/><ellipse cx="-12" cy="-4" rx="12" ry="6"/></g>`;

const ART = `<svg viewBox="0 0 360 200" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
<circle cx="180" cy="128" r="46" fill="#ffd27a" opacity=".22"/><circle cx="180" cy="128" r="26" fill="#ffe3a0"/>
${cloud(70, 44, 'c1')}${cloud(250, 30, 'c2')}${cloud(150, 76, 'c3')}
<g class="t-plane"><ellipse cx="0" cy="0" rx="16" ry="4" fill="#2b2f45"/><path d="M-4 0l-10-12h7l9 10zM-4 0l-10 12h7l9-10z" fill="#3a405c"/><path d="M-14-1l-8-8h5l8 7z" fill="#3a405c"/><circle cx="10" cy="-1" r="2" fill="#ffe45c"/></g>
<path d="M0 138c30-14 52-10 80-2s48 4 70-6 54-14 82-4 54 6 78-2 50-2 50-2v78H0z" fill="#3c2f63"/>
${city(6, '#6a3a3a', '#8a4a2a')}${city(322, '#34497a', '#3c74d6')}
<path d="M0 154c40-8 80-4 120 0s90 4 130-2 80-2 110 2v46H0z" fill="#4e7a3a"/>
<rect x="0" y="160" width="360" height="40" fill="#5f9444"/>
<path d="M0 170h360M0 182h360M40 160v40M80 160v40M120 160v40M160 160v40M200 160v40M240 160v40M280 160v40M320 160v40" stroke="#4e7a3a" stroke-width="1" opacity=".55"/>
${grunt(34, 1, '#e8712c', 'u1')}${tank(104, 1, '#e8712c', '#9a3f0e', 'u2 fire-l')}
${tank(256, -1, '#3c74d6', '#1e3f80', 'u3 fire-r')}${grunt(326, -1, '#3c74d6', 'u4')}
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

    const art = h('div', 'title-scene'); art.innerHTML = ART;
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
    const logo = h('h1', 'title-logo');
    logo.append(h('span', 'logo-top', 'Pocket'), h('span', 'logo-main', 'Wars'));
    body.append(logo, h('div', 'sub', 'Build your army, capture properties, and take the enemy HQ.'),
      loading, this.go, this.links, this.upd, this.ver);
    this.root = h('div', 'title');
    this.root.append(art, body);
    doc.body.append(this.root);
  }

  setProgress(pct, text) { this.fill.style.width = pct + '%'; this.status.textContent = text; }
  setVersion(text) { this.ver.textContent = text; }
  setReady() { this.ready = true; this.go.disabled = false; this.go.textContent = 'Start'; this.setProgress(100, 'Ready'); }
  setFailed(message) { this.ready = false; this.go.disabled = false; this.go.textContent = 'Retry'; this.setProgress(0, 'Could not load the game: ' + message); }
  showUpdate(onClick) { this.onUpdate = onClick; this.upd.hidden = false; }
  remove() { this.root.remove(); }
}

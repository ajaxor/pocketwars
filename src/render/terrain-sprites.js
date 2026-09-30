// Procedural terrain drawing. terrain.json -> render.base is the tile colour, render.decor names a
// decoration below and render.building names a building drawn on properties. Each function draws into a square
// (px, py, S) and knows nothing about the tile under it: the tile's shape belongs to terrain-layer.js and the alternative
// drawings of the decor belong to terrain-themes.js. Buildings are the same in every theme.

const tri = (g, a, b, c, d, e, f) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.lineTo(e, f); g.fill(); };

// The original flat drawings: the 'flat' theme in terrain-themes.js. Every theme supplies one function per decor name;
// grass and road are the ground under plain tiles, roads and buildings and draw nothing here.
export const TERRAIN_DECOR = {
  grass() {},
  road() {},
  forest(g, px, py, S) {
    g.fillStyle = '#2f6b34';
    for (const [a, b] of [[.3, .35], [.7, .4], [.5, .72]]) { g.beginPath(); g.arc(px + a * S, py + b * S, S * .2, 0, 7); g.fill(); }
  },
  mountain(g, px, py, S) {
    g.fillStyle = '#8a8275'; tri(g, px + S * .5, py + S * .1, px + S * .05, py + S * .9, px + S * .95, py + S * .9);
    g.fillStyle = '#ece8de'; tri(g, px + S * .5, py + S * .1, px + S * .36, py + S * .38, px + S * .64, py + S * .38);
  },
  sea(g, px, py, S) {
    g.strokeStyle = '#8fc2ee'; g.lineWidth = 2; g.beginPath(); g.moveTo(px + S * .15, py + S * .5);
    g.quadraticCurveTo(px + S * .3, py + S * .3, px + S * .5, py + S * .5);
    g.quadraticCurveTo(px + S * .7, py + S * .7, px + S * .85, py + S * .5); g.stroke();
  },
};

// Every building starts from the same house shape (in the owner's colour), then adds its own details.
const house = (g, px, py, S, owner) => {
  g.fillStyle = owner; g.fillRect(px + S * .2, py + S * .3, S * .6, S * .55);
  g.fillStyle = '#fff9'; g.fillRect(px + S * .3, py + S * .42, S * .12, S * .12); g.fillRect(px + S * .58, py + S * .42, S * .12, S * .12);
};

export const BUILDINGS = {
  city: (g, px, py, S, owner) => house(g, px, py, S, owner),
  factory(g, px, py, S, owner) {
    house(g, px, py, S, owner);
    g.fillStyle = '#333'; g.fillRect(px + S * .62, py + S * .12, S * .12, S * .2);
  },
  airfield(g, px, py, S, owner) {
    house(g, px, py, S, owner);
    g.fillStyle = '#585d66'; g.fillRect(px + S * .04, py + S * .28, S * .92, S * .46);
    g.fillStyle = '#e8e8e8'; for (let i = 0; i < 4; i++) g.fillRect(px + S * (.12 + i * .22), py + S * .49, S * .12, S * .05);
    g.fillStyle = owner; g.fillRect(px + S * .7, py + S * .08, S * .2, S * .24);
    g.fillStyle = '#cfe6f5'; g.fillRect(px + S * .73, py + S * .12, S * .14, S * .07);
  },
  barracks(g, px, py, S, owner) {
    house(g, px, py, S, owner);
    g.fillStyle = '#5a4632'; tri(g, px + S * .12, py + S * .34, px + S * .5, py + S * .08, px + S * .88, py + S * .34);
    g.fillStyle = '#3a2a1c'; g.fillRect(px + S * .42, py + S * .58, S * .16, S * .27);
  },
  hq(g, px, py, S, owner) {
    house(g, px, py, S, owner);
    g.fillStyle = '#111'; g.fillRect(px + S * .46, py + S * .06, S * .07, S * .26);
    g.fillStyle = owner; g.fillRect(px + S * .53, py + S * .06, S * .18, S * .12);
  },
};

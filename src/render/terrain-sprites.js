// The original flat terrain decorations. terrain.json -> render.decor names one; each function draws into a square
// (px, py, S) and knows nothing about the tile under it: the tile's shape belongs to terrain-layer.js, the alternative
// drawings belong to terrain-themes.js and buildings (render.building) to buildings.js.

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

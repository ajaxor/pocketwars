// The nose, mouth and chin of each leader (the eyes are in eye-styles.js). A portrait (src/render/portrait-art.js) draws them from the
// styles named by the leader's `noseStyle`, `mouthStyle` and `chinStyle` traits in data/campaign.json. Every leader has a nose, a
// mouth and a chin of their own (campaign validation checks that no two share one). Sizes are in the 100 x 100 drawing space.
//
// NOSE   len  how far the tip is below the eyes' line;  w  half the width of the nostrils;  tip  radius of the tip;  red  how pink the tip is
//        lean how far the bridge leans to the shadow side;  bridge  weight of the bridge line;  up  how far the tip turns up (negative: hangs down);
//        bump a bump on the bridge;  hook  the tip hangs past the nostrils;  flare  how big the nostrils are (0 = hidden)
// MOUTH  w  half-width (1 = the standard);  dy  how far down it sits;  lips  fullness (0 = a plain line);  red  how red the lips are;
//        tilt  one corner higher than the other (positive: the right side is raised);  curl  corners turned down (positive) or up (negative)
// CHIN   parts  shapes added under the face, [ 'ell', cx, cy, rx, ry ] or [ 'poly', [x, y], ... ];  dimple  a dimple or cleft;
//        crease  a shadow line under the lip;  fold  a second chin's fold;  none  nothing added (a receding chin)

export const NOSE_STYLES = {
  plain:   { len: 7, w: 2, tip: 1.6, red: 0, lean: 1.6, bridge: 1.1, up: 0, bump: 0, hook: 0, flare: 1 },
  broad:   { len: 8, w: 3.6, tip: 2.6, red: .08, lean: 1.2, bridge: 1.4, up: .2, bump: 0, hook: 0, flare: 1.5 },
  button:  { len: 5, w: 1.4, tip: 1.7, red: .12, lean: .6, bridge: .7, up: 1.3, bump: 0, hook: 0, flare: 1.1 },
  long:    { len: 10, w: 1.9, tip: 1.2, red: 0, lean: 2, bridge: 1.1, up: 0, bump: 0, hook: 0, flare: .8 },
  hawk:    { len: 9, w: 2.2, tip: 1.3, red: 0, lean: 1.8, bridge: 1.4, up: -1.2, bump: 1.4, hook: 1.8, flare: .8 },
  pointed: { len: 8.5, w: 1.5, tip: .8, red: .05, lean: 1.2, bridge: .9, up: -.4, bump: 0, hook: 0, flare: .7 },
  roman:   { len: 8.5, w: 2.4, tip: 1.5, red: 0, lean: 2.2, bridge: 1.5, up: 0, bump: 1, hook: 0, flare: 1 },
  slim:    { len: 7, w: 1.6, tip: 1.1, red: 0, lean: .8, bridge: .8, up: .5, bump: 0, hook: 0, flare: .8 },
  bulb:    { len: 7.5, w: 2.8, tip: 3.1, red: .3, lean: .8, bridge: 1, up: 0, bump: 0, hook: 0, flare: 1 },
  refined: { len: 6.5, w: 1.5, tip: 1, red: 0, lean: .5, bridge: .6, up: .9, bump: 0, hook: 0, flare: .6 },
  minimal: { len: 6, w: 1.1, tip: .5, red: 0, lean: .3, bridge: .5, up: 0, bump: 0, hook: 0, flare: .6 },
};

export const MOUTH_STYLES = {
  plain:   { w: 1, dy: 0, lips: 0, red: 0, tilt: 0, curl: 0 },
  grim:    { w: 1.1, dy: .4, lips: .5, red: .1, tilt: 0, curl: 1.8 },
  grin:    { w: 1.3, dy: -.2, lips: 1.2, red: .55, tilt: 0, curl: -1.2 },
  thin:    { w: .85, dy: 0, lips: 0, red: 0, tilt: .8, curl: -.2 },
  firm:    { w: 1.05, dy: .2, lips: .5, red: .2, tilt: 0, curl: 0 },
  pursed:  { w: .6, dy: .3, lips: 1.1, red: .4, tilt: 0, curl: 0 },
  sneer:   { w: 1.25, dy: .2, lips: 1, red: .35, tilt: -1.6, curl: -.6 },
  smirk:   { w: 1, dy: 0, lips: .6, red: .25, tilt: 1.6, curl: -.8 },
  slit:    { w: 1.2, dy: .5, lips: 0, red: 0, tilt: 0, curl: 1.2 },
  full:    { w: 1, dy: -.1, lips: 1.7, red: .75, tilt: 0, curl: 0 },
  tiny:    { w: .7, dy: .2, lips: .3, red: .1, tilt: 0, curl: 0 },
};

export const CHIN_STYLES = {
  plain:    {},
  block:    { parts: [['poly', [35, 56], [65, 56], [64, 68], [60, 71.5], [40, 71.5], [36, 68]]] },
  soft:     { parts: [['ell', 50, 63.5, 11, 7]], dimple: true },
  point:    { parts: [['poly', [37, 58], [63, 58], [52, 73], [50, 75], [48, 73]]] },
  jut:      { parts: [['ell', 50, 67, 13, 7]], crease: true },
  weak:     { none: true, crease: true },
  cleft:    { parts: [['ell', 50, 65.5, 12, 8]], dimple: 'cleft' },
  angular:  { parts: [['poly', [34, 58], [66, 58], [60.5, 71], [50, 73.5], [39.5, 71]]] },
  double:   { parts: [['ell', 50, 66.5, 13.5, 8], ['ell', 50, 71, 10, 5]], fold: true },
  delicate: { parts: [['poly', [39, 58], [61, 58], [55, 69], [50, 71], [45, 69]]] },
  smooth:   { parts: [['ell', 50, 69, 9.5, 8.5]] },
};

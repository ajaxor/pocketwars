// The eyes of each leader. A portrait (src/render/portrait-art.js) draws its eyes from one of these styles, picked by the leader's
// `eyeStyle` trait in data/campaign.json; every leader has a style of their own (campaign validation checks that no two share one).
//
// All sizes are in the portrait's 100 x 100 drawing space; an eye is a lens between its inner corner (by the nose) and its outer corner.
//   gap      distance of each eye from the middle of the face
//   w, h     half width and half height of the open eye
//   tilt     how far the outer corner sits above the inner one (negative: it droops)
//   top,bot  how round the upper and lower lid are (1 = a plain curve, less = flatter)
//   lid      how much of the eye the upper lid covers (0 = none, .5 = half-lidded)
//   ir, irh  iris half width and height;  pr = pupil radius;  look = how far the gaze is turned to one side
//   bags     dark bags under the eye;  lashes  a flick at the outer corner;  liner  the weight of the upper lash line
//   shadow   colour of eye-shadow or kohl above the eye;  ring  a dark ring round the iris;  shine  glints in the eye (1 or 2)
//   size2    scale of the right eye (an uneven pair);  glow  a lit eye with no white (the Chorus)

export const EYE_STYLES = {
  plain:    { gap: 8, w: 4.4, h: 3.5, tilt: 0, top: 1, bot: 1, lid: 0, ir: 2.6, irh: 2.9, pr: 1.2, look: .4, bags: 0, lashes: false, liner: 0, shine: 1 },
  weary:    { gap: 8, w: 4.7, h: 2.8, tilt: -.8, top: .9, bot: .8, lid: .2, ir: 2.2, irh: 2.4, pr: 1.1, look: .4, bags: 1.4, lashes: false, liner: 1.2, shine: 1 },
  bright:   { gap: 8.2, w: 4.9, h: 4.5, tilt: .5, top: 1.1, bot: 1.1, lid: 0, ir: 3.5, irh: 3.8, pr: 1.5, look: .2, bags: 0, lashes: true, liner: 1.1, shine: 2 },
  cold:     { gap: 8.6, w: 5, h: 2.5, tilt: 1.3, top: .55, bot: .8, lid: .06, ir: 2, irh: 2.1, pr: .8, look: 0, bags: .5, lashes: false, liner: 1.5, shine: 1, ring: true },
  serene:   { gap: 8.8, w: 5.2, h: 2.1, tilt: .9, top: .8, bot: .7, lid: .24, ir: 2, irh: 2.1, pr: 1, look: 0, bags: 0, lashes: false, liner: 1.3, shine: 1 },
  manic:    { gap: 8.4, w: 5, h: 5, tilt: 0, top: 1.15, bot: 1.1, lid: 0, ir: 3, irh: 3.2, pr: .65, look: 0, bags: .8, lashes: false, liner: .5, shine: 2, size2: 1.2 },
  fierce:   { gap: 8, w: 5.1, h: 3.3, tilt: 1.7, top: .85, bot: .9, lid: .08, ir: 2.7, irh: 2.9, pr: 1.3, look: .3, bags: 0, lashes: true, liner: 1.9, shadow: '#2b1d33', shine: 1 },
  cocky:    { gap: 8, w: 4.6, h: 3, tilt: .4, top: .7, bot: .9, lid: .2, ir: 2.6, irh: 2.7, pr: 1.2, look: 1.4, bags: 0, lashes: false, liner: 1, shine: 2 },
  deadpan:  { gap: 8, w: 4.7, h: 2.5, tilt: -.3, top: .75, bot: .75, lid: .3, ir: 2.2, irh: 2.3, pr: 1, look: 0, bags: 1.9, lashes: false, liner: .8, shine: 1, ring: true },
  regal:    { gap: 8.4, w: 5.3, h: 3.3, tilt: 1.8, top: 1.1, bot: .9, lid: .12, ir: 2.9, irh: 3.1, pr: 1.2, look: .2, bags: 0, lashes: true, liner: 1.6, shadow: '#d3a93a', shine: 2 },
  glow:     { gap: 8.2, w: 4.9, h: 3.4, tilt: .7, top: 1, bot: .9, lid: 0, ir: 3.4, irh: 3.5, pr: 0, look: 0, bags: 0, lashes: false, liner: .7, shine: 0, glow: true },
};

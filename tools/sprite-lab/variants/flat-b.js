// Flat B — same drawings plus a light band on top and a dark band underneath every part (still flat fills).
import { makeFlat } from './flat-core.js';
export const meta = { id: 'flat-b', name: 'Flat B: banded shading', blurb: 'flat fills with a light top band and dark underside on each part' };
export const { SPRITES, SHADOWS } = makeFlat({ shade: true });

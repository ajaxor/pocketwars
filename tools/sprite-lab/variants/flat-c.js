// Flat C — banded shading plus a thin tone-on-tone outline (each part outlined in a darker shade of itself).
import { makeFlat } from './flat-core.js';
export const meta = { id: 'flat-c', name: 'Flat C: tone outline', blurb: 'banded shading + soft outline in each part’s own darker colour' };
export const { SPRITES, SHADOWS } = makeFlat({ shade: true, tone: true });

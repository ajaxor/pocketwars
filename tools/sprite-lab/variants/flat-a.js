// Flat A — "Flat+": the current look (flat fills, no outlines) with more detail and matching shadows.
import { makeFlat } from './flat-core.js';
export const meta = { id: 'flat-a', name: 'Flat A: pure flat', blurb: 'today’s look, more detail, shaped shadows' };
export const { SPRITES, SHADOWS } = makeFlat({});

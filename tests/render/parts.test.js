// The shared parts library: every export is a colour or a drawing function, and each drawing function runs without throwing.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as parts from '../../src/render/parts.js';
import { PARTS } from '../../src/render/unit-art.js';

const ctx = () => new Proxy({}, { get: (_, p) => (typeof p === 'symbol' ? undefined : () => ({ addColorStop() {} })), set: () => true });

test('PARTS re-exports the whole library', () => {
  for (const k of Object.keys(parts)) assert.equal(PARTS[k], parts[k], k);
});

test('colours are strings and every other part is a function', () => {
  for (const [k, v] of Object.entries(parts)) assert.ok(typeof v === 'string' || typeof v === 'function' || typeof v === 'number', k);
});

test('every drawing part draws, animating and frozen', () => {
  const g = ctx(), s = 100;
  const calls = {
    wheel: [g, s, 0, 0, .08, .3, 1, 10], wheels: [g, s, [-.2, .2], 0, .08, .3, 1], treads: [g, s, -.3, .3, 0, .15, .3, 1],
    walkerLeg: [g, s, 0, 0, 0, .3, 1, 7, '#444'], antigrav: [g, s, -.2, .2, .1, .3, 1, 3], hoverEmitter: [g, s, -.3, .3, .1, .3, 1], bubbles: [g, s, .3, 1, 0, 0],
    periscope: [g, s, 0, 0, -.2], tubes: [g, s, 0, 0, .4, .2, { n: 2 }], dish: [g, s, 0, 0, .1, .3, 1], propDisc: [g, s, 0, 0, .1, .3, 1],
    legs: [g, s, 2, '#444'], torso: [g, s, 0, '#c33'], head: [g, s, 0], dome: [g, s, 0, .1, '#444'],
    sheen: [g, s, .3, 1, [[0, 0], [.2, 0], [.2, .2]]], plume: [g, s, 0, 0, .3, 1, 0],
    propeller: [g, s, 0, 0, .3, 1, '#444'], afloat: [g, s, .3, 1, -.3, .3, () => {}], hullPath: [g, s, { x0: -.4, x1: .4, deck: -.05, keel: .1 }],
    turret: [g, s, 0, 0, .2, .3, {}], skyClip: [g, s, .14], seaClip: [g, s, .14],
  };
  for (const [name, args] of Object.entries(calls)) {
    assert.equal(typeof parts[name], 'function', name);
    parts[name](...args);
    if (['wheel', 'treads', 'walkerLeg', 'antigrav', 'hoverEmitter', 'bubbles', 'tubes', 'dish', 'propDisc', 'sheen', 'plume', 'propeller'].includes(name)) { const a = args.slice(); a[a.indexOf(1)] = 0; parts[name](...a); }
  }
});

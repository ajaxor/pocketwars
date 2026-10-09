// The skirmish page's wide breakpoint lives in JS (the preview's resolution) and in CSS (the layout); they must agree.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WIDE } from '../../src/ui/skirmish-screen.js';

test('the skirmish wide breakpoint is the same number in the script and the stylesheet', () => {
  const css = readFileSync(new URL('../../style.css', import.meta.url), 'utf8');
  assert.ok(css.includes(`@media (min-width: ${WIDE}px)`), `style.css has a (min-width: ${WIDE}px) query`);
});

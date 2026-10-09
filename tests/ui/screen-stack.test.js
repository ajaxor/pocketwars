import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeDoc } from '../helpers/fake-dom.js';
import { ScreenStack } from '../../src/ui/screen-stack.js';

function setup() {
  const doc = new FakeDoc();
  const log = [];
  const stack = new ScreenStack(doc, { onCover: () => log.push('cover'), onUncover: () => log.push('uncover') });
  const screen = (name) => ({ root: doc.createElement('div'), remove() { log.push('remove ' + name); } });
  return { doc, log, stack, screen };
}

test('the first screen covers the title and the last one uncovers it', () => {
  const { log, stack, screen } = setup();
  assert.equal(stack.active, false);
  stack.push(screen('a'));
  stack.push(screen('b'));
  assert.equal(stack.active, true);
  stack.pop();
  stack.pop();
  assert.deepEqual(log, ['cover', 'remove b', 'remove a', 'uncover']);
  assert.equal(stack.active, false);
});

test('replace swaps the top screen without uncovering in between', () => {
  const { log, stack, screen } = setup();
  const a = stack.push(screen('intro'));
  const b = stack.replace(screen('map'));
  assert.notEqual(a, b);
  assert.equal(stack.top, b);
  stack.pop();
  assert.deepEqual(log, ['cover', 'remove intro', 'remove map', 'uncover']);
});

test('clear removes everything and leaves the title covered', () => {
  const { log, stack, screen } = setup();
  stack.push(screen('a'));
  stack.clear();
  assert.deepEqual(log, ['cover', 'remove a']);
  assert.equal(stack.active, false);
});

test('popping an empty stack does nothing', () => {
  const { log, stack } = setup();
  stack.pop();
  assert.deepEqual(log, []);
});

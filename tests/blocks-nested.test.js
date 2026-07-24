// Nested layout: Columns holding bare elements must round-trip through the Puck
// adapter losslessly and render recursively server-side. Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBlocks } from '../api/_blocks.js';
import { toPuck, toBlocks } from '../tools/pages-builder/src/adapter.js';

const nested = [
  {
    type: 'columns', id: 'c1', cols: 2,
    col0: [{ type: 'el-heading', id: 'h1', text: 'Left', level: 2 }],
    col1: [{ type: 'el-button', id: 'b1', label: 'Go', url: '/x', style: 'y' }],
    col2: [], col3: [],
  },
];

test('a Columns block with nested elements round-trips through the adapter', () => {
  assert.deepEqual(toBlocks(toPuck(nested)), nested);
});

test('Columns renders a responsive grid with its nested elements server-side', () => {
  const html = renderBlocks(nested);
  assert.match(html, /<div class="pb-cols pb-cols-2" data-reveal>/);
  assert.match(html, /<div class="pb-col"><h2 data-reveal>Left<\/h2><\/div>/);
  assert.match(html, /<a href="\/x" class="btn btn-y">Go /);
});

test('deeply nested columns (columns inside a column) round-trip', () => {
  const deep = [{
    type: 'columns', id: 'outer', cols: 2,
    col0: [{ type: 'columns', id: 'inner', cols: 2, col0: [{ type: 'el-text', id: 't', html: '<p>hi</p>' }], col1: [], col2: [], col3: [] }],
    col1: [], col2: [], col3: [],
  }];
  assert.deepEqual(toBlocks(toPuck(deep)), deep);
});

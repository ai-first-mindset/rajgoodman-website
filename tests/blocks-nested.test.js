// Nested layout: Columns holding bare elements must round-trip through the Puck
// adapter losslessly and render recursively server-side. Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBlocks } from '../api/_blocks.js';
import { parse, serialize } from '../builder/core/document.js';

const nested = [
  {
    type: 'columns', id: 'c1', cols: 2,
    col0: [{ type: 'el-heading', id: 'h1', text: 'Left', level: 2 }],
    col1: [{ type: 'el-button', id: 'b1', label: 'Go', url: '/x', style: 'y' }],
    col2: [], col3: [],
  },
];

test('a Columns block migrates its column slots to Column children', () => {
  const { doc } = parse(nested);
  const columns = doc.root.children[0];
  assert.deepEqual(columns.children.map((c) => c.type), ['column', 'column']);
  assert.deepEqual(columns.children.map((c) => c.children[0].type), ['el-heading', 'el-button']);
  assert.deepEqual(parse(serialize(doc)).doc, doc);
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
  const { doc } = parse(deep);
  const inner = doc.root.children[0].children[0].children[0];
  assert.equal(inner.type, 'columns');
  assert.equal(inner.children[0].children[0].props.html, '<p>hi</p>');
  assert.deepEqual(parse(serialize(doc)).doc, doc);
});

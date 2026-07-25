// Phase 1: Container element (single-column section slot) + token-driven design
// controls (the .pb-wrap wrapper). Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBlock, renderBlocks } from '../api/_blocks.js';
import { toPuck, toBlocks } from '../tools/pages-builder/src/adapter.js';

test('container renders a section wrapping its child blocks', () => {
  const html = renderBlocks([{ type: 'container', id: 'c', content: [{ type: 'el-heading', id: 'h', text: 'Hi', level: 2 }] }]);
  assert.match(html, /<section class="sec tight">/);
  assert.match(html, /<h2 data-reveal>Hi<\/h2>/);
});

test('container round-trips through the adapter (content slot)', () => {
  const b = [{ type: 'container', id: 'c', content: [{ type: 'el-text', id: 't', html: '<p>x</p>' }] }];
  assert.deepEqual(toBlocks(toPuck(b)), b);
});

test('design controls wrap a block in token classes; absent design leaves it unchanged', () => {
  const withD = renderBlock({ type: 'el-button', id: 'b', label: 'Go', url: '/x', style: 'y', d: { space: 'md', align: 'c', bg: 'panel' } });
  assert.match(withD, /^<div class="pb-wrap pb-mt-md pb-al-c pb-bg-panel">/);
  assert.match(withD, /<\/div>$/);
  const noD = renderBlock({ type: 'el-button', id: 'b', label: 'Go', url: '/x', style: 'y' });
  assert.doesNotMatch(noD, /pb-wrap/);
});

test('partial design only emits the classes set', () => {
  const html = renderBlock({ type: 'el-text', id: 't', html: '<p>x</p>', d: { space: 'lg' } });
  assert.match(html, /^<div class="pb-wrap pb-mt-lg">/);
});

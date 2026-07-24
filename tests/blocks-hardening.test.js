// Anti-fragility hardening: schema version, default-normalisation, no-silent-drop
// of unknown blocks, and the single shared sanitiser. Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBlock, normalizeBlocks, BLOCKS_SCHEMA_VERSION } from '../api/_blocks.js';
import { sanitizeHtml, sanitizeBlocks } from '../api/_sanitize.js';

test('block schema version is exposed for migrations', () => {
  assert.equal(typeof BLOCKS_SCHEMA_VERSION, 'number');
});

test('normalizeBlocks fills known-type defaults and preserves unknown blocks untouched', () => {
  const out = normalizeBlocks([
    { type: 'cta', id: 'c1', heading: 'Hi' },        // partial → defaults fill the rest
    { type: 'future-widget', id: 'x', foo: 'bar' },  // unknown → passed through verbatim
  ]);
  assert.equal(out[0].label, '');       // default filled
  assert.equal(out[0].url, '');         // default filled
  assert.equal(out[0].heading, 'Hi');   // provided value wins over default
  assert.deepEqual(out[1], { type: 'future-widget', id: 'x', foo: 'bar' });
});

test('render never silently drops an unrecognised block', () => {
  assert.equal(renderBlock({ type: 'z', html: '<b>x</b>' }), '<b>x</b>'); // payload preserved
  assert.match(renderBlock({ type: 'z' }), /unsupported-block:z/);        // inert marker, not ''
});

test('one shared sanitiser strips scripts/handlers in html and faq answers', () => {
  assert.doesNotMatch(sanitizeHtml('<p onclick="x()">hi</p><script>bad()</script>'), /onclick|<script/i);
  const out = sanitizeBlocks([{ type: 'faq', items: [{ question: 'q', answer_html: '<a onmouseover="x">a</a>' }] }]);
  assert.doesNotMatch(out[0].items[0].answer_html, /onmouseover/i);
});

// The cutover seams: SEO extraction and write-path sanitisation must behave
// identically for a v2 builder document and for the legacy blocks[] array,
// because the `pages.blocks` column can hold either.
// Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFaqItems, htmlFieldsByType } from '../builder/seo.js';
import { sanitizeBlocks, sanitizeHtml } from '../api/_sanitize.js';
import { parse, serialize } from '../builder/core/document.js';
import { renderPage } from '../api/_page-template.js';

const LEGACY_FAQ = [{
  type: 'faq', kicker: 'FAQs', heading: 'Q',
  items: [
    { question: 'First <em>question</em>?', answer_html: '<p>First answer.</p>', open: false },
    { question: 'Second?', answer_html: '<p>Second answer.</p>', open: true },
    { question: 'No answer', answer_html: '', open: false },
  ],
}];

test('FAQ extraction reads the legacy array and the v2 document identically', () => {
  const fromLegacy = extractFaqItems(LEGACY_FAQ);
  const fromDoc = extractFaqItems(serialize(parse(LEGACY_FAQ).doc));
  assert.deepEqual(fromLegacy, fromDoc);
  assert.deepEqual(fromLegacy, [
    { q: 'First question ?', a: 'First answer.' },
    { q: 'Second?', a: 'Second answer.' },
  ]);
});

test('FAQ extraction finds accordions nested inside layout elements', () => {
  const nested = [{ type: 'container', content: LEGACY_FAQ }];
  assert.equal(extractFaqItems(nested).length, 2);
});

test('the HTML field map is derived from the schemas, not hand-listed', () => {
  const map = htmlFieldsByType();
  assert.deepEqual(map['rich-text'], ['html']);
  assert.deepEqual(map['raw-html'], ['html']);
  assert.deepEqual(map['el-text'], ['html']);
  assert.deepEqual(map['el-split'], ['html']);
  assert.deepEqual(map['faq-item'], ['answer_html']);
  assert.equal(map['el-button'], undefined); // no html-controlled field
});

const NASTY = '<p>ok</p><script>steal()</script><img src=x onerror="bad()"><a href="javascript:bad()">x</a>';

test('sanitizeHtml strips scripts, handlers and javascript: URLs', () => {
  const clean = sanitizeHtml(NASTY);
  assert.doesNotMatch(clean, /<script/i);
  assert.doesNotMatch(clean, /onerror/i);
  assert.doesNotMatch(clean, /javascript:/i);
  assert.match(clean, /<p>ok<\/p>/);
});

test('a v2 document is sanitised through every html-controlled field, at any depth', () => {
  const { doc } = parse([
    { type: 'rich-text', html: NASTY },
    { type: 'container', content: [{ type: 'el-text', html: NASTY }] },
    { type: 'faq', items: [{ question: 'q', answer_html: NASTY, open: true }] },
    { type: 'el-split', src: '/x.png', heading: 'h', html: NASTY },
  ]);
  const clean = sanitizeBlocks(serialize(doc));
  const json = JSON.stringify(clean);
  assert.doesNotMatch(json, /<script/i);
  assert.doesNotMatch(json, /onerror/i);
  assert.doesNotMatch(json, /javascript:/i);
  assert.equal((json.match(/<p>ok<\/p>/g) || []).length, 4, 'safe markup survives in all four');
  // Shape is preserved exactly.
  assert.deepEqual(
    clean.root.children.map((c) => c.type),
    ['rich-text', 'container', 'faq', 'el-split'],
  );
});

test('the legacy array path is still sanitised, including inside layout slots', () => {
  const clean = sanitizeBlocks([
    { type: 'rich-text', html: NASTY },
    { type: 'faq', items: [{ question: 'q', answer_html: NASTY }] },
    { type: 'container', content: [{ type: 'el-text', html: NASTY }] },
    { type: 'columns', cols: 2, col0: [{ type: 'raw-html', html: NASTY }], col1: [], col2: [], col3: [] },
  ]);
  const json = JSON.stringify(clean);
  assert.doesNotMatch(json, /<script/i);
  assert.doesNotMatch(json, /onerror/i);
  assert.equal((json.match(/<p>ok<\/p>/g) || []).length, 4);
});

test('sanitisation never drops unknown shapes or unknown element types', () => {
  assert.equal(sanitizeBlocks(null), null);
  assert.equal(sanitizeBlocks('nope'), 'nope');
  const future = {
    version: 99,
    root: { id: 'r', type: 'page-root', props: {}, children: [
      { id: 'x', type: 'timeline', props: { html: NASTY, keep: 'me' }, children: [] },
    ] },
  };
  const clean = sanitizeBlocks(future);
  assert.equal(clean.root.children[0].props.keep, 'me');
  assert.doesNotMatch(clean.root.children[0].props.html, /<script/i);
});

test('the page template renders a v2 document, with FAQ structured data', () => {
  const page = {
    slug: 'demo', title: 'Demo', meta_description: 'd',
    blocks: serialize(parse(LEGACY_FAQ).doc),
  };
  const html = renderPage(page);
  assert.match(html, /<details open><summary>Second\?/);
  assert.match(html, /"@type":"FAQPage"/);
  assert.match(html, /First answer\./);
});

test('the page template still renders the legacy array byte-for-byte the same', () => {
  const base = { slug: 'demo', title: 'Demo', meta_description: 'd' };
  const fromLegacy = renderPage({ ...base, blocks: LEGACY_FAQ });
  const fromDoc = renderPage({ ...base, blocks: serialize(parse(LEGACY_FAQ).doc) });
  assert.equal(fromLegacy, fromDoc);
});

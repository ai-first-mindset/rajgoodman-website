// The cutover seams: SEO extraction and write-path sanitisation must behave
// identically for a v2 builder document and for the legacy blocks[] array,
// because the `pages.blocks` column can hold either.
// Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFaqItems, htmlFieldsByType } from '../builder/seo.js';
import { sanitizeBlocks, sanitizeHtml } from '../api/_sanitize.js';
import { parse, serialize } from '../builder/core/document.js';
import { renderPageBlocks } from '../builder/index.js';
import { renderPage } from '../api/_page-template.js';

const renderPageBlocksFor = (stored, page) => renderPageBlocks(stored, { page });

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

/* ---- bindings must never become markup ----
   Write-time sanitisation only sees literal strings, so a prop holding a
   Binding passes through it untouched. Without escaping at render, the resolved
   value (or its author-supplied fallback) would be injected raw into an
   html-controlled field: stored XSS straight past the sanitiser. */

function boundDoc(fieldValue, type = 'rich-text', field = 'html') {
  const { doc } = parse([{ type, [field]: '' }]);
  const stored = serialize(doc);
  stored.root.children[0].props[field] = fieldValue;
  return stored;
}

test('a binding resolved into an html field is escaped, not injected', () => {
  const stored = sanitizeBlocks(boundDoc({ $bind: 'page.title' }));
  const html = renderPage({ slug: 'x', title: 'T', blocks: stored, meta_description: '' });
  const rendered = renderPageBlocksFor(stored, { title: '<script>alert(1)</script>' });
  assert.doesNotMatch(rendered, /<script>alert\(1\)<\/script>/);
  assert.match(rendered, /&lt;script&gt;/);
  assert.ok(html.length > 0);
});

test('a binding FALLBACK cannot smuggle markup either', () => {
  const stored = sanitizeBlocks(boundDoc({ $bind: 'page.nothing', fallback: '<img src=x onerror=alert(1)>' }));
  const rendered = renderPageBlocksFor(stored, {});
  assert.doesNotMatch(rendered, /<img/);
  assert.match(rendered, /&lt;img/);
});

test('bindings are escaped in every html-controlled field, not just rich-text', () => {
  for (const [type, field] of [['el-text', 'html'], ['raw-html', 'html'], ['el-split', 'html']]) {
    const stored = sanitizeBlocks(boundDoc({ $bind: 'page.title' }, type, field));
    const rendered = renderPageBlocksFor(stored, { title: '<script>alert(1)</script>' });
    assert.doesNotMatch(rendered, /<script>/, `${type}.${field} injected raw markup`);
  }
});

test('a literal html field is still rendered as markup (the fix is binding-only)', () => {
  const rendered = renderPageBlocksFor([{ type: 'rich-text', html: '<p><strong>bold</strong></p>' }], {});
  assert.match(rendered, /<strong>bold<\/strong>/);
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

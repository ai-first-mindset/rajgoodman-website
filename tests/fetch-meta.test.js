// Tests for the og:title extraction used by the LinkedIn manager's "Fetch title".
// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractTitle, decode } from '../api/admin/fetch-meta.js';

test('strips the "| Author | N comments" LinkedIn suffix', () => {
  const html = '<meta property="og:title" content="5 People Who Prove You Need an AI Readiness Assessment | Raj Goodman Anand | 14 comments">';
  assert.equal(extractTitle(html), '5 People Who Prove You Need an AI Readiness Assessment');
});

test('decodes HTML entities in the title', () => {
  const html = '<meta property="og:title" content="AI &amp; Leadership: Raj&#39;s take">';
  assert.equal(extractTitle(html), "AI & Leadership: Raj's take");
});

test('handles content-before-property attribute order', () => {
  const html = '<meta content="Hello world | Author" property="og:title" />';
  assert.equal(extractTitle(html), 'Hello world');
});

test('returns empty string when there is no og:title', () => {
  assert.equal(extractTitle('<html><head><title>x</title></head></html>'), '');
});

test('is null-safe on empty/undefined input', () => {
  assert.equal(extractTitle(''), '');
  assert.equal(extractTitle(undefined), '');
});

test('decode handles numeric and named entities', () => {
  assert.equal(decode('a &amp; b &#39;c&#39; &hellip;'), "a & b 'c' …");
});

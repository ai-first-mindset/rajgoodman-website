// Author-bio block on published posts (Arif SEO P3): rendered for Raj-authored
// posts, absent otherwise, and mirrored as Person.description in the JSON-LD.
// Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPost } from '../api/_post-template.js';

const base = {
  slug: 'test-post',
  title: 'Test Post',
  body_html: '<p>Hello</p>',
  published_at: '2026-07-01T00:00:00Z',
};

test('Raj-authored post renders the author-bio block', () => {
  const html = renderPost({ ...base, author: 'Raj Goodman Anand' });
  assert.match(html, /class="author-bio"/);
  assert.match(html, /More about Raj/);
  assert.match(html, /href="\/about\/"/);
  assert.match(html, /linkedin\.com\/in\/rajanand/);
});

test('byline "Raj Goodman" (no Anand) also gets the bio block', () => {
  const html = renderPost({ ...base, author: 'Raj Goodman' });
  assert.match(html, /class="author-bio"/);
});

test('non-Raj author gets no bio block', () => {
  const html = renderPost({ ...base, author: 'Guest Writer' });
  assert.doesNotMatch(html, /class="author-bio"/);
});

test('Person JSON-LD carries the bio as description', () => {
  const html = renderPost({ ...base, author: 'Raj Goodman Anand' });
  const m = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
  assert.ok(m, 'JSON-LD script tag present');
  const person = JSON.parse(m[1])['@graph'].find((n) => n['@type'] === 'Person');
  assert.match(person.description, /AI futurist/);
});

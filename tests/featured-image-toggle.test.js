// Per-post option to hide the featured image at the top of the article.
// It is an option rather than switched off everywhere: many posts imported
// from WordPress use the featured image as their only image. Hiding it only
// affects the article page; it stays the social-share image.
// Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPost } from '../api/_post-template.js';

const IMG = 'https://cdn.example/feature.webp';
const base = { slug: 's', title: 'T', excerpt: 'E', body_html: '<p>Body</p>', author: 'A',
  published_at: '2026-07-01T00:00:00Z', featured_image: IMG, featured_image_alt: 'Alt' };
const imgTags = (html) => (html.match(new RegExp(`<img src="${IMG.replace(/\./g, '\\.')}"`, 'g')) || []).length;

test('the featured image shows at the top by default (existing posts unchanged)', () => {
  assert.equal(imgTags(renderPost(base)), 1);
  assert.equal(imgTags(renderPost({ ...base, show_featured_image: true })), 1);
});

test('show_featured_image: false hides it from the article', () => {
  assert.equal(imgTags(renderPost({ ...base, show_featured_image: false })), 0);
});

test('a hidden featured image is still the social-share image', () => {
  const html = renderPost({ ...base, show_featured_image: false });
  assert.match(html, new RegExp(`<meta property="og:image" content="${IMG.replace(/\./g, '\\.')}"`));
});

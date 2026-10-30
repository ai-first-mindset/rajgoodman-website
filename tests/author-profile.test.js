// Post byline + "Written by" box read the author profile (Admin > Authors),
// falling back to the built-in bio when no profile loads.
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPost } from '../api/_post-template.js';
import { authorRow } from '../api/admin/authors.js';

const post = { slug: 'p', title: 'T', author: 'Raj Goodman Anand', body_html: '<p>x</p>', published_at: '2026-10-01T00:00:00Z' };
const profile = { slug: 'raj-goodman-anand', name: 'Raj Goodman Anand', title: 'AI Futurist, Keynote Speaker & Founder', bio: 'Profile bio text.', image_url: 'https://x.test/raj.webp', linkedin_url: 'https://www.linkedin.com/in/rajanand/' };

test('author box and schema use the profile when present', () => {
  const html = renderPost(post, [], profile);
  assert.match(html, /Written by[\s\S]*Profile bio text\./);
  assert.match(html, /src="https:\/\/x\.test\/raj\.webp"/);
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.ok(JSON.stringify(ld).includes('Profile bio text.'));
});

test('without a profile the built-in bio still renders', () => {
  const html = renderPost(post, [], null);
  assert.match(html, /class="author-bio"/);
  assert.match(html, /founder of AI-First Mindset/);
});

test('author rows derive the slug from the name', () => {
  assert.equal(authorRow({ name: 'Raj Goodman Anand' }).slug, 'raj-goodman-anand');
});

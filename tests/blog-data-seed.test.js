// Tests for _blog-data.js in UNCONFIGURED mode (no Supabase env): the in-repo
// SEED post must let the whole render path work before/without a database,
// and nothing may attempt a network call. Also covers catSlug edge cases.
// Runs in its own process (node:test per-file isolation), so deleting the env
// here cannot leak into other test files.
// Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SECRET_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
const data = await import('../api/_blog-data.js');

globalThis.fetch = async () => { throw new Error('seed mode must never touch the network'); };

test('dataSource reports seed when Supabase is not configured', () => {
  assert.equal(data.dataSource, 'seed');
});

test('getPostBySlug serves the published seed post, unknown slugs are null', async () => {
  const post = await data.getPostBySlug('sample-ai-post');
  assert.equal(post.status, 'published');
  assert.match(post.title, /Sample Post/);
  assert.equal(await data.getPostBySlug('nope'), null);
});

test('any-status lookup and prev-slug redirect behave in seed mode', async () => {
  assert.ok(await data.getPostBySlugAnyStatus('sample-ai-post'));
  assert.equal(await data.getPublishedByPrevSlug('anything'), null); // no redirects without a DB
});

test('listPublished returns only published seed posts', async () => {
  const posts = await data.listPublished();
  assert.ok(posts.length >= 1);
  assert.ok(posts.every((p) => p.status === 'published'));
});

test('category helpers work over the seed set without crashing', async () => {
  assert.deepEqual(await data.getAllCategories(), []); // seed post has no categories
  assert.deepEqual(await data.listByCategory('ai-strategy'), []);
});

test('PRODUCTION with missing Supabase env refuses to serve seed content (loud 5xx, not a silent masquerade)', async (t) => {
  process.env.VERCEL_ENV = 'production';
  t.after(() => { delete process.env.VERCEL_ENV; });
  await assert.rejects(() => data.listPublished(), /CONFIG ERROR/);
  await assert.rejects(() => data.getPostBySlug('sample-ai-post'), /CONFIG ERROR/);
  await assert.rejects(() => data.getPublishedByPrevSlug('x'), /CONFIG ERROR/);
});

test('preview/dev environments still get the seed fallback', async (t) => {
  process.env.VERCEL_ENV = 'preview';
  t.after(() => { delete process.env.VERCEL_ENV; });
  assert.ok(await data.getPostBySlug('sample-ai-post'));
});

test('catSlug: lowercases, collapses punctuation, trims dashes, survives junk', () => {
  assert.equal(data.catSlug('AI Strategy'), 'ai-strategy');
  assert.equal(data.catSlug('  Ethics & Trust!  '), 'ethics-trust');
  assert.equal(data.catSlug('--Already--Sluggy--'), 'already-sluggy');
  assert.equal(data.catSlug(null), '');
  assert.equal(data.catSlug('***'), '');
});

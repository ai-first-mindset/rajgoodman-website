// Smoke tests for the SSR route handlers (render-post, blog-index,
// render-category) against a stubbed Supabase: status codes, cache headers,
// prev-slug 301s, admin draft preview (noindex + no-store), and the honest
// empty/error states that must never get pinned to the edge cache.
// Run: node --test 'tests/**/*.test.js'
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://sb.test';
process.env.SUPABASE_SECRET_KEY = 'sb-secret';
const { default: renderPostHandler } = await import('../api/render-post.js');
const { default: blogIndexHandler } = await import('../api/blog-index.js');
const { default: renderCategoryHandler } = await import('../api/render-category.js');

const PUBLISHED = {
  slug: 'live-post', title: 'A Live Post', body_html: '<p>body</p>', status: 'published',
  author: 'Raj Goodman Anand', published_at: '2026-06-01T00:00:00Z', categories: ['AI Strategy'],
  excerpt: 'An excerpt', featured_image: null,
};
const DRAFT = { ...PUBLISHED, slug: 'secret-draft', title: 'A Secret Draft', status: 'draft' };

function makeRes() {
  const res = { statusCode: 200, body: null, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.send = (b) => { res.body = b; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.end = () => res;
  return res;
}
const reqFor = (url, cookie = '') => ({ method: 'GET', url, headers: { cookie, host: 'x' }, socket: {} });

const realFetch = globalThis.fetch;
let db;
beforeEach(() => {
  db = { published: [PUBLISHED], any: [PUBLISHED, DRAFT], moved: [], authed: false, throwOnRest: false };
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u.includes('/auth/v1/user')) {
      return { ok: db.authed, json: async () => ({ id: 'u1', app_metadata: { role: 'admin' } }) };
    }
    if (u.includes('/rest/v1/posts')) {
      if (db.throwOnRest) return { ok: false, status: 500, text: async () => 'db down' };
      const one = (rows) => ({ ok: true, json: async () => rows });
      if (u.includes('prev_slugs=cs.')) return one(db.moved);
      const slugMatch = u.match(/slug=eq\.([^&]+)/);
      if (slugMatch) {
        const s = decodeURIComponent(slugMatch[1]);
        const pool = u.includes('status=eq.published') ? db.published : db.any;
        return one(pool.filter((p) => p.slug === s));
      }
      if (u.includes('status=eq.published')) return one(db.published);
      return one([]);
    }
    throw new Error('unexpected fetch ' + u);
  };
});
afterEach(() => { globalThis.fetch = realFetch; });

/* ---- render-post ---- */
test('published slug -> 200 with edge caching and the rendered article', async () => {
  const res = makeRes();
  await renderPostHandler(reqFor('/api/render-post?slug=live-post'), res);
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /<h1[^>]*>A Live Post<\/h1>/);
  assert.match(res.headers['Cache-Control'], /s-maxage=300, stale-while-revalidate/);
});

test('missing slug -> themed 404, short cache', async () => {
  const res = makeRes();
  await renderPostHandler(reqFor('/api/render-post'), res);
  assert.equal(res.statusCode, 404);
  assert.match(res.body, /Article not found/);
  assert.equal(res.headers['Cache-Control'], 'public, s-maxage=60');
});

test('unknown slug (no redirect match) -> 404, never a crash', async () => {
  const res = makeRes();
  await renderPostHandler(reqFor('/api/render-post?slug=nope'), res);
  assert.equal(res.statusCode, 404);
  assert.match(res.body, /Article not found/);
});

test('renamed post: old slug 301s to the current URL', async () => {
  db.moved = [{ slug: 'live-post' }];
  const res = makeRes();
  await renderPostHandler(reqFor('/api/render-post?slug=the-old-slug'), res);
  assert.equal(res.statusCode, 301);
  assert.equal(res.headers.Location, '/blog/live-post/');
});

test('draft is invisible to the public but previewable when authed (noindex + no-store)', async () => {
  let res = makeRes();
  await renderPostHandler(reqFor('/api/render-post?slug=secret-draft'), res);
  assert.equal(res.statusCode, 404);

  db.authed = true;
  res = makeRes();
  await renderPostHandler(reqFor('/api/render-post?slug=secret-draft', 'sb_at=tok'), res);
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /A Secret Draft/);
  assert.match(res.body, /noindex, nofollow/);
  assert.equal(res.headers['Cache-Control'], 'no-store');
});

test('DB failure -> 500 and no-store (error page must not be cached)', async () => {
  db.throwOnRest = true;
  const res = makeRes();
  await renderPostHandler(reqFor('/api/render-post?slug=live-post'), res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.headers['Cache-Control'], 'no-store');
});

/* ---- blog index ---- */
test('index: 200 with article card, category chips, edge caching', async () => {
  const res = makeRes();
  await blogIndexHandler(reqFor('/api/blog-index'), res);
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /href="\/blog\/live-post\/"/);
  assert.match(res.body, /href="\/blog\/category\/ai-strategy\/"/);
  assert.match(res.headers['Cache-Control'], /s-maxage=300/);
});

test('index: zero posts -> honest empty state, still 200', async () => {
  db.published = [];
  const res = makeRes();
  await blogIndexHandler(reqFor('/api/blog-index'), res);
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /No articles published yet/);
});

test('index: DB failure -> 503 + no-store so the outage is not cached or indexed', async () => {
  db.throwOnRest = true;
  const res = makeRes();
  await blogIndexHandler(reqFor('/api/blog-index'), res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.match(res.body, /temporarily unavailable/);
});

/* ---- category archive ---- */
test('category with posts -> 200, display name resolved from the stored names', async () => {
  const res = makeRes();
  await renderCategoryHandler(reqFor('/api/render-category?slug=ai-strategy'), res);
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /<h1>AI Strategy<\/h1>/);
  assert.match(res.body, /href="\/blog\/live-post\/"/);
});

test('empty category -> themed 404 archive with honest copy, not the post-404', async () => {
  const res = makeRes();
  await renderCategoryHandler(reqFor('/api/render-category?slug=quantum-baking'), res);
  assert.equal(res.statusCode, 404);
  assert.match(res.body, /<h1>Quantum Baking<\/h1>/);
  assert.match(res.body, /No articles in this category yet/);
  assert.doesNotMatch(res.body, /Article not found/);
});

test('category: DB failure -> 500 + no-store', async () => {
  db.throwOnRest = true;
  const res = makeRes();
  await renderCategoryHandler(reqFor('/api/render-category?slug=ai-strategy'), res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.headers['Cache-Control'], 'no-store');
});

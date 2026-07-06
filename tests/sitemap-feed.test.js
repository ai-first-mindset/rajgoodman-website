// Tests for the Yoast-parity XML sitemaps (index/pages/posts/categories) and
// the RSS feed handler wrapper: content types, cache headers, and the
// error paths that must stay valid XML and never get edge-cached.
// Run: node --test 'tests/**/*.test.js'
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://sb.test';
process.env.SUPABASE_SECRET_KEY = 'sb-secret';
const { default: sitemap } = await import('../api/sitemap.js');
const { default: feed } = await import('../api/feed.js');

const POSTS = [
  { slug: 'newer', title: 'Newer & Better', excerpt: 'Ex <1>', categories: ['AI Strategy'],
    published_at: '2026-06-01T08:00:00Z', modified_at: '2026-06-15T09:00:00Z' },
  { slug: 'older', title: 'Older', categories: [], published_at: '2026-01-02T00:00:00Z' },
];

function makeRes() {
  const res = { statusCode: 0, body: null, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.send = (b) => { res.body = b; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return res;
}
const reqFor = (url) => ({ method: 'GET', url, headers: {}, socket: {} });

const realFetch = globalThis.fetch;
let dbFail;
beforeEach(() => {
  dbFail = false;
  globalThis.fetch = async (url) => {
    if (dbFail) return { ok: false, status: 500, text: async () => 'down' };
    if (String(url).includes('status=eq.published')) return { ok: true, json: async () => POSTS };
    return { ok: true, json: async () => [] };
  };
});
afterEach(() => { globalThis.fetch = realFetch; });

/* ---- sitemaps ---- */
test('index (no kind): valid sitemapindex linking the three sub-sitemaps', async () => {
  const res = makeRes();
  await sitemap(reqFor('/api/sitemap'), res);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['Content-Type'], /application\/xml/);
  assert.match(res.body, /<sitemapindex /);
  for (const sub of ['post-sitemap.xml', 'page-sitemap.xml', 'category-sitemap.xml']) {
    assert.ok(res.body.includes(`https://rajgoodman.com/${sub}`), sub);
  }
});

test('pages: static canonical URLs including privacy policy, edge-cached', async () => {
  const res = makeRes();
  await sitemap(reqFor('/api/sitemap?kind=pages'), res);
  assert.match(res.body, /<urlset /);
  assert.ok(res.body.includes('https://rajgoodman.com/privacy-policy/'));
  assert.match(res.headers['Cache-Control'], /s-maxage=600/);
});

test('posts: /blog/{slug}/ URLs with lastmod preferring modified_at', async () => {
  const res = makeRes();
  await sitemap(reqFor('/api/sitemap?kind=posts'), res);
  assert.ok(res.body.includes('<loc>https://rajgoodman.com/blog/newer/</loc><lastmod>2026-06-15</lastmod>'));
  assert.ok(res.body.includes('<loc>https://rajgoodman.com/blog/older/</loc><lastmod>2026-01-02</lastmod>'));
});

test('categories: archive URLs derived from post categories', async () => {
  const res = makeRes();
  await sitemap(reqFor('/api/sitemap?kind=categories'), res);
  assert.ok(res.body.includes('https://rajgoodman.com/blog/category/ai-strategy/'));
});

test('DB failure: 500 but still a valid empty urlset document', async () => {
  dbFail = true;
  const res = makeRes();
  await sitemap(reqFor('/api/sitemap?kind=posts'), res);
  assert.equal(res.statusCode, 500);
  assert.match(res.body, /<urlset [^>]+>\s*<\/urlset>/);
});

/* ---- feed handler wrapper (rss() itself is covered by parity-surfaces) ---- */
test('feed: 200 RSS with items, correct content type, edge-cached', async () => {
  const res = makeRes();
  await feed(reqFor('/feed/'), res);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['Content-Type'], /application\/rss\+xml/);
  assert.match(res.headers['Cache-Control'], /s-maxage=600/);
  assert.ok(res.body.includes('<title>Newer &amp; Better</title>'));
  assert.ok(res.body.includes('<guid isPermaLink="true">https://rajgoodman.com/blog/newer/</guid>'));
});

test('feed: DB failure -> 503 no-store, body is still a valid empty feed', async () => {
  dbFail = true;
  const res = makeRes();
  await feed(reqFor('/feed/'), res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.match(res.body, /<rss version="2.0"/);
  assert.doesNotMatch(res.body, /<item>/);
});

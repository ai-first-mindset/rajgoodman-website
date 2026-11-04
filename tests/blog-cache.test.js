// Blog CDN cache: every blog-derived page carries the 'blog' cache tag, and
// every admin write deletes that tag so the edit shows on the live site at
// once. Before this, edits took up to five minutes (s-maxage=300) to appear.
// Run: node --test 'tests/**/*.test.js'
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.SUPABASE_URL = 'https://sb.test';
process.env.SUPABASE_SECRET_KEY = 'sb-secret';
const { BLOG_TAG, tagBlog, purgeBlog } = await import('../api/_cache.js');
const { default: posts } = await import('../api/admin/posts.js');
const { default: authors } = await import('../api/admin/authors.js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CTX = Symbol.for('@vercel/request-context');

function makeRes() {
  const res = { statusCode: 0, body: null, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return res;
}
const req = (method, body) => ({ method, body, url: '/api/admin/x', headers: { cookie: 'sb_at=good-token', host: 'x' }, socket: {}, query: {} });

const realFetch = globalThis.fetch;
let purged, restOk, purgeThrows;
beforeEach(() => {
  purged = []; restOk = true; purgeThrows = false;
  globalThis[CTX] = { get: () => ({ purge: { dangerouslyDeleteByTag: async (tag) => {
    if (purgeThrows) throw new Error('purge down');
    purged.push(tag);
  } } }) };
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u.includes('/auth/v1/user')) {
      return { ok: true, json: async () => ({ id: 'u1', email: 'e@x.io', app_metadata: { role: 'editor' } }) };
    }
    if (u.includes('select=published_at,slug,prev_slugs')) return { ok: true, json: async () => [{ published_at: null, slug: 's', prev_slugs: [] }] };
    return { ok: restOk, status: restOk ? 200 : 500, text: async () => 'no', json: async () => [{ id: 'p1' }] };
  };
});
afterEach(() => { globalThis.fetch = realFetch; delete globalThis[CTX]; });

test('tagBlog sets the Vercel-Cache-Tag header', () => {
  const res = makeRes();
  tagBlog(res);
  assert.equal(res.headers['Vercel-Cache-Tag'], BLOG_TAG);
});

test('purgeBlog is a no-op outside Vercel (no request context)', async () => {
  delete globalThis[CTX];
  assert.equal(await purgeBlog(), false);
});

for (const [name, method, body, status] of [
  ['create', 'POST', { title: 'T', slug: 's' }, 201],
  ['update', 'PATCH', { id: 'p1', title: 'T' }, 200],
  ['delete', 'DELETE', { id: 'p1' }, 200],
]) {
  test(`post ${name} purges the blog cache tag`, async () => {
    const res = makeRes();
    await posts(req(method, body), res);
    assert.equal(res.statusCode, status);
    assert.deepEqual(purged, [BLOG_TAG]);
  });
}

test('a failed post write does not purge', async () => {
  restOk = false;
  const res = makeRes();
  await posts(req('PATCH', { id: 'p1', title: 'T' }), res);
  assert.equal(res.statusCode, 502);
  assert.deepEqual(purged, []);
});

test('a failed purge does not fail the save', async () => {
  purgeThrows = true;
  const res = makeRes();
  await posts(req('PATCH', { id: 'p1', title: 'T' }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
});

test('saving an author profile purges the blog cache tag', async () => {
  const res = makeRes();
  await authors(req('POST', { name: 'Raj Goodman Anand' }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(purged, [BLOG_TAG]);
});

test('every handler that reads the blog tags its response', () => {
  const dir = join(ROOT, 'api');
  const readers = readdirSync(dir)
    .filter((f) => f.endsWith('.js') && !f.startsWith('_'))
    .filter((f) => /from '\.\/_blog-data\.js'/.test(readFileSync(join(dir, f), 'utf8')));
  assert.ok(readers.length > 0);
  const untagged = readers.filter((f) => !/\n  tagBlog\(res\);/.test(readFileSync(join(dir, f), 'utf8')));
  assert.deepEqual(untagged, [], 'blog handlers whose pages would never be purged');
});

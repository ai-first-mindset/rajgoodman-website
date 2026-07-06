// Tests for the admin auth guards (_auth.js) and the posts CRUD endpoint
// (api/admin/posts.js) against a stubbed Supabase (GoTrue + PostgREST):
// 401 gate, cookie refresh, role guard, field allow-listing, HTML
// sanitisation, publish bookkeeping, and slug-history recording.
// Run: node --test 'tests/**/*.test.js'
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Both modules capture SUPABASE_* at import time — set env BEFORE importing.
process.env.SUPABASE_URL = 'https://sb.test';
process.env.SUPABASE_SECRET_KEY = 'sb-secret';
const { default: handler } = await import('../api/admin/posts.js');
const { requireAdmin, roleOf } = await import('../api/_auth.js');

function makeRes() {
  const res = { statusCode: 0, body: null, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return res;
}
const req = (method, { cookie = 'sb_at=good-token', body, url = '/api/admin/posts/' } = {}) =>
  ({ method, headers: { cookie, host: 'localhost:3000' }, body, url, socket: {} });

/* ---- Supabase stub: GoTrue auth + PostgREST posts table ---- */
const realFetch = globalThis.fetch;
let restCalls, userRole, currentRow, restFail, curLookupFail;
beforeEach(() => {
  restCalls = []; userRole = 'editor'; currentRow = null; restFail = false; curLookupFail = false;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u.includes('/auth/v1/user')) {
      const ok = (opts.headers.authorization || '') === 'Bearer good-token';
      return { ok, json: async () => ({ id: 'u1', app_metadata: { role: userRole } }) };
    }
    if (u.includes('/auth/v1/token')) {
      const ok = JSON.parse(opts.body).refresh_token === 'rt-good';
      return {
        ok,
        json: async () => ({ access_token: 'good-token', refresh_token: 'rt-next',
          user: { id: 'u1', app_metadata: { role: userRole } } }),
      };
    }
    if (u.includes('/rest/v1/posts')) {
      restCalls.push({ url: u, method: opts.method || 'GET', headers: opts.headers, body: opts.body && JSON.parse(opts.body) });
      if (restFail) return { ok: false, status: 500, json: async () => [], text: async () => 'db says no' };
      if (u.includes('select=published_at,slug,prev_slugs')) return { ok: !curLookupFail, json: async () => (currentRow ? [currentRow] : []) };
      return { ok: true, json: async () => [{ id: 'p1', echoed: true }], text: async () => '' };
    }
    throw new Error('unexpected fetch ' + u);
  };
});
afterEach(() => { globalThis.fetch = realFetch; });

/* ---- auth gate ---- */
test('no cookies -> 401, PostgREST never touched', async () => {
  const res = makeRes();
  await handler(req('GET', { cookie: '' }), res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'unauthorized');
  assert.equal(restCalls.length, 0);
});

test('garbage access token with no refresh token -> 401', async () => {
  const res = makeRes();
  await handler(req('GET', { cookie: 'sb_at=stale' }), res);
  assert.equal(res.statusCode, 401);
  assert.equal(restCalls.length, 0);
});

test('expired access token + valid refresh token -> refreshed, cookies re-set, request served', async () => {
  const res = makeRes();
  await handler(req('GET', { cookie: 'sb_at=stale; sb_rt=rt-good' }), res);
  assert.equal(res.statusCode, 200);
  const setCookie = res.headers['Set-Cookie'];
  assert.ok(Array.isArray(setCookie) && setCookie[0].startsWith('sb_at=good-token'), 'access cookie rotated');
  assert.ok(setCookie[1].startsWith('sb_rt=rt-next'), 'refresh cookie rotated');
  assert.ok(setCookie[0].includes('HttpOnly'), 'cookies stay httpOnly');
});

test('requireAdmin: editor role -> 403, admin passes', async () => {
  let res = makeRes();
  assert.equal(await requireAdmin(req('GET'), res), null);
  assert.equal(res.statusCode, 403);
  userRole = 'admin';
  res = makeRes();
  const u = await requireAdmin(req('GET'), res);
  assert.equal(roleOf(u), 'admin');
});

test('roleOf defaults to editor when metadata is absent', () => {
  assert.equal(roleOf({}), 'editor');
  assert.equal(roleOf(null), 'editor');
});

/* ---- CRUD contract ---- */
test('GET list: slim column selection ordered by modified_at', async () => {
  const res = makeRes();
  await handler(req('GET'), res);
  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.body.posts));
  assert.match(restCalls[0].url, /select=id,slug,title,status,categories,published_at,modified_at&order=modified_at\.desc/);
});

test('GET ?id: returns a single post (or null when missing)', async () => {
  const res = makeRes();
  await handler(req('GET', { url: '/api/admin/posts/?id=p1' }), res);
  assert.equal(res.body.posts.id, 'p1');
  assert.match(restCalls[0].url, /posts\?id=eq\.p1&limit=1/);
});

test('POST: title and slug are required', async () => {
  const res = makeRes();
  await handler(req('POST', { body: { title: 'No slug' } }), res);
  assert.equal(res.statusCode, 422);
  assert.equal(res.body.error, 'title-and-slug-required');
});

test('POST: only allow-listed fields reach the DB; script/handlers sanitised out', async () => {
  const res = makeRes();
  await handler(req('POST', { body: {
    title: 'T', slug: 't', id: 'attacker-set', evil: 'x',
    body_html: '<p onclick="pwn()">hi</p><script>pwn()</script><a href="javascript:pwn()">x</a>',
  } }), res);
  assert.equal(res.statusCode, 201);
  const row = restCalls[0].body;
  assert.equal(row.id, undefined);
  assert.equal(row.evil, undefined);
  assert.doesNotMatch(row.body_html, /<script|onclick|javascript:/);
  assert.match(row.body_html, /<p ?>hi<\/p>/);
});

test('PATCH: id required; first publish stamps published_at exactly once', async () => {
  let res = makeRes();
  await handler(req('PATCH', { body: { title: 'x' } }), res);
  assert.equal(res.body.error, 'id-required');

  // first publish: current row has no published_at -> stamped
  currentRow = { published_at: null, slug: 't', prev_slugs: [] };
  res = makeRes();
  await handler(req('PATCH', { body: { id: 'p1', status: 'published' } }), res);
  const patch1 = restCalls.find((c) => c.method === 'PATCH').body;
  assert.match(patch1.published_at, /^\d{4}-\d{2}-\d{2}T/);

  // re-publish: already has published_at -> untouched
  restCalls = [];
  currentRow = { published_at: '2026-01-01T00:00:00Z', slug: 't', prev_slugs: [] };
  res = makeRes();
  await handler(req('PATCH', { body: { id: 'p1', status: 'published' } }), res);
  const patch2 = restCalls.find((c) => c.method === 'PATCH').body;
  assert.equal(patch2.published_at, undefined);
});

test('PATCH: a failed bookkeeping lookup refuses the save instead of saving blind', async () => {
  curLookupFail = true;
  const res = makeRes();
  await handler(req('PATCH', { body: { id: 'p1', status: 'published' } }), res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.error, 'current-row-lookup-failed');
  assert.ok(!restCalls.some((c) => c.method === 'PATCH'), 'no blind update issued');
});

test('PATCH: slug change records the old slug in prev_slugs (no dupes, no self)', async () => {
  currentRow = { published_at: null, slug: 'old-slug', prev_slugs: ['ancient-slug'] };
  const res = makeRes();
  await handler(req('PATCH', { body: { id: 'p1', slug: 'new-slug' } }), res);
  const patch = restCalls.find((c) => c.method === 'PATCH').body;
  assert.deepEqual([...patch.prev_slugs].sort(), ['ancient-slug', 'old-slug']);
});

test('DELETE: id required, then deletes by id', async () => {
  let res = makeRes();
  await handler(req('DELETE', { body: {} }), res);
  assert.equal(res.body.error, 'id-required');
  res = makeRes();
  await handler(req('DELETE', { body: { id: 'p9' } }), res);
  assert.equal(res.statusCode, 200);
  assert.match(restCalls[0].url, /id=eq\.p9/);
  assert.equal(restCalls[0].method, 'DELETE');
});

test('unsupported method -> 405 with Allow header', async () => {
  const res = makeRes();
  await handler(req('PUT'), res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'GET, POST, PATCH, DELETE');
});

test('PostgREST failure -> 502 with the endpoint-specific error', async () => {
  restFail = true;
  const res = makeRes();
  await handler(req('POST', { body: { title: 'T', slug: 't' } }), res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.error, 'create-failed');
});

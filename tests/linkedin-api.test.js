// Tests for the public /api/linkedin endpoint that feeds the homepage widget.
// Run: node --test tests/
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// The module reads SUPABASE_* from process.env at import time, so set them first.
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-key';
const { default: handler } = await import('../api/linkedin.js');

function mockRes() {
  return {
    statusCode: 200, headers: {}, body: null,
    status(c) { this.statusCode = c; return this; },
    setHeader(k, v) { this.headers[k] = v; },
    json(o) { this.body = o; return this; },
  };
}

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

test('GET returns the visible posts from the database', async () => {
  let calledUrl = '';
  globalThis.fetch = async (u) => { calledUrl = String(u); return { ok: true, json: async () => [{ url: 'u', title: 't', image_url: 'i' }] }; };
  const res = mockRes();
  await handler({ method: 'GET' }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.posts.length, 1);
  // contract: only visible rows, ordered, capped at 4
  assert.match(calledUrl, /visible=eq\.true/);
  assert.match(calledUrl, /order=sort_order\.asc/);
  assert.match(calledUrl, /limit=4/);
});

test('non-GET methods are rejected with 405', async () => {
  const res = mockRes();
  await handler({ method: 'POST' }, res);
  assert.equal(res.statusCode, 405);
});

test('fails soft to an empty list when the database errors', async () => {
  globalThis.fetch = async () => ({ ok: false, text: async () => 'boom' });
  const res = mockRes();
  await handler({ method: 'GET' }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.posts, []);
});

test('fails soft when fetch throws', async () => {
  globalThis.fetch = async () => { throw new Error('network'); };
  const res = mockRes();
  await handler({ method: 'GET' }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.posts, []);
});

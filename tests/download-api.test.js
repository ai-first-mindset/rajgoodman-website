// Tests for the gated-download endpoint: the asset registry stays server-side,
// the human gate comes first, and lead-capture failure never blocks delivery.
// Run: node --test 'tests/**/*.test.js'
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import handler, { ASSETS } from '../api/download.js';

function makeRes() {
  const res = { statusCode: 0, body: null, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return res;
}
const post = (body) => ({ method: 'POST', body, headers: {}, socket: {} });

// fetch stub: first call is Turnstile siteverify, later calls are EmailOctopus.
const realFetch = globalThis.fetch;
let eoCalls;
function stubFetch({ human = true, eoFail = false } = {}) {
  eoCalls = [];
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('challenges.cloudflare.com')) {
      return { ok: true, json: async () => ({ success: human }) };
    }
    eoCalls.push({ url: String(url), body: JSON.parse(opts.body) });
    if (eoFail) return { ok: false, status: 500, json: async () => ({ error: { code: 'X' } }) };
    return { ok: true, json: async () => ({ status: 'PENDING' }) };
  };
}
beforeEach(() => {
  process.env.TURNSTILE_SECRET_KEY = 'test-secret';
  process.env.EMAILOCTOPUS_API_KEY = 'k';
  process.env.EMAILOCTOPUS_LIST_ID = 'l';
});
afterEach(() => { globalThis.fetch = realFetch; });

test('registry: every asset has a title and a downloads-bucket URL', () => {
  const keys = Object.keys(ASSETS);
  assert.ok(keys.length >= 3);
  for (const k of keys) {
    assert.ok(ASSETS[k].title.length > 5, k);
    assert.match(ASSETS[k].url, /\/storage\/v1\/object\/public\/downloads\/.+\.pdf$/, k);
  }
});

test('happy path: verified human gets the URL, lead lands in EO with the asset tag', async () => {
  stubFetch();
  const res = makeRes();
  await handler(post({ token: 't', name: 'Ada Lovelace', email: 'ada@example.com', asset: 'ebook-ai-era' }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.url, ASSETS['ebook-ai-era'].url);
  assert.equal(res.body.pending, true);
  assert.equal(eoCalls.length, 1);
  assert.deepEqual(eoCalls[0].body.tags, ['ebook-ai-era']);
  assert.equal(eoCalls[0].body.fields.FirstName, 'Ada');
  assert.equal(eoCalls[0].body.fields.LastName, 'Lovelace');
});

test('bot (turnstile fail) never reaches the registry or EO', async () => {
  stubFetch({ human: false });
  const res = makeRes();
  await handler(post({ token: 'bad', name: 'X', email: 'x@y.zz', asset: 'ebook-ai-era' }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'turnstile-failed');
  assert.equal(eoCalls.length, 0);
});

test('unknown asset -> 422, no lead stored', async () => {
  stubFetch();
  const res = makeRes();
  await handler(post({ token: 't', name: 'X', email: 'x@y.zz', asset: 'not-a-thing' }), res);
  assert.equal(res.statusCode, 422);
  assert.equal(res.body.error, 'unknown-asset');
  assert.equal(eoCalls.length, 0);
});

test('missing fields / invalid email -> 422', async () => {
  stubFetch();
  let res = makeRes();
  await handler(post({ token: 't', email: 'x@y.zz', asset: 'ebook-ai-era' }), res);
  assert.equal(res.body.error, 'missing-fields');
  res = makeRes();
  await handler(post({ token: 't', name: 'X', email: 'not-an-email', asset: 'ebook-ai-era' }), res);
  assert.equal(res.body.error, 'invalid-email');
});

test('EO failure is not fatal: download still delivered', async () => {
  stubFetch({ eoFail: true });
  const res = makeRes();
  await handler(post({ token: 't', name: 'X Y', email: 'x@y.zz', asset: 'ebook-building-trust' }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.url, ASSETS['ebook-building-trust'].url);
  assert.equal(res.body.pending, false);
});

test('non-POST -> 405', async () => {
  const res = makeRes();
  await handler({ method: 'GET', headers: {}, socket: {} }, res);
  assert.equal(res.statusCode, 405);
});

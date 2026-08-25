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

// fetch stub: Turnstile siteverify, EmailOctopus, and the resources mirror are
// routed apart so each sink can be asserted (and failed) independently.
const realFetch = globalThis.fetch;
let eoCalls;
let mirrorCalls;
function stubFetch({ human = true, eoFail = false, eoThrow = false, mirrorOk = true } = {}) {
  eoCalls = [];
  mirrorCalls = [];
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (u.includes('challenges.cloudflare.com')) {
      return { ok: true, json: async () => ({ success: human }) };
    }
    if (u.includes('newsletter-subscribe')) {
      mirrorCalls.push({ url: u, body: JSON.parse(opts.body) });
      if (!mirrorOk) return { ok: false, status: 500, json: async () => ({ ok: false, error: 'nope' }) };
      return { ok: true, json: async () => ({ ok: true, created: true, status: 'subscribed' }) };
    }
    if (eoThrow) throw new Error('boom');
    eoCalls.push({ url: u, body: JSON.parse(opts.body) });
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
  assert.ok(keys.length >= 5);
  for (const k of keys) {
    assert.ok(ASSETS[k].title.length > 5, k);
    assert.match(ASSETS[k].url, /\/storage\/v1\/object\/public\/downloads\/.+\.(pdf|mp3)$/, k);
  }
});

test('registry: audiobook keys map to mp3 files, ebook keys to pdf', () => {
  for (const k of Object.keys(ASSETS)) {
    if (k.startsWith('audiobook-')) assert.match(ASSETS[k].url, /\.mp3$/, k);
    else assert.match(ASSETS[k].url, /\.pdf$/, k);
  }
  assert.ok(ASSETS['audiobook-embracing-the-future']);
  assert.ok(ASSETS['audiobook-ai-era']);
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

test('audiobook happy path: URL delivered, lead tagged with the audiobook asset', async () => {
  stubFetch();
  const res = makeRes();
  await handler(post({ token: 't', name: 'Ada Lovelace', email: 'ada@example.com', asset: 'audiobook-ai-era' }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.url, ASSETS['audiobook-ai-era'].url);
  assert.deepEqual(eoCalls[0].body.tags, ['audiobook-ai-era']);
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

/* ---- dual-write: EmailOctopus + the AIFM resources platform ---- */

test('the download lead is mirrored to the resources platform as well as EO', async () => {
  stubFetch();
  process.env.AIFM_SUBSCRIBE_KEY = 'test-key';
  const res = makeRes();
  await handler(post({ token: 't', name: 'Ada Lovelace', email: 'ada@example.com', asset: 'ebook-ai-era' }), res);
  delete process.env.AIFM_SUBSCRIBE_KEY;
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.url, ASSETS['ebook-ai-era'].url, 'the file is still delivered');
  assert.equal(eoCalls.length, 1);
  assert.equal(mirrorCalls.length, 1);
  assert.equal(mirrorCalls[0].body.email, 'ada@example.com');
  assert.equal(mirrorCalls[0].body.first_name, 'Ada');
  assert.equal(mirrorCalls[0].body.last_name, 'Lovelace');
  // a book download is a different consent surface from a newsletter signup
  assert.equal(mirrorCalls[0].body.source, 'rajgoodman-ebook');
  assert.equal(mirrorCalls[0].body.secret, 'test-key');
  assert.deepEqual(res.body.sinks, { resources: true, emailoctopus: true });
});

test('a double opt-in EO signup is mirrored as pending, not subscribed', async () => {
  stubFetch();               // EO replies PENDING
  process.env.AIFM_SUBSCRIBE_KEY = 'test-key';
  const res = makeRes();
  await handler(post({ token: 't', name: 'Ada', email: 'ada@example.com', asset: 'ebook-ai-era' }), res);
  delete process.env.AIFM_SUBSCRIBE_KEY;
  assert.equal(mirrorCalls[0].body.status, 'pending', 'never claim subscribed before they confirm');
});

test('EmailOctopus down but mirror up -> file still delivered, lead still captured', async () => {
  stubFetch({ eoThrow: true });
  process.env.AIFM_SUBSCRIBE_KEY = 'test-key';
  const res = makeRes();
  await handler(post({ token: 't', name: 'Ada', email: 'ada@example.com', asset: 'ebook-ai-era' }), res);
  delete process.env.AIFM_SUBSCRIBE_KEY;
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.url);
  assert.deepEqual(res.body.sinks, { resources: true, emailoctopus: false });
});

test('mirror down but EmailOctopus up -> file still delivered', async () => {
  stubFetch({ mirrorOk: false });
  process.env.AIFM_SUBSCRIBE_KEY = 'test-key';
  const res = makeRes();
  await handler(post({ token: 't', name: 'Ada', email: 'ada@example.com', asset: 'ebook-ai-era' }), res);
  delete process.env.AIFM_SUBSCRIBE_KEY;
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.url);
  assert.deepEqual(res.body.sinks, { resources: false, emailoctopus: true });
});

test('with the mirror unconfigured the download is unchanged (no network call)', async () => {
  stubFetch();               // AIFM_SUBSCRIBE_KEY deliberately unset
  const res = makeRes();
  await handler(post({ token: 't', name: 'Ada', email: 'ada@example.com', asset: 'ebook-ai-era' }), res);
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.url);
  assert.equal(mirrorCalls.length, 0, 'no key, no call - keeps local runs and CI offline');
  assert.deepEqual(res.body.sinks, { resources: false, emailoctopus: true });
});

// Tests for the newsletter endpoint: Turnstile-first gating, the DUAL WRITE
// to the resources platform + EmailOctopus (success when either sink takes
// the address, failure only when both refuse), list setting decides double
// opt-in (PENDING surfaces to the form), member-exists treated as success.
// Run: node --test 'tests/**/*.test.js'
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/subscribe.js';

function makeRes() {
  const res = { statusCode: 0, body: null, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return res;
}
const post = (body) => ({ method: 'POST', body, headers: {}, socket: {} });

// fetch stub: Turnstile siteverify first, EmailOctopus after.
const realFetch = globalThis.fetch;
let eoCalls;
let mirrorCalls;
function stubFetch({ human = true, eoStatus = 'PENDING', eoHttpFail = false, eoErrorCode = null, eoThrow = false, mirrorOk = true } = {}) {
  eoCalls = [];
  mirrorCalls = [];
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('challenges.cloudflare.com')) {
      return { ok: true, json: async () => ({ success: human }) };
    }
    if (String(url).includes('newsletter-subscribe')) {
      mirrorCalls.push({ url: String(url), body: JSON.parse(opts.body) });
      if (!mirrorOk) return { ok: false, status: 502, json: async () => ({ ok: false, error: 'nope' }) };
      return { ok: true, json: async () => ({ ok: true, created: true, status: 'subscribed' }) };
    }
    if (eoThrow) throw new Error('boom');
    eoCalls.push({ url: String(url), body: JSON.parse(opts.body) });
    if (eoHttpFail || eoErrorCode) {
      return { ok: false, status: 409, json: async () => ({ error: { code: eoErrorCode || 'X' } }) };
    }
    return { ok: true, json: async () => ({ status: eoStatus }) };
  };
}
beforeEach(() => {
  process.env.TURNSTILE_SECRET_KEY = 'test-secret';
  process.env.EMAILOCTOPUS_API_KEY = 'k';
  process.env.EMAILOCTOPUS_LIST_ID = 'list-1';
});
afterEach(() => { globalThis.fetch = realFetch; });

test('happy path: contact stored with names, pending flag surfaces DOI', async () => {
  stubFetch();
  const res = makeRes();
  await handler(post({ token: 't', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.stored, true);
  assert.equal(res.body.pending, true);
  assert.equal(eoCalls.length, 1);
  assert.match(eoCalls[0].url, /lists\/list-1\/contacts$/);
  assert.equal(eoCalls[0].body.email_address, 'ada@example.com');
  assert.deepEqual(eoCalls[0].body.fields, { FirstName: 'Ada', LastName: 'Lovelace' });
  assert.equal(eoCalls[0].body.status, undefined); // list setting decides DOI
});

test('single opt-in list (no PENDING) -> pending:false', async () => {
  stubFetch({ eoStatus: 'SUBSCRIBED' });
  const res = makeRes();
  await handler(post({ token: 't', email: 'x@y.zz' }), res);
  assert.equal(res.body.pending, false);
});

test('bot (turnstile fail) -> 400, EO never called', async () => {
  stubFetch({ human: false });
  const res = makeRes();
  await handler(post({ token: 'bad', email: 'x@y.zz' }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'turnstile-failed');
  assert.equal(eoCalls.length, 0);
});

test('missing / invalid email -> 422', async () => {
  stubFetch();
  let res = makeRes();
  await handler(post({ token: 't' }), res);
  assert.equal(res.statusCode, 422);
  assert.equal(res.body.error, 'missing-fields');
  res = makeRes();
  await handler(post({ token: 't', email: 'nope' }), res);
  assert.equal(res.statusCode, 422);
  assert.equal(res.body.error, 'invalid-email');
});

test('already on the list (MEMBER_EXISTS) is success, not an error', async () => {
  stubFetch({ eoErrorCode: 'MEMBER_EXISTS_WITH_EMAIL_ADDRESS' });
  const res = makeRes();
  await handler(post({ token: 't', email: 'x@y.zz' }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
});

test('other EO API failure -> 502 subscribe-error', async () => {
  stubFetch({ eoHttpFail: true });
  const res = makeRes();
  await handler(post({ token: 't', email: 'x@y.zz' }), res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.error, 'subscribe-error');
});

test('EO network throw with no mirror -> 502, nothing stored', async () => {
  stubFetch({ eoThrow: true });
  const res = makeRes();
  await handler(post({ token: 't', email: 'x@y.zz' }), res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.error, 'subscribe-error');
  assert.equal(res.body.stored, false);
});

// The old contract answered 200 {ok:true, stored:false} here. The front end
// checks `r.ok && j.ok`, so it told the visitor "you're subscribed" while the
// address reached nobody. Failing is the honest answer.
test('unconfigured EO and no mirror -> 502, never a false success', async () => {
  stubFetch();
  delete process.env.EMAILOCTOPUS_API_KEY;
  const res = makeRes();
  await handler(post({ token: 't', email: 'x@y.zz' }), res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.stored, false);
});

// ---- dual write ----

test('mirror receives the signup alongside EmailOctopus', async () => {
  stubFetch();
  process.env.AIFM_SUBSCRIBE_KEY = 'test-key';
  const res = makeRes();
  await handler(post({ token: 't', firstName: 'Ada', lastName: 'L', email: 'ada@example.com' }), res);
  delete process.env.AIFM_SUBSCRIBE_KEY;
  assert.equal(res.statusCode, 200);
  assert.equal(mirrorCalls.length, 1);
  assert.equal(eoCalls.length, 1);
  assert.equal(mirrorCalls[0].body.email, 'ada@example.com');
  assert.equal(mirrorCalls[0].body.source, 'rajgoodman-newsletter');
  assert.equal(mirrorCalls[0].body.secret, 'test-key');
  assert.deepEqual(res.body.sinks, { resources: true, emailoctopus: true });
});

test('EmailOctopus down but mirror up -> signup still succeeds', async () => {
  stubFetch({ eoThrow: true });
  process.env.AIFM_SUBSCRIBE_KEY = 'test-key';
  const res = makeRes();
  await handler(post({ token: 't', email: 'x@y.zz' }), res);
  delete process.env.AIFM_SUBSCRIBE_KEY;
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.stored, true);
  assert.deepEqual(res.body.sinks, { resources: true, emailoctopus: false });
});

test('mirror down but EmailOctopus up -> signup still succeeds', async () => {
  stubFetch({ mirrorOk: false });
  process.env.AIFM_SUBSCRIBE_KEY = 'test-key';
  const res = makeRes();
  await handler(post({ token: 't', email: 'x@y.zz' }), res);
  delete process.env.AIFM_SUBSCRIBE_KEY;
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.stored, true);
  assert.deepEqual(res.body.sinks, { resources: false, emailoctopus: true });
});

test('both sinks down -> 502, no false success', async () => {
  stubFetch({ eoThrow: true, mirrorOk: false });
  process.env.AIFM_SUBSCRIBE_KEY = 'test-key';
  const res = makeRes();
  await handler(post({ token: 't', email: 'x@y.zz' }), res);
  delete process.env.AIFM_SUBSCRIBE_KEY;
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.ok, false);
});

test('bot never reaches either sink', async () => {
  stubFetch({ human: false });
  process.env.AIFM_SUBSCRIBE_KEY = 'test-key';
  const res = makeRes();
  await handler(post({ token: 'bad', email: 'x@y.zz' }), res);
  delete process.env.AIFM_SUBSCRIBE_KEY;
  assert.equal(res.statusCode, 400);
  assert.equal(mirrorCalls.length, 0);
  assert.equal(eoCalls.length, 0);
});

test('non-POST -> 405 with Allow header', async () => {
  const res = makeRes();
  await handler({ method: 'GET', headers: {}, socket: {} }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'POST');
});

// ---- double opt-in consent (found by testing production, 25 Aug) ----
// This list has DOI enabled, so EmailOctopus answers PENDING until the person
// clicks the confirmation. The platform must record the same, or we would mail
// somebody who never confirmed.

test('DOI pending in EmailOctopus mirrors as pending, not subscribed', async () => {
  stubFetch({ eoStatus: 'PENDING' });
  process.env.AIFM_SUBSCRIBE_KEY = 'test-key';
  const res = makeRes();
  await handler(post({ token: 't', email: 'x@y.zz' }), res);
  delete process.env.AIFM_SUBSCRIBE_KEY;
  assert.equal(mirrorCalls[0].body.status, 'pending');
  assert.equal(res.body.pending, true);
});

test('confirmed (SUBSCRIBED) mirrors as subscribed', async () => {
  stubFetch({ eoStatus: 'SUBSCRIBED' });
  process.env.AIFM_SUBSCRIBE_KEY = 'test-key';
  const res = makeRes();
  await handler(post({ token: 't', email: 'x@y.zz' }), res);
  delete process.env.AIFM_SUBSCRIBE_KEY;
  assert.equal(mirrorCalls[0].body.status, 'subscribed');
});

test('EmailOctopus unreachable falls back to pending on this DOI list', async () => {
  stubFetch({ eoThrow: true });
  process.env.AIFM_SUBSCRIBE_KEY = 'test-key';
  const res = makeRes();
  await handler(post({ token: 't', email: 'x@y.zz' }), res);
  delete process.env.AIFM_SUBSCRIBE_KEY;
  assert.equal(mirrorCalls[0].body.status, 'pending');
});

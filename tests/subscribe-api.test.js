// Tests for the newsletter endpoint: Turnstile-first gating, EmailOctopus
// list add (list setting decides double opt-in — PENDING surfaces to the form),
// member-exists treated as success, loud-but-graceful when unconfigured.
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
function stubFetch({ human = true, eoStatus = 'PENDING', eoHttpFail = false, eoErrorCode = null, eoThrow = false } = {}) {
  eoCalls = [];
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('challenges.cloudflare.com')) {
      return { ok: true, json: async () => ({ success: human }) };
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
  assert.deepEqual(res.body, { ok: true, stored: true, pending: true });
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

test('EO network throw -> 502 subscribe-unreachable', async () => {
  stubFetch({ eoThrow: true });
  const res = makeRes();
  await handler(post({ token: 't', email: 'x@y.zz' }), res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.error, 'subscribe-unreachable');
});

test('unconfigured EO: accepted but marked stored:false (loud-config contract)', async () => {
  stubFetch();
  delete process.env.EMAILOCTOPUS_API_KEY;
  const res = makeRes();
  await handler(post({ token: 't', email: 'x@y.zz' }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, stored: false });
});

test('non-POST -> 405 with Allow header', async () => {
  const res = makeRes();
  await handler({ method: 'GET', headers: {}, socket: {} }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'POST');
});

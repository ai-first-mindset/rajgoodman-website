// Tests for the contact endpoint: Turnstile-first gating, DealDesk forward
// with x-api-key (service folded into the message), graceful-but-loud
// acceptance when DealDesk isn't configured.
// Run: node --test 'tests/**/*.test.js'
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/contact.js';

function makeRes() {
  const res = { statusCode: 0, body: null, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return res;
}
const post = (body) => ({ method: 'POST', body, headers: {}, socket: {} });
const LEAD = { token: 't', name: 'Ada', email: 'ada@example.com', message: 'Hello', source_page: '/x' };

const realFetch = globalThis.fetch;
let ddCalls;
function stubFetch({ human = true, ddFail = false, ddThrow = false } = {}) {
  ddCalls = [];
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('challenges.cloudflare.com')) {
      return { ok: true, json: async () => ({ success: human }) };
    }
    if (ddThrow) throw new Error('boom');
    ddCalls.push({ url: String(url), headers: opts.headers, body: JSON.parse(opts.body) });
    if (ddFail) return { ok: false, status: 500, text: async () => 'nope' };
    return { ok: true };
  };
}
beforeEach(() => {
  process.env.TURNSTILE_SECRET_KEY = 'test-secret';
  process.env.DEALDESK_ENDPOINT = 'https://dealdesk.example.com/intake';
  process.env.DEALDESK_API_KEY = 'dd-key';
});
afterEach(() => { globalThis.fetch = realFetch; });

test('happy path: lead forwarded to DealDesk with x-api-key', async () => {
  stubFetch();
  const res = makeRes();
  await handler(post(LEAD), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, forwarded: true });
  assert.equal(ddCalls.length, 1);
  assert.equal(ddCalls[0].url, 'https://dealdesk.example.com/intake');
  assert.equal(ddCalls[0].headers['x-api-key'], 'dd-key');
  assert.deepEqual(ddCalls[0].body, { name: 'Ada', email: 'ada@example.com', message: 'Hello', source_page: '/x' });
});

test('service dropdown is folded into the message, not dropped', async () => {
  stubFetch();
  const res = makeRes();
  await handler(post({ ...LEAD, service: 'Keynote' }), res);
  assert.equal(ddCalls[0].body.message, 'Service interest: Keynote\n\nHello');
});

test('bot (turnstile fail) -> 400, DealDesk never called', async () => {
  stubFetch({ human: false });
  const res = makeRes();
  await handler(post(LEAD), res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'turnstile-failed');
  assert.equal(ddCalls.length, 0);
});

test('missing fields / invalid email -> 422', async () => {
  stubFetch();
  let res = makeRes();
  await handler(post({ token: 't', name: 'A', email: 'a@b.cc' }), res); // no message
  assert.equal(res.statusCode, 422);
  assert.equal(res.body.error, 'missing-fields');
  res = makeRes();
  await handler(post({ ...LEAD, email: 'not-an-email' }), res);
  assert.equal(res.statusCode, 422);
  assert.equal(res.body.error, 'invalid-email');
});

test('DealDesk HTTP failure -> 502 dealdesk-error', async () => {
  stubFetch({ ddFail: true });
  const res = makeRes();
  await handler(post(LEAD), res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.error, 'dealdesk-error');
});

test('DealDesk network throw -> 502 dealdesk-unreachable', async () => {
  stubFetch({ ddThrow: true });
  const res = makeRes();
  await handler(post(LEAD), res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.error, 'dealdesk-unreachable');
});

test('half-configured DealDesk (endpoint without key) does NOT forward', async () => {
  stubFetch();
  delete process.env.DEALDESK_API_KEY;
  const res = makeRes();
  await handler(post(LEAD), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, forwarded: false });
  assert.equal(ddCalls.length, 0);
});

test('non-POST -> 405 with Allow header', async () => {
  const res = makeRes();
  await handler({ method: 'GET', headers: {}, socket: {} }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'POST');
});

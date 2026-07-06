// Unit tests for the shared Turnstile helper: fails CLOSED on missing config,
// missing token, and unreachable siteverify — a misconfiguration must never
// silently skip human verification. Plus clientIp header precedence.
// Run: node --test 'tests/**/*.test.js'
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { verifyTurnstile, clientIp } from '../api/_turnstile.js';

const realFetch = globalThis.fetch;
let lastCall;
function stubFetch(reply) {
  lastCall = null;
  globalThis.fetch = async (url, opts) => {
    lastCall = { url: String(url), body: opts.body };
    if (reply instanceof Error) throw reply;
    return { json: async () => reply };
  };
}
beforeEach(() => { process.env.TURNSTILE_SECRET_KEY = 'shh'; });
afterEach(() => { globalThis.fetch = realFetch; });

test('success verdict passes secret, token and ip to siteverify', async () => {
  stubFetch({ success: true });
  const v = await verifyTurnstile('tok-1', '1.2.3.4');
  assert.deepEqual(v, { ok: true });
  assert.match(lastCall.url, /challenges\.cloudflare\.com\/turnstile\/v0\/siteverify/);
  const p = lastCall.body; // URLSearchParams
  assert.equal(p.get('secret'), 'shh');
  assert.equal(p.get('response'), 'tok-1');
  assert.equal(p.get('remoteip'), '1.2.3.4');
});

test('failure verdict surfaces Cloudflare error codes', async () => {
  stubFetch({ success: false, 'error-codes': ['invalid-input-response'] });
  const v = await verifyTurnstile('bad');
  assert.equal(v.ok, false);
  assert.deepEqual(v.errors, ['invalid-input-response']);
});

test('failure with no error codes still reports a reason', async () => {
  stubFetch({ success: false });
  const v = await verifyTurnstile('bad');
  assert.deepEqual(v.errors, ['verification-failed']);
});

test('missing secret key fails CLOSED without calling Cloudflare', async () => {
  stubFetch({ success: true });
  delete process.env.TURNSTILE_SECRET_KEY;
  const v = await verifyTurnstile('tok');
  assert.equal(v.ok, false);
  assert.deepEqual(v.errors, ['missing-secret-key']);
  assert.equal(lastCall, null);
});

test('missing token fails CLOSED without calling Cloudflare', async () => {
  stubFetch({ success: true });
  const v = await verifyTurnstile('');
  assert.equal(v.ok, false);
  assert.deepEqual(v.errors, ['missing-input-response']);
  assert.equal(lastCall, null);
});

test('unreachable siteverify fails CLOSED', async () => {
  stubFetch(new Error('offline'));
  const v = await verifyTurnstile('tok');
  assert.equal(v.ok, false);
  assert.deepEqual(v.errors, ['siteverify-unreachable']);
});

test('clientIp: first x-forwarded-for hop wins, falls back to socket, never crashes', () => {
  assert.equal(clientIp({ headers: { 'x-forwarded-for': ' 9.9.9.9 , 10.0.0.1' }, socket: {} }), '9.9.9.9');
  assert.equal(clientIp({ headers: {}, socket: { remoteAddress: '8.8.8.8' } }), '8.8.8.8');
  assert.equal(clientIp({ headers: {} }), '');
});

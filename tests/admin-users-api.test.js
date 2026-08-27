// Tests for admin-only user management: role-gated access, invite flow with
// authoritative app_metadata role, self-delete protection, invite resend
// (PATCH), password reset (PUT), and rate-limit reporting (429 passthrough).
// Run: node --test 'tests/**/*.test.js'
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://sb.test';
process.env.SUPABASE_SECRET_KEY = 'sb-secret';
const { default: handler } = await import('../api/admin/users.js');

function makeRes() {
  const res = { statusCode: 0, body: null, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return res;
}
const req = (method, { body, host = 'rajgoodman.com', origin } = {}) =>
  ({ method, body, headers: { cookie: 'sb_at=good-token', host, ...(origin ? { origin } : {}) }, url: '/x', socket: {} });

const USERS = () => ({
  u1: { id: 'u1', email: 'raj@x.com', app_metadata: { role: 'admin' }, email_confirmed_at: '2026-01-01', last_sign_in_at: '2026-07-01' },
  u2: { id: 'u2', email: 'deth@x.com', app_metadata: {}, email_confirmed_at: null },
});

const realFetch = globalThis.fetch;
let calls, myRole, inviteOk, byId, inviteQueue, recoverQueue;
beforeEach(() => {
  calls = []; myRole = 'admin'; inviteOk = true;
  byId = USERS(); inviteQueue = []; recoverQueue = [];   // per-call responses; fall back to inviteOk / ok
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url); const method = opts.method || 'GET';
    calls.push({ url: u, method, body: opts.body && JSON.parse(opts.body) });
    if (u.includes('/auth/v1/user')) {
      const ok = (opts.headers.authorization || '') === 'Bearer good-token';
      return { ok, json: async () => ({ id: 'me-1', app_metadata: { role: myRole } }) };
    }
    if (u.includes('/auth/v1/token')) return { ok: false, json: async () => ({}) };
    if (u.includes('/auth/v1/invite')) {
      const q = inviteQueue.length ? inviteQueue.shift() : { ok: inviteOk, status: inviteOk ? 200 : 422, body: 'smtp exploded' };
      return { ok: q.ok, status: q.status || (q.ok ? 200 : 422),
        headers: { get: (k) => (q.headers || {})[k.toLowerCase()] || null },
        text: async () => q.body || '', json: async () => ({ id: q.id || 'new-user-9' }) };
    }
    if (u.includes('/auth/v1/recover')) {
      const q = recoverQueue.length ? recoverQueue.shift() : { ok: true, status: 200 };
      return { ok: q.ok, status: q.status || 200,
        headers: { get: (k) => (q.headers || {})[k.toLowerCase()] || null },
        text: async () => q.body || '', json: async () => ({}) };
    }
    const one = u.match(/\/auth\/v1\/admin\/users\/([^/?]+)$/);
    if (one && method === 'GET') { const f = byId[one[1]]; return { ok: !!f, json: async () => f || {} }; }
    if (u.includes('/auth/v1/admin/users/')) return { ok: true, json: async () => ({}) };
    if (u.includes('/auth/v1/admin/users')) return { ok: true, json: async () => ({ users: Object.values(byId) }) };
    throw new Error('unexpected fetch ' + u);
  };
});
afterEach(() => { globalThis.fetch = realFetch; });

test('access: unauthenticated 401, editor 403 — never reaches the admin API', async () => {
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url) });
    if (String(url).includes('/auth/v1/user')) return { ok: false, json: async () => ({}) };
    if (String(url).includes('/auth/v1/token')) return { ok: false, json: async () => ({}) };
    throw new Error('reached admin API without auth');
  };
  let res = makeRes();
  await handler({ method: 'GET', headers: { cookie: '' }, socket: {} }, res);
  assert.equal(res.statusCode, 401);

  myRole = 'editor';
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u.includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: 'me', app_metadata: { role: 'editor' } }) };
    throw new Error('editor reached the admin API: ' + u);
  };
  res = makeRes();
  await handler(req('GET'), res);
  assert.equal(res.statusCode, 403);
});

test('GET: maps users to the slim shape with editor as the default role', async () => {
  const res = makeRes();
  await handler(req('GET'), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.users, [
    { id: 'u1', email: 'raj@x.com', role: 'admin', confirmed: true, last_sign_in_at: '2026-07-01' },
    { id: 'u2', email: 'deth@x.com', role: 'editor', confirmed: false, last_sign_in_at: null },
  ]);
});

test('POST invite: normalises email, coerces unknown roles to editor, sets authoritative app_metadata', async () => {
  const res = makeRes();
  await handler(req('POST', { body: { email: ' New@X.Com ', role: 'superuser' } }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, email: 'new@x.com', role: 'editor' });
  const invite = calls.find((c) => c.url.includes('/invite'));
  assert.match(invite.url, /redirect_to=https%3A%2F%2Frajgoodman\.com%2Fadmin%2F/);
  assert.deepEqual(invite.body, { email: 'new@x.com', data: { role: 'editor' } });
  const rolePut = calls.find((c) => c.url.endsWith('/admin/users/new-user-9'));
  assert.deepEqual(rolePut.body, { app_metadata: { role: 'editor' } });
});

test('POST invite: missing email 422; GoTrue failure 502 with detail', async () => {
  let res = makeRes();
  await handler(req('POST', { body: {} }), res);
  assert.equal(res.body.error, 'email-required');
  inviteOk = false;
  res = makeRes();
  await handler(req('POST', { body: { email: 'a@b.cc' } }), res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.error, 'invite-failed');
});

test('POST invite: 429 -> rate-limited with parsed seconds; no figure means the hourly window', async () => {
  inviteQueue.push({ ok: false, status: 429, body: 'you can only request this after 37 seconds' });
  let res = makeRes();
  await handler(req('POST', { body: { email: 'a@b.cc' } }), res);
  assert.equal(res.statusCode, 429);
  assert.deepEqual(res.body, { ok: false, error: 'rate-limited', retryAfterSeconds: 37 });
  inviteQueue.push({ ok: false, status: 429, body: 'email rate limit exceeded' });
  res = makeRes();
  await handler(req('POST', { body: { email: 'b@b.cc' } }), res);
  assert.equal(res.body.retryAfterSeconds, 3600);
});

test('PATCH resend: missing id 422, unknown user 404, active user refused (already-active)', async () => {
  let res = makeRes();
  await handler(req('PATCH', { body: {} }), res);
  assert.equal(res.statusCode, 422);
  res = makeRes();
  await handler(req('PATCH', { body: { id: 'ghost' } }), res);
  assert.equal(res.statusCode, 404);
  res = makeRes();
  await handler(req('PATCH', { body: { id: 'u1' } }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'already-active');
  assert.ok(!calls.some((c) => c.url.includes('/auth/v1/invite')), 'no invite sent for an active user');
});

test('PATCH resend: accepted re-invite -> 200 resent with the authoritative role re-set', async () => {
  const res = makeRes();
  await handler(req('PATCH', { body: { id: 'u2' } }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, resent: true, email: 'deth@x.com', role: 'editor' });
  assert.ok(!calls.some((c) => c.method === 'DELETE'), 'no recreate needed');
});

test('PATCH resend: refused address -> pending user recreated (delete lands between the invite attempts)', async () => {
  inviteQueue.push({ ok: false, status: 422, body: 'A user with this email address has already been registered' });
  inviteQueue.push({ ok: true, id: 'recreated-1' });
  const res = makeRes();
  await handler(req('PATCH', { body: { id: 'u2' } }), res);
  assert.equal(res.statusCode, 200);
  const iDel = calls.findIndex((c) => c.method === 'DELETE' && c.url.endsWith('/admin/users/u2'));
  const invites = calls.map((c, i) => ({ c, i })).filter(({ c }) => c.url.includes('/auth/v1/invite'));
  assert.ok(iDel > invites[0].i && iDel < invites[1].i, 'delete happens between the two invite attempts');
  assert.ok(calls.some((c) => c.method === 'PUT' && c.url.endsWith('/admin/users/recreated-1')), 'role restored on the recreated user');
});

test('PATCH resend: 429 before any change -> plain rate-limited; 429 after the recreate delete -> recreate:true', async () => {
  inviteQueue.push({ ok: false, status: 429, body: 'after 12 seconds' });
  let res = makeRes();
  await handler(req('PATCH', { body: { id: 'u2' } }), res);
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.recreate, undefined);
  assert.ok(!calls.some((c) => c.method === 'DELETE'), 'pending user untouched');

  calls = []; byId = USERS();
  inviteQueue.push({ ok: false, status: 422, body: 'already been registered' });
  inviteQueue.push({ ok: false, status: 429, body: 'after 25 seconds' });
  res = makeRes();
  await handler(req('PATCH', { body: { id: 'u2' } }), res);
  assert.deepEqual(res.body, { ok: false, error: 'rate-limited', retryAfterSeconds: 25, email: 'deth@x.com', role: 'editor', recreate: true });
});

test('PUT reset: missing id 422, unknown 404, pending invite refused (not-confirmed)', async () => {
  let res = makeRes();
  await handler(req('PUT', { body: {} }), res);
  assert.equal(res.statusCode, 422);
  res = makeRes();
  await handler(req('PUT', { body: { id: 'ghost' } }), res);
  assert.equal(res.statusCode, 404);
  res = makeRes();
  await handler(req('PUT', { body: { id: 'u2' } }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'not-confirmed');
  assert.ok(!calls.some((c) => c.url.includes('/auth/v1/recover')), 'no recovery email for a pending invite');
});

test("PUT reset: confirmed user -> recovery email back to this origin's /admin/; 429 passes through", async () => {
  let res = makeRes();
  await handler(req('PUT', { body: { id: 'u1' } }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, reset: true, email: 'raj@x.com' });
  const rec = calls.find((c) => c.url.includes('/auth/v1/recover'));
  assert.match(rec.url, /redirect_to=https%3A%2F%2Frajgoodman\.com%2Fadmin%2F/);
  assert.deepEqual(rec.body, { email: 'raj@x.com' });

  recoverQueue.push({ ok: false, status: 429, body: 'after 42 seconds' });
  res = makeRes();
  await handler(req('PUT', { body: { id: 'u1' } }), res);
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.retryAfterSeconds, 42);
});

test('unsupported method -> 405 with Allow header', async () => {
  const res = makeRes();
  await handler(req('OPTIONS'), res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'GET, POST, PATCH, PUT, DELETE');
});

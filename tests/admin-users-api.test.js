// Tests for admin-only user management: role-gated access, invite flow with
// authoritative app_metadata role, self-delete protection.
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

const realFetch = globalThis.fetch;
let calls, myRole, inviteOk;
beforeEach(() => {
  calls = []; myRole = 'admin'; inviteOk = true;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    calls.push({ url: u, method: opts.method || 'GET', body: opts.body && JSON.parse(opts.body) });
    if (u.includes('/auth/v1/user')) {
      const ok = (opts.headers.authorization || '') === 'Bearer good-token';
      return { ok, json: async () => ({ id: 'me-1', app_metadata: { role: myRole } }) };
    }
    if (u.includes('/auth/v1/token')) return { ok: false, json: async () => ({}) };
    if (u.includes('/auth/v1/invite')) {
      return { ok: inviteOk, text: async () => 'smtp exploded', json: async () => ({ id: 'new-user-9' }) };
    }
    if (u.includes('/auth/v1/admin/users/')) return { ok: true, json: async () => ({}) };
    if (u.includes('/auth/v1/admin/users')) {
      return { ok: true, json: async () => ({ users: [
        { id: 'u1', email: 'raj@x.com', app_metadata: { role: 'admin' }, email_confirmed_at: '2026-01-01', last_sign_in_at: '2026-07-01' },
        { id: 'u2', email: 'deth@x.com', app_metadata: {}, email_confirmed_at: null },
      ] }) };
    }
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

test('DELETE: cannot delete yourself; missing id 422; happy path 200', async () => {
  let res = makeRes();
  await handler(req('DELETE', { body: { id: 'me-1' } }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'cannot-delete-self');
  res = makeRes();
  await handler(req('DELETE', { body: {} }), res);
  assert.equal(res.body.error, 'id-required');
  res = makeRes();
  await handler(req('DELETE', { body: { id: 'u2' } }), res);
  assert.equal(res.statusCode, 200);
  assert.ok(calls.some((c) => c.method === 'DELETE' && c.url.endsWith('/admin/users/u2')));
});

test('unsupported method -> 405 with Allow header', async () => {
  const res = makeRes();
  await handler(req('PUT'), res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'GET, POST, DELETE');
});

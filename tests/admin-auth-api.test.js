// Tests for the admin auth endpoints: login (password grant -> httpOnly
// cookies), session (whoami / logout), and set-password (invite flow).
// Run: node --test 'tests/**/*.test.js'
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://sb.test';
process.env.SUPABASE_SECRET_KEY = 'sb-secret';
const { default: login } = await import('../api/admin/login.js');
const { default: session } = await import('../api/admin/session.js');
const { default: setPassword } = await import('../api/admin/set-password.js');

function makeRes() {
  const res = { statusCode: 0, body: null, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return res;
}
const req = (method, { body, cookie = '', host = 'localhost:3000' } = {}) =>
  ({ method, body, headers: { cookie, host }, url: '/x', socket: {} });

const realFetch = globalThis.fetch;
let calls, passwordGrantOk, putPasswordOk;
beforeEach(() => {
  calls = []; passwordGrantOk = true; putPasswordOk = true;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    calls.push({ url: u, method: opts.method || 'GET', headers: opts.headers || {}, body: opts.body });
    if (u.includes('grant_type=password')) {
      return { ok: passwordGrantOk, json: async () => ({ access_token: 'at-1', refresh_token: 'rt-1',
        user: { email: 'ada@example.com', app_metadata: { role: 'admin' } } }) };
    }
    if (u.includes('/auth/v1/user') && (opts.method || 'GET') === 'PUT') {
      return { ok: putPasswordOk, text: async () => 'gotrue said no', json: async () => ({}) };
    }
    if (u.includes('/auth/v1/user')) {
      const ok = (opts.headers.authorization || '') === 'Bearer good-token';
      return { ok, json: async () => ({ email: 'ada@example.com', app_metadata: { role: 'editor' } }) };
    }
    if (u.includes('/auth/v1/token')) return { ok: false, json: async () => ({}) };
    throw new Error('unexpected fetch ' + u);
  };
});
afterEach(() => { globalThis.fetch = realFetch; });

/* ---- login ---- */
test('login: happy path sets both httpOnly cookies and returns email + role', async () => {
  const res = makeRes();
  await login(req('POST', { body: { email: ' ada@example.com ', password: 'pw' } }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, email: 'ada@example.com', role: 'admin' });
  const sc = res.headers['Set-Cookie'];
  assert.ok(sc[0].startsWith('sb_at=at-1') && sc[0].includes('HttpOnly'));
  assert.ok(sc[1].startsWith('sb_rt=rt-1') && sc[1].includes('HttpOnly'));
  // localhost gets no Secure flag; the email was trimmed before the grant call
  assert.ok(!sc[0].includes('Secure'));
  assert.equal(JSON.parse(calls[0].body).email, 'ada@example.com');
});

test('login: non-localhost host adds the Secure cookie attribute', async () => {
  const res = makeRes();
  await login(req('POST', { body: { email: 'a@b.cc', password: 'pw' }, host: 'rajgoodman.com' }), res);
  assert.ok(res.headers['Set-Cookie'][0].includes('; Secure'));
});

test('login: bad credentials -> 401, missing fields -> 422, non-POST -> 405', async () => {
  passwordGrantOk = false;
  let res = makeRes();
  await login(req('POST', { body: { email: 'a@b.cc', password: 'wrong' } }), res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'bad-credentials');
  res = makeRes();
  await login(req('POST', { body: { email: 'a@b.cc' } }), res);
  assert.equal(res.statusCode, 422);
  res = makeRes();
  await login(req('GET'), res);
  assert.equal(res.statusCode, 405);
});

/* ---- session ---- */
test('session GET: valid cookie -> email + role; no cookie -> 401', async () => {
  let res = makeRes();
  await session(req('GET', { cookie: 'sb_at=good-token' }), res);
  assert.deepEqual(res.body, { ok: true, email: 'ada@example.com', role: 'editor' });
  res = makeRes();
  await session(req('GET'), res);
  assert.equal(res.statusCode, 401);
});

test('session DELETE: logout clears both cookies without needing auth', async () => {
  const res = makeRes();
  await session(req('DELETE'), res);
  assert.equal(res.statusCode, 200);
  const sc = res.headers['Set-Cookie'];
  assert.ok(sc[0].startsWith('sb_at=;') && sc[0].includes('Max-Age=0'));
  assert.ok(sc[1].startsWith('sb_rt=;') && sc[1].includes('Max-Age=0'));
  assert.equal(calls.length, 0); // no Supabase round-trip for logout
});

/* ---- set-password (invite flow) ---- */
test('set-password: happy path PUTs with the invite token and logs the user in', async () => {
  const res = makeRes();
  await setPassword(req('POST', { body: { access_token: 'invite-at', refresh_token: 'invite-rt', password: 'longenough' } }), res);
  assert.equal(res.statusCode, 200);
  const put = calls.find((c) => c.method === 'PUT');
  assert.equal(put.headers.authorization, 'Bearer invite-at');
  assert.deepEqual(JSON.parse(put.body), { password: 'longenough' });
  assert.ok(res.headers['Set-Cookie'][0].startsWith('sb_at=invite-at'));
});

test('set-password: without a refresh token it succeeds but sets no cookies', async () => {
  const res = makeRes();
  await setPassword(req('POST', { body: { access_token: 'invite-at', password: 'longenough' } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Set-Cookie'], undefined);
});

test('set-password: validation — missing token/password 422, short password 422', async () => {
  let res = makeRes();
  await setPassword(req('POST', { body: { password: 'longenough' } }), res);
  assert.equal(res.body.error, 'token-and-password-required');
  res = makeRes();
  await setPassword(req('POST', { body: { access_token: 't', password: 'short7!' } }), res);
  assert.equal(res.body.error, 'password-too-short');
});

test('set-password: GoTrue rejection -> 400 with truncated detail', async () => {
  putPasswordOk = false;
  const res = makeRes();
  await setPassword(req('POST', { body: { access_token: 't', password: 'longenough' } }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'set-password-failed');
  assert.ok(res.body.detail.length <= 160);
});

// Minimal admin session auth: a signed, expiring cookie (HMAC-SHA256).
// No password or secret ever reaches the browser — login compares server-side
// and only a signed token is stored in an httpOnly cookie.

import crypto from 'crypto';

const SECRET = process.env.SESSION_SECRET || 'dev-insecure-secret-change-me';
const COOKIE = 'aifm_admin';
const TTL = 60 * 60 * 12; // 12 hours

function sign(payload) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function makeToken() {
  const exp = String(Math.floor(Date.now() / 1000) + TTL);
  return exp + '.' + sign(exp);
}

export function verifyToken(token) {
  if (!token || token.indexOf('.') < 0) return false;
  const [exp, sig] = token.split('.');
  if (!safeEqual(sig, sign(exp))) return false;
  return Number(exp) > Math.floor(Date.now() / 1000);
}

export function isAuthed(req) {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(new RegExp('(?:^|; )' + COOKIE + '=([^;]+)'));
  return m ? verifyToken(decodeURIComponent(m[1])) : false;
}

export function setSessionCookie(res, req) {
  const host = (req.headers.host || '').toString();
  const secure = !host.startsWith('localhost') && !host.startsWith('127.0.0.1');
  const attrs = `HttpOnly; SameSite=Lax; Path=/; Max-Age=${TTL}` + (secure ? '; Secure' : '');
  res.setHeader('Set-Cookie', `${COOKIE}=${makeToken()}; ${attrs}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

/** Guard for admin API routes. Returns true if handled (sent 401). */
export function blockIfUnauthed(req, res) {
  if (isAuthed(req)) return false;
  res.status(401).json({ ok: false, error: 'unauthorized' });
  return true;
}

import { setSessionCookie, safeEqual } from '../_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false }); }
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return res.status(500).json({ ok: false, error: 'admin-password-not-set' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const pw = (body && body.password) || '';

  if (!safeEqual(pw, expected)) return res.status(401).json({ ok: false, error: 'bad-password' });
  setSessionCookie(res, req);
  return res.status(200).json({ ok: true });
}

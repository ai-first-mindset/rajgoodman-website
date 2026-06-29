// Invitee lands on /admin/ from the email link with access+refresh tokens in the
// URL hash. They choose a password here: we PUT it with their invite access token,
// then set our httpOnly cookies so they're logged in.
import { setAuthCookies } from '../_auth.js';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false }); }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const { access_token, refresh_token, password } = body;
  if (!access_token || !password) return res.status(422).json({ ok: false, error: 'token-and-password-required' });
  if (String(password).length < 8) return res.status(422).json({ ok: false, error: 'password-too-short' });

  const r = await fetch(`${SB_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: { apikey: SB_KEY, authorization: `Bearer ${access_token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!r.ok) return res.status(400).json({ ok: false, error: 'set-password-failed', detail: (await r.text()).slice(0, 160) });

  // Log them in straight away if we also got the refresh token from the hash.
  if (refresh_token) setAuthCookies(res, req, access_token, refresh_token);
  return res.status(200).json({ ok: true });
}

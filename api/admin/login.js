// POST {email, password} -> Supabase password grant -> httpOnly token cookies.
import { setAuthCookies, roleOf } from '../_auth.js';
import { readBody } from '../_body.js';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false }); }

  const body = readBody(req);
  const email = (body.email || '').trim();
  const password = body.password || '';
  if (!email || !password) return res.status(422).json({ ok: false, error: 'email-and-password-required' });

  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: SB_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) return res.status(401).json({ ok: false, error: 'bad-credentials' });

  const data = await r.json();
  setAuthCookies(res, req, data.access_token, data.refresh_token);
  return res.status(200).json({ ok: true, email: data.user && data.user.email, role: roleOf(data.user) });
}

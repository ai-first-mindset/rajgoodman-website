// Admin-only user management via Supabase Auth admin API (service key).
//   GET    -> list users (id, email, role, confirmed, last sign-in)
//   POST   {email, role}   -> invite (sends email) + set app_metadata.role
//   DELETE {id}            -> remove user
import { requireAdmin } from '../_auth.js';
import { readBody } from '../_body.js';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_H = { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}`, 'content-type': 'application/json' };

function originOf(req) {
  if (req.headers.origin) return req.headers.origin;
  const host = req.headers.host || '';
  const proto = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  const me = await requireAdmin(req, res);
  if (!me) return;

  if (req.method === 'GET') {
    const r = await fetch(`${SB_URL}/auth/v1/admin/users?per_page=200`, { headers: ADMIN_H });
    if (!r.ok) return res.status(502).json({ ok: false, error: 'list-failed' });
    const data = await r.json();
    const users = (data.users || []).map((u) => ({
      id: u.id,
      email: u.email,
      role: (u.app_metadata && u.app_metadata.role) || 'editor',
      confirmed: !!u.email_confirmed_at,
      last_sign_in_at: u.last_sign_in_at || null,
    }));
    return res.status(200).json({ ok: true, users });
  }

  const body = readBody(req);

  if (req.method === 'POST') {
    const email = (body.email || '').trim().toLowerCase();
    const role = body.role === 'admin' ? 'admin' : 'editor';
    if (!email) return res.status(422).json({ ok: false, error: 'email-required' });

    const redirectTo = `${originOf(req)}/admin/`;
    const inv = await fetch(`${SB_URL}/auth/v1/invite?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: 'POST', headers: ADMIN_H, body: JSON.stringify({ email, data: { role } }),
    });
    if (!inv.ok) return res.status(502).json({ ok: false, error: 'invite-failed', detail: (await inv.text()).slice(0, 160) });
    const invited = await inv.json();

    // Invite stores `role` in user_metadata; set authoritative role in app_metadata.
    if (invited && invited.id) {
      await fetch(`${SB_URL}/auth/v1/admin/users/${invited.id}`, {
        method: 'PUT', headers: ADMIN_H, body: JSON.stringify({ app_metadata: { role } }),
      });
    }
    return res.status(200).json({ ok: true, email, role });
  }

  if (req.method === 'DELETE') {
    const id = body.id;
    if (!id) return res.status(422).json({ ok: false, error: 'id-required' });
    if (id === me.id) return res.status(400).json({ ok: false, error: 'cannot-delete-self' });
    const r = await fetch(`${SB_URL}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: ADMIN_H });
    if (!r.ok) return res.status(502).json({ ok: false, error: 'delete-failed' });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ ok: false });
}

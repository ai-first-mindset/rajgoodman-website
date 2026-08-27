// Admin-only user management via Supabase Auth admin API (service key).
//   GET    -> list users (id, email, role, confirmed, last sign-in)
//   POST   {email, role}   -> invite (sends email) + set app_metadata.role
//   PATCH  {id}            -> re-send a pending invite (recreates it if GoTrue
//                             refuses invites to existing addresses)
//   PUT    {id}            -> send a password-reset email (confirmed users)
//   DELETE {id}            -> remove user
// Invite emails are subject to Supabase's send rate limit; those failures are
// returned as 429 {error:'rate-limited', retryAfterSeconds} so the admin UI
// can state the allowance and when a manual retry should succeed.
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

// GoTrue signals its email rate limit with a 429 ("over_email_send_rate_limit",
// msg "…you can only request this after N seconds."). Returns the seconds to
// wait, or null when the failure
// isn't a rate limit; with no figure from GoTrue (hourly pool exhausted),
// assume the full hour.
function rateLimitSeconds(r, text) {
  if (r.status !== 429) return null;
  const h = r.headers && typeof r.headers.get === 'function' ? Number(r.headers.get('retry-after')) : 0;
  if (h > 0) return Math.ceil(h);
  const m = /after (\d+) second/i.exec(text || '');
  return m ? Number(m[1]) : 3600;
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

  const sendInvite = (email, role) =>
    fetch(`${SB_URL}/auth/v1/invite?redirect_to=${encodeURIComponent(`${originOf(req)}/admin/`)}`, {
      method: 'POST', headers: ADMIN_H, body: JSON.stringify({ email, data: { role } }),
    });
  // Invite stores `role` in user_metadata; set authoritative role in app_metadata.
  const setRole = (id, role) =>
    fetch(`${SB_URL}/auth/v1/admin/users/${id}`, {
      method: 'PUT', headers: ADMIN_H, body: JSON.stringify({ app_metadata: { role } }),
    });

  if (req.method === 'POST') {
    const email = (body.email || '').trim().toLowerCase();
    const role = body.role === 'admin' ? 'admin' : 'editor';
    if (!email) return res.status(422).json({ ok: false, error: 'email-required' });

    const inv = await sendInvite(email, role);
    if (!inv.ok) {
      const detail = (await inv.text()).slice(0, 300);
      const retry = rateLimitSeconds(inv, detail);
      if (retry) return res.status(429).json({ ok: false, error: 'rate-limited', retryAfterSeconds: retry });
      return res.status(502).json({ ok: false, error: 'invite-failed', detail: detail.slice(0, 160) });
    }
    const invited = await inv.json();
    if (invited && invited.id) await setRole(invited.id, role);
    return res.status(200).json({ ok: true, email, role });
  }

  // Re-send a pending invite. The original invite link may be expired or spent
  // (single-use); GoTrue has no first-class "resend invite", so: try a straight
  // re-invite first, and when GoTrue refuses (address already registered),
  // recreate the pending user and invite afresh. Never touches confirmed users.
  if (req.method === 'PATCH') {
    const id = body.id;
    if (!id) return res.status(422).json({ ok: false, error: 'id-required' });

    const ur = await fetch(`${SB_URL}/auth/v1/admin/users/${id}`, { headers: ADMIN_H });
    if (!ur.ok) return res.status(404).json({ ok: false, error: 'user-not-found' });
    const u = await ur.json();
    if (u.email_confirmed_at) return res.status(400).json({ ok: false, error: 'already-active' });
    const email = u.email;
    const role = (u.app_metadata && u.app_metadata.role) === 'admin' ? 'admin' : 'editor';

    let inv = await sendInvite(email, role);
    if (!inv.ok) {
      let detail = (await inv.text()).slice(0, 300);
      const retry = rateLimitSeconds(inv, detail);
      // Rate-limited before anything changed: the same PATCH can simply be retried.
      if (retry) return res.status(429).json({ ok: false, error: 'rate-limited', retryAfterSeconds: retry, email, role });

      const del = await fetch(`${SB_URL}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: ADMIN_H });
      if (!del.ok) return res.status(502).json({ ok: false, error: 'resend-failed', detail: detail.slice(0, 160) });
      inv = await sendInvite(email, role);
      if (!inv.ok) {
        detail = (await inv.text()).slice(0, 300);
        const retry2 = rateLimitSeconds(inv, detail);
        // The pending user is already deleted, so the retry must be a fresh
        // invite (POST) - `recreate` tells the client which call to repeat.
        if (retry2) return res.status(429).json({ ok: false, error: 'rate-limited', retryAfterSeconds: retry2, email, role, recreate: true });
        return res.status(502).json({ ok: false, error: 'resend-failed', detail: detail.slice(0, 160) });
      }
    }
    const invited = await inv.json();
    if (invited && invited.id) await setRole(invited.id, role);
    return res.status(200).json({ ok: true, resent: true, email, role });
  }

  // Send a password-reset email to a confirmed user. Rescues accounts whose
  // invite link was verified but who never reached the set-password screen
  // (the localhost-redirect era): they list as active yet have no password.
  // Recovery links land on /admin/, which already shows set-password for
  // recovery tokens. Pending (unconfirmed) users get a resend instead.
  if (req.method === 'PUT') {
    const id = body.id;
    if (!id) return res.status(422).json({ ok: false, error: 'id-required' });
    const ur = await fetch(`${SB_URL}/auth/v1/admin/users/${id}`, { headers: ADMIN_H });
    if (!ur.ok) return res.status(404).json({ ok: false, error: 'user-not-found' });
    const u = await ur.json();
    if (!u.email_confirmed_at) return res.status(400).json({ ok: false, error: 'not-confirmed' });
    const rec = await fetch(`${SB_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(`${originOf(req)}/admin/`)}`, {
      method: 'POST', headers: ADMIN_H, body: JSON.stringify({ email: u.email }),
    });
    if (!rec.ok) {
      const detail = (await rec.text()).slice(0, 300);
      const retry = rateLimitSeconds(rec, detail);
      if (retry) return res.status(429).json({ ok: false, error: 'rate-limited', retryAfterSeconds: retry });
      return res.status(502).json({ ok: false, error: 'reset-failed', detail: detail.slice(0, 160) });
    }
    return res.status(200).json({ ok: true, reset: true, email: u.email });
  }

  if (req.method === 'DELETE') {
    const id = body.id;
    if (!id) return res.status(422).json({ ok: false, error: 'id-required' });
    if (id === me.id) return res.status(400).json({ ok: false, error: 'cannot-delete-self' });
    const r = await fetch(`${SB_URL}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: ADMIN_H });
    if (!r.ok) return res.status(502).json({ ok: false, error: 'delete-failed' });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, PATCH, PUT, DELETE');
  return res.status(405).json({ ok: false });
}

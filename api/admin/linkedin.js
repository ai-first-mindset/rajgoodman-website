// Admin CRUD for LinkedIn posts (auth-gated). GET list / POST create /
// PATCH update / DELETE (admin-only). Uses the Supabase secret key via PostgREST.

import { requireUser, roleOf } from '../_auth.js';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALLOWED = ['url', 'title', 'image_url', 'visible', 'sort_order'];

function headers(extra) {
  return { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}`, 'content-type': 'application/json', ...extra };
}
function pick(body) {
  const row = {};
  for (const k of ALLOWED) if (k in body && body[k] !== undefined) row[k] = body[k];
  return row;
}

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  if (!SB_URL || !SB_KEY) return res.status(500).json({ ok: false, error: 'db-not-configured' });

  try {
    if (req.method === 'GET') {
      const r = await fetch(`${SB_URL}/rest/v1/linkedin_posts?select=*&order=sort_order.asc`, { headers: headers() });
      if (!r.ok) return res.status(502).json({ ok: false, error: 'list-failed', detail: await r.text() });
      return res.status(200).json({ ok: true, posts: await r.json() });
    }

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};

    if (req.method === 'POST') {
      if (!body.url) return res.status(422).json({ ok: false, error: 'url-required' });
      const r = await fetch(`${SB_URL}/rest/v1/linkedin_posts`, {
        method: 'POST', headers: headers({ Prefer: 'return=representation' }), body: JSON.stringify(pick(body)),
      });
      if (!r.ok) return res.status(502).json({ ok: false, error: 'create-failed', detail: await r.text() });
      return res.status(201).json({ ok: true, post: (await r.json())[0] });
    }

    if (req.method === 'PATCH') {
      if (!body.id) return res.status(422).json({ ok: false, error: 'id-required' });
      const r = await fetch(`${SB_URL}/rest/v1/linkedin_posts?id=eq.${encodeURIComponent(body.id)}`, {
        method: 'PATCH', headers: headers({ Prefer: 'return=representation' }), body: JSON.stringify(pick(body)),
      });
      if (!r.ok) return res.status(502).json({ ok: false, error: 'update-failed', detail: await r.text() });
      return res.status(200).json({ ok: true, post: (await r.json())[0] });
    }

    if (req.method === 'DELETE') {
      if (roleOf(user) !== 'admin') return res.status(403).json({ ok: false, error: 'forbidden' });
      if (!body.id) return res.status(422).json({ ok: false, error: 'id-required' });
      const r = await fetch(`${SB_URL}/rest/v1/linkedin_posts?id=eq.${encodeURIComponent(body.id)}`, { method: 'DELETE', headers: headers() });
      if (!r.ok) return res.status(502).json({ ok: false, error: 'delete-failed' });
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return res.status(405).json({ ok: false, error: 'method-not-allowed' });
  } catch (err) {
    console.error('admin/linkedin error', err);
    return res.status(500).json({ ok: false, error: 'server-error' });
  }
}

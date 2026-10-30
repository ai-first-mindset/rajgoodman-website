// Admin CRUD for author profiles (auth-gated). GET list / POST create-or-update.
// The slug is derived from the name, which is what posts.author stores and the
// author archive URL is built from, so renaming creates a new profile rather
// than silently orphaning the old author's posts.

import { requireUser } from '../_auth.js';
import { readBody } from '../_body.js';
import { catSlug } from '../_blog-data.js';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

function headers(extra) {
  return { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}`, 'content-type': 'application/json', ...extra };
}
const clean = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const httpUrl = (v) => { const s = clean(v, 500); return s && /^https:\/\//i.test(s) ? s : null; };

export function authorRow(body) {
  const name = clean(body.name, 120);
  if (!name) return null;
  return {
    slug: catSlug(name), name,
    title: clean(body.title, 120), bio: clean(body.bio, 1500),
    image_url: httpUrl(body.image_url), linkedin_url: httpUrl(body.linkedin_url),
    sort: Number.isFinite(Number(body.sort)) ? Math.round(Number(body.sort)) : 100,
    modified_at: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  if (!(await requireUser(req, res))) return;
  if (!SB_URL || !SB_KEY) return res.status(500).json({ ok: false, error: 'db-not-configured' });
  try {
    if (req.method === 'GET') {
      const r = await fetch(`${SB_URL}/rest/v1/authors?select=*&order=sort.asc,name.asc`, { headers: headers() });
      if (!r.ok) return res.status(502).json({ ok: false, error: 'list-failed' });
      return res.status(200).json({ ok: true, authors: await r.json() });
    }
    if (req.method === 'POST') {
      const row = authorRow(readBody(req));
      if (!row) return res.status(422).json({ ok: false, error: 'name-required' });
      const r = await fetch(`${SB_URL}/rest/v1/authors?on_conflict=slug`, {
        method: 'POST', headers: headers({ Prefer: 'resolution=merge-duplicates,return=representation' }), body: JSON.stringify(row),
      });
      if (!r.ok) return res.status(502).json({ ok: false, error: 'save-failed', detail: await r.text() });
      return res.status(200).json({ ok: true, author: (await r.json())[0] });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'method-not-allowed' });
  } catch (err) {
    console.error('admin/authors error', err);
    return res.status(500).json({ ok: false, error: 'server-error' });
  }
}

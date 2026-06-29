// Admin CRUD for blog posts (auth-gated). Uses the Supabase secret key
// server-side via PostgREST. GET list / GET ?id / POST create / PATCH update
// (incl. publish bookkeeping) / DELETE.

import { blockIfUnauthed } from '../_auth.js';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED = ['slug', 'title', 'seo_title', 'meta_description', 'excerpt', 'body_html',
  'featured_image', 'featured_image_alt', 'author', 'canonical_url', 'robots', 'focus_keyphrase',
  'og_title', 'og_description', 'og_image',
  'status', 'published_at'];

function headers(extra) {
  return { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}`, 'content-type': 'application/json', ...extra };
}
function pick(body) {
  const row = {};
  for (const k of ALLOWED) if (k in body && body[k] !== undefined) row[k] = body[k];
  return row;
}
function getId(req) {
  let id = req.query && req.query.id;
  if (!id && req.url) { try { id = new URL(req.url, 'http://x').searchParams.get('id'); } catch (e) { /* noop */ } }
  return id ? String(id) : null;
}

export default async function handler(req, res) {
  if (blockIfUnauthed(req, res)) return;
  if (!SB_URL || !SB_KEY) return res.status(500).json({ ok: false, error: 'db-not-configured' });

  try {
    if (req.method === 'GET') {
      const id = getId(req);
      const path = id
        ? `posts?id=eq.${encodeURIComponent(id)}&limit=1`
        : 'posts?select=id,slug,title,status,published_at,modified_at&order=modified_at.desc';
      const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: headers() });
      const data = await r.json();
      return res.status(200).json({ ok: true, posts: id ? (data[0] || null) : data });
    }

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};

    if (req.method === 'POST') {
      if (!body.title || !body.slug) return res.status(422).json({ ok: false, error: 'title-and-slug-required' });
      const row = pick(body);
      const r = await fetch(`${SB_URL}/rest/v1/posts`, {
        method: 'POST', headers: headers({ Prefer: 'return=representation' }), body: JSON.stringify(row),
      });
      if (!r.ok) return res.status(502).json({ ok: false, error: 'create-failed', detail: await r.text() });
      return res.status(201).json({ ok: true, post: (await r.json())[0] });
    }

    if (req.method === 'PATCH') {
      if (!body.id) return res.status(422).json({ ok: false, error: 'id-required' });
      const row = pick(body);
      // Set published_at once, the first time a post becomes published.
      if (body.status === 'published') {
        const cur = await fetch(`${SB_URL}/rest/v1/posts?id=eq.${encodeURIComponent(body.id)}&select=published_at`, { headers: headers() });
        const curRow = (await cur.json())[0];
        if (curRow && !curRow.published_at) row.published_at = new Date().toISOString();
      }
      const r = await fetch(`${SB_URL}/rest/v1/posts?id=eq.${encodeURIComponent(body.id)}`, {
        method: 'PATCH', headers: headers({ Prefer: 'return=representation' }), body: JSON.stringify(row),
      });
      if (!r.ok) return res.status(502).json({ ok: false, error: 'update-failed', detail: await r.text() });
      return res.status(200).json({ ok: true, post: (await r.json())[0] });
    }

    if (req.method === 'DELETE') {
      if (!body.id) return res.status(422).json({ ok: false, error: 'id-required' });
      const r = await fetch(`${SB_URL}/rest/v1/posts?id=eq.${encodeURIComponent(body.id)}`, { method: 'DELETE', headers: headers() });
      if (!r.ok) return res.status(502).json({ ok: false, error: 'delete-failed' });
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return res.status(405).json({ ok: false, error: 'method-not-allowed' });
  } catch (err) {
    console.error('admin/posts error', err);
    return res.status(500).json({ ok: false, error: 'server-error' });
  }
}

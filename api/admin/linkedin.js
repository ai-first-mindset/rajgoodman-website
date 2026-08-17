// Admin CRUD for LinkedIn posts (auth-gated). GET list / POST create /
// PATCH update / DELETE (admin-only). Uses the Supabase secret key via PostgREST.

import { requireUser, roleOf } from '../_auth.js';
import { readBody } from '../_body.js';
import { cleanupIfOrphan } from '../_media.js';

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

// The homepage widget assigns these straight to a.href and img.src, and the
// site sends no CSP - so an off-domain or javascript: value stored here is
// XSS / a visitor-IP beacon on every homepage load. Validate server-side
// rather than at the caller: this endpoint is also driven by the unattended
// LinkedIn sync agent, which reads untrusted post text off linkedin.com and
// so must not be the only thing standing between a bad string and the DB.
function rejectReason(row) {
  if ('url' in row) {
    let u;
    try { u = new URL(String(row.url)); } catch { return 'url-invalid'; }
    const host = u.hostname.toLowerCase();
    if (u.protocol !== 'https:') return 'url-not-linkedin';
    if (host !== 'www.linkedin.com' && host !== 'linkedin.com') return 'url-not-linkedin';
  }
  if ('image_url' in row && row.image_url) {
    const v = String(row.image_url);
    // Either site-relative (/assets/...) or our own public bucket, which is
    // what the Upload and Library buttons produce. A leading '//' is an
    // off-domain URL wearing a relative disguise, so it has to fail.
    const relative = v.startsWith('/') && !v.startsWith('//');
    const ourBucket = v.startsWith(`${SB_URL}/storage/v1/object/public/`);
    if (!relative && !ourBucket) return 'image-url-not-allowed';
  }
  return null;
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

    const body = readBody(req);

    if (req.method === 'POST') {
      if (!body.url) return res.status(422).json({ ok: false, error: 'url-required' });
      const row = pick(body);
      const bad = rejectReason(row);
      if (bad) return res.status(422).json({ ok: false, error: bad });
      const r = await fetch(`${SB_URL}/rest/v1/linkedin_posts`, {
        method: 'POST', headers: headers({ Prefer: 'return=representation' }), body: JSON.stringify(row),
      });
      if (!r.ok) return res.status(502).json({ ok: false, error: 'create-failed', detail: await r.text() });
      return res.status(201).json({ ok: true, post: (await r.json())[0] });
    }

    if (req.method === 'PATCH') {
      if (!body.id) return res.status(422).json({ ok: false, error: 'id-required' });
      const row = pick(body);
      // Only the fields actually being patched are checked, so the visibility
      // toggle and the reorder arrows (id + one field) stay unaffected.
      const bad = rejectReason(row);
      if (bad) return res.status(422).json({ ok: false, error: bad });
      // If the image is changing, capture the current one so the old file can
      // be cleaned up (same as the media library's Replace) once it's orphaned.
      let oldImage = null;
      if ('image_url' in row) {
        const cur = await fetch(`${SB_URL}/rest/v1/linkedin_posts?id=eq.${encodeURIComponent(body.id)}&select=image_url`, { headers: headers() });
        if (cur.ok) oldImage = ((await cur.json())[0] || {}).image_url || null;
      }
      const r = await fetch(`${SB_URL}/rest/v1/linkedin_posts?id=eq.${encodeURIComponent(body.id)}`, {
        method: 'PATCH', headers: headers({ Prefer: 'return=representation' }), body: JSON.stringify(row),
      });
      if (!r.ok) return res.status(502).json({ ok: false, error: 'update-failed', detail: await r.text() });
      const post = (await r.json())[0];
      if (oldImage && post && oldImage !== post.image_url) await cleanupIfOrphan(oldImage);
      return res.status(200).json({ ok: true, post });
    }

    if (req.method === 'DELETE') {
      if (roleOf(user) !== 'admin') return res.status(403).json({ ok: false, error: 'forbidden' });
      if (!body.id) return res.status(422).json({ ok: false, error: 'id-required' });
      const cur = await fetch(`${SB_URL}/rest/v1/linkedin_posts?id=eq.${encodeURIComponent(body.id)}&select=image_url`, { headers: headers() });
      const oldImage = cur.ok ? (((await cur.json())[0] || {}).image_url || null) : null;
      const r = await fetch(`${SB_URL}/rest/v1/linkedin_posts?id=eq.${encodeURIComponent(body.id)}`, { method: 'DELETE', headers: headers() });
      if (!r.ok) return res.status(502).json({ ok: false, error: 'delete-failed' });
      if (oldImage) await cleanupIfOrphan(oldImage);
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return res.status(405).json({ ok: false, error: 'method-not-allowed' });
  } catch (err) {
    console.error('admin/linkedin error', err);
    return res.status(500).json({ ok: false, error: 'server-error' });
  }
}

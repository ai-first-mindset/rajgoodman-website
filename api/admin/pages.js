// Admin CRUD for CMS pages (auth-gated). Mirrors admin/posts.js but content is
// the `blocks` JSONB array (see api/_blocks.js) instead of body_html; every
// rich field inside the blocks is sanitised on write.

import { requireUser, requireAdmin } from '../_auth.js';
import { readBody } from '../_body.js';
import { sanitizeBlocks } from '../_sanitize.js';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED = ['slug', 'title', 'seo_title', 'meta_description', 'excerpt', 'blocks',
  'featured_image', 'featured_image_alt', 'canonical_url', 'robots',
  'og_title', 'og_description', 'og_image', 'json_ld', 'template', 'nav_label',
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
  // Reading the page list is fine for any signed-in user; WRITING is not.
  // Page content becomes markup on public pages, so a page write is effectively
  // "publish HTML to rajgoodman.com" and is restricted to admins.
  const guard = req.method === 'GET' ? requireUser : requireAdmin;
  if (!(await guard(req, res))) return;
  if (!SB_URL || !SB_KEY) return res.status(500).json({ ok: false, error: 'db-not-configured' });

  try {
    if (req.method === 'GET') {
      const id = getId(req);
      const path = id
        ? `pages?id=eq.${encodeURIComponent(id)}&limit=1`
        : 'pages?select=id,slug,title,status,published_at,modified_at&order=modified_at.desc';
      const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: headers() });
      const data = await r.json();
      return res.status(200).json({ ok: true, pages: id ? (data[0] || null) : data });
    }

    const body = readBody(req);

    if (req.method === 'POST') {
      if (!body.title || !body.slug) return res.status(422).json({ ok: false, error: 'title-and-slug-required' });
      const row = pick(body);
      if ('blocks' in row) row.blocks = sanitizeBlocks(row.blocks);
      const r = await fetch(`${SB_URL}/rest/v1/pages`, {
        method: 'POST', headers: headers({ Prefer: 'return=representation' }), body: JSON.stringify(row),
      });
      if (!r.ok) return res.status(502).json({ ok: false, error: 'create-failed', detail: await r.text() });
      return res.status(201).json({ ok: true, page: (await r.json())[0] });
    }

    if (req.method === 'PATCH') {
      if (!body.id) return res.status(422).json({ ok: false, error: 'id-required' });
      const row = pick(body);
      if ('blocks' in row) row.blocks = sanitizeBlocks(row.blocks);
      // Look up the current row when we may need to stamp published_at or record a
      // slug change (old URL → 301). Refuse the save if that lookup fails.
      if (body.status === 'published' || body.slug) {
        const cur = await fetch(`${SB_URL}/rest/v1/pages?id=eq.${encodeURIComponent(body.id)}&select=published_at,slug,prev_slugs`, { headers: headers() });
        if (!cur.ok) return res.status(502).json({ ok: false, error: 'current-row-lookup-failed' });
        const curRow = (await cur.json())[0];
        if (curRow) {
          if (body.status === 'published' && !curRow.published_at) row.published_at = new Date().toISOString();
          if (body.slug && curRow.slug && body.slug !== curRow.slug) {
            const set = new Set([...(curRow.prev_slugs || []), curRow.slug]);
            set.delete(body.slug);
            row.prev_slugs = [...set];
          }
        }
      }
      const r = await fetch(`${SB_URL}/rest/v1/pages?id=eq.${encodeURIComponent(body.id)}`, {
        method: 'PATCH', headers: headers({ Prefer: 'return=representation' }), body: JSON.stringify(row),
      });
      if (!r.ok) return res.status(502).json({ ok: false, error: 'update-failed', detail: await r.text() });
      return res.status(200).json({ ok: true, page: (await r.json())[0] });
    }

    if (req.method === 'DELETE') {
      if (!body.id) return res.status(422).json({ ok: false, error: 'id-required' });
      const r = await fetch(`${SB_URL}/rest/v1/pages?id=eq.${encodeURIComponent(body.id)}`, { method: 'DELETE', headers: headers() });
      if (!r.ok) return res.status(502).json({ ok: false, error: 'delete-failed' });
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return res.status(405).json({ ok: false, error: 'method-not-allowed' });
  } catch (err) {
    console.error('admin/pages error', err);
    return res.status(500).json({ ok: false, error: 'server-error' });
  }
}

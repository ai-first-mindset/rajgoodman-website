// Authed media library: lists images in the blog-media Supabase Storage bucket
// (most recent first) so the editor can reuse previously-uploaded images.

import { blockIfUnauthed } from '../_auth.js';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'blog-media';

export default async function handler(req, res) {
  if (blockIfUnauthed(req, res)) return;
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false, error: 'method-not-allowed' }); }
  if (!SB_URL || !SB_KEY) return res.status(500).json({ ok: false, error: 'storage-not-configured' });

  const r = await fetch(`${SB_URL}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ prefix: '', limit: 100, sortBy: { column: 'created_at', order: 'desc' } }),
  });
  if (!r.ok) return res.status(502).json({ ok: false, error: 'list-failed', detail: await r.text() });

  const items = await r.json();
  const files = (Array.isArray(items) ? items : []).filter((o) => o && o.id).map((o) => ({
    name: o.name, url: `${SB_URL}/storage/v1/object/public/${BUCKET}/${o.name}`,
  }));
  return res.status(200).json({ ok: true, files });
}

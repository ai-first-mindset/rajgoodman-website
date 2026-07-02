// Authed image upload: returns a short-lived signed upload URL for the
// blog-media Supabase Storage bucket. The browser PUTs the file bytes directly
// to that URL (bypassing the serverless body-size limit), then uses publicUrl.

import { requireUser } from '../_auth.js';
import { readBody } from '../_body.js';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'blog-media';
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' };

function safeName(n) {
  return (n || 'image').toLowerCase().replace(/\.[a-z0-9]+$/, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'image';
}

export default async function handler(req, res) {
  if (!(await requireUser(req, res))) return;
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method-not-allowed' }); }
  if (!SB_URL || !SB_KEY) return res.status(500).json({ ok: false, error: 'storage-not-configured' });

  const body = readBody(req);

  const ext = EXT[body.contentType];
  if (!ext) return res.status(415).json({ ok: false, error: 'unsupported-type' });

  const path = `${Date.now().toString(36)}-${safeName(body.filename)}.${ext}`;
  const sign = await fetch(`${SB_URL}/storage/v1/object/upload/sign/${BUCKET}/${encodeURIComponent(path)}`, {
    method: 'POST', headers: { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}` },
  });
  if (!sign.ok) return res.status(502).json({ ok: false, error: 'sign-failed', detail: await sign.text() });

  const j = await sign.json();
  const rel = j.url || j.signedUrl || '';
  const signedUrl = rel.startsWith('http') ? rel : `${SB_URL}/storage/v1${rel.startsWith('/') ? '' : '/'}${rel}`;
  const publicUrl = `${SB_URL}/storage/v1/object/public/${BUCKET}/${path}`;
  return res.status(201).json({ ok: true, signedUrl, publicUrl, path });
}

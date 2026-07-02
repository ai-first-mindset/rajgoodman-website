// Authed media library for the blog-media Supabase Storage bucket.
//   GET    — list every object (recursively) merged with alt/caption/title metadata
//   PATCH  — upsert metadata { path, alt, caption, title }
//   DELETE — admin-only; refuses if the file is used in a post (unless force:true)

import { requireUser, roleOf } from '../_auth.js';
import { readBody } from '../_body.js';
import { cleanupIfOrphan } from '../_media.js';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'blog-media';

function sbHeaders(extra) {
  return { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}`, 'content-type': 'application/json', ...extra };
}
// Storage object DELETE must NOT carry a JSON content-type: the storage server
// (Fastify) rejects a bodyless `application/json` request with 400. Auth only.
const authOnly = () => ({ apikey: SB_KEY, authorization: `Bearer ${SB_KEY}` });
const publicUrl = (path) => `${SB_URL}/storage/v1/object/public/${BUCKET}/${path}`;
const encPath = (path) => path.split('/').map(encodeURIComponent).join('/');

// Supabase Storage `list` only returns one prefix level (files + sub-folders),
// so walk folders recursively to surface nested paths (e.g. wp-content/uploads/…).
async function listAll(prefix = '', depth = 0) {
  if (depth > 8) return [];
  const r = await fetch(`${SB_URL}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST', headers: sbHeaders(),
    body: JSON.stringify({ prefix, limit: 1000, sortBy: { column: 'name', order: 'asc' } }),
  });
  if (!r.ok) return [];
  const items = await r.json();
  const files = [], folders = [];
  for (const o of (Array.isArray(items) ? items : [])) {
    if (!o || !o.name) continue;
    const full = prefix + o.name;
    if (o.id) files.push({ path: full, name: o.name, created_at: o.created_at || (o.metadata && o.metadata.lastModified) || '', size: (o.metadata && o.metadata.size) || null });
    else folders.push(`${full}/`); // folder placeholder (id === null)
  }
  // Recurse into sibling folders concurrently — serial recursion was ~21 round-trips.
  const subs = await Promise.all(folders.map((f) => listAll(f, depth + 1)));
  for (const s of subs) files.push(...s);
  return files;
}

// Metadata overlay keyed by path. Returns {} if the table doesn't exist yet.
async function metaMap() {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/media?select=path,alt,caption,title`, { headers: sbHeaders() });
    if (!r.ok) return {};
    const rows = await r.json();
    const m = {};
    for (const row of rows) m[row.path] = row;
    return m;
  } catch (e) { return {}; }
}

// Posts that reference this object's path in their body, featured image or og image.
// Storage paths are [a-z0-9-/._] so they're safe to inline into the PostgREST `or`.
async function usedIn(path) {
  const needle = `*${path}*`;
  const cond = `body_html.ilike.${needle},featured_image.ilike.${needle},og_image.ilike.${needle}`;
  const r = await fetch(`${SB_URL}/rest/v1/posts?select=id,title,slug&or=(${cond})`, { headers: sbHeaders() });
  if (!r.ok) return [];
  return await r.json();
}

// --- Replace helpers: repoint every reference from one URL to another so a
// re-uploaded (e.g. cropped) image takes over everywhere, then the old file
// can be removed. Keeps the reference the source of truth — no stale duplicate.
async function repointExact(table, col, oldUrl, newUrl) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${col}=eq.${encodeURIComponent(oldUrl)}`, {
    method: 'PATCH', headers: sbHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify({ [col]: newUrl }),
  });
  if (!r.ok) return 0;
  const rows = await r.json();
  return Array.isArray(rows) ? rows.length : 0;
}

// Blog posts store the full public URL inside body_html / featured_image /
// og_image; swap every occurrence (string replace, not a column overwrite).
async function repointPosts(path, oldUrl, newUrl) {
  const needle = `*${path}*`;
  const cond = `body_html.ilike.${needle},featured_image.ilike.${needle},og_image.ilike.${needle}`;
  const r = await fetch(`${SB_URL}/rest/v1/posts?select=id,body_html,featured_image,og_image&or=(${cond})`, { headers: sbHeaders() });
  if (!r.ok) return 0;
  const posts = await r.json();
  let n = 0;
  for (const p of posts) {
    const patch = {};
    for (const col of ['body_html', 'featured_image', 'og_image']) {
      if (p[col] && p[col].includes(oldUrl)) patch[col] = p[col].split(oldUrl).join(newUrl);
    }
    if (!Object.keys(patch).length) continue;
    const u = await fetch(`${SB_URL}/rest/v1/posts?id=eq.${encodeURIComponent(p.id)}`, {
      method: 'PATCH', headers: sbHeaders({ Prefer: 'return=minimal' }), body: JSON.stringify(patch),
    });
    if (u.ok) n++;
  }
  return n;
}

// Carry the alt/caption/title metadata onto the new path, then drop the old row.
async function carryMeta(oldPath, newPath) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/media?path=eq.${encodeURIComponent(oldPath)}&select=alt,caption,title`, { headers: sbHeaders() });
    const m = (r.ok ? await r.json() : [])[0];
    if (m && (m.alt || m.caption || m.title)) {
      await fetch(`${SB_URL}/rest/v1/media?on_conflict=path`, {
        method: 'POST', headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify({ path: newPath, alt: m.alt || null, caption: m.caption || null, title: m.title || null, updated_at: new Date().toISOString() }),
      });
    }
    await fetch(`${SB_URL}/rest/v1/media?path=eq.${encodeURIComponent(oldPath)}`, { method: 'DELETE', headers: sbHeaders() });
  } catch (e) { /* metadata is best-effort */ }
}

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  if (!SB_URL || !SB_KEY) return res.status(500).json({ ok: false, error: 'storage-not-configured' });

  try {
    if (req.method === 'GET') {
      const [objs, meta] = await Promise.all([listAll(), metaMap()]);
      objs.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      const files = objs.map((o) => {
        const m = meta[o.path] || {};
        return { path: o.path, name: o.name, url: publicUrl(o.path), alt: m.alt || '', caption: m.caption || '', title: m.title || '', size: o.size || null, created_at: o.created_at || '' };
      });
      return res.status(200).json({ ok: true, files });
    }

    const body = readBody(req);

    // Replace an image in place: point every reference at the newly-uploaded
    // file, then delete the old object. The browser uploads the replacement via
    // /api/admin/upload first (bypasses the body-size limit), then calls this.
    if (req.method === 'POST' && body.action === 'replace') {
      if (roleOf(user) !== 'admin') return res.status(403).json({ ok: false, error: 'forbidden' });
      const { oldPath, newPath } = body;
      if (!oldPath || !newPath) return res.status(422).json({ ok: false, error: 'paths-required' });
      if (oldPath === newPath) return res.status(422).json({ ok: false, error: 'same-path' });
      const oldUrl = publicUrl(oldPath), newUrl = publicUrl(newPath);
      const counts = {
        linkedin: await repointExact('linkedin_posts', 'image_url', oldUrl, newUrl),
        posts: await repointPosts(oldPath, oldUrl, newUrl),
      };
      await carryMeta(oldPath, newPath);
      // Old file last, once nothing points at it anymore. Best-effort.
      await cleanupIfOrphan(oldUrl);
      return res.status(200).json({ ok: true, url: newUrl, counts });
    }

    if (req.method === 'PATCH') {
      if (!body.path) return res.status(422).json({ ok: false, error: 'path-required' });
      const row = {
        path: body.path, alt: body.alt || null, caption: body.caption || null, title: body.title || null,
        updated_at: new Date().toISOString(),
      };
      const r = await fetch(`${SB_URL}/rest/v1/media?on_conflict=path`, {
        method: 'POST', headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }), body: JSON.stringify(row),
      });
      if (!r.ok) return res.status(502).json({ ok: false, error: 'save-failed', detail: await r.text() });
      return res.status(200).json({ ok: true, media: (await r.json())[0] || row });
    }

    if (req.method === 'DELETE') {
      if (roleOf(user) !== 'admin') return res.status(403).json({ ok: false, error: 'forbidden' });
      if (!body.path) return res.status(422).json({ ok: false, error: 'path-required' });
      if (!body.force) {
        const posts = await usedIn(body.path);
        if (posts.length) return res.status(409).json({ ok: false, error: 'in-use', posts });
      }
      const del = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${encPath(body.path)}`, { method: 'DELETE', headers: authOnly() });
      if (!del.ok) return res.status(502).json({ ok: false, error: 'delete-failed', detail: await del.text() });
      await fetch(`${SB_URL}/rest/v1/media?path=eq.${encodeURIComponent(body.path)}`, { method: 'DELETE', headers: sbHeaders() });
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return res.status(405).json({ ok: false, error: 'method-not-allowed' });
  } catch (err) {
    console.error('admin/media error', err);
    return res.status(500).json({ ok: false, error: 'server-error' });
  }
}

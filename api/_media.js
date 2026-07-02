// Shared media-storage helpers: detect whether an uploaded image is still used
// anywhere, and delete it if it has become an orphan. Used by the media library
// Replace and the LinkedIn manager so image changes clean up after themselves.

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
export const BUCKET = 'blog-media';

// Auth-only headers: a bodyless storage DELETE must NOT send a JSON
// content-type (the storage server rejects it with 400).
const auth = () => ({ apikey: SB_KEY, authorization: `Bearer ${SB_KEY}` });

// The storage path for one of our public URLs, or null if the URL isn't an
// object in our bucket (external/hard-coded images are never touched).
export function bucketPath(url) {
  if (!url || typeof url !== 'string') return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length).split('?')[0];
}

// Is this image still referenced by any LinkedIn post or blog post?
export async function isReferenced(url) {
  const path = bucketPath(url);
  if (!path) return true; // not ours → treat as referenced, never delete
  const li = await fetch(`${SB_URL}/rest/v1/linkedin_posts?image_url=eq.${encodeURIComponent(url)}&select=id&limit=1`, { headers: auth() });
  if (li.ok && (await li.json()).length) return true;
  const needle = `*${path}*`;
  const cond = `body_html.ilike.${needle},featured_image.ilike.${needle},og_image.ilike.${needle}`;
  const po = await fetch(`${SB_URL}/rest/v1/posts?select=id&limit=1&or=(${cond})`, { headers: auth() });
  if (po.ok && (await po.json()).length) return true;
  return false;
}

// Delete the storage object for `url` iff it's one of ours and no longer
// referenced anywhere. Best-effort. Returns true if it was deleted.
export async function cleanupIfOrphan(url) {
  const path = bucketPath(url);
  if (!path) return false;
  if (await isReferenced(url)) return false;
  const enc = path.split('/').map(encodeURIComponent).join('/');
  const del = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${enc}`, { method: 'DELETE', headers: auth() });
  return del.ok;
}

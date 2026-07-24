// Pages data-access layer for the block CMS. Mirrors _blog-data.js: PostgREST
// with the service key when configured; loud failure in production if not.

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(SB_URL && SB_KEY);

async function sb(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}` },
  });
  if (!r.ok) throw new Error(`supabase ${r.status}: ${await r.text()}`);
  return r.json();
}

// Missing config in production must fail loudly (5xx from callers), never
// silently serve an empty/seed page while returning 200.
function guardSeed() {
  if (!configured && process.env.VERCEL_ENV === 'production') {
    throw new Error('CONFIG ERROR: SUPABASE_URL/SUPABASE_SECRET_KEY missing in production - refusing to serve CMS pages');
  }
}

export async function getPageBySlug(slug) {
  if (!configured) { guardSeed(); return SEED.find((p) => p.slug === slug && p.status === 'published') || null; }
  const rows = await sb(`pages?slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`);
  return rows[0] || null;
}

// Any-status lookup - used only for authed admin draft preview.
export async function getPageBySlugAnyStatus(slug) {
  if (!configured) { guardSeed(); return SEED.find((p) => p.slug === slug) || null; }
  const rows = await sb(`pages?slug=eq.${encodeURIComponent(slug)}&limit=1`);
  return rows[0] || null;
}

// Find a published page whose previous slug matches (301 after a slug change).
export async function getPublishedByPrevSlug(slug) {
  if (!configured) { guardSeed(); return null; }
  const filter = encodeURIComponent(`{${slug}}`);
  const rows = await sb(`pages?status=eq.published&prev_slugs=cs.${filter}&select=slug&limit=1`);
  return rows[0] || null;
}

export async function listPublishedPages() {
  if (!configured) { guardSeed(); return SEED.filter((p) => p.status === 'published'); }
  return sb('pages?status=eq.published&select=slug,title,modified_at&order=modified_at.desc');
}

export const dataSource = configured ? 'supabase' : 'seed';

// No dev seed pages yet; empty until a page is authored/migrated. In non-prod an
// unconfigured DB simply yields 404s (guardSeed only throws in production).
const SEED = [];

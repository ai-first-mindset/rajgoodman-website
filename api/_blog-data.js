// Blog data-access layer. Queries Supabase (PostgREST) with the service role
// key when configured; otherwise falls back to an in-repo SEED post so the
// branch renders end-to-end before the database is wired.

// Prefer the new Supabase secret key (sb_secret_…); fall back to the legacy
// service_role JWT for resilience during the key migration.
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

// In production a missing Supabase config must be a LOUD failure (5xx from the
// callers' catch blocks), never a silent fallback that replaces the whole blog
// with the one seed post while every page still returns 200.
function guardSeed() {
  if (!configured && process.env.VERCEL_ENV === 'production') {
    throw new Error('CONFIG ERROR: SUPABASE_URL/SUPABASE_SECRET_KEY missing in production — refusing to serve seed content');
  }
}

export async function getPostBySlug(slug) {
  if (!configured) { guardSeed(); return SEED.find((p) => p.slug === slug && p.status === 'published') || null; }
  const rows = await sb(`posts?slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`);
  return rows[0] || null;
}

// Any-status lookup — used only for authed admin draft preview.
export async function getPostBySlugAnyStatus(slug) {
  if (!configured) { guardSeed(); return SEED.find((p) => p.slug === slug) || null; }
  const rows = await sb(`posts?slug=eq.${encodeURIComponent(slug)}&limit=1`);
  return rows[0] || null;
}

// Find a published post whose previous slug matches (for 301 redirects after a
// slug change). Returns the post's current slug, or null.
export async function getPublishedByPrevSlug(slug) {
  if (!configured) { guardSeed(); return null; }
  const filter = encodeURIComponent(`{${slug}}`);
  const rows = await sb(`posts?status=eq.published&prev_slugs=cs.${filter}&select=slug&limit=1`);
  return rows[0] || null;
}

export async function listPublished() {
  if (!configured) { guardSeed(); return SEED.filter((p) => p.status === 'published'); }
  return sb('posts?status=eq.published&select=slug,title,excerpt,featured_image,categories,published_at,modified_at&order=published_at.desc');
}

// Category helpers. Categories are stored as display names (text[]) on each post;
// the URL slug is derived from the name.
export function catSlug(name) {
  return String(name == null ? '' : name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
export async function getAllCategories() {
  const posts = await listPublished();
  const map = new Map();
  posts.forEach((p) => (p.categories || []).forEach((c) => { const s = catSlug(c); if (s && !map.has(s)) map.set(s, c); }));
  return [...map.entries()].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name));
}
export async function listByCategory(slug) {
  const posts = await listPublished();
  return posts.filter((p) => (p.categories || []).some((c) => catSlug(c) === slug));
}

export const dataSource = configured ? 'supabase' : 'seed';

// --- Dev seed (used only until SUPABASE_URL/KEY are set) ---
const SEED = [
  {
    slug: 'sample-ai-post',
    title: 'A Sample Post — Proving the Blog Render Path',
    seo_title: 'Sample Post — rajgoodman.com Blog Editor (render-path test)',
    meta_description: 'A seed post used to verify the new Supabase-backed blog render path renders full Yoast-equivalent SEO metadata at /blog/{slug}/.',
    excerpt: 'A seed post used to verify the new blog render path.',
    body_html:
      '<p>This page is rendered by the new serverless blog engine from a data record — not a hand-written HTML file. ' +
      'It exists to prove the render path, the themed chrome (nav + footer via <code>chrome.js</code>), and full SEO metadata before the database is wired.</p>' +
      '<h2>What this demonstrates</h2><ul><li>SSR HTML with a complete &lt;head&gt; (canonical, OpenGraph, Twitter, Article JSON-LD)</li>' +
      '<li>The site theme via <code>site.css</code> + injected chrome</li><li>Edge caching for static-like performance</li></ul>' +
      '<p>Once Supabase is connected, this seed is ignored and real posts are served from the <code>posts</code> table.</p>',
    featured_image: 'https://djpxdnxnvuokdfxlwktx.supabase.co/storage/v1/object/public/blog-media/wp-content/uploads/2025/06/Rectangle-2-1.webp',
    featured_image_alt: 'Raj Goodman',
    author: 'Raj Goodman Anand',
    canonical_url: null,
    robots: 'noindex, follow',
    focus_keyphrase: null,
    status: 'published',
    published_at: '2026-06-23T00:00:00+00:00',
    modified_at: '2026-06-23T00:00:00+00:00',
  },
];

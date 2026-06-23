// Blog data-access layer. Queries Supabase (PostgREST) with the service role
// key when configured; otherwise falls back to an in-repo SEED post so the
// branch renders end-to-end before the database is wired.

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(SB_URL && SB_KEY);

async function sb(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}` },
  });
  if (!r.ok) throw new Error(`supabase ${r.status}: ${await r.text()}`);
  return r.json();
}

export async function getPostBySlug(slug) {
  if (!configured) return SEED.find((p) => p.slug === slug && p.status === 'published') || null;
  const rows = await sb(`posts?slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`);
  return rows[0] || null;
}

export async function listPublished() {
  if (!configured) return SEED.filter((p) => p.status === 'published');
  return sb('posts?status=eq.published&select=slug,title,excerpt,featured_image,published_at,modified_at&order=published_at.desc');
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
    featured_image: 'https://cdn.rajgoodman.com/wp-content/uploads/2025/06/Rectangle-2-1.webp',
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

// Dynamic XML sitemaps, mirroring Yoast's structure:
//   /sitemap_index.xml -> /post-sitemap.xml (DB) + /page-sitemap.xml (static)
// Wired via rewrites in vercel.json. Posts come from the published set in the DB.

import { listPublished, getAllCategories } from './_blog-data.js';

const SITE = 'https://rajgoodman.com';

// The static pages (canonical paths) - kept in sync with the canonical tags.
const PAGES = ['/', '/about/', '/ai-business-consultant/', '/keynote-speaker/',
  '/ai-for-business-leaders/', '/ai-trainer/', '/events/', '/media/',
  '/ai-training-for-executives/', '/blog/', '/testimonials/', '/eo-ypo-leadership/',
  '/fractional-chief-ai-officer/', '/organizational-transformation-consultant/',
  '/workshops/tech-workshop/', '/privacy-policy/'];

function urlTag(loc, lastmod) {
  return `<url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
}
function doc(inner, root = 'urlset') {
  const ns = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<${root} ${ns}>\n${inner}\n</${root}>`;
}

export default async function handler(req, res) {
  let kind = (req.query && req.query.kind) || '';
  if (!kind && req.url) { try { kind = new URL(req.url, 'http://x').searchParams.get('kind') || ''; } catch (e) { /* noop */ } }

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');

  try {
    if (kind === 'pages') {
      return res.status(200).send(doc(PAGES.map((p) => urlTag(SITE + p)).join('\n')));
    }
    if (kind === 'posts') {
      const posts = await listPublished();
      const items = posts.map((p) => urlTag(`${SITE}/blog/${p.slug}/`, (p.modified_at || p.published_at || '').slice(0, 10)));
      return res.status(200).send(doc(items.join('\n')));
    }
    if (kind === 'categories') {
      const cats = await getAllCategories();
      return res.status(200).send(doc(cats.map((c) => urlTag(`${SITE}/blog/category/${c.slug}/`)).join('\n')));
    }
    // default: sitemap index
    const subs = [`${SITE}/post-sitemap.xml`, `${SITE}/page-sitemap.xml`, `${SITE}/category-sitemap.xml`]
      .map((loc) => `<sitemap><loc>${loc}</loc></sitemap>`).join('\n');
    return res.status(200).send(doc(subs, 'sitemapindex'));
  } catch (err) {
    console.error('sitemap error', err);
    return res.status(500).send(doc('', 'urlset'));
  }
}

// RSS 2.0 feed at /feed/ (via vercel.json rewrite) - parity with the old
// WordPress feed so existing subscribers and aggregators keep working.

import { listPublished } from './_blog-data.js';

const SITE = 'https://rajgoodman.com';

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]
  ));
}

export function rss(posts) {
  const items = posts.map((p) => {
    const url = `${SITE}/blog/${p.slug}/`;
    const pub = p.published_at ? new Date(p.published_at).toUTCString() : '';
    return `<item>
<title>${esc(p.title)}</title>
<link>${url}</link>
<guid isPermaLink="true">${url}</guid>${pub ? `\n<pubDate>${pub}</pubDate>` : ''}${p.excerpt ? `\n<description>${esc(p.excerpt)}</description>` : ''}${(p.categories || []).map((c) => `\n<category>${esc(c)}</category>`).join('')}
</item>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>Raj Goodman - AI, Strategy &amp; Innovation</title>
<link>${SITE}/blog/</link>
<atom:link href="${SITE}/feed/" rel="self" type="application/rss+xml" />
<description>Raj Goodman's latest thinking on AI, leadership and strategy.</description>
<language>en-US</language>
${items}
</channel>
</rss>`;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  try {
    const posts = await listPublished();
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
    return res.status(200).send(rss(posts));
  } catch (err) {
    console.error('feed failed', err);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).send(rss([]));
  }
}

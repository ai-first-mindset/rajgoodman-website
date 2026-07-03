// SSR a category archive at /blog/category/{slug}/ (via vercel.json rewrite).
// Lists published posts in the category, using the site theme + chrome.

import { listByCategory, catSlug } from './_blog-data.js';
import { renderNotFound } from './_post-template.js';

const SITE = 'https://rajgoodman.com';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function card(p) {
  const img = p.featured_image
    ? `<div class="th"><img src="${esc(p.featured_image)}" alt="${esc(p.featured_image_alt || p.title)}" loading="lazy"/></div>`
    : '';
  const ex = p.excerpt ? `<p>${esc(p.excerpt)}</p>` : '';
  return `<a class="post" href="/blog/${esc(p.slug)}/">${img}<div class="bd"><h3>${esc(p.title)}</h3>${ex}<span class="go">READ &#8594;</span></div></a>`;
}

function page(name, slug, posts) {
  const url = `${SITE}/blog/category/${slug}/`;
  const title = `${name} — Raj Goodman Blog`;
  const desc = `Articles on ${name} from Raj Goodman — practical thinking on AI, leadership and strategy.`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
<link rel="canonical" href="${esc(url)}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${esc(url)}" />
<meta property="og:site_name" content="Raj Goodman" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Playfair+Display:ital,wght@0,700;0,900;1,700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/site.css" />
<link rel="icon" href="/assets/favicon-32.png" sizes="32x32" />
<link rel="icon" href="/assets/favicon-192.png" sizes="192x192" />
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
</head>
<body data-page="blog">
<div class="bg-grid"></div>
<div class="scan"></div>
<main>
<header class="phero" style="padding-bottom:30px">
  <div class="wrap">
    <div class="crumbs"><a href="/">Home</a><span class="sep">/</span><a href="/blog/">Blog</a><span class="sep">/</span><span>${esc(name)}</span></div>
    <span class="eyebrow"><span class="live"></span>Category</span>
    <h1>${esc(name)}</h1>
    <p class="lede">${posts.length ? `${posts.length} article${posts.length === 1 ? '' : 's'} on ${esc(name)}.` : 'No articles in this category yet — browse all articles below.'}</p>
  </div>
</header>
<section class="sec" style="padding-top:30px">
  <div class="wrap">
    <div class="blog-grid">${posts.map(card).join('')}</div>
    <div style="margin-top:40px"><a href="/blog/" class="btn btn-line">&larr; All articles</a></div>
  </div>
</section>
</main>
<script src="/chrome.js"></script>
<script src="/common.js"></script>
</body>
</html>`;
}

export default async function handler(req, res) {
  let raw = req.query && req.query.slug;
  if (!raw && req.url) { try { raw = new URL(req.url, 'http://x').searchParams.get('slug'); } catch (e) { /* noop */ } }
  const slug = (raw || '').toString().replace(/\/+$/, '');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  let posts = [];
  try { posts = slug ? await listByCategory(slug) : []; }
  catch (err) { console.error('render-category failed', err); res.setHeader('Cache-Control', 'no-store'); return res.status(500).send(renderNotFound()); }

  if (!posts.length) {
    // Category-flavored empty state (not the post "Article not found" page):
    // same layout, honest copy, 404 so crawlers don't index an empty archive.
    const pretty = slug.replace(/-/g, ' ').replace(/\b[a-z]/g, (c) => c.toUpperCase());
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    return res.status(404).send(page(pretty, slug, []));
  }
  const name = posts[0].categories.find((c) => catSlug(c) === slug) || slug;
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
  return res.status(200).send(page(name, slug, posts));
}

// SSR /blog/ index: full page chrome from the template, article grid populated
// live from the DB. Served via the vercel.json rewrite (/blog/ -> here).

import { listPublished } from './_blog-data.js';
import { TEMPLATE } from './_blog-index-template.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function card(p) {
  const img = p.featured_image
    ? `<div class="th"><img src="${esc(p.featured_image)}" alt="${esc(p.featured_image_alt || p.title)}" loading="lazy"/></div>`
    : '';
  const ex = p.excerpt ? `<p>${esc(p.excerpt)}</p>` : '';
  return `<a class="post" href="/blog/${esc(p.slug)}/" data-reveal>${img}<div class="bd"><h3>${esc(p.title)}</h3>${ex}<span class="go">READ &#8594;</span></div></a>`;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');

  let posts = [];
  try {
    posts = await listPublished();
  } catch (err) {
    console.error('blog-index failed', err);
  }

  const grid = posts.length
    ? posts.map(card).join('\n')
    : '<p style="opacity:.7;grid-column:1/-1">No articles published yet — check back soon.</p>';

  // Function replacement avoids $-pattern interpretation in the grid HTML.
  return res.status(200).send(TEMPLATE.replace('{{POSTS}}', () => grid));
}

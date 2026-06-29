// SSR /blog/ index: full page chrome from the template, article grid populated
// live from the DB. Served via the vercel.json rewrite (/blog/ -> here).

import { listPublished, getAllCategories } from './_blog-data.js';
import { TEMPLATE } from './_blog-index-template.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function card(p) {
  const img = p.featured_image
    ? `<div class="th"><img src="${esc(p.featured_image)}" alt="${esc(p.featured_image_alt || p.title)}" loading="lazy"/></div>`
    : '';
  const date = p.published_at
    ? `<time datetime="${esc(p.published_at)}" style="display:block;font-size:.76rem;color:var(--tx-40);margin:0 0 8px">${esc(fmtDate(p.published_at))}</time>`
    : '';
  const ex = p.excerpt ? `<p>${esc(p.excerpt)}</p>` : '';
  return `<a class="post" href="/blog/${esc(p.slug)}/" data-reveal>${img}<div class="bd"><h3>${esc(p.title)}</h3>${date}${ex}<span class="go">READ &#8594;</span></div></a>`;
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

  let cats = [];
  try { cats = await getAllCategories(); } catch (e) { /* noop */ }
  const catRow = cats.length
    ? `<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:26px;align-items:center"><span style="color:var(--tx-40);font-size:.74rem;text-transform:uppercase;letter-spacing:.12em">Browse</span>${cats.map((c) => `<a href="/blog/category/${c.slug}/" style="font-size:.84rem;color:var(--tx-60);border:1px solid var(--line);padding:5px 13px;border-radius:20px;text-decoration:none">${esc(c.name)}</a>`).join('')}</div>`
    : '';

  // Function replacement avoids $-pattern interpretation in the HTML.
  const withCats = TEMPLATE.replace('<div class="blog-grid">{{POSTS}}</div>', () => `${catRow}<div class="blog-grid">{{POSTS}}</div>`);
  return res.status(200).send(withCats.replace('{{POSTS}}', () => grid));
}

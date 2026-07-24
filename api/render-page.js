// SSR a single published CMS page at its clean URL (via a vercel.json rewrite,
// e.g. /about/ → /api/render-page/?slug=about). Edge-cached; 404s are themed.

import { getPageBySlug, getPageBySlugAnyStatus, getPublishedByPrevSlug } from './_pages-data.js';
import { renderPage, renderNotFound } from './_page-template.js';
import { getAuthedUser } from './_auth.js';

export default async function handler(req, res) {
  let raw = req.query && req.query.slug;
  if (!raw && req.url) {
    try { raw = new URL(req.url, 'http://x').searchParams.get('slug'); } catch (e) { /* noop */ }
  }
  const slug = (raw || '').toString().replace(/\/+$/, '');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!slug) {
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    return res.status(404).send(renderNotFound());
  }

  let page, preview = false;
  try {
    page = await getPageBySlug(slug);
    // Authed admins can preview an unpublished draft (never cached, noindex).
    if (!page && (await getAuthedUser(req))) {
      page = await getPageBySlugAnyStatus(slug);
      preview = Boolean(page);
    }
  } catch (err) {
    console.error('render-page failed', err);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).send(renderNotFound());
  }

  if (!page) {
    // 301 from a previous slug of a published page, if one matches.
    try {
      const moved = await getPublishedByPrevSlug(slug);
      if (moved) {
        res.setHeader('Cache-Control', 'public, s-maxage=300');
        res.statusCode = 301;
        res.setHeader('Location', `/${moved.slug}/`);
        return res.end();
      }
    } catch (e) { /* fall through to 404 */ }
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    return res.status(404).send(renderNotFound());
  }

  if (preview) {
    page = { ...page, robots: 'noindex, nofollow' };
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(renderPage(page));
  }

  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
  return res.status(200).send(renderPage(page));
}

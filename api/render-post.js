// SSR a single published blog post at /blog/{slug}/ (via the vercel.json rewrite).
// Cached at the edge for static-like performance; 404s are themed + short-cached.

import { getPostBySlug, getPostBySlugAnyStatus } from './_blog-data.js';
import { renderPost, renderNotFound } from './_post-template.js';
import { isAuthed } from './_auth.js';

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

  let post, preview = false;
  try {
    post = await getPostBySlug(slug);
    // Authed admins can preview an unpublished draft (never cached, noindex).
    if (!post && isAuthed(req)) {
      post = await getPostBySlugAnyStatus(slug);
      preview = Boolean(post);
    }
  } catch (err) {
    console.error('render-post failed', err);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).send(renderNotFound());
  }

  if (!post) {
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    return res.status(404).send(renderNotFound());
  }

  if (preview) {
    post = { ...post, robots: 'noindex, nofollow' };
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(renderPost(post));
  }

  // Static-like caching; revalidate in the background after 5 min.
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
  return res.status(200).send(renderPost(post));
}

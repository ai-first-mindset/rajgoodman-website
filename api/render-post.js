// SSR a single published blog post at /blog/{slug}/ (via the vercel.json rewrite).
// Cached at the edge for static-like performance; 404s are themed + short-cached.

import { getPostBySlug, getPostBySlugAnyStatus, getPublishedByPrevSlug, listPublished } from './_blog-data.js';
import { renderPost, renderNotFound } from './_post-template.js';
import { getAuthedUser } from './_auth.js';
import { imageSize } from './_image-size.js';

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
    if (!post && (await getAuthedUser(req))) {
      post = await getPostBySlugAnyStatus(slug);
      preview = Boolean(post);
    }
  } catch (err) {
    console.error('render-post failed', err);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).send(renderNotFound());
  }

  if (!post) {
    // 301 from a previous slug of a published post, if one matches.
    try {
      const moved = await getPublishedByPrevSlug(slug);
      if (moved) {
        res.setHeader('Cache-Control', 'public, s-maxage=300');
        res.statusCode = 301;
        res.setHeader('Location', `/blog/${moved.slug}/`);
        return res.end();
      }
    } catch (e) { /* fall through to 404 */ }
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    return res.status(404).send(renderNotFound());
  }

  // Recent posts for the "Recent Posts" section (3 most recent, excluding this one).
  let recent = [];
  try { recent = (await listPublished()).filter((p) => p.slug !== post.slug).slice(0, 3); } catch (e) { /* noop */ }

  // Give the hero its real size so the page doesn't jump as it loads. Fails
  // soft: no dimensions just means the template leaves the attributes off.
  const dims = await imageSize(post.featured_image);
  if (dims) post = { ...post, featured_image_width: dims.width, featured_image_height: dims.height };

  if (preview) {
    post = { ...post, robots: 'noindex, nofollow' };
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(renderPost(post, recent));
  }

  // Static-like caching; revalidate in the background after 5 min.
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
  return res.status(200).send(renderPost(post, recent));
}

// CDN cache tagging + purge for the blog. Blog pages are cached at the edge for
// five minutes (s-maxage=300), so an edit in the admin used to take up to five
// minutes to reach the live site. Every blog-derived response now carries the
// BLOG_TAG cache tag, and every admin write deletes that tag so the next
// request renders fresh.
//
// Delete rather than invalidate: invalidate serves the stale copy once more
// while it refreshes in the background, and an editor checks the live page
// straight after saving. Blog traffic is low, so there is no stampede risk.
//
// The purge goes through the per-request context that @vercel/functions'
// dangerouslyDeleteByTag() reads; inlined here because the repo has no
// dependencies. Outside Vercel (tests, local dev) there is no context, so the
// purge is a no-op and the pages simply expire on their s-maxage as before.

export const BLOG_TAG = 'blog';

export function tagBlog(res) {
  res.setHeader('Vercel-Cache-Tag', BLOG_TAG);
}

export async function purgeBlog() {
  const ctx = globalThis[Symbol.for('@vercel/request-context')]?.get?.() ?? {};
  if (!ctx.purge) return false;
  try {
    await ctx.purge.dangerouslyDeleteByTag(BLOG_TAG);
    return true;
  } catch (err) {
    // A failed purge must not fail the save: the page still refreshes on its
    // s-maxage, just not instantly.
    console.error('blog cache purge failed', err);
    return false;
  }
}

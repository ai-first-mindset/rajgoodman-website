// Public read for the homepage "On LinkedIn" widget: the first 4 visible posts
// by sort_order. Uses the Supabase secret key server-side; returns only safe
// public fields. Fails soft (empty list) so the static fallback cards remain.

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false }); }
  if (!SB_URL || !SB_KEY) return res.status(200).json({ ok: true, posts: [] });
  try {
    const r = await fetch(`${SB_URL}/rest/v1/linkedin_posts?select=url,title,image_url&visible=eq.true&order=sort_order.asc&limit=4`, {
      headers: { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}` },
    });
    if (!r.ok) {
      // Fail-soft is deliberate (homepage keeps its fallback cards) — but log,
      // or a DB outage silently freezes the widget with no way to notice.
      console.error('linkedin: DB query failed', r.status, (await r.text()).slice(0, 200));
      return res.status(200).json({ ok: true, posts: [] });
    }
    // Short edge cache so admin edits (new/cropped images, reordering) show up
    // within ~1 min; stale-while-revalidate keeps it fast without long staleness.
    res.setHeader('cache-control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ ok: true, posts: await r.json() });
  } catch (e) {
    console.error('linkedin: fetch threw', e);
    return res.status(200).json({ ok: true, posts: [] });
  }
}

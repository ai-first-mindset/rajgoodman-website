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
    if (!r.ok) return res.status(200).json({ ok: true, posts: [] });
    res.setHeader('cache-control', 'public, max-age=60, s-maxage=300');
    return res.status(200).json({ ok: true, posts: await r.json() });
  } catch (e) {
    return res.status(200).json({ ok: true, posts: [] });
  }
}

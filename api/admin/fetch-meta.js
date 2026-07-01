// Auth-gated helper: given a URL, fetch its page and return the og:title so the
// LinkedIn manager can prefill the title field. LinkedIn formats og:title as
// "Title | Author | N comments", so we keep the first " | "-delimited segment.

import { requireUser } from '../_auth.js';

function getUrl(req) {
  let u = req.query && req.query.url;
  if (!u && req.url) { try { u = new URL(req.url, 'http://x').searchParams.get('url'); } catch (e) { /* noop */ } }
  return u ? String(u) : null;
}
export function decode(s) {
  return s.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&hellip;/g, '…').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}
// Pull the og:title out of a page's HTML and clean it (decode entities, drop the
// "| Author | N comments" suffix LinkedIn appends). Returns '' if none found.
export function extractTitle(html) {
  const m = String(html || '').match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']*)["']/i)
    || String(html || '').match(/<meta[^>]+content=["']([^"']*)["'][^>]*property=["']og:title["']/i);
  return m ? decode(m[1]).split(/\s+\|\s+/)[0].trim() : '';
}

export default async function handler(req, res) {
  if (!(await requireUser(req, res))) return;
  const url = getUrl(req);
  if (!url || !/^https?:\/\//i.test(url)) return res.status(422).json({ ok: false, error: 'url-required' });
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; rajgoodman-bot/1.0)' }, redirect: 'follow' });
    const html = await r.text();
    return res.status(200).json({ ok: true, title: extractTitle(html) });
  } catch (e) {
    return res.status(200).json({ ok: true, title: '' });
  }
}

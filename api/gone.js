// 410 Gone for pages taken down for good (via vercel.json rewrites). Unlike a
// 404, 410 tells search engines the removal is deliberate, so they drop the URL
// quickly; unlike a redirect, it does not pass the old page off as another one.
// Mirrors api/gone.js in the aifirstmindset-website repo.
//
// Pages routed here (SEO round 1, Nov 2026: the consulting services are no
// longer offered): /ai-business-consultant/ and
// /organizational-transformation-consultant/. Keep them out of api/sitemap.js,
// site-map.html and chrome.js.

export const GONE_PATHS = ['/ai-business-consultant/', '/organizational-transformation-consultant/'];

export const GONE_HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script src="/assets/cookie-consent.js"></script>
<link rel="icon" href="/assets/favicon-32.png" sizes="32x32" />
<link rel="icon" href="/assets/favicon-192.png" sizes="192x192" />
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
<title>Page removed - Raj Goodman</title><meta name="robots" content="noindex" />
<meta name="theme-color" content="#f2f2ef" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/site.css" /></head>
<body data-page=""><main><article class="wrap" style="max-width:760px;padding:180px 34px 120px;text-align:center">
<h1>This page has been removed</h1><p style="color:var(--tx-60);margin:1rem 0 1.6rem">It is no longer part of this site. Raj now helps leaders and teams learn AI through keynotes, workshops and training.</p>
<a href="/ai-for-business-leaders/" class="btn btn-line">See AI for Business Leaders &rarr;</a></article></main>
<script src="/chrome.js"></script><script src="/common.js"></script></body></html>`;

export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.setHeader('Cache-Control', 'public, s-maxage=86400');
  return res.status(410).send(GONE_HTML);
}

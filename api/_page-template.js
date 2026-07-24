// Renders a CMS page record (block array) into a complete, SEO-faithful
// interior page that matches the static marketing pages: chrome injected by
// chrome.js, styling via site.css, blocks rendered by api/_blocks.js.

import { renderBlocks, extractFaqItems, esc } from './_blocks.js';

const SITE = 'https://rajgoodman.com';
const SITE_NAME = 'Raj Goodman';
const TWITTER = '@RajAnand';
const DEFAULT_OG_IMAGE = 'https://djpxdnxnvuokdfxlwktx.supabase.co/storage/v1/object/public/blog-media/wp-content/uploads/2025/06/Rectangle-2-1.webp';
const PERSON_ID = `${SITE}/#raj`;        // site-wide Person node
const WEBSITE_ID = `${SITE}/#website`;
const SAME_AS = ['https://www.linkedin.com/in/rajanand/', 'https://x.com/RajAnand'];

export function renderPage(page) {
  const url = page.canonical_url || `${SITE}/${page.slug}/`;
  const title = page.seo_title || page.title;
  const desc = page.meta_description || page.excerpt || '';
  const modified = page.modified_at || page.published_at;

  const ogTitle = page.og_title || title;
  const ogDesc = page.og_description || desc;
  const ogImg = page.og_image || page.featured_image || DEFAULT_OG_IMAGE;

  const webpageId = `${url}#webpage`;
  const breadcrumbId = `${url}#breadcrumb`;
  const imageId = `${url}#primaryimage`;
  const graph = [
    {
      '@type': 'Person', '@id': PERSON_ID, name: 'Raj Goodman Anand', alternateName: 'Raj Goodman',
      url: `${SITE}/`, image: DEFAULT_OG_IMAGE, jobTitle: 'AI Futurist, Keynote Speaker & Founder', sameAs: SAME_AS,
    },
    {
      '@type': 'WebSite', '@id': WEBSITE_ID, url: `${SITE}/`, name: SITE_NAME,
      publisher: { '@id': PERSON_ID }, inLanguage: 'en-US',
    },
    { '@type': 'ImageObject', '@id': imageId, url: ogImg, contentUrl: ogImg, inLanguage: 'en-US' },
    {
      '@type': 'WebPage', '@id': webpageId, url, name: title, isPartOf: { '@id': WEBSITE_ID },
      primaryImageOfPage: { '@id': imageId }, image: { '@id': imageId },
      dateModified: modified, description: desc, breadcrumb: { '@id': breadcrumbId }, inLanguage: 'en-US',
    },
    {
      '@type': 'BreadcrumbList', '@id': breadcrumbId, itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: page.title },
      ],
    },
  ];
  const faqs = extractFaqItems(page.blocks);
  if (faqs.length) {
    graph.push({
      '@type': 'FAQPage', '@id': `${url}#faq`,
      mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    });
  }
  const jsonld = { '@context': 'https://schema.org', '@graph': graph };
  // Any bespoke per-page schema (e.g. about's rich Person node) is preserved
  // verbatim as its own second ld+json block.
  const customLd = page.json_ld
    ? `\n<script type="application/ld+json">${JSON.stringify(page.json_ld)}</script>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script src="/assets/cookie-consent.js"></script>
<link rel="icon" href="/assets/favicon-32.png" sizes="32x32" />
<link rel="icon" href="/assets/favicon-192.png" sizes="192x192" />
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<meta name="robots" content="${esc(page.robots || 'index, follow')}" />
<link rel="canonical" href="${esc(url)}" />
<meta property="og:locale" content="en_US" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${esc(ogTitle)}" />
<meta property="og:description" content="${esc(ogDesc)}" />
<meta property="og:url" content="${esc(url)}" />
<meta property="og:site_name" content="${esc(SITE_NAME)}" />
<meta property="og:image" content="${esc(ogImg)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="${TWITTER}" />
<meta name="twitter:title" content="${esc(ogTitle)}" />
<meta name="twitter:description" content="${esc(ogDesc)}" />
<meta name="twitter:image" content="${esc(ogImg)}" />
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>${customLd}
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Libre+Baskerville:wght@700&family=Playfair+Display:ital,wght@0,700;0,900;1,700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/site.css" />
</head>
<body data-page="${esc(page.slug)}">
<div class="bg-grid"></div>
<div class="scan"></div>
<main>
${renderBlocks(page.blocks)}
</main>
<script src="/chrome.js"></script>
<script src="/common.js"></script>
</body>
</html>`;
}

export function renderNotFound() {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Page not found - ${SITE_NAME}</title><meta name="robots" content="noindex" />
<link rel="stylesheet" href="/site.css" /></head>
<body data-page=""><main><section class="sec tight"><div class="wrap" style="padding:140px 0 100px;text-align:center">
<h1>Page not found</h1><p style="opacity:.75">That page doesn't exist or isn't published yet.</p>
<p><a href="/">&larr; Back home</a></p></div></section></main>
<script src="/chrome.js"></script><script src="/common.js"></script></body></html>`;
}

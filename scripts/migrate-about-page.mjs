// Builds the `about` Pages-CMS record from the legacy static about.html:
// bespoke sections become verbatim raw-html blocks, the FAQ becomes a typed
// faq block, and the custom Person schema is preserved in json_ld.
//
//   node scripts/migrate-about-page.mjs            → print the record JSON
//   node scripts/migrate-about-page.mjs --render   → render it (no DB) to scratch HTML for parity diffing
//   node scripts/migrate-about-page.mjs --push     → upsert into Supabase `pages` (needs SUPABASE_URL/SECRET_KEY + the pages table)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');

export function buildAboutRecord() {
  const html = readFileSync(join(root, 'about.html'), 'utf8');
  const mainInner = html.match(/<main>([\s\S]*?)<\/main>/)[1];

  // Split the body at the FAQ / WORK section comment markers.
  const faqStart = mainInner.indexOf('<!-- FAQ -->');
  const workStart = mainInner.indexOf('<!-- WORK -->');
  if (faqStart < 0 || workStart < 0) throw new Error('FAQ/WORK markers not found in about.html');
  const before = mainInner.slice(0, faqStart).replace(/\s+$/, '');
  const faqChunk = mainInner.slice(faqStart, workStart);
  const workChunk = mainInner.slice(workStart).replace(/\s+$/, '');

  // Parse the FAQ <details> into typed items.
  const items = [];
  const dre = /<details(\s+open)?><summary>([\s\S]*?)<span class="pm-ic"><\/span><\/summary><div class="ans">([\s\S]*?)<\/div><\/details>/gi;
  let m;
  while ((m = dre.exec(faqChunk))) {
    items.push({ question: m[2].trim(), answer_html: m[3].trim(), open: Boolean(m[1]) });
  }
  if (items.length !== 5) throw new Error(`expected 5 FAQ items, parsed ${items.length}`);

  // Preserve the bespoke Person schema verbatim.
  const jsonLd = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);

  const blocks = [
    { type: 'raw-html', id: 'about-hero-to-reach', html: before.replace(/^\s+/, '') },
    { type: 'faq', id: 'about-faq', idx: '[ 10 ]', kicker: 'FAQs', heading: 'Questions, answered', items },
    { type: 'raw-html', id: 'about-work', html: workChunk },
  ];

  return {
    slug: 'about',
    title: 'About Raj Goodman',
    seo_title: 'About Raj Goodman - Human-First Innovator & AI Futurist',
    meta_description: 'Raj Goodman, human-first innovator and AI futurist, helps leaders cut costs, rethink business models, and drive innovation in changing markets.',
    canonical_url: 'https://rajgoodman.com/about/',
    og_title: 'About Raj Goodman | Human-First Innovator & AI Futurist',
    og_description: 'Raj Goodman, human-first innovator and AI futurist, helps leaders cut costs, rethink business models, and drive innovation in changing markets.',
    robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    blocks,
    json_ld: jsonLd,
    status: 'published',
    published_at: '2025-09-15T10:57:08+00:00',
  };
}

async function main() {
  const mode = process.argv[2];
  const rec = buildAboutRecord();

  if (mode === '--render') {
    const { renderPage } = await import('../api/_page-template.js');
    const out = renderPage({ ...rec, modified_at: rec.published_at });
    const dest = join(process.env.TMP_HTML || root, 'scratch-about-cms.html');
    writeFileSync(dest, out, 'utf8');
    console.log('Rendered CMS about →', dest, `(${out.length} bytes)`);
    return;
  }

  if (mode === '--push') {
    const SB_URL = process.env.SUPABASE_URL;
    const SB_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SB_URL || !SB_KEY) throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY required for --push');
    const h = { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}`, 'content-type': 'application/json' };
    // Idempotent: remove any existing about row, then insert.
    await fetch(`${SB_URL}/rest/v1/pages?slug=eq.about`, { method: 'DELETE', headers: h });
    const r = await fetch(`${SB_URL}/rest/v1/pages`, {
      method: 'POST', headers: { ...h, Prefer: 'return=representation' }, body: JSON.stringify(rec),
    });
    if (!r.ok) throw new Error(`push failed ${r.status}: ${await r.text()}`);
    console.log('Pushed about page →', (await r.json())[0].id);
    return;
  }

  console.log(JSON.stringify(rec, null, 2).slice(0, 1200) + '\n… (truncated; blocks + json_ld included)');
}

main().catch((e) => { console.error(e); process.exit(1); });

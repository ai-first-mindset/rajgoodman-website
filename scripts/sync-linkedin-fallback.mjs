// Regenerate the homepage "On LinkedIn" fallback cards in index.html from the
// linkedin_posts table, so the static first paint matches what the widget loads
// from /api/linkedin (no flash of stale images, no manual editing).
//
// Run after changing LinkedIn posts/images in the admin, then commit index.html:
//   node scripts/sync-linkedin-fallback.mjs
//
// Reads SUPABASE_URL / SUPABASE_SECRET_KEY from .env (same as the API). Node 18+.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) env[m[1]] = m[2];
    }
  } catch { /* no .env */ }
  return env;
}

const env = loadEnv();
const SB = env.SUPABASE_URL;
const KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB || !KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SECRET_KEY in .env');
  process.exit(1);
}

// Same query the public widget API uses: first 4 visible posts by sort order.
const res = await fetch(
  `${SB}/rest/v1/linkedin_posts?select=url,image_url&visible=eq.true&order=sort_order.asc&limit=4`,
  { headers: { apikey: KEY, authorization: `Bearer ${KEY}` } },
);
if (!res.ok) { console.error('Fetch failed:', res.status, await res.text()); process.exit(1); }
const posts = await res.json();
if (!posts.length) { console.error('No visible LinkedIn posts — refusing to blank the fallback.'); process.exit(1); }

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const hrefOf = (u) => esc(String(u).split('?')[0]); // drop tracking params from the static href

const cards = posts.map((p, i) => {
  const delay = i === 0 ? '' : ` data-delay="${i * 80}"`;
  return `      <a class="li-card" href="${hrefOf(p.url)}" target="_blank" rel="noopener" data-reveal${delay}>`
    + `<img src="${esc(p.image_url)}" alt="Raj Goodman LinkedIn post"/><span class="tag">in · Raj Anand</span></a>`;
}).join('\n');

const file = join(ROOT, 'index.html');
let html = readFileSync(file, 'utf8');
const re = /(<div class="li-grid" data-li-grid[^>]*>)[\s\S]*?(\n[ \t]*<\/div>)/;
if (!re.test(html)) { console.error('Could not find the <div class="li-grid" data-li-grid> block in index.html'); process.exit(1); }

const next = html.replace(re, `$1\n${cards}$2`);
if (next === html) { console.log('index.html already in sync — no change.'); process.exit(0); }
writeFileSync(file, next);
console.log(`Synced ${posts.length} LinkedIn fallback card(s) into index.html:`);
posts.forEach((p, i) => console.log(`  ${i + 1}. ${p.image_url.split('/').pop()}`));
console.log('Review the diff, then commit index.html.');

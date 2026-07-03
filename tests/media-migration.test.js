// Media-migration parity tests: every piece of media the old WordPress site
// served must now be reachable through its new home (Supabase Storage or the
// repo's /assets/), and no reference to the doomed WordPress hosts may exist
// anywhere. Three layers:
//   1. static repo scans (always run, no network)
//   2. public-URL resolution for media referenced in the repo (network;
//      skip with SKIP_NET_TESTS=1)
//   3. DB-content sweep across ALL posts + LinkedIn cards (needs Supabase
//      secrets from .env; skipped automatically when absent, e.g. in CI)
// Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { ASSETS } from '../api/download.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// The hosts that die at cutover. NOTE: 'wp-content' alone is NOT forbidden —
// rehosted Supabase paths legitimately contain it (blog-media/wp-content/…).
const DOOMED = /(rajanandbizstg\.wpenginepowered\.com|https?:\/\/(?:www\.)?rajgoodman\.com\/wp-content)/;

function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) env[m[1]] = m[2];
    }
  } catch { /* no .env (CI) */ }
  return env;
}
const ENV = loadEnv();
const SB = ENV.SUPABASE_URL || '';
const KEY = ENV.SUPABASE_SECRET_KEY || '';
const SKIP_NET = process.env.SKIP_NET_TESTS === '1';

function repoPages() {
  const files = readdirSync(ROOT).filter((f) => f.endsWith('.html') && !f.endsWith('.updated.html'));
  files.push(join('workshops', 'tech-workshop.html'), join('admin', 'index.html'),
    join('api', '_post-template.js'), join('api', '_blog-index-template.js'),
    'common.js', 'chrome.js', join('assets', 'cookie-consent.js'), join('api', 'download.js'));
  return files.map((f) => ({ file: f, text: readFileSync(join(ROOT, f), 'utf8') }));
}

async function resolves(url) {
  let r = await fetch(url, { method: 'HEAD' });
  if (!r.ok) r = await fetch(url); // some CDNs dislike HEAD
  return r.ok;
}
async function allResolve(urls, label) {
  const failures = [];
  const list = [...urls];
  const BATCH = 8;
  for (let i = 0; i < list.length; i += BATCH) {
    await Promise.all(list.slice(i, i + BATCH).map(async (u) => {
      try { if (!(await resolves(u))) failures.push(u); }
      catch (e) { failures.push(`${u} (${e.message})`); }
    }));
  }
  assert.deepEqual(failures, [], `${label}: ${failures.length}/${urls.size ?? urls.length} unreachable`);
}

/* ---- 1. static: the repo itself ---- */

test('no page, template or script references the doomed WordPress hosts', () => {
  const offenders = [];
  for (const { file, text } of repoPages()) {
    const m = text.match(DOOMED);
    if (m) offenders.push(`${file}: ${m[0]}`);
  }
  assert.deepEqual(offenders, []);
});

test('every /assets/ file referenced by the pages exists in the repo', () => {
  const missing = new Set();
  for (const { text } of repoPages()) {
    for (const m of text.matchAll(/(?:src|href)=\\?"\/(assets\/[^"\\?#]+)/g)) {
      if (!existsSync(join(ROOT, m[1]))) missing.add(m[1]);
    }
  }
  assert.deepEqual([...missing], []);
});

/* ---- 2. network: media the repo points at must be live ---- */

test('ebook registry: all gated files are live in the downloads bucket', { skip: SKIP_NET }, async () => {
  const urls = new Set(Object.values(ASSETS).map((a) => a.url));
  assert.ok(urls.size >= 3, 'registry has the three ebooks');
  await allResolve(urls, 'ebook registry');
});

test('every Supabase media URL hard-coded in the repo resolves', { skip: SKIP_NET }, async () => {
  const urls = new Set();
  for (const { text } of repoPages()) {
    // bucket + at least one object segment (a bare bucket prefix, e.g. the
    // STORAGE constant in api/download.js, is not a fetchable object)
    for (const m of text.matchAll(/https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/[^"'\\\s)/]+\/[^"'\\\s)]+/g)) {
      urls.add(m[0]);
    }
  }
  assert.ok(urls.size >= 5, `found supabase refs in repo (got ${urls.size})`);
  await allResolve(urls, 'repo supabase refs');
});

/* ---- 3. DB content: everything the posts + widget serve (needs secrets) ---- */

const NO_DB = !SB || !KEY;
const sbHeaders = { apikey: KEY, authorization: `Bearer ${KEY}` };

test('no post (published OR draft) references a doomed WordPress host', { skip: NO_DB || SKIP_NET }, async () => {
  const r = await fetch(`${SB}/rest/v1/posts?select=slug,body_html,featured_image,og_image`, { headers: sbHeaders });
  assert.ok(r.ok, 'posts query');
  const offenders = [];
  for (const p of await r.json()) {
    const blob = `${p.body_html || ''} ${p.featured_image || ''} ${p.og_image || ''}`;
    const m = blob.match(DOOMED);
    if (m) offenders.push(`${p.slug}: ${m[0]}`);
  }
  assert.deepEqual(offenders, []);
});

test('all Supabase media referenced by any post resolves (migrated images are live)', { skip: NO_DB || SKIP_NET }, async () => {
  const r = await fetch(`${SB}/rest/v1/posts?select=slug,body_html,featured_image,og_image`, { headers: sbHeaders });
  const urls = new Set();
  for (const p of await r.json()) {
    const blob = `${p.body_html || ''} ${p.featured_image || ''} ${p.og_image || ''}`;
    for (const m of blob.matchAll(/https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/[^"'\s)]+/g)) {
      urls.add(m[0]);
    }
  }
  assert.ok(urls.size >= 20, `posts reference migrated media (got ${urls.size})`);
  await allResolve(urls, 'post media');
});

test('all LinkedIn card images resolve', { skip: NO_DB || SKIP_NET }, async () => {
  const r = await fetch(`${SB}/rest/v1/linkedin_posts?select=image_url`, { headers: sbHeaders });
  assert.ok(r.ok, 'linkedin_posts query');
  const urls = new Set((await r.json()).map((p) => p.image_url).filter(Boolean));
  assert.ok(urls.size >= 1, 'linkedin posts exist');
  await allResolve(urls, 'linkedin images');
});

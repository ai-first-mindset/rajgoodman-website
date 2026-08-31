// Cutover parity surfaces: the WordPress-era URL surface (feeds, pagination,
// hotlinked uploads) must keep working after the domain moves, and every page
// must carry the site icon. These lock in the fixes from the parity audit.
// Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { rss, esc } from '../api/feed.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

/* ---- favicon: files exist, every public page + template links them ---- */

test('favicon files exist (root .ico + PNG set)', () => {
  for (const f of ['favicon.ico', 'assets/favicon-32.png', 'assets/favicon-192.png', 'assets/apple-touch-icon.png']) {
    assert.ok(existsSync(join(ROOT, f)), f);
  }
});

test('every public page and SSR template declares the site icon', () => {
  const pages = readdirSync(ROOT).filter((f) => f.endsWith('.html') && !f.endsWith('.updated.html'));
  pages.push(join('workshops', 'tech-workshop.html'));
  const templates = [join('api', '_post-template.js'), join('api', '_blog-index-template.js'), join('api', 'render-category.js')];
  const missing = [...pages, ...templates].filter((f) => !/rel=\\?"icon\\?"/.test(read(f)));
  assert.deepEqual(missing, []);
});

/* ---- Google Search Console ownership ---- */

// Verification lives in a meta tag, NOT the HTML file Google recommends:
// cleanUrls 308-redirects every .html request (even ones that don't exist),
// and Google won't verify a file it gets redirected to. Google REVOKES
// ownership if the tag disappears, which silently kills the SEO reporting,
// so pin the exact token here.
test('homepage carries every Google Search Console verification tag', () => {
  const html = read('index.html');
  const head = html.slice(0, html.indexOf('<body'));
  const found = [...head.matchAll(/<meta\s+name="google-site-verification"\s+content="([^"]+)"\s*\/?>/gi)].map((m) => m[1]);
  // One token per Google account; dropping either revokes that person's access.
  for (const [who, token] of [
    ['raj (rajeshwar.anand@gmail.com, owner)', 'CtywK5i0Ul8MCJwyyrz6_-0j-9QK5qqMDHqZegG82Yo'],
    ['David', '-KsprLkJPmXoUUFJ0oN0rGO3ByPpUS0PUuAlLdwrFz4'],
  ]) {
    assert.ok(found.includes(token), `verification tag for ${who} is missing from <head>`);
  }
});

/* ---- vercel.json: the WP-era surface is redirected, feeds are wired ---- */

test('vercel.json preserves the WordPress URL surface', () => {
  const cfg = JSON.parse(read('vercel.json'));
  const redirects = Object.fromEntries(cfg.redirects.map((r) => [r.source, r.destination]));
  assert.match(redirects['/wp-content/uploads/:path*'] || '', /supabase\.co\/storage\/v1\/object\/public\/blog-media\/wp-content\/uploads\/:path\*/, 'hotlinked uploads redirect to Supabase');
  assert.equal(redirects['/blog/page/:n/'], '/blog/', 'blog pagination redirects');
  assert.equal(redirects['/blog/category/:slug/page/:n/'], '/blog/category/:slug/', 'category pagination redirects');
  assert.equal(redirects['/author-sitemap.xml'], '/sitemap_index.xml', 'author sitemap redirects');
  const rewrites = Object.fromEntries(cfg.rewrites.map((r) => [r.source, r.destination]));
  assert.equal(rewrites['/feed/'], '/api/feed/', 'main RSS feed wired');
  assert.equal(rewrites['/blog/feed/'], '/api/feed/', 'blog RSS alias wired');
});

test('page sitemap includes privacy-policy', () => {
  assert.match(read(join('api', 'sitemap.js')), /'\/privacy-policy\/'/);
});

/* ---- RSS generator ---- */

test('rss() renders a valid channel with one item per post', () => {
  const xml = rss([
    { slug: 'a-post', title: 'A & B <Post>', excerpt: 'Says "hi"', published_at: '2026-06-09T10:00:00Z', categories: ['AI Ethics'] },
    { slug: 'no-extras', title: 'Bare' },
  ]);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<rss version="2\.0"/);
  assert.equal((xml.match(/<item>/g) || []).length, 2);
  assert.match(xml, /<title>A &amp; B &lt;Post&gt;<\/title>/, 'titles are escaped');
  assert.match(xml, /<guid isPermaLink="true">https:\/\/rajgoodman\.com\/blog\/a-post\/<\/guid>/);
  assert.match(xml, /<pubDate>Tue, 09 Jun 2026 10:00:00 GMT<\/pubDate>/);
  assert.match(xml, /<category>AI Ethics<\/category>/);
  assert.doesNotMatch(xml, /<pubDate><\/pubDate>/, 'no empty pubDate for bare posts');
});

test('rss() with no posts still yields a valid empty channel', () => {
  const xml = rss([]);
  assert.match(xml, /<channel>[\s\S]*<\/channel>/);
  assert.equal((xml.match(/<item>/g) || []).length, 0);
});

test('esc() neutralises all XML-significant characters', () => {
  assert.equal(esc(`<&>"'`), '&lt;&amp;&gt;&quot;&apos;');
});

/* ---- homepage structured data parity ---- */

test('homepage JSON-LD includes the Organization + ContactPoint nodes', () => {
  const html = read('index.html');
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  const graph = JSON.parse(ld)['@graph'];
  const org = graph.find((n) => n['@type'] === 'Organization');
  assert.ok(org, 'Organization node present');
  assert.ok(org.contactPoint && org.contactPoint.telephone, 'ContactPoint with phone');
  assert.ok(org.logo && org.logo.url, 'logo set');
});
